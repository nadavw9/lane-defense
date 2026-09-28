// Shop economy: rewarded-video coins are capped per calendar day, the daily
// countdown is exact.
import { describe, it, expect } from 'vitest';
import { ProgressManager } from '../src/game/ProgressManager.js';

const MS_DAY = 24 * 3600 * 1000;

describe('video coins', () => {
  it('grants coins up to the daily cap, then nothing', () => {
    const p = new ProgressManager();
    const day = new Date(2026, 8, 28, 10);
    const start = p.coins;
    for (let i = 0; i < ProgressManager.VIDEO_COINS_PER_DAY; i++) expect(p.claimVideoCoins(day)).toBe(ProgressManager.VIDEO_COINS);
    expect(p.videoCoinsLeft(day)).toBe(0);
    expect(p.claimVideoCoins(day)).toBe(0);
    expect(p.coins).toBe(start + ProgressManager.VIDEO_COINS * ProgressManager.VIDEO_COINS_PER_DAY);
  });

  it('resets on the next calendar day', () => {
    const p = new ProgressManager();
    const d1 = new Date(2026, 8, 28, 23, 30);
    for (let i = 0; i < ProgressManager.VIDEO_COINS_PER_DAY; i++) p.claimVideoCoins(d1);
    expect(p.videoCoinsLeft(new Date(2026, 8, 29, 0, 5))).toBe(ProgressManager.VIDEO_COINS_PER_DAY);
  });
});

describe('daily countdown', () => {
  it('is 0 when never claimed and counts down a full day after a claim', () => {
    const p = new ProgressManager();
    expect(p.dailyReadyIn()).toBe(0);
    p.claimDaily();
    const left = p.dailyReadyIn();
    expect(left).toBeGreaterThan(MS_DAY - 5000);
    expect(left).toBeLessThanOrEqual(MS_DAY);
    expect(p.canClaimDaily()).toBe(false);
  });
});

