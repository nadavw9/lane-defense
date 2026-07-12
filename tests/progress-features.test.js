// Tests for the v1.2 ProgressManager additions:
//   - touchLoginStreak() return shape
//   - streakShield methods
//   - claimOfflineReward()
//   - weekly playlist claim tracking

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProgressManager } from '../src/game/ProgressManager.js';

// ProgressManager reads/writes localStorage. In the Node test environment
// localStorage is undefined, so _load() catches the ReferenceError and
// returns defaults(), and _save() silently no-ops. No mocking needed.

// ── touchLoginStreak ──────────────────────────────────────────────────────────

describe('ProgressManager.touchLoginStreak()', () => {
  let p;
  beforeEach(() => { p = new ProgressManager(); });

  it('returns an object with count, wasReset, prevCount fields', () => {
    const r = p.touchLoginStreak();
    expect(r).toHaveProperty('count');
    expect(r).toHaveProperty('wasReset');
    expect(r).toHaveProperty('prevCount');
  });

  it('fresh player: count=1, wasReset=false, prevCount=0', () => {
    const r = p.touchLoginStreak();
    expect(r.count).toBe(1);
    expect(r.wasReset).toBe(false);
    expect(r.prevCount).toBe(0);
  });

  it('calling twice on the same day is idempotent', () => {
    const r1 = p.touchLoginStreak();
    const r2 = p.touchLoginStreak();
    expect(r1.count).toBe(r2.count);
    expect(r2.wasReset).toBe(false);
  });

  it('count is always a positive integer', () => {
    const { count } = p.touchLoginStreak();
    expect(Number.isInteger(count)).toBe(true);
    expect(count).toBeGreaterThan(0);
  });
});

// ── Streak shield ─────────────────────────────────────────────────────────────

describe('ProgressManager streak shield', () => {
  let p;
  beforeEach(() => { p = new ProgressManager(); });

  it('has 1 default shield on fresh start', () => {
    expect(p.streakShields).toBe(1);
    expect(p.hasStreakShield()).toBe(true);
  });

  it('addStreakShield increments by the given amount', () => {
    p.addStreakShield(2);
    expect(p.streakShields).toBe(3);
  });

  it('useStreakShield returns true and decrements when shields > 0', () => {
    const ok = p.useStreakShield(5);
    expect(ok).toBe(true);
    expect(p.streakShields).toBe(0);
    expect(p.hasStreakShield()).toBe(false);
  });

  it('useStreakShield returns false when shields = 0', () => {
    p.useStreakShield(5); // spend the one default
    const ok = p.useStreakShield(5);
    expect(ok).toBe(false);
  });

  it('useStreakShield restores streak to prevCount + 1', () => {
    p.useStreakShield(7);
    expect(p.loginStreak).toBe(8);
  });

  it('streakShields never goes below 0', () => {
    p.useStreakShield(1);
    p.useStreakShield(1); // no-op
    expect(p.streakShields).toBe(0);
  });
});

// ── claimOfflineReward ────────────────────────────────────────────────────────

describe('ProgressManager.claimOfflineReward()', () => {
  let p;
  beforeEach(() => { p = new ProgressManager(); });

  it('returns null on the very first call (no prior session)', () => {
    expect(p.claimOfflineReward()).toBeNull();
  });

  it('returns null if called again immediately (< 30 min)', () => {
    p.claimOfflineReward();        // stamps now
    expect(p.claimOfflineReward()).toBeNull();
  });

  it('returns { coins, awayMin } after sufficient time away', () => {
    // Manually backdate lastSessionMs to simulate 90 minutes away.
    p._data.lastSessionMs = Date.now() - 90 * 60 * 1000;
    const r = p.claimOfflineReward();
    expect(r).not.toBeNull();
    expect(r.coins).toBeGreaterThan(0);
    expect(r.awayMin).toBeGreaterThanOrEqual(90);
  });

  it('coins = floor(awayMin / 5), capped at 20', () => {
    p._data.lastSessionMs = Date.now() - 60 * 60 * 1000; // 60 min
    const r = p.claimOfflineReward();
    expect(r.coins).toBe(Math.min(20, Math.floor(60 / 5)));
  });

  it('caps at 20 coins regardless of how long away', () => {
    p._data.lastSessionMs = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
    const r = p.claimOfflineReward();
    expect(r.coins).toBe(20);
  });

  it('coins are added to the balance', () => {
    const coinsBefore = p.coins;
    p._data.lastSessionMs = Date.now() - 90 * 60 * 1000;
    const r = p.claimOfflineReward();
    expect(p.coins).toBe(coinsBefore + r.coins);
  });

  it('stamps lastSessionMs so back-to-back calls return null', () => {
    p._data.lastSessionMs = Date.now() - 90 * 60 * 1000;
    p.claimOfflineReward();                // claim
    expect(p.claimOfflineReward()).toBeNull();  // second call within seconds
  });
});

// ── Weekly claim tracking ─────────────────────────────────────────────────────

describe('ProgressManager weekly playlist tracking', () => {
  let p;
  beforeEach(() => { p = new ProgressManager(); });

  it('hasClaimedWeeklyLevel returns false before any claim', () => {
    expect(p.hasClaimedWeeklyLevel(8, '2026-W17')).toBe(false);
  });

  it('markClaimedWeeklyLevel → hasClaimedWeeklyLevel returns true', () => {
    p.markClaimedWeeklyLevel(8, '2026-W17');
    expect(p.hasClaimedWeeklyLevel(8, '2026-W17')).toBe(true);
  });

  it('claim for one level does not affect another level', () => {
    p.markClaimedWeeklyLevel(8, '2026-W17');
    expect(p.hasClaimedWeeklyLevel(16, '2026-W17')).toBe(false);
  });

  it('claim for one week does not affect a different week', () => {
    p.markClaimedWeeklyLevel(8, '2026-W17');
    expect(p.hasClaimedWeeklyLevel(8, '2026-W18')).toBe(false);
  });

  it('marking the same level twice is idempotent (no duplicates)', () => {
    p.markClaimedWeeklyLevel(8, '2026-W17');
    p.markClaimedWeeklyLevel(8, '2026-W17');
    const claimed = p._data.weeklyClaimedLevels['2026-W17'];
    const deduplicated = [...new Set(claimed)];
    expect(claimed.length).toBe(deduplicated.length);
  });
});

// ── Car-type intro persistence (Bug A) ────────────────────────────────────────

describe('ProgressManager introducedCarTypes', () => {
  function withStorage(store) {
    vi.stubGlobal('localStorage', {
      getItem:    (k) => (k in store ? store[k] : null),
      setItem:    (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    });
  }
  afterEach(() => vi.unstubAllGlobals());

  it('fresh player: empty set', () => {
    const p = new ProgressManager();
    expect(p.getIntroducedCarTypes().size).toBe(0);
  });

  it('markCarTypeIntroduced persists and is idempotent', () => {
    const store = {};
    withStorage(store);
    const p = new ProgressManager();
    p.markCarTypeIntroduced('truck');
    p.markCarTypeIntroduced('truck');
    expect(p.getIntroducedCarTypes().has('truck')).toBe(true);
    const reloaded = new ProgressManager();
    expect(reloaded.getIntroducedCarTypes().has('truck')).toBe(true);
    expect([...reloaded.getIntroducedCarTypes()].filter((t) => t === 'truck').length).toBe(1);
  });

  it('migration merges the legacy lane_defense_seen_car_types key', () => {
    const store = {
      'lane-defense-v1': JSON.stringify({ unlockedLevel: 1 }),
      'lane_defense_seen_car_types': JSON.stringify(['small', 'big']),
    };
    withStorage(store);
    const p = new ProgressManager();
    expect(p.getIntroducedCarTypes().has('small')).toBe(true);
    expect(p.getIntroducedCarTypes().has('big')).toBe(true);
    expect(p.getIntroducedCarTypes().has('tank')).toBe(false);
  });

  it('migration backfills from progression: past a type intro level = introduced', () => {
    const store = { 'lane-defense-v1': JSON.stringify({ unlockedLevel: 13 }) };
    withStorage(store);
    const p = new ProgressManager();
    const seen = p.getIntroducedCarTypes();
    // completed L1..L12 → met small(L1), big(L2), jeep(L5), truck(L9)
    for (const t of ['small', 'big', 'jeep', 'truck']) expect(seen.has(t)).toBe(true);
    // bigrig intros AT L13 (not yet played), tank at L15
    expect(seen.has('bigrig')).toBe(false);
    expect(seen.has('tank')).toBe(false);
  });

  it('corrupt legacy key is ignored, backfill still applies', () => {
    const store = {
      'lane-defense-v1': JSON.stringify({ unlockedLevel: 3 }),
      'lane_defense_seen_car_types': '{not json',
    };
    withStorage(store);
    const p = new ProgressManager();
    expect(p.getIntroducedCarTypes().has('small')).toBe(true);
    expect(p.getIntroducedCarTypes().has('big')).toBe(true);
    expect(p.getIntroducedCarTypes().has('jeep')).toBe(false);
  });
});
