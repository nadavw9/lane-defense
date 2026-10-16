// A native rewarded ad takes a moment to load. Tapping CONTINUE twice in that
// window used to stack two listener sets on the one ad, so the single reward
// fired the rescue twice (and the second destroy() hit a null overlay).
import { describe, it, expect, vi } from 'vitest';

const handlers = {};
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('@capacitor-community/admob', () => {
  const addListener = vi.fn((ev, fn) => {
    (handlers[ev] ??= []).push(fn);
    const p = Promise.resolve({ remove: () => {} });
    p.remove = () => { handlers[ev] = handlers[ev].filter(f => f !== fn); };
    return p;
  });
  return {
    AdMob: { addListener, prepareRewardVideoAd: vi.fn(() => new Promise(() => {})), showRewardVideoAd: vi.fn() },
    RewardAdPluginEvents: { Rewarded: 'rewarded', Dismissed: 'dismissed', FailedToLoad: 'ftl', FailedToShow: 'fts' },
    InterstitialAdPluginEvents: {}, AdmobConsentStatus: {},
  };
});

const { AdManager } = await import('../src/ads/AdManager.js');

describe('rewarded ad — one at a time', () => {
  it('a second request while one is loading is ignored; the reward fires once', () => {
    const ads = new AdManager();
    ads._native = true;
    const done = vi.fn();
    ads.showRewarded(done, null);
    ads.showRewarded(done, null);           // impatient double tap
    (handlers.rewarded ?? []).slice().forEach(f => f());
    expect(done).toHaveBeenCalledTimes(1);
  });
  it('after the ad resolves, the next request goes through', () => {
    const ads = AdManager.getInstance();
    const done = vi.fn();
    ads.showRewarded(done, null);
    (handlers.rewarded ?? []).slice().forEach(f => f());
    expect(done).toHaveBeenCalledTimes(1);
  });
});
