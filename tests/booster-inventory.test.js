// Owned boosters must survive levels: the shop used to sell boosters that the
// next level start wiped. A level debits the inventory only by what it spent,
// ad-granted (level-only) boosters first.
import { describe, it, expect, beforeEach } from 'vitest';
import { inventorySpent } from '../src/game/BoosterInventory.js';

describe('inventorySpent', () => {
  it('spends nothing when every owned booster is still there', () => {
    expect(inventorySpent({ colorChange: 2, freeze: 1, bombs: 0 }, { colorChange: 3, freeze: 1, bombs: 0 }))
      .toEqual({ colorChange: 0, freeze: 0, bombs: 0 });
  });
  it('uses the ad grant before owned boosters', () => {
    // took 2 owned + 1 granted = 3; used 1 → the granted one; owned untouched
    expect(inventorySpent({ colorChange: 2 }, { colorChange: 2 }).colorChange).toBe(0);
    // used 2 of 3 → 1 granted + 1 owned
    expect(inventorySpent({ colorChange: 2 }, { colorChange: 1 }).colorChange).toBe(1);
  });
  it('debits everything owned when the level used it all', () => {
    expect(inventorySpent({ freeze: 3 }, { freeze: 0 }).freeze).toBe(3);
  });
  it('never goes negative', () => {
    expect(inventorySpent({ bombs: 0 }, { bombs: 5 }).bombs).toBe(0);
  });
});

describe('ProgressManager inventory', () => {
  beforeEach(() => {
    const store = {};
    globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  });
  it('persists purchases and clamps debits at zero', async () => {
    const { ProgressManager } = await import('../src/game/ProgressManager.js');
    const p = new ProgressManager();
    p.addInventory('freeze', 2);
    p.addInventory('bombs', 1);
    expect(new ProgressManager().getInventory()).toMatchObject({ freeze: 2, bombs: 1 });
    p.addInventory('freeze', -5);
    expect(new ProgressManager().getInventory().freeze).toBe(0);
  });
});

import { inventorySpentByUse } from '../src/game/BoosterInventory.js';
import { BoosterState } from '../src/game/BoosterState.js';
describe('inventorySpentByUse (settle by use, not by remaining)', () => {
  it('debits owned boosters even when in-level earns refilled the counts', () => {
    // took 2 owned freezes, used both, earned 2 more: remaining-based settle debits 0
    expect(inventorySpentByUse({ freeze: 2 }, {}, { freeze: 2 }).freeze).toBe(2);
  });
  it('spends the level-only ad grant first and never debits more than was taken', () => {
    expect(inventorySpentByUse({ bombs: 1 }, { bombs: 1 }, { bombs: 1 }).bombs).toBe(0);
    expect(inventorySpentByUse({ bombs: 1 }, { bombs: 1 }, { bombs: 2 }).bombs).toBe(1);
    expect(inventorySpentByUse({ bombs: 1 }, {}, { bombs: 5 }).bombs).toBe(1);
  });
  it('BoosterState counts only charges actually consumed', () => {
    const b = new BoosterState();
    b.freeze = 2; b.bombs = 1; b.colorChange = 1;
    b.activateFreeze(); b.activateBomb(); b.cancelBomb();
    expect(b.used).toEqual({ colorChange: 0, freeze: 1, bombs: 0 });
    b.consumeBomb(); b.consumeColorChange();
    expect(b.used).toEqual({ colorChange: 1, freeze: 1, bombs: 1 });
  });
});
