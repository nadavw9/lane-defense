// Dynamic difficulty assist (DDA) — §3d "fail-streak mercy".
//
// An INVISIBLE assist for a player who keeps losing the same level: after 2
// consecutive fails, quietly soften the level's hpMultiplier so cars die in
// fewer hits. No "easy mode" label, no announcement — the player just finds
// the wall a little lower.
//
// HARD CONSTRAINT (see FABLE_EXIT_BRIEF §1): this factor is applied ONLY to the
// Director's COPY of the level config at level start (GameApp._startLevel). It
// must NEVER touch LevelManager's configs — those are the balance source of
// truth, and the sim reads them at BASE difficulty. If the sim ever saw DDA,
// every tuned number this project relies on would be meaningless. The
// SimulationRunner has no code path to this module, and a static tripwire test
// keeps it that way.

// Mercy engages at 2 consecutive fails; each further fail compounds ×0.9,
// clamped so it can never dig below FLOOR (0.9^3 = 0.729 → 0.73 by ~streak 4).
const MERCY_STREAK = 2;
const STEP         = 0.9;
const FLOOR        = 0.73;

// Multiplier applied to hpMultiplier for a given consecutive-fail streak.
//   streak 0-1 → 1.0 (no mercy)   streak 2 → 0.90   streak 3 → 0.81
//   streak 4 → 0.73 (0.729 clamped)   streak 5+ → 0.73
export function ddaFactor(failStreak) {
  const streak = Math.max(0, Math.floor(failStreak ?? 0));
  if (streak < MERCY_STREAK) return 1;
  return Math.max(FLOOR, STEP ** (streak - 1));
}

// Build the Director's world-config copy for a level start. This is the ONE
// place the copy is made — GameApp._startLevel and the integrity tests both
// call it, so "the copy shares no reference with LevelManager and the mercy
// factor lands on hpMultiplier" is guaranteed by construction, not by two
// implementations agreeing. Returns a fresh object that aliases NOTHING in
// `worldConfig` (nested `speed` copied too — a shallow spread would still
// share it). `failStreak` 0-1 yields an exact-value copy (factor 1.0).
export function applyDda(worldConfig, failStreak) {
  return {
    ...worldConfig,
    speed: { ...worldConfig.speed },
    hpMultiplier: worldConfig.hpMultiplier * ddaFactor(failStreak),
  };
}
