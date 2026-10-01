import { describe, it, expect } from 'vitest';
import { AdaptiveQuality, QUALITY_STEPS } from '../src/renderer3d/AdaptiveQuality.js';

const feed = (q, ms, n) => { let changed = 0; for (let i = 0; i < n; i++) if (q.record(ms)) changed++; return changed; };

describe('AdaptiveQuality', () => {
  it('starts at full quality', () => {
    expect(new AdaptiveQuality().factor).toBe(1);
  });
  it('drops a step after one slow window and never below the floor', () => {
    const q = new AdaptiveQuality();
    expect(feed(q, 40, 90)).toBe(1);
    expect(q.factor).toBe(QUALITY_STEPS[1]);
    feed(q, 40, 90 * 10);
    expect(q.factor).toBe(QUALITY_STEPS[QUALITY_STEPS.length - 1]);
  });
  it('climbs back only after repeated fast windows', () => {
    const q = new AdaptiveQuality();
    feed(q, 40, 90);
    expect(feed(q, 12, 90 * 2)).toBe(0);
    expect(feed(q, 12, 90)).toBe(1);
    expect(q.factor).toBe(1);
  });
  it('ignores hitches and non-positive samples', () => {
    const q = new AdaptiveQuality();
    expect(feed(q, 900, 500)).toBe(0);
    expect(feed(q, 0, 500)).toBe(0);
    expect(q.factor).toBe(1);
  });
  it('a mid-speed device does not oscillate', () => {
    const q = new AdaptiveQuality();
    expect(feed(q, 21, 90 * 20)).toBe(0);
  });
});
