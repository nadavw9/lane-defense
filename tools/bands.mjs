// Target win-rate bands per level, shared by balance-sim.js and tune-levels.mjs so
// the two cannot drift. Reference profile: skill=average, boosterIQ 0.70.
//   tutorial L1-3 exempt · L4-9 85-95 · mid non-boss to L26 70-82 · to L45 60-75
//   · later worlds step down 2 points each (58-72, 56-70, 54-68, 52-66), never
//   below that: an average player should still win a late level about half the time.
//   Bosses 40-55 everywhere.
import { isBossLevel } from '../src/game/LevelManager.js';

export const TUTORIAL_LEVELS = new Set([1, 2, 3]);

export function bandFor(levelId) {
  if (TUTORIAL_LEVELS.has(levelId)) return { lo: 85, hi: 100, tutorial: true };
  if (isBossLevel(levelId)) return { lo: 40, hi: 55, boss: true };
  if (levelId <= 9)  return { lo: 85, hi: 95, boss: false };
  if (levelId <= 26) return { lo: 70, hi: 82, boss: false };
  if (levelId <= 45) return { lo: 60, hi: 75, boss: false };
  const step = Math.min(4, Math.floor((levelId - 46) / 15) + 1);   // worlds 4..7
  return { lo: 60 - 2 * step, hi: 75 - 2 * step, boss: false };
}
