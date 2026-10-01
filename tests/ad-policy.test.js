import { describe, it, expect } from 'vitest';
import { shouldShowInterstitial, INTERSTITIAL_FIRST_LEVEL, INTERSTITIAL_MIN_GAP_MS, AFTER_REWARDED_GRACE_MS } from '../src/ads/adPolicy.js';

const base = { now: 10_000_000, lastInterstitial: 0, lastRewarded: 0, levelId: 20, eligibleCount: 2 };

describe('interstitial pacing', () => {
  it('shows when everything allows it', () => { expect(shouldShowInterstitial(base)).toBe(true); });
  it('never during the learning levels', () => {
    expect(shouldShowInterstitial({ ...base, levelId: INTERSTITIAL_FIRST_LEVEL - 1 })).toBe(false);
    expect(shouldShowInterstitial({ ...base, levelId: INTERSTITIAL_FIRST_LEVEL })).toBe(true);
  });
  it('daily challenge is not gated by level number', () => {
    expect(shouldShowInterstitial({ ...base, levelId: 'daily' })).toBe(true);
  });
  it('respects the minimum gap', () => {
    expect(shouldShowInterstitial({ ...base, lastInterstitial: base.now - INTERSTITIAL_MIN_GAP_MS + 1 })).toBe(false);
    expect(shouldShowInterstitial({ ...base, lastInterstitial: base.now - INTERSTITIAL_MIN_GAP_MS })).toBe(true);
  });
  it('leaves the player alone right after a rewarded ad', () => {
    expect(shouldShowInterstitial({ ...base, lastRewarded: base.now - AFTER_REWARDED_GRACE_MS + 1 })).toBe(false);
  });
  it('only every second eligible moment', () => {
    expect(shouldShowInterstitial({ ...base, eligibleCount: 1 })).toBe(false);
    expect(shouldShowInterstitial({ ...base, eligibleCount: 3 })).toBe(false);
    expect(shouldShowInterstitial({ ...base, eligibleCount: 4 })).toBe(true);
  });
});
