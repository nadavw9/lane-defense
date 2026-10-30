// Target win-rate bands per level, shared by balance-sim.js and tune-levels.mjs so
// the two cannot drift. Reference profile (2026-10-30): skill=human — the player's own
// move set (a mismatched drop bounces back, no column cycling, boosterIQ 0.90), with
// lane barriers and no crisis assist. Numbers are the owner's first call
// (docs/superpowers/specs/2026-10-30-lane-barriers-design.md §3.6); refine after device play.
//   tutorial L1-3 90-100 · L4-9 70-80 · to L26 62-72 · to L45 58-68
//   · later worlds step down 2 points each (56-66, 54-64, 52-62, 50-60), never below that.
import { levelDifficulty, isReliefLevel } from '../src/game/LevelManager.js';

export const TUTORIAL_LEVELS = new Set([1, 2, 3]);

function baseBand(levelId) {
  if (TUTORIAL_LEVELS.has(levelId)) return { lo: 90, hi: 100, tutorial: true };
  if (levelId <= 9)  return { lo: 70, hi: 80 };
  if (levelId <= 26) return { lo: 62, hi: 72 };
  if (levelId <= 45) return { lo: 58, hi: 68 };
  const step = Math.min(4, Math.floor((levelId - 46) / 15) + 1);   // worlds 4..7 (and the second tour)
  return { lo: 58 - 2 * step, hi: 68 - 2 * step };
}

// Sawtooth (2026-10-17), the shape casual puzzle games use: ordinary levels sit in the band
// above, HARD levels (every x5 from L15, and the L10/L20 big waves) 15 points under it, SUPER HARD
// big waves (L50 on) 25 under, and the level after a hard one is a RELIEF level 6 points over
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
