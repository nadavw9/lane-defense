// Target win-rate bands per level, shared by balance-sim.js and tune-levels.mjs so
// the two cannot drift. Reference profile: skill=average, boosterIQ 0.70.
//   tutorial L1-3 exempt · L4-9 80-90 · mid non-boss to L26 66-78 · to L45 60-75
//   · later worlds step down 2 points each (58-72, 56-70, 54-68, 52-66), never
//   below that: an average player should still win a late level about half the time.
//   Big waves (every tenth level): the ordinary band minus 10 points.
import { levelDifficulty, isReliefLevel } from '../src/game/LevelManager.js';

export const TUTORIAL_LEVELS = new Set([1, 2, 3]);

function baseBand(levelId) {
  if (TUTORIAL_LEVELS.has(levelId)) return { lo: 85, hi: 100, tutorial: true };
  if (levelId <= 9)  return { lo: 80, hi: 90 };   // 2026-10-22: a touch harder, the owner found the start too easy
  if (levelId <= 26) return { lo: 66, hi: 78 };
  if (levelId <= 45) return { lo: 60, hi: 75 };
  const step = Math.min(4, Math.floor((levelId - 46) / 15) + 1);   // worlds 4..7
  return { lo: 60 - 2 * step, hi: 75 - 2 * step };
}

// Sawtooth (2026-10-17), the shape casual puzzle games use: ordinary levels sit in the band
// above, HARD levels (every x5 from L15, and the L10/L20 big waves) 15 points under it, SUPER HARD
// big waves (L30 on) 25 under, and the level after a hard one is a RELIEF level 6 points over
// (capped at 95). Failing a hard level is the moment a continue or a booster is worth paying for;
// the relief level after it gives the win back.
export function bandFor(levelId) {
  const b = baseBand(levelId);
  if (b.tutorial) return b;
  const d = levelDifficulty(levelId);
  if (d === 'superhard') return { lo: b.lo - 25, hi: b.hi - 25, milestone: true, tier: d };
  // L10 is the player's FIRST hard level (2026-10-18 pacing): a softer step, 8 under not 15.
  if (d === 'hard') { const off = levelId === 10 ? 8 : 15; return { lo: b.lo - off, hi: b.hi - off, tier: d }; }
  if (isReliefLevel(levelId)) return { lo: Math.min(88, b.lo + 6), hi: Math.min(95, b.hi + 6), tier: 'relief' };
  return b;
}
