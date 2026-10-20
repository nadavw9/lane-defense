// Purchases core (src/monetization): generic entitlements + a catalog-driven purchase flow with an
// injected store gateway. Shared with The Math Wolf (its gateway sits behind a parent gate).
import { describe, it, expect, beforeEach } from 'vitest';
import { configureEntitlements, hasEntitlement, setEntitlements } from '../src/monetization/entitlements.js';
import { createPurchases } from '../src/monetization/purchases.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const CATALOG = [
  { id: 'remove_ads', type: 'nonconsumable', grant: { entitlement: 'remove_ads' } },
  { id: 'coins_500',  type: 'consumable',    grant: { coins: 500 } },
];
function fakeGateway({ available = true, owned = [] } = {}) {
  let n = 0;
  return { calls: [], available: () => available,
    async buy(id) { this.calls.push(id); return { ok: true, transactionId: `t${++n}` }; },
    async restore() { return owned; } };
}

beforeEach(() => configureEntitlements(mem()));

describe('entitlements', () => {
  it('are any string key, off until granted, and survive a reload from the same storage', () => {
    const s = mem(); configureEntitlements(s);
    expect(hasEntitlement('remove_ads')).toBe(false);
    setEntitlements(['remove_ads', 'family_plan']);
    configureEntitlements(s);
    expect(hasEntitlement('family_plan')).toBe(true);
    expect(hasEntitlement('nope')).toBe(false);
  });
  it('a broken store reads as nothing owned, never as everything', () => {
    configureEntitlements({ getItem() { return '{bad json'; }, setItem() {} });
    expect(hasEntitlement('remove_ads')).toBe(false);
  });
});

describe('purchases', () => {
  it('a bought non-consumable becomes an entitlement', async () => {
    const p = createPurchases({ gateway: fakeGateway(), catalog: CATALOG, storage: mem() });
    expect(await p.buy('remove_ads')).toMatchObject({ ok: true });
    expect(hasEntitlement('remove_ads')).toBe(true);
  });
  it('a consumable pays its grant once per transaction', async () => {
    const grants = [];
    const p = createPurchases({ gateway: fakeGateway(), catalog: CATALOG, storage: mem(), onGrant: (g) => grants.push(g) });
    await p.buy('coins_500');
    expect(grants).toEqual([{ coins: 500 }]);
    p.deliver('coins_500', 't1');          // the same transaction reported again (app restart, listener re-fire)
    expect(grants.length).toBe(1);
  });
  it('no store, unknown product: refused, nothing granted, gateway never called', async () => {
    const gw = fakeGateway({ available: false });
    const p = createPurchases({ gateway: gw, catalog: CATALOG, storage: mem() });
    expect(await p.buy('remove_ads')).toEqual({ ok: false, reason: 'unavailable' });
    const p2 = createPurchases({ gateway: fakeGateway(), catalog: CATALOG, storage: mem() });
    expect(await p2.buy('free_money')).toEqual({ ok: false, reason: 'unknown_product' });
    expect(gw.calls).toEqual([]);
    expect(hasEntitlement('remove_ads')).toBe(false);
  });
  it('restore rebuilds entitlements from what the store says is owned (and only that)', async () => {
    setEntitlements(['remove_ads']);
    const p = createPurchases({ gateway: fakeGateway({ owned: [] }), catalog: CATALOG, storage: mem() });
    await p.restore();
    expect(hasEntitlement('remove_ads')).toBe(false);   // refunded: the store is the source of truth
    const p2 = createPurchases({ gateway: fakeGateway({ owned: ['remove_ads'] }), catalog: CATALOG, storage: mem() });
    await p2.restore();
    expect(hasEntitlement('remove_ads')).toBe(true);
  });
  it('a cancelled or failed purchase grants nothing', async () => {
    const gw = { available: () => true, buy: async () => ({ ok: false, reason: 'cancelled' }), restore: async () => [] };
    const p = createPurchases({ gateway: gw, catalog: CATALOG, storage: mem() });
    expect(await p.buy('remove_ads')).toEqual({ ok: false, reason: 'cancelled' });
    expect(hasEntitlement('remove_ads')).toBe(false);
  });
});
