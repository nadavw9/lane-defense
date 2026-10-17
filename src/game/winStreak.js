// Win streak — the reward for winning levels back to back (the Royal Match / Toon Blast loop):
// every consecutive win makes the next level start a little stronger, and losing it is a real
// cost, so a CONTINUE that keeps the streak alive is worth something.
//
// Rules: a win on a numbered level adds one; a final loss or quitting a level resets it to 0.
// The daily challenge neither adds nor resets. The gift is free and comes on top of anything
// the player picks on the pre-level card. Bombs are never gifted: a lane clear per level would
// flatten the late game.

export const STREAK_TIERS = [
  { min: 4, gift: { colorChange: 1, freeze: 1, bombs: 0 } },
  { min: 2, gift: { colorChange: 0, freeze: 1, bombs: 0 } },
];

/** Boosters the next level starts with for this streak, or null below the first tier. */
export function streakGift(streak) {
  const n = Number.isFinite(streak) ? streak : 0;
  const tier = STREAK_TIERS.find(t => n >= t.min);
  return tier ? { ...tier.gift } : null;
}

/** Wins still needed to reach the next tier (0 when already at the top). */
export function winsToNextTier(streak) {
  const n = Number.isFinite(streak) ? streak : 0;
  const next = [...STREAK_TIERS].reverse().find(t => n < t.min);
  return next ? next.min - n : 0;
}

/** Sum two booster bundles; either may be null. */
export function addBundles(a, b) {
  const z = { colorChange: 0, freeze: 0, bombs: 0 };
  for (const k of Object.keys(z)) z[k] = (a?.[k] ?? 0) + (b?.[k] ?? 0);
  return z;
}
