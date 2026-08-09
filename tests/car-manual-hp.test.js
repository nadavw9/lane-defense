// THE CAR MANUAL MUST SHOW THE HP THE PLAYER'S CARS ACTUALLY HAVE.
//
// HpGuideOverlay shipped a hardcoded table — 3/6/8/10/15/30 — with a footer saying
// "Base values — actual HP scales by level". Those numbers were CAR_TYPES' real
// base values on 0f4b7fa, the commit that added the panel, and were never updated
// when the balance pass took them to 2/4/5/7/11/20. The file carried a comment
// reading "Keep the HP numbers in sync with src/director/CarTypes.js". It was not
// kept in sync, because a comment cannot keep anything in sync.
//
// So the panel was wrong twice over: its numbers matched neither the code's base
// values NOR the board (2/3/4/5 after hpMultiplier), and even if they had matched
// the base values, "scales by level" is not information a player can act on — you
// cannot derive a 4 HP van from an 8.
//
// This test does not check the panel against CAR_TYPES. It checks it against CARS
// THAT WERE ACTUALLY SPAWNED, because CAR_TYPES agreeing with itself is what the
// old comment already promised. Same shape as the socket-radius and column-capacity
// guards: assert the consumer against the real thing, not against a mirror.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { CAR_TYPES, carHpFor, spawnableTypesFor } from '../src/director/CarTypes.js';
import { HP_MINIMUM } from '../src/director/DirectorConfig.js';
import { CarDirector } from '../src/director/CarDirector.js';
import { SeededRandom } from '../src/utils/SeededRandom.js';

const ALL_TYPES = Object.keys(CAR_TYPES);

// Spawn a pile of real cars and collect the hp actually assigned per type.
function observedHp({ level, hpMultiplier, gridRows, runs = 400 }) {
  const dir = new CarDirector({}, new SeededRandom(level * 977 + 13));
  dir.setLevel?.(level);
  const world = { hpMultiplier, speed: { base: 5, variance: 0 } };
  const seen = new Map();
  for (let i = 0; i < runs; i++) {
    for (const phase of ['CALM', 'BUILD', 'PRESSURE', 'CLIMAX', 'RELIEF']) {
      const car = dir.generateCar({ id: i % 3 }, phase, world, ['Red', 'Blue'], gridRows);
      // CARRY-OVER BAIT/REWARD CARS ARE EXCLUDED, and the exclusion is deliberately
      // one-directional. _buildCarryOverCar makes a type-'small' car with hp 1-2
      // regardless of level, ignoring hpMultiplier entirely, so it is not what the
      // manual documents — but it carries no flag, so the only way to spot it is
      // that its hp is BELOW the type's computed value. Skipping only the low side
      // means a car with MORE hp than the manual shows still fails this test.
      //
      // Honest consequence, reported to the owner rather than hidden: at the
      // shipped multipliers a normal Motorbike is 2 HP and a bait bike can be 1,
      // so an occasional bike on the board has less HP than the manual states.
      // That is the bait mechanic, not manual drift.
      if (car.type === 'small' && car.hp < carHpFor('small', hpMultiplier)) continue;
      if (!seen.has(car.type)) seen.set(car.type, new Set());
      seen.get(car.type).add(car.hp);
    }
  }
  return seen;
}

describe('the CAR HP manual matches the cars the game actually spawns', () => {
  // The pilot's live multiplier, the boss values, and the extremes.
  const MULTIPLIERS = [0.70, 0.81, 0.89, 0.90, 1.0, 1.5];
  const LEVELS      = [1, 5, 8, 13, 17, 20, 30, 40];

  it('every spawned car has exactly the HP the manual would print for its type', () => {
    const mismatches = [];
    for (const level of LEVELS) {
      for (const hpMultiplier of MULTIPLIERS) {
        for (const gridRows of [8, 16]) {
          const seen = observedHp({ level, hpMultiplier, gridRows });
          for (const [type, hps] of seen) {
            const shown = carHpFor(type, hpMultiplier);
            for (const hp of hps) {
              if (hp !== shown) {
                mismatches.push(`L${level} mult=${hpMultiplier} rows=${gridRows} `
                  + `${type}: board shows ${hp}, manual would print ${shown}`);
              }
            }
          }
        }
      }
    }
    expect(mismatches, `the manual disagrees with the board:\n  ${mismatches.slice(0, 12).join('\n  ')}`)
      .toEqual([]);
  });

  it('the manual never lists a type the level cannot spawn', () => {
    // The reported confusion: Tank listed on L9, where it never appears.
    const offenders = [];
    for (const level of LEVELS) {
      for (const gridRows of [8, 16]) {
        const listed = spawnableTypesFor(level, gridRows);
        const seen   = new Set(observedHp({ level, hpMultiplier: 1.0, gridRows }).keys());
        for (const t of seen) {
          if (!listed.has(t)) offenders.push(`L${level} rows=${gridRows}: ${t} SPAWNS but is not listed`);
        }
      }
    }
    // A listed-but-unseen type is acceptable (rare types may not roll in a finite
    // sample); a SPAWNED-but-unlisted type is a real hole and would grey out a car
    // the player is looking at.
    expect(offenders, offenders.join('\n  ')).toEqual([]);
  });

  it('L9 does not list Tank, and L30 does', () => {
    expect(spawnableTypesFor(9, 8).has('tank'), 'Tank listed on L9 again').toBe(false);
    expect(spawnableTypesFor(30, 8).has('tank'), 'L30 is the tank boss and must list it').toBe(true);
  });

  it('carHpFor applies the HP_MINIMUM clamp the spawner applies', () => {
    // At a small multiplier a bike would round below the floor.
    expect(carHpFor('small', 0.1)).toBe(HP_MINIMUM);
    expect(carHpFor('tank', 0.1)).toBe(2);
    expect(carHpFor('unknown-type', 1.0)).toBeNull();
  });

  it('the overlay computes HP and does not carry its own number table', () => {
    // The specific failure mode: a literal list of hp values in the view layer.
    const src = fs.readFileSync('src/screens/HpGuideOverlay.js', 'utf8');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(code, 'the overlay must compute HP through the canonical function')
      .toMatch(/carHpFor\s*\(/);
    expect(code, 'a hardcoded hp table is back in the overlay')
      .not.toMatch(/\bhp:\s*\d+/);
    expect(code, 'the misleading "base values" footer is back')
      .not.toMatch(/[Bb]ase values/);
  });

  it('every car type has art in the overlay, so a new type cannot render blank', () => {
    const src = fs.readFileSync('src/screens/HpGuideOverlay.js', 'utf8');
    for (const t of ALL_TYPES) {
      expect(src, `car type "${t}" has no row in the manual`).toMatch(new RegExp(`type:\\s*'${t}'`));
    }
  });
});
