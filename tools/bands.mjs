// Target win-rate bands per level, shared by balance-sim.js and tune-levels.mjs so
// the two cannot drift. Reference profile: skill=average, boosterIQ 0.70.
//   tutorial L1-3 exempt · L4-9 85-95 · mid non-boss to L26 70-82 · to L45 60-75
//   · later worlds step down 2 points each (58-72, 56-70, 54-68, 52-66), never
//   below that: an average player should still win a late level about half the time.
//   Big waves (every tenth level): the ordinary band minus 10 points.
import { isMilestoneLevel } from '../src/game/LevelManager.js';

export const TUTORIAL_LEVELS = new Set([1, 2, 3]);

function baseBand(levelId) {
  if (TUTORIAL_LEVELS.has(levelId)) return { lo: 85, hi: 100, tutorial: true };
  if (levelId <= 9)  return { lo: 85, hi: 95 };
  if (levelId <= 26) return { lo: 70, hi: 82 };
  if (levelId <= 45) return { lo: 60, hi: 75 };
  const step = Math.min(4, Math.floor((levelId - 46) / 15) + 1);   // worlds 4..7
  return { lo: 60 - 2 * step, hi: 75 - 2 * step };
}

// A BIG WAVE (every tenth level) is meant to be the hardest level of its block: its
// band is ten points under the ordinary band for that part of the campaign.
export function bandFor(levelId) {
  const b = baseBand(levelId);
  if (isMilestoneLevel(levelId)) return { lo: b.lo - 10, hi: b.hi - 10, milestone: true };
  return b;
}
