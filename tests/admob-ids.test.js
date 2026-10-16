import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// The app ID (manifest) and the ad unit IDs (AdManager) must come from ONE
// AdMob publisher. A mismatch makes every ad request fail silently in release.
const src = readFileSync('src/ads/AdManager.js', 'utf8');
const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');

const pub = (id) => id.match(/ca-app-pub-(\d{16})/)[1];

describe('AdMob IDs', () => {
  const appId = manifest.match(/ca-app-pub-\d{16}~\d+/)[0];
  const rewarded = src.match(/REWARDED_AD_ID\s*=\s*'(ca-app-pub-\d{16}\/\d+)'/)[1];
  const interstitial = src.match(/INTERSTITIAL_AD_ID\s*=\s*'(ca-app-pub-\d{16}\/\d+)'/)[1];

  it('app ID and both unit IDs share one publisher', () => {
    expect(pub(rewarded)).toBe(pub(appId));
    expect(pub(interstitial)).toBe(pub(appId));
  });

  it('is not Google\'s sample publisher (test IDs must never ship)', () => {
    expect(pub(appId)).not.toBe('3940256099942544');
  });

  it('rewarded and interstitial are different units', () => {
    expect(rewarded).not.toBe(interstitial);
  });
});
