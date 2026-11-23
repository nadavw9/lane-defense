// App Review rejected iOS 1.0 twice (13 and 22 Nov 2026, guideline 2.1): the App Tracking
// Transparency prompt never appeared on their iPad. Owner decision (23 Nov 2026): Traffic Bomb
// does not track. No ATT prompt, no NSUserTrackingUsageDescription, and every iOS ad request is
// non-personalised (npa), so the App Store privacy label can honestly say "no tracking".
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { adOptions } from '../src/ads/AdManager.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

describe('iOS does not track', () => {
  it('never asks for tracking permission', () => {
    expect(read('src/ads/AdManager.js')).not.toMatch(/requestTrackingAuthorization|askTracking/);
  });

  it('has no tracking usage text in Info.plist', () => {
    expect(read('ios/App/App/Info.plist')).not.toContain('NSUserTrackingUsageDescription');
  });

  it('requests non-personalised ads on iOS only', () => {
    expect(adOptions('x', false, 'ios')).toEqual({ adId: 'x', isTesting: false, npa: true });
    expect(adOptions('x', true, 'android')).toEqual({ adId: 'x', isTesting: true });
  });
});
