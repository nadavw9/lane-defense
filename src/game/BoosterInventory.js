// BoosterInventory — how much of the player's OWNED boosters a level spent.
//
// A level starts with its ad grant (level-only) plus `taken` owned boosters.
// When it ends, `left` of each kind remain. The ad grant is spent first, so the
// owned units still unspent are min(left, taken), and the inventory is debited
// by the rest. Pure: no state, safe to test headless.
export const BOOSTER_KEYS = ['colorChange', 'freeze', 'bombs'];

export function inventorySpent(taken, left) {
  const out = {};
  for (const k of BOOSTER_KEYS) {
    const t = Math.max(0, taken?.[k] ?? 0);
    const l = Math.max(0, left?.[k] ?? 0);
    out[k] = t - Math.min(l, t);
  }
  return out;
}

// Settle by USE, not by what is left: in-level earns (freeze from a 3-kill shot, bombs,
// colour change) top the remaining counts back up, so `inventorySpent` reads "nothing
// spent" for a player who used their owned boosters and earned replacements. The level's
// ad grant is level-only and is spent first; whatever use is left over comes out of the
// owned stock, never more than was taken.
export function inventorySpentByUse(taken, grant, used) {
  const out = {};
  for (const k of BOOSTER_KEYS) {
    const t = Math.max(0, taken?.[k] ?? 0);
    const g = Math.max(0, grant?.[k] ?? 0);
    const u = Math.max(0, used?.[k] ?? 0);
    out[k] = Math.min(t, Math.max(0, u - g));
  }
  return out;
}
