// A refill car drives in from beyond the top of the screen (src/renderer3d/carEntry.js).
// It used to start only SPAWN_OFFSET (5 wu) above its row — still under the HUD band — and
// finish most of a 0.45 s ease-out there, so on the phone it simply appeared (owner, 2026-10-19).
import { describe, it, expect } from 'vitest';
import { carEntryStartZ, carEntryProgress, CAR_ENTRY } from '../src/renderer3d/carEntry.js';

describe('carEntryStartZ', () => {
  it('starts the car fully above the top of the screen', () => {
    const screenTopZ = -30, half = 3;
    expect(carEntryStartZ(-24, screenTopZ, half)).toBeLessThanOrEqual(screenTopZ - half);
  });
  it('is never closer to its row than the old spawn offset', () => {
    expect(carEntryStartZ(-40, -30, 3)).toBeLessThanOrEqual(-40 - CAR_ENTRY.minOffset);
  });
});

describe('carEntryProgress', () => {
  it('holds still during the delay, then runs 0 to 1 monotonically and stops at 1', () => {
    expect(carEntryProgress(0)).toBe(0);
    expect(carEntryProgress(CAR_ENTRY.delay * 0.9)).toBe(0);
    const ts = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7].map(t => carEntryProgress(t));
    for (let i = 1; i < ts.length; i++) expect(ts[i]).toBeGreaterThanOrEqual(ts[i - 1]);
    expect(carEntryProgress(CAR_ENTRY.delay + CAR_ENTRY.duration)).toBe(1);
    expect(carEntryProgress(9)).toBe(1);
  });
  it('is visibly still travelling a third of the way in (not a snap)', () => {
    const third = carEntryProgress(CAR_ENTRY.delay + CAR_ENTRY.duration / 3);
    expect(third).toBeGreaterThan(0.2);
    expect(third).toBeLessThan(0.75);
  });
});
