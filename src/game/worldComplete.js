// World complete — WHEN the end-of-world ceremony plays and WHAT it gives (pure; the screen is
// src/screens/WorldCompleteScreen.js). Owner request 2026-10-23: finishing L15 went straight
// into L16 with no sense of having finished a world.
//
// Modelled on Royal Match's area chest, Candy Crush's episode outro and Cut the Rope's
// "box complete": the normal win screen first, then on NEXT a WORLD COMPLETE moment with the
// world's stars, a gift the player taps open, and a title card for the next world before the
// map drive. Once per world, on the FIRST clear of its last level, never on a replay.

import { MAP_WORLDS, worldForLevel } from '../screens/levelMapLayout.js';
import { boosterUnlocked } from './boosterUnlocks.js';

export const WORLD_REWARD_COINS = 100;

// One honest line about what the next world brings (introSchedule.js / LevelManager /
// LateLevels). Keyed by map page. Only things that really arrive in that world.
export const WORLD_TEASER = {
  2:  'Yellow cars, gift cars, traffic lights and the new COLOR SWAP booster.',
  3:  'Rainbow bombs, plated cars and convoys.',
  4:  'Menders, chameleons, and orange and purple bombs.',
  5:  'Phantom cars hide their color in the fog.',
  6:  'Volatile cargo: one blast pushes every other lane forward.',
  7:  'The last stretch: everything at once.',
};
const TOUR_TEASER = 'Second tour: the same roads, much heavier traffic.';

export function worldTeaser(page) { return WORLD_TEASER[page] ?? TOUR_TEASER; }

/**
 * The ceremony for this win, or null. `firstClear` = the level had no stars before this win.
 * `seen(page)` = the ceremony for that world already played.
 */
export function worldCompleteFor(levelId, { firstClear, seen = () => false }) {
  if (typeof levelId !== 'number' || !firstClear) return null;
  const world = worldForLevel(levelId);
  if (!world || levelId !== world.last) return null;
  const next = MAP_WORLDS[world.page];          // page is 1-based: the next world's index
  if (!next) return null;                        // the final world: the win screen's finale covers it
  if (seen(world.page)) return null;
  return { world, next };
}

/** The gift: coins plus one of every booster the player has by the next world's first level. */
export function worldReward(next) {
  const boosters = {};
  for (const key of ['bombs', 'freeze', 'colorChange']) if (boosterUnlocked(key, next.first)) boosters[key] = 1;
  return { coins: WORLD_REWARD_COINS, boosters };
}
