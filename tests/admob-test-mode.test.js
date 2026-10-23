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
