// A corrupt / partial / hand-edited save must never crash a later call (2026-10-03 review).
import { describe, it, expect, afterEach } from 'vitest';
import { ProgressManager } from '../src/game/ProgressManager.js';

function withSave(obj) {
  const store = { 'lane-defense-v1': JSON.stringify(obj) };
  globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
}
afterEach(() => { delete globalThis.localStorage; });

describe('ProgressManager._load hardening', () => {
  it('null nested objects fall back to defaults instead of crashing recordWin / getStars', () => {
    withSave({ unlockedLevel: 5, stars: null, failStreak: 'x', cityState: null, bestStats: 7 });
    const p = new ProgressManager();
    expect(() => p.recordWin(3, 2)).not.toThrow();
    expect(() => p.getStars(3)).not.toThrow();
    expect(() => p.recordLoss(4)).not.toThrow();
  });

  it('an out-of-range or NaN dailyReward.day cannot make claimDaily throw', () => {
    withSave({ dailyReward: { day: 99, lastClaim: null } });
    expect(() => new ProgressManager().claimDaily()).not.toThrow();
    withSave({ dailyReward: { day: 'NaN', lastClaim: null } });
    expect(new ProgressManager().claimDaily()).toBeTruthy();
  });

  it('a daily claim stamped in the future (clock moved back) does not lock the reward', () => {
    withSave({ dailyReward: { day: 1, lastClaim: Date.now() + 10 * 86400000 } });
    const p = new ProgressManager();
    expect(p.canClaimDaily()).toBe(true);
    expect(p.dailyReadyIn()).toBe(0);
  });

  it('NaN coins and a non-numeric unlockedLevel are sanitised', () => {
    withSave({ coins: 'lots', unlockedLevel: null });
    const p = new ProgressManager();
    expect(p.coins).toBe(0);
    expect(p.unlockedLevel).toBe(1);
  });
});
