// Funnel report (src/analytics/funnel.js): the numbers that decide whether paying for installs can
// work. Input rows: { event, playerId, ts, installDay?, dayIndex?, levelId?, kind? } from any sink.
import { describe, it, expect } from 'vitest';
import { funnelReport } from '../src/analytics/funnel.js';

const day = (d, h = 12) => new Date(2026, 9, d, h).getTime();
const row = (playerId, event, d, extra = {}) => ({ playerId, event, ts: day(d), installDay: extra.installDay ?? '2026-10-01', dayIndex: d - 1, ...extra });

describe('funnel report', () => {
  const rows = [
    // A: installs day 1, back day 2 and day 8
    row('A', 'session_start', 1), row('A', 'level_started', 1, { levelId: 1 }), row('A', 'level_completed', 1, { levelId: 1 }),
    row('A', 'level_started', 1, { levelId: 2 }), row('A', 'level_failed', 1, { levelId: 2 }),
    row('A', 'level_started', 1, { levelId: 2 }), row('A', 'level_completed', 1, { levelId: 2 }),
    row('A', 'session_start', 2), row('A', 'ad_shown', 2, { kind: 'rewarded' }), row('A', 'session_start', 8),
    // B: installs day 1, never back, stops at level 1
    row('B', 'session_start', 1), row('B', 'level_started', 1, { levelId: 1 }), row('B', 'level_failed', 1, { levelId: 1 }),
    row('B', 'ad_shown', 1, { kind: 'interstitial' }),
  ];
  const r = funnelReport(rows, { now: day(40) });

  it('retention: share of the cohort with a session N days after install', () => {
    expect(r.installs).toBe(2);
    expect(r.retention.d1).toBeCloseTo(0.5);
    expect(r.retention.d7).toBeCloseTo(0.5);
    expect(r.retention.d30).toBe(0);
  });
  it('a cohort too young for D30 is left out of D30, not counted as churned', () => {
    const young = funnelReport(rows, { now: day(5) });
    expect(young.retention.d30).toBeNull();
    expect(young.retention.d1).toBeCloseTo(0.5);
  });
  it('per level: players who started, won, and won on their first attempt', () => {
    const l2 = r.levels.find(l => l.levelId === 2);
    expect(l2).toMatchObject({ started: 1, won: 1, firstTryWins: 0, attempts: 2 });
    const l1 = r.levels.find(l => l.levelId === 1);
    expect(l1).toMatchObject({ started: 2, won: 1, firstTryWins: 1 });
  });
  it('where players stop: the highest level each player has won (0 = never won one)', () => {
    expect(r.stopAt).toEqual({ 0: 1, 2: 1 });
  });
  it('ads per daily player', () => {
    // active player-days: A on 1, 2, 8; B on 1 = 4; ads 2
    expect(r.playerDays).toBe(4);
    expect(r.adsPerPlayerDay).toBeCloseTo(0.5);
  });
  it('rows without install stamps (older builds) use the first day the player was seen', () => {
    const legacy = funnelReport([{ playerId: 'Z', event: 'session_start', ts: day(3) }, { playerId: 'Z', event: 'session_start', ts: day(4) }], { now: day(40) });
    expect(legacy.retention.d1).toBe(1);
  });
});
