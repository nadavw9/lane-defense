// AdManager — rewarded video and interstitial ad abstraction layer.
//
// On native (Android/iOS via Capacitor): uses @capacitor-community/admob with
// the production AdMob ad unit IDs (publisher ca-app-pub-3492310681731275).
//
// On web: falls back to a timed mock overlay so the game is playable without
// a native wrapper.
//
import { Capacitor } from '@capacitor/core';
import { interstitialWindowOpen, isInterstitialTurn } from './adPolicy.js';
import { AdMob, RewardAdPluginEvents, InterstitialAdPluginEvents, AdmobConsentStatus } from '@capacitor-community/admob';

const REWARDED_AD_ID     = 'ca-app-pub-3492310681731275/5674269166';
const INTERSTITIAL_AD_ID = 'ca-app-pub-3492310681731275/5734968591';
// ── Booster costs (ads required to unlock) ─────────────────────────────────
export const AD_COSTS = {
  colorchange: 1,   // 1 ad → Color Change booster for this level
  freeze:      1,   // 1 ad → Freeze booster
  bomb:        3,   // 3 ads → Bomb booster (best power-up)
};

// localStorage key prefix for per-level ad progress.
const KEY = (type) => `ad_progress_${type}`;

export class AdManager {
  constructor() {
    // Singleton — only one AdManager should exist.
    if (AdManager._instance) return AdManager._instance;
    AdManager._instance = this;
    this._overlay          = null;
    this._native           = false;
    this._lastInterstitial = 0;
    this._lastRewarded     = 0;
    this._eligibleCount    = 0;
    this._consent          = !Capacitor.isNativePlatform();   // web has no consent regime
    this._privacyOptions   = false;   // UMP says the player must be able to reopen consent
  }

  static getInstance() {
    if (!AdManager._instance) new AdManager();
    return AdManager._instance;
  }

  // How many ads the player has watched for this booster in the current level.
  getProgress(boosterType) {
    return parseInt(localStorage.getItem(KEY(boosterType)) ?? '0', 10);
  }

  // How many ads are needed for this booster.
  getCost(boosterType) { return AD_COSTS[boosterType] ?? 1; }

  // Whether the player has watched enough ads to unlock this booster.
  isUnlocked(boosterType) {
    return this.getProgress(boosterType) >= this.getCost(boosterType);
  }

  // Progress label, e.g. "1 / 3".
  progressLabel(boosterType) {
    const p = this.getProgress(boosterType);
    const c = this.getCost(boosterType);
    return `${p} / ${c}`;
  }

  // Reset all ad progress (call at the start of each level attempt).
  resetForLevel() {
    for (const type of Object.keys(AD_COSTS)) {
      localStorage.removeItem(KEY(type));
    }
  }

  // Register AdMob on native. No-op on web. Call once at app startup.
  async init() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      // Test mode ONLY in dev builds (2026-09-27). This was hard-coded true, which
      // puts the production ad unit IDs above into test mode in the release APK:
      // test ads, no revenue. `vite build` sets DEV=false, so release is live.
      await AdMob.initialize({ testingDevices: [], initializeForTesting: import.meta.env.DEV });
      // Consent (Google UMP) BEFORE any ad request. Where the law requires it
      // (EEA / UK / Switzerland) the form shows on first launch; elsewhere the
      // status comes back NOT_REQUIRED and nothing is shown. The form itself is
      // the GDPR message configured in the AdMob console (Privacy & messaging).
      const info = await this._resolveConsent();
      this._native = info.canRequestAds;
      this._consent = info.canRequestAds;
    } catch (e) {
      console.warn('[AdManager] AdMob init failed:', e);
      this._consent = false;
    }
  }

  /** True when the player may be measured: web (no consent regime) or UMP allows it. */
  get consentGranted() { return this._consent; }

  async _resolveConsent() {
    let info = await AdMob.requestConsentInfo();
    if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) {
      info = await AdMob.showConsentForm();
    }
    // (Compared as a string: the plugin declares PrivacyOptionsRequirementStatus
    // but its package index does not export the enum.)
    this._privacyOptions = info.privacyOptionsRequirementStatus === 'REQUIRED';
    return info;
  }

  /** True when Settings must offer a way to review ad consent (UMP rule). */
  get hasPrivacyOptions() { return this._privacyOptions; }

  /** Reopen the consent choices (Settings → Ad privacy choices). */
  async showPrivacyOptions() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await AdMob.showPrivacyOptionsForm();
      const info = await AdMob.requestConsentInfo();
      this._native = info.canRequestAds;
      this._consent = info.canRequestAds;
      this.onConsentChange?.(this._consent);
    } catch (e) {
      console.warn('[AdManager] privacy options failed:', e);
    }
  }

  // Show a rewarded video ad (rescue flow).
  // onComplete() — called when the player earns the reward.
  // onDismissed() — called if dismissed/failed before reward (optional).
  showRewarded(onComplete, onDismissed) {
    if (!this._native) {
      // Web: the timed mock keeps the flow playable. On device with ads
      // unavailable (no consent yet, init failed) there is nothing to show —
      // never the mock, which would look like a fake ad.
      if (Capacitor.isNativePlatform()) onDismissed?.();
      else this._showPlatformAd(onComplete, onDismissed);
      return;
    }
    // One rewarded ad at a time. A native ad takes a second or two to load, and
    // a player who taps CONTINUE again in that window would otherwise stack a
    // second set of listeners — both fire on the one reward (double rescue).
    if (this._rewardedBusy) return;
    this._rewardedBusy = true;
    let rewarded = false;
    const listeners = [];
    const cleanup = () => { this._rewardedBusy = false; listeners.forEach(l => l.remove()); listeners.length = 0; };

    listeners.push(AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
      rewarded = true;
      this._lastRewarded = Date.now();
      cleanup();
      onComplete?.();
    }));
    listeners.push(AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
      cleanup();
      if (!rewarded) onDismissed?.();
    }));
    listeners.push(AdMob.addListener(RewardAdPluginEvents.FailedToLoad, () => {
      cleanup();
      onDismissed?.();
    }));
    listeners.push(AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => {
      cleanup();
      onDismissed?.();
    }));

    AdMob.prepareRewardVideoAd({ adId: REWARDED_AD_ID })
      .then(() => AdMob.showRewardVideoAd())
      .catch(() => { cleanup(); onDismissed?.(); });
  }

  // Show an interstitial ad (lose screen). Returns a Promise that resolves
  // once the ad is dismissed. Paced by adPolicy (window + every-Nth). Resolves immediately on web or when throttled.
  showInterstitial(levelId = 0) {
    if (!this._native) return Promise.resolve();
    const now = Date.now();
    if (!interstitialWindowOpen({ now, lastInterstitial: this._lastInterstitial,
      lastRewarded: this._lastRewarded, levelId })) return Promise.resolve();
    this._eligibleCount++;   // only moments the window allowed count toward "every second"
    if (!isInterstitialTurn(this._eligibleCount)) return Promise.resolve();
    this._lastInterstitial = now;

    return new Promise((resolve) => {
      const listeners = [];
      const done = () => { listeners.forEach(l => l.remove()); listeners.length = 0; resolve(); };

      listeners.push(AdMob.addListener(InterstitialAdPluginEvents.Dismissed, done));
      listeners.push(AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, () => {
        console.warn('[AdManager] Interstitial failed to load');
        done();
      }));
      listeners.push(AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, () => {
        console.warn('[AdManager] Interstitial failed to show');
        done();
      }));

      AdMob.prepareInterstitial({ adId: INTERSTITIAL_AD_ID })
        .then(() => AdMob.showInterstitial())
        .catch((e) => { console.warn('[AdManager] Interstitial error:', e); done(); });
    });
  }

  // Show a rewarded ad for the given booster type.
  //   onRewarded(boosterType)  — called when the player finishes watching.
  //   onDismissed()            — called if the player skips before completion.
  showRewardedAd(boosterType, onRewarded, onDismissed) {
    if (this._overlay) return;   // already showing an ad
    // A REAL rewarded ad on device. This used to call the web mock directly, so
    // on Android the booster unlocks played a fake 5-second "WATCHING AD" card:
    // no ad, no revenue, and a screen that looks like a scam.
    this.showRewarded(
      () => {
        // Record progress.
        const next = this.getProgress(boosterType) + 1;
        localStorage.setItem(KEY(boosterType), String(next));
        onRewarded?.(boosterType);
      },
      onDismissed,
    );
  }

  // ── Platform integration point ────────────────────────────────────────────
  // Replace this method body with your real ad SDK.
  // Contract: call onComplete() after a successful view; onDismissed() if skipped.
  _showPlatformAd(onComplete, onDismissed) {
    if (this._overlay) return;   // one at a time (double tap on CONTINUE)
    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
      'background:rgba(0,0,0,0.96)', 'z-index:99999',
      'display:flex', 'align-items:center', 'justify-content:center',
      'flex-direction:column', 'gap:14px',
      'color:#fff', 'font-family:Arial,sans-serif', 'user-select:none',
    ].join(';');

    let remaining = 5;   // mock ad duration (seconds)

    overlay.innerHTML = `
      <div style="font-size:48px">📺</div>
      <div style="font-size:20px;font-weight:bold;letter-spacing:1px">WATCHING AD</div>
      <div id="ad-bar-wrap" style="width:240px;height:8px;background:#333;border-radius:4px;overflow:hidden">
        <div id="ad-bar" style="height:100%;width:0%;background:#ffcc00;border-radius:4px;transition:width 1s linear"></div>
      </div>
      <div id="ad-timer" style="font-size:44px;font-weight:bold;color:#ffcc00;min-width:56px;text-align:center">
        ${remaining}
      </div>
      <div style="font-size:12px;color:#888;margin-top:4px">Earn your booster reward</div>
      <button id="ad-skip" disabled style="
        margin-top:8px;padding:10px 28px;border:none;border-radius:8px;
        background:#333;color:#666;font-size:14px;font-weight:bold;cursor:not-allowed">
        Skip Ad
      </button>
    `;
    document.body.appendChild(overlay);
    this._overlay = overlay;

    // Progress bar animation.
    requestAnimationFrame(() => {
      const bar = overlay.querySelector('#ad-bar');
      if (bar) bar.style.width = '100%';
    });

    const skipBtn = overlay.querySelector('#ad-skip');
    const timerEl = overlay.querySelector('#ad-timer');

    const tick = setInterval(() => {
      remaining--;
      if (timerEl) timerEl.textContent = Math.max(0, remaining);
      if (remaining <= 0) {
        clearInterval(tick);
        document.body.removeChild(overlay);
        this._overlay = null;
        onComplete?.();
      }
      // Allow skip after halfway.
      if (remaining <= 2 && skipBtn) {
        skipBtn.disabled = false;
        skipBtn.style.background = '#555';
        skipBtn.style.color      = '#ccc';
        skipBtn.style.cursor     = 'pointer';
      }
    }, 1000);

    skipBtn?.addEventListener('click', () => {
      if (skipBtn.disabled) return;
      clearInterval(tick);
      document.body.removeChild(overlay);
      this._overlay = null;
      onDismissed?.();
    });
  }
}

// Create singleton immediately so it's ready.
export const adManager = new AdManager();
