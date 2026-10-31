// Speeders are the tension of BRIDGES (owner, 2026-10-31: "a turbo on one of them should break the
// bridge... accordingly the frequency of turbo cars should be higher"). CarDirector.setTraits
// multiplies the level's speeder probability by SPEEDER_BOOST (capped), in one place for the live
// game and the simulator.
import { describe, it, expect } from 'vitest';
import { CarDirector }  from '../src/director/CarDirector.js';
import { SeededRandom } from '../src/utils/SeededRandom.js';
import { SPEEDER_BOOST, SPEEDER_CAP } from '../src/director/DirectorConfig.js';

describe('speeder boost', () => {
  it('is a boost with a cap', () => {
    expect(SPEEDER_BOOST).toBeGreaterThan(1);
    expect(SPEEDER_CAP).toBeLessThanOrEqual(0.7);
  });
  it('multiplies the speeder share and leaves the other traits alone', () => {
    const cd = new CarDirector({}, new SeededRandom(1));
    cd.setTraits({ speeder: 0.2, armored: 0.1 }, ['Red', 'Blue']);
    expect(cd._traits.speeder).toBeCloseTo(0.2 * SPEEDER_BOOST, 6);
    expect(cd._traits.armored).toBe(0.1);
  });
  it('caps a big share and does not invent speeders where there are none', () => {
    const cd = new CarDirector({}, new SeededRandom(1));
    cd.setTraits({ speeder: 0.5 }, ['Red']);
    expect(cd._traits.speeder).toBe(SPEEDER_CAP);
    cd.setTraits({ armored: 0.3 }, ['Red']);
    expect(cd._traits.speeder ?? 0).toBe(0);
    cd.setTraits(null, ['Red']);
    expect(cd._traits).toBe(null);
  });
});
