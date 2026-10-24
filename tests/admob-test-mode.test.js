// Tester builds must never show a real ad. initializeForTesting with an empty
// testingDevices list registers nothing, so until 2026-10-20 every Play internal build
// ("ads-test") served LIVE ads from the production unit IDs. The plugin only swaps in
// Google's test unit when each ad request carries isTesting: true.
import { describe, it, expect, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
const prepareRewardVideoAd = vi.fn(() => new Promise(() => {}));
const prepareInterstitial = vi.fn(() => new Promise(() => {}));
vi.mock('@capacitor-community/admob', () => ({
  AdMob: {
    addListener: vi.fn(() => { const p = Promise.resolve({ remove() {} }); p.remove = () => {}; return p; }),
    prepareRewardVideoAd, prepareInterstitial,
  },
  RewardAdPluginEvents: {}, InterstitialAdPluginEvents: {}, AdmobConsentStatus: {},
}));

const { AdManager, adOptions } = await import('../src/ads/AdManager.js');

describe('ad requests in test mode', () => {
  it('adOptions carries isTesting from the build mode', () => {
    expect(adOptions('x', true)).toEqual({ adId: 'x', isTesting: true });
    expect(adOptions('x', false)).toEqual({ adId: 'x', isTesting: false });
  });

  it('a non-live build asks for test ads on rewarded and interstitial requests', async () => {
    const ads = new AdManager();
    ads._native = true;
    ads.showRewarded(() => {}, () => {});
    expect(prepareRewardVideoAd).toHaveBeenCalledWith(expect.objectContaining({ isTesting: true }));

    ads._lastInterstitial = 0; ads._lastRewarded = 0; ads._eligibleCount = 1;
    ads.showInterstitial(99);
    await Promise.resolve();
    expect(prepareInterstitial).toHaveBeenCalledWith(expect.objectContaining({ isTesting: true }));
  });
});

describe('ad unavailable feedback', () => {
  it('tells the app when no rewarded ad can be shown, and still calls onDismissed', () => {
    const m = new AdManager();
    m._native = false;                 // consent unresolved / init failed on device
    const unavailable = vi.fn(); const dismissed = vi.fn(); const complete = vi.fn();
    m.onUnavailable = unavailable;
    m.showRewarded(complete, dismissed);
    expect(unavailable).toHaveBeenCalledTimes(1);
    expect(dismissed).toHaveBeenCalledTimes(1);
    expect(complete).not.toHaveBeenCalled();
  });
});

describe('ad units per platform (iOS)', async () => {
  const { adUnitIds, testAdsFor } = await import('../src/ads/AdManager.js');
  const live = { DEV: false, VITE_ADS_MODE: 'live' };
  it('Android uses its own units; a live Android build serves live ads', () => {
    expect(adUnitIds('android').rewarded).toMatch(/^ca-app-pub-3810333742263149\//);
    expect(testAdsFor(live, 'android')).toBe(false);
  });
  it('iOS without its own units stays on test ads even in a live build', () => {
    expect(adUnitIds('ios', {})).toEqual({ rewarded: null, interstitial: null });
    expect(testAdsFor(live, 'ios', {})).toBe(true);
    expect(testAdsFor(live, 'ios', { rewarded: 'ca-app-pub-1/1' })).toBe(true);   // both are needed
  });
  it('iOS with both units serves live ads only in a live build', () => {
    const ios = { rewarded: 'ca-app-pub-1/1', interstitial: 'ca-app-pub-1/2' };
    expect(testAdsFor(live, 'ios', ios)).toBe(false);
    expect(testAdsFor({ DEV: false, VITE_ADS_MODE: 'test' }, 'ios', ios)).toBe(true);
  });
});
