// adPolicy — when an interstitial may appear. Pure, so the pacing is testable.
//
// Fair-play rules: never in the learning levels, never right after the player
// chose to watch a rewarded ad, never twice within two minutes, and only on every
// second eligible moment — a loss streak should not become an ad streak.

export const INTERSTITIAL_FIRST_LEVEL = 8;       // no interstitials before this level
export const INTERSTITIAL_MIN_GAP_MS = 120_000;
export const AFTER_REWARDED_GRACE_MS  = 120_000;
export const INTERSTITIAL_EVERY       = 2;       // every Nth eligible moment

/**
 * Is an interstitial allowed at all right now? `levelId` must be the player's REAL
 * progress (the level being played, or for the daily challenge the highest level
 * they have unlocked) so a brand-new player never sees one through the daily.
 * @param {{ now:number, lastInterstitial:number, lastRewarded:number, levelId:number }} s
 */
export function interstitialWindowOpen(s) {
  if (!(s.levelId >= INTERSTITIAL_FIRST_LEVEL)) return false;
  if (s.now - s.lastInterstitial < INTERSTITIAL_MIN_GAP_MS) return false;
  if (s.now - s.lastRewarded < AFTER_REWARDED_GRACE_MS) return false;
  return true;
}

/** Of the moments that pass the window, only every Nth shows an ad. */
export function isInterstitialTurn(eligibleCount) {
  return eligibleCount % INTERSTITIAL_EVERY === 0;
}
