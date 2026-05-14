// Tests for _resolveShot() grid-advance behavior after the wrong-color fix:
//   - Color match → damage dealt → grid advances
//   - Color mismatch → no damage → grid does NOT advance
//   - Color mismatch on empty lane → no advance

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

function makeState({ laneCount = 2, colCount = 2 } = {}) {
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

describe('_resolveShot() — grid advance only on color match', () => {
  it('correct color match: damage is dealt and cars advance one row', () => {
    const { gs, lanes } = makeState({ laneCount: 1 });
    const loop = makeLoop(gs);

    const car = new Car({ color: 'Red', hp: 10, speed: 5 });
    car.row = 2; car.position = loop._rowToPosition(2, 10);
    lanes[0].addCar(car);

    loop._resolveShot(new Shooter({ color: 'Red', damage: 3, column: 0 }), 0);

    expect(car.hp).toBe(7);      // damage dealt
    expect(car.row).toBe(3);     // grid advanced
  });

  it('wrong color: no damage dealt, cars do NOT advance', () => {
    const { gs, lanes } = makeState({ laneCount: 1 });
    const onMiss = vi.fn();
    const loop   = makeLoop(gs, { onMiss });

    const car = new Car({ color: 'Red', hp: 10, speed: 5 });
    car.row = 2; car.position = loop._rowToPosition(2, 10);
    lanes[0].addCar(car);

    loop._resolveShot(new Shooter({ color: 'Blue', damage: 3, column: 0 }), 0);

    expect(car.hp).toBe(10);     // no damage
    expect(car.row).toBe(2);     // no advance
    expect(onMiss).toHaveBeenCalledOnce();
  });

  it('wrong color: cars in OTHER lanes also do not advance (no cross-lane advance on miss)', () => {
    const { gs, lanes } = makeState({ laneCount: 2 });
    const loop = makeLoop(gs);

    // Lane 0: car that will get the wrong-color shot
    const car0 = new Car({ color: 'Red', hp: 10, speed: 5 });
    car0.row = 2; car0.position = loop._rowToPosition(2, 10);
    lanes[0].addCar(car0);

    // Lane 1: bystander car — should NOT advance when lane 0 gets a miss
    const car1 = new Car({ color: 'Blue', hp: 10, speed: 5 });
    car1.row = 3; car1.position = loop._rowToPosition(3, 10);
    lanes[1].addCar(car1);

    // Fire wrong color into lane 0
    loop._resolveShot(new Shooter({ color: 'Blue', damage: 3, column: 0 }), 0);

    expect(car0.row).toBe(2);   // target lane: no advance
    expect(car1.row).toBe(3);   // other lane: no advance either
  });
});
