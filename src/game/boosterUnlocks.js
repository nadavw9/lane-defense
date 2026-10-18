// boosterUnlocks — WHEN each booster exists for the player. One schedule, read by the
// in-level bar, the level card, the shop, the win-streak / mercy / gift-car payouts and
// the in-play earns, so no path can hand out (or show) a booster the game has not
// introduced yet.
//
// Pacing (2026-10-18, owner-approved, re-spaced after the top-games research the same day):
// one new thing per level with a quiet level between, boosters one at a time, nothing new
// on a HARD level.
//   BOMB         L1   earned in play (every KILLS_PER_BOMB kills) and taught with a pointer
//   FREEZE       L8   3 free on arrival, first use guided; offered before levels from L9
//   COLOR SWAP   L21  3 free on arrival, first use guided; offered before levels from L22
//   RAINBOW      L33  the earned rainbow bomb (3 multi-kill shots) starts here
// Nothing is offered for an ad before OFFERS_FROM (leaders unlock boosters at L6-8), and the
// win-streak gift waits for WIN_STREAK_FROM (Royal Match's starts at L32).
//
// "Reached" is the furthest the player has got: max(level being played, unlockedLevel).
// Replaying L3 after reaching L20 has every booster. The daily challenge is not a
// numeric level, so it uses only unlockedLevel.

export const BOOSTER_UNLOCK_LEVEL = Object.freeze({ bombs: 1, freeze: 8, colorChange: 21 });
export const RAINBOW_FROM = 33;
export const OFFERS_FROM = 6;                      // first level a booster may be offered
export const WIN_STREAK_FROM = 30;                 // first level the win streak shows and pays
export const UNLOCK_GIFT = 3;                       // free boosters on arrival
export const BOOSTER_KEYS = Object.freeze(['colorChange', 'freeze', 'bombs']);

export function reachedLevel(levelId, unlockedLevel = 0) {
  const u = Number.isFinite(unlockedLevel) ? unlockedLevel : 0;
  return typeof levelId === 'number' ? Math.max(levelId, u) : u;
}

/** The booster exists on this level: shown live in the bar, earnable, spendable. */
export function boosterUnlocked(key, levelId, unlockedLevel = 0) {
  const at = BOOSTER_UNLOCK_LEVEL[key];
  return at != null && reachedLevel(levelId, unlockedLevel) >= at;
}

/**
 * The booster may be offered BEFORE a level (rewarded video, mercy gift, streak gift).
 * Strictly after its arrival level: the arrival level teaches it with free ones instead.
 */
export function boosterOffered(key, levelId, unlockedLevel = 0) {
  const at = BOOSTER_UNLOCK_LEVEL[key];
  const r = reachedLevel(levelId, unlockedLevel);
  return at != null && r > at && r >= OFFERS_FROM;
}

/** The win streak (and its free boosters) is live once the player has reached WIN_STREAK_FROM. */
export function winStreakOn(levelId, unlockedLevel = 0) {
  return reachedLevel(levelId, unlockedLevel) >= WIN_STREAK_FROM;
}

/** The level a booster arrives on, for the locked "LV 8" tag. */
export function unlockLevelOf(key) { return BOOSTER_UNLOCK_LEVEL[key] ?? null; }

/** { colorChange, freeze, bombs } booleans for one level (what GameState carries). */
export function unlocksFor(levelId, unlockedLevel = 0) {
  return {
    colorChange: boosterUnlocked('colorChange', levelId, unlockedLevel),
    freeze:      boosterUnlocked('freeze', levelId, unlockedLevel),
    bombs:       boosterUnlocked('bombs', levelId, unlockedLevel),
    rainbow:     reachedLevel(levelId, unlockedLevel) >= RAINBOW_FROM,
  };
}

/** Drop every booster from a bundle that is not offered on this level. */
export function filterOffered(bundle, levelId, unlockedLevel = 0) {
  if (!bundle) return bundle;
  const out = { colorChange: 0, freeze: 0, bombs: 0 };
  let any = false;
  for (const k of BOOSTER_KEYS) {
    if ((bundle[k] ?? 0) > 0 && boosterOffered(k, levelId, unlockedLevel)) { out[k] = bundle[k]; any = true; }
  }
  return any ? out : null;
}

/**
 * The booster that arrives on this level (first time only — the caller checks the
 * once-ever flag), or null. Bombs arrive by being earned, not gifted.
 */
export function arrivingBooster(levelId) {
  if (typeof levelId !== 'number') return null;
  for (const k of ['freeze', 'colorChange']) if (BOOSTER_UNLOCK_LEVEL[k] === levelId) return k;
  return null;
}
