import { describe, it, expect, beforeEach } from 'vitest';
import { streakGift, winsToNextTier, addBundles } from '../src/game/winStreak.js';
import { ProgressManager } from '../src/game/ProgressManager.js';

describe('win streak gift', () => {
  it('nothing below two wins, a FREEZE at two, FREEZE + COLOR SWAP at four, never a bomb', () => {
    expect(streakGift(0)).toBeNull();
    expect(streakGift(1)).toBeNull();
    expect(streakGift(2)).toEqual({ colorChange: 0, freeze: 1, bombs: 0 });
    expect(streakGift(3)).toEqual({ colorChange: 0, freeze: 1, bombs: 0 });
    expect(streakGift(4)).toEqual({ colorChange: 1, freeze: 1, bombs: 0 });
    expect(streakGift(40).bombs).toBe(0);
    expect(streakGift(NaN)).toBeNull();
  });
  it('counts the wins to the next tier', () => {
    expect(winsToNextTier(0)).toBe(2);
    expect(winsToNextTier(1)).toBe(1);
    expect(winsToNextTier(2)).toBe(2);
    expect(winsToNextTier(5)).toBe(0);
  });
  it('adds bundles, tolerating null', () => {
    expect(addBundles({ colorChange: 0, freeze: 1, bombs: 1 }, { colorChange: 1, freeze: 1, bombs: 0 }))
      .toEqual({ colorChange: 1, freeze: 2, bombs: 1 });
    expect(addBundles(null, null)).toEqual({ colorChange: 0, freeze: 0, bombs: 0 });
  });
});

describe('ProgressManager win streak', () => {
  beforeEach(() => {
    const mem = {};
    globalThis.localStorage = {
      getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); },
      removeItem: (k) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; },
    };
  });
  it('grows on wins, resets on a final loss and on breakWinStreak, survives a reload', () => {
    const p = new ProgressManager();
    expect(p.winStreak).toBe(0);
    p.recordWin(1, 3); p.recordWin(2, 2);
    expect(p.winStreak).toBe(2);
    expect(new ProgressManager().winStreak).toBe(2);
    p.recordLoss(3);
    expect(p.winStreak).toBe(0);
    p.recordWin(3, 1);
    p.breakWinStreak();
    expect(p.winStreak).toBe(0);
  });
});
