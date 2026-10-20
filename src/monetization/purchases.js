// Purchases core (2026-10-20). Catalog-driven, with the store behind an injected gateway:
//   gateway = { available(): boolean, buy(productId) -> { ok, transactionId?, reason? },
//               restore() -> productId[] owned (non-consumables / active subscriptions) }
// Nothing here offers a purchase on its own: the UI calls buy(). The Math Wolf wraps its gateway in
// a parent gate. Consumables are granted once per transaction id (a re-reported transaction after
// a restart pays nothing twice). Non-consumables become entitlements; restore() rebuilds them
// from the store, so a refund removes them.
import { grantEntitlement, setEntitlements } from './entitlements.js';

const DELIVERED = 'ld_delivered_tx';

export function createPurchases({ gateway, catalog, onGrant = () => {}, storage = null }) {
  const byId = new Map(catalog.map(p => [p.id, p]));
  let delivered = new Set();
  try { delivered = new Set(JSON.parse(storage?.getItem(DELIVERED) ?? '[]')); } catch { /* fresh */ }
  const remember = (tx) => {
    delivered.add(tx);
    try { storage?.setItem(DELIVERED, JSON.stringify([...delivered].slice(-200))); } catch { /* unavailable */ }
  };

  function deliver(productId, transactionId) {
    const p = byId.get(productId);
    if (!p || !transactionId || delivered.has(transactionId)) return false;
    remember(transactionId);
    if (p.grant?.entitlement) grantEntitlement(p.grant.entitlement);
    if (p.type === 'consumable') onGrant(p.grant, p);
    return true;
  }

  return {
    catalog: () => [...byId.values()],
    deliver,
    async buy(productId) {
      if (!byId.has(productId)) return { ok: false, reason: 'unknown_product' };
      if (!gateway?.available?.()) return { ok: false, reason: 'unavailable' };
      let r;
      try { r = await gateway.buy(productId); } catch { return { ok: false, reason: 'error' }; }
      if (!r?.ok) return { ok: false, reason: r?.reason ?? 'error' };
      deliver(productId, r.transactionId);
      return { ok: true, transactionId: r.transactionId };
    },
    async restore() {
      if (!gateway?.available?.()) return false;
      let owned;
      try { owned = await gateway.restore(); } catch { return false; }   // offline: keep the cache
      setEntitlements(owned.map(id => byId.get(id)?.grant?.entitlement).filter(Boolean));
      return true;
    },
  };
}
