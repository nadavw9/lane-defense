import { describe, it, expect } from 'vitest';
import { interstitialWindowOpen, isInterstitialTurn, INTERSTITIAL_FIRST_LEVEL, INTERSTITIAL_MIN_GAP_MS, AFTER_REWARDED_GRACE_MS } from '../src/ads/adPolicy.js';

const base = { now: 10_000_000, lastInterstitial: 0, lastRewarded: 0, levelId: 20 };

describe('interstitial pacing', () => {
  it('window is open when everything allows it', () => { expect(interstitialWindowOpen(base)).toBe(true); });
  it('never during the learning levels', () => {
    expect(interstitialWindowOpen({ ...base, levelId: INTERSTITIAL_FIRST_LEVEL - 1 })).toBe(false);
    expect(interstitialWindowOpen({ ...base, levelId: INTERSTITIAL_FIRST_LEVEL })).toBe(true);
  });
  it('a missing or non-numeric level id never opens the window', () => {
    expect(interstitialWindowOpen({ ...base, levelId: 0 })).toBe(false);
    expect(interstitialWindowOpen({ ...base, levelId: 'daily' })).toBe(false);
    expect(interstitialWindowOpen({ ...base, levelId: undefined })).toBe(false);
  });
  it('respects the minimum gap', () => {
    expect(interstitialWindowOpen({ ...base, lastInterstitial: base.now - INTERSTITIAL_MIN_GAP_MS + 1 })).toBe(false);
    expect(interstitialWindowOpen({ ...base, lastInterstitial: base.now - INTERSTITIAL_MIN_GAP_MS })).toBe(true);
  });
  it('leaves the player alone right after a rewarded ad', () => {
    expect(interstitialWindowOpen({ ...base, lastRewarded: base.now - AFTER_REWARDED_GRACE_MS + 1 })).toBe(false);
  });
  it('every second eligible moment shows', () => {
    expect([1, 2, 3, 4].map(isInterstitialTurn)).toEqual([false, true, false, true]);
  });
});
