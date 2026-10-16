// Once-a-day features roll over at the player's local midnight, not UTC midnight.
import { describe, it, expect, beforeEach } from 'vitest';
import { localDateKey, previousLocalDateKey, utcDateKey } from '../src/game/dateKeys.js';
import { ProgressManager } from '../src/game/ProgressManager.js';

describe('dateKeys', () => {
  it('formats the local calendar day', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(localDateKey(new Date(2026, 11, 31, 0, 1))).toBe('2026-12-31');
  });
  it('previous key crosses month and year boundaries', () => {
    expect(previousLocalDateKey(new Date(2026, 2, 1, 8))).toBe('2026-02-28');
    expect(previousLocalDateKey(new Date(2027, 0, 1, 0, 5))).toBe('2026-12-31');
  });
  it('utc key is the legacy ISO day', () => {
    expect(utcDateKey(new Date(Date.UTC(2026, 5, 1, 23, 0)))).toBe('2026-06-01');
  });
});

describe('login streak follows the local day', () => {
  let p;
  beforeEach(() => { p = new ProgressManager(); });

  it('late evening and early morning next day are consecutive days', () => {
    p.touchLoginStreak(new Date(2026, 5, 10, 23, 50));
    const r = p.touchLoginStreak(new Date(2026, 5, 11, 0, 10));
    expect(r.count).toBe(2);
    expect(r.wasReset).toBe(false);
  });
  it('two opens on one local day count once', () => {
    p.touchLoginStreak(new Date(2026, 5, 10, 0, 10));
    const r = p.touchLoginStreak(new Date(2026, 5, 10, 23, 50));
    expect(r.count).toBe(1);
  });
  it('a skipped day resets and reports the previous count', () => {
    p.touchLoginStreak(new Date(2026, 5, 10, 12));
    p.touchLoginStreak(new Date(2026, 5, 11, 12));
    const r = p.touchLoginStreak(new Date(2026, 5, 13, 12));
    expect(r).toMatchObject({ count: 1, wasReset: true, prevCount: 2 });
  });
  it('the UTC fallback applies once: after a local write it no longer forgives a missed day', () => {
    p.touchLoginStreak(new Date(2026, 5, 9, 12));
    const r = p.touchLoginStreak(new Date(2026, 5, 11, 1, 30));   // skipped the 10th
    expect(r.wasReset).toBe(true);
  });
  it('a streak saved with a legacy UTC key survives the migration', () => {
    const now = new Date(2026, 5, 11, 12);
    p._data.loginStreak = { count: 4, lastLogin: utcDateKey(new Date(now.getTime() - 86400000)) };
    expect(p.touchLoginStreak(now).count).toBe(5);
  });
});
