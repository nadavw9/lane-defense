// The weekly +15 claim key must roll on the SAME day as the weekly playlist, or the
// bonus pays twice per playlist (Sunday, and the Dec 31 / Jan 1 boundary).
import { describe, it, expect, afterEach, vi } from 'vitest';
import { DailyChallengeManager } from '../src/game/DailyChallengeManager.js';

afterEach(() => vi.useRealTimers());
const at = (iso) => { vi.useFakeTimers(); vi.setSystemTime(new Date(iso)); return new DailyChallengeManager().getWeeklyPlaylist(); };

describe('weekly playlist vs claim key', () => {
  it('Saturday and Sunday of one Mon-Sun week share playlist AND key', () => {
    const sat = at('2026-10-03T12:00:00'), sun = at('2026-10-04T12:00:00');
    expect(sun.levels).toEqual(sat.levels);
    expect(sun.weekKey).toBe(sat.weekKey);
  });
  it('the key changes on Monday, exactly when the playlist rotates', () => {
    const sun = at('2026-10-04T23:59:00'), mon = at('2026-10-05T00:01:00');
    expect(mon.weekKey).not.toBe(sun.weekKey);
    expect(mon.levels).not.toEqual(sun.levels);
  });
  it('the Dec 31 / Jan 1 boundary inside one week does not re-key', () => {
    const a = at('2026-12-31T12:00:00'), b = at('2027-01-01T12:00:00');
    expect(a.levels).toEqual(b.levels);
    expect(b.weekKey).toBe(a.weekKey);
  });
});
