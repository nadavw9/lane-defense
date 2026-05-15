// Tests for Streak Shot mechanic:
//   - 3 consecutive correct-color hits charge the streak (streakActive)
//   - Any miss (wrong color) resets streakCount and streakActive
//   - Power shot fires on next correct hit when streakActive: 2× damage
//   - Hit car that survives a power shot has slowedTurns=1 (skips next advance)
//   - A car slowed by a power shot skips exactly 1 grid advance then resumes
//   - Consuming the streak resets to streakCount=0, streakActive=false

import { describe, it, expect, vi } from 'vitest';
import { GameLoop }        from '../src/game/GameLoop.js';
import { GameState }       from '../src/game/GameState.js';
import { CombatResolver }  from '../src/game/CombatResolver.js';
import { CarDirector }     from '../src/director/CarDirector.js';
import { ShooterDirector } from '../src/director/ShooterDirector.js';
import { FairnessArbiter } from '../src/director/FairnessArbiter.js';
import { IntensityPhase }  from '../src/director/IntensityPhase.js';
import { SeededRandom }    from '../src/utils/SeededRandom.js';
import { Lane }            from '../src/models/Lane.js';
import { Column }          from '../src/models/Column.js';
import { Shooter }         from '../src/models/Shooter.js';
import { Car }             from '../src/models/Car.js';

const mockApp = { ticker: { add: vi.fn(), remove: vi.fn() } };

function makeState({ laneCount = 1, colCount = 1 } = {}) {
  const lanes   = Array.from({ length: 4 }, (_, id) => new Lane({ id }));
  const columns = Array.from({ length: 4 }, (_, id) => new Column({ id }));
  const phaseMan = new IntensityPhase(90);
  const gs = new GameState({
    lanes, columns,
    colors:    ['Red', 'Blue'],
    world:     { hpMultiplier: 1, speed: { base: 5, variance: 0.5 } },
    duration:  90,
    phaseMan,
    laneCount,
    colCount,
  });
  gs.gridRows = 10;
  return { gs, lanes, columns };
}

function makeLoop(gs, overrides = {}) {
  const rng        = new SeededRandom(1);
  const arbiter    = new FairnessArbiter();
  const carDir     = new CarDirector({}, rng);
  const shooterDir = new ShooterDirector({}, rng, arbiter);
  return new GameLoop({
    app: mockApp,
    gameState: gs,
    carDir,
    shooterDir,
    combatResolver: new CombatResolver(),
    rng,
    ...overrides,
  });
}

// Helper: place a fresh car (high HP so it never dies) in lane 0
function addCar(lanes, loop, { color = 'Red', hp = 50, row = 2 } = {}) {
  const car = new Car({ color, hp, speed: 5 });
  car.row = row; car.position = loop._rowToPosition(row, 10);
  lanes[0].addCar(car);
  return car;
}

describe('GameState streak helpers', () => {
  it('starts with streakCount=0, streakActive=false', () => {
    const { gs } = makeState();
    expect(gs.streakCount).toBe(0);
    expect(gs.streakActive).toBe(false);
  });

  it('recordCorrectHit increments count; activates after 3rd hit', () => {
    const { gs } = makeState();
    gs.recordCorrectHit(); expect(gs.streakCount).toBe(1); expect(gs.streakActive).toBe(false);
    gs.recordCorrectHit(); expect(gs.streakCount).toBe(2); expect(gs.streakActive).toBe(false);
    gs.recordCorrectHit(); expect(gs.streakCount).toBe(3); expect(gs.streakActive).toBe(true);
  });

  it('recordMiss resets streak and deactivates', () => {
    const { gs } = makeState();
    gs.recordCorrectHit();
    gs.recordCorrectHit();
    gs.recordMiss();
    expect(gs.streakCount).toBe(0);
    expect(gs.streakActive).toBe(false);
  });

  it('recordMiss after streakActive also resets', () => {
    const { gs } = makeState();
    gs.recordCorrectHit(); gs.recordCorrectHit(); gs.recordCorrectHit();
    expect(gs.streakActive).toBe(true);
    gs.recordMiss();
    expect(gs.streakCount).toBe(0);
    expect(gs.streakActive).toBe(false);
  });

  it('consumeStreak resets to zero', () => {
    const { gs } = makeState();
    gs.recordCorrectHit(); gs.recordCorrectHit(); gs.recordCorrectHit();
    gs.consumeStreak();
    expect(gs.streakCount).toBe(0);
    expect(gs.streakActive).toBe(false);
  });

  it('recordCorrectHit is a no-op when streakActive (already charged)', () => {
    const { gs } = makeState();
    gs.recordCorrectHit(); gs.recordCorrectHit(); gs.recordCorrectHit();
    gs.recordCorrectHit(); // 4th hit while active — should not change state
    expect(gs.streakCount).toBe(3);
    expect(gs.streakActive).toBe(true);
  });

  it('resetLevel resets streak fields', () => {
    const { gs } = makeState();
    gs.recordCorrectHit(); gs.recordCorrectHit(); gs.recordCorrectHit();
    gs.resetLevel();
    expect(gs.streakCount).toBe(0);
    expect(gs.streakActive).toBe(false);
  });
});

describe('_resolveShot — streak charges on correct hits', () => {
  it('3 correct hits charge streakActive via recordCorrectHit', () => {
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs);

    for (let i = 0; i < 3; i++) {
      // Add a fresh car each time — previous one may have been pushed off by grid advance
      lanes[0].cars.length = 0;
      addCar(lanes, loop);
      loop._resolveShot(new Shooter({ color: 'Red', damage: 1, column: 0 }), 0);
    }

    expect(gs.streakActive).toBe(true);
  });

  it('wrong-color shot calls recordMiss and resets streak count', () => {
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs);

    // Charge 2 hits
    for (let i = 0; i < 2; i++) {
      lanes[0].cars.length = 0;
      addCar(lanes, loop);
      loop._resolveShot(new Shooter({ color: 'Red', damage: 1, column: 0 }), 0);
    }
    expect(gs.streakCount).toBe(2);

    // Wrong-color shot
    lanes[0].cars.length = 0;
    addCar(lanes, loop, { color: 'Red' });
    loop._resolveShot(new Shooter({ color: 'Blue', damage: 1, column: 0 }), 0);

    expect(gs.streakCount).toBe(0);
    expect(gs.streakActive).toBe(false);
  });
});

describe('_resolveShot — power shot fires on charged streak', () => {
  it('power shot deals 2× damage vs normal shot', () => {
    const { gs, lanes } = makeState();
    const onHit = vi.fn();
    const loop  = makeLoop(gs, { onHit });

    // Charge streak to active
    gs.streakCount  = 3;
    gs.streakActive = true;

    // Place a car with enough HP to survive the power shot (damage=3 → power=6, hp=20)
    const car = addCar(lanes, loop, { color: 'Red', hp: 20 });
    const hpBefore = car.hp;

    loop._resolveShot(new Shooter({ color: 'Red', damage: 3, column: 0 }), 0);

    expect(car.hp).toBe(hpBefore - 6);  // 2× damage = 6
  });

  it('wasStreakShot=true passed as 6th arg to onHit callback', () => {
    const { gs, lanes } = makeState();
    const onHit = vi.fn();
    const loop  = makeLoop(gs, { onHit });

    gs.streakCount  = 3;
    gs.streakActive = true;

    addCar(lanes, loop, { color: 'Red', hp: 20 });
    loop._resolveShot(new Shooter({ color: 'Red', damage: 3, column: 0 }), 0);

    expect(onHit).toHaveBeenCalledOnce();
    const [,,,,,wasStreakShot] = onHit.mock.calls[0];
    expect(wasStreakShot).toBe(true);
  });

  it('non-streak correct hit passes wasStreakShot=false to onHit', () => {
    const { gs, lanes } = makeState();
    const onHit = vi.fn();
    const loop  = makeLoop(gs, { onHit });

    addCar(lanes, loop, { color: 'Red', hp: 20 });
    loop._resolveShot(new Shooter({ color: 'Red', damage: 3, column: 0 }), 0);

    const [,,,,,wasStreakShot] = onHit.mock.calls[0];
    expect(wasStreakShot).toBe(false);
  });

  it('power shot consumes streak: streakActive=false after firing', () => {
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs);

    gs.streakCount  = 3;
    gs.streakActive = true;

    addCar(lanes, loop, { color: 'Red', hp: 20 });
    loop._resolveShot(new Shooter({ color: 'Red', damage: 3, column: 0 }), 0);

    expect(gs.streakActive).toBe(false);
    expect(gs.streakCount).toBe(0);
  });

  it('surviving car skips its grid advance on the power shot turn', () => {
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs);

    gs.streakCount  = 3;
    gs.streakActive = true;

    // Place car at row 2 — if it advances normally it goes to row 3.
    const car = addCar(lanes, loop, { color: 'Red', hp: 20, row: 2 });
    loop._resolveShot(new Shooter({ color: 'Red', damage: 3, column: 0 }), 0);

    // Car must NOT have advanced this grid tick (slow consumed the advance within resolve).
    expect(car.row).toBe(2);
  });

  it('killed car does NOT get slowedTurns (car is removed)', () => {
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs);

    gs.streakCount  = 3;
    gs.streakActive = true;

    // hp=4 < 2×3=6 → car dies from power shot
    const car = addCar(lanes, loop, { color: 'Red', hp: 4 });
    loop._resolveShot(new Shooter({ color: 'Red', damage: 3, column: 0 }), 0);

    // Car removed from lane; slowedTurns should NOT be 1
    expect(lanes[0].cars.includes(car)).toBe(false);
    expect(car.slowedTurns ?? 0).toBe(0);
  });
});

describe('_advanceGrid — slowed car skips one advance', () => {
  it('car with slowedTurns=1 does not advance on the next grid tick', () => {
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs);

    const car = addCar(lanes, loop, { color: 'Red', hp: 20, row: 2 });
    car.slowedTurns = 1;
    const rowBefore = car.row;

    loop._advanceGrid();

    expect(car.slowedTurns).toBe(0);   // decremented
    expect(car.row).toBe(rowBefore);   // did NOT advance
  });

  it('car resumes advancing after slowedTurns reaches 0', () => {
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs);

    const car = addCar(lanes, loop, { color: 'Red', hp: 20, row: 2 });
    car.slowedTurns = 1;

    loop._advanceGrid();  // skip
    loop._advanceGrid();  // normal advance

    expect(car.row).toBe(3);   // advanced exactly once over two grid ticks
  });

  it('car with no slowedTurns advances normally', () => {
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs);

    const car = addCar(lanes, loop, { color: 'Red', hp: 20, row: 2 });
    loop._advanceGrid();

    expect(car.row).toBe(3);
  });
});
