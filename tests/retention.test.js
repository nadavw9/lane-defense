// Retention stamps (src/analytics/retention.js): every session row carries the player's install day
// and how many days since, so D1/D7/D30 can be read straight off the event log.
import { describe, it, expect } from 'vitest';
import { installDayFor, dayIndex, sessionClock } from '../src/analytics/retention.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

describe('install day', () => {
  it('is the first day the game was seen, and never moves after that', () => {
    const s = mem();
    expect(installDayFor(s, new Date(2026, 9, 20, 9))).toBe('2026-10-20');
    expect(installDayFor(s, new Date(2026, 9, 27, 9))).toBe('2026-10-20');
  });
  it('survives storage that throws (private mode): today, not a crash', () => {
    const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
    expect(installDayFor(bad, new Date(2026, 9, 20))).toBe('2026-10-20');
  });
  it('an old save without the key starts counting from today', () => {
    expect(installDayFor(mem(), new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('day index', () => {
  it('counts local calendar days, so a late-night install and a morning return is day 1', () => {
    expect(dayIndex('2026-10-20', new Date(2026, 9, 20, 23, 50))).toBe(0);
    expect(dayIndex('2026-10-20', new Date(2026, 9, 21, 0, 10))).toBe(1);
    expect(dayIndex('2026-10-20', new Date(2026, 9, 27, 12))).toBe(7);
  });
  it('is DST-safe across the October clock change', () => {
    expect(dayIndex('2026-10-24', new Date(2026, 9, 26, 1))).toBe(2);
    expect(dayIndex('2026-03-28', new Date(2026, 2, 30, 1))).toBe(2);
  });
});

describe('session clock', () => {
  it('a return from the background after 30 minutes is a new session, a short switch is not', () => {
    let t = 0; const c = sessionClock(() => t);
    expect(c.foreground()).toBe(true);           // app open
    t = 60_000; expect(c.background()).toBe(60); // seconds played
    t = 90_000; expect(c.foreground()).toBe(false);
    t = 200_000; c.background();
    t = 200_000 + 31 * 60_000; expect(c.foreground()).toBe(true);
  });
});

describe('session tracking', () => {
  it('opens a session on start and closes it with seconds when the app is hidden', async () => {
    const { trackSessions } = await import('../src/analytics/Analytics.js');
    const calls = [];
    const a = { recordSessionStart: () => calls.push('start'), recordSessionEnd: (s) => calls.push(`end:${typeof s}`) };
    const listeners = {};
    const doc = { hidden: false, addEventListener: (k, fn) => { listeners[k] = fn; } };
    trackSessions(a, doc);
    doc.hidden = true; listeners.visibilitychange();
    doc.hidden = false; listeners.visibilitychange();   // quick return: same session
    expect(calls).toEqual(['start', 'end:number']);
  });
});
