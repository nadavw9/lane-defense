// The tuner's special-car lever (2026-11-26). Thinning EVERY trait backfired on levels whose goal
// asks for a trait ("destroy 3 menders"): the goal's cars got rarer, the level dragged on, and
// with the first breach now a loss those levels fell to 5-10% (L124 23% -> 7% when thinned).
// So: `ts` thins only the traits no goal asks for; `gb` boosts the ones a goal asks for.
import { describe, it, expect } from 'vitest';
import { tuneTraits } from '../src/game/levelDsl.js';

const goals = [{ type: 'destroyTrait', trait: 'mender', count: 3 }, { type: 'destroyColor', color: 'Red', count: 4 }];

describe('tuneTraits', () => {
  it('thins only the traits no goal asks for', () => {
    expect(tuneTraits({ mender: 0.1, plated: 0.04 }, goals, 0.5)).toEqual({ mender: 0.1, plated: 0.02 });
  });
  it('boosts the traits a goal asks for by gb', () => {
    expect(tuneTraits({ mender: 0.1, plated: 0.04 }, goals, 1, 2)).toEqual({ mender: 0.2, plated: 0.04 });
  });
  it('is the identity at ts 1, gb 1, and passes a missing mix through', () => {
    expect(tuneTraits({ mender: 0.1 }, goals)).toEqual({ mender: 0.1 });
    expect(tuneTraits(null, goals, 0.4, 2)).toBe(null);
  });
});
