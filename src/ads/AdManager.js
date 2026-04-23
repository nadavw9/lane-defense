// AdManager — rewarded video ad abstraction layer.
//
// Current state: MOCK implementation (timed overlay simulating an ad).
// To integrate a real ad SDK, replace the body of _showPlatformAd() only.
// Everything else (tracking, progress, callbacks) stays the same.
//
// ── Supported ad SDKs (plug into _showPlatformAd) ──────────────────────────
//   Google AdMob (Capacitor):  import { AdMob } from '@capacitor-community/admob';
//   IronSource:                IronSource.showRewardedVideo();
//   Unity Ads:                 UnityAds.show('Rewarded_Android', listener);
//   AppLovin MAX:              MaxSdk.showRewardedAd(adUnitId, listener);
//   Facebook Audience Network: RewardedVideoAd.create(...).then(ad => ad.show());
//
// ── Booster costs (ads required to unlock) ─────────────────────────────────
export const AD_COSTS = {
  swap:   1,   // 1 ad → Swap booster for this level
  peek:   1,   // 1 ad → Peek booster
  freeze: 1,   // 1 ad → Freeze booster
  bomb:   3,   // 3 ads → Bomb booster (best power-up)
};

// localStorage key prefix for per-level ad progress.
const KEY = (type) => `ad_progress_${type}`;

export class AdManager {
  constructor() {
    // Singleton — only one AdManager should exist.
    if (AdManager._instance) return AdManager._instance;
    AdManager._instance = this;
    this._overlay = null;
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

  // Show a rewarded ad for the given booster type.
  //   onRewarded(boosterType)  — called when the player finishes watching.
  //   onDismissed()            — called if the player skips before completion.
  showRewardedAd(boosterType, onRewarded, onDismissed) {
    if (this._overlay) return;   // already showing an ad
    this._showPlatformAd(
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
