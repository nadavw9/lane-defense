// Win detection, checked inside _advanceGrid after a shot resolves. Two modes:
//   • goal mode    — win when all goals are met (goalProgress all zero).
//   • legacy mode  — win when totalKills reaches targetKills (no goals),
//                    regardless of cars still on the board.
// Win detection is config-agnostic, so boss levels use the same path.
// Headless — real GameLoop/GameState/CombatResolver/models.

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
import { Car }             from '../src/models/Car.js';

const mockApp = { ticker: { add: vi.fn(), remove: vi.fn() } };

function makeState(opts = {}) {
  const { laneCount = 4, ...rest } = opts;
  const lanes    = Array.from({ length: laneCount }, (_, id) => new Lane({ id }));
  const columns  = Array.from({ length: 4 }, (_, id) => new Column({ id }));
  const phaseMan = new IntensityPhase(90);
  const gs = new GameState({
    lanes, columns,
    colors:   ['Red', 'Blue', 'Green', 'Yellow'],
    world:    { hpMultiplier: 1, speed: { base: 5, variance: 0.5 } },
    duration: 90, phaseMan, laneCount, colCount: 4, gridRows: 11,
    ...rest,
  });
  return { gs, lanes, columns };
}

function makeLoop(gs, overrides = {}) {
  const rng     = new SeededRandom(1);
  const arbiter = new FairnessArbiter();
  return new GameLoop({
    app: mockApp, gameState: gs,
    carDir:     new CarDirector({}, rng),
    shooterDir: new ShooterDirector({}, rng, arbiter),
    combatResolver: new CombatResolver(),
    rng, ...overrides,
  });
}

function addCar(lane, color, hp, position, type = 'standard') {
  const c = new Car({ color, hp, speed: 5, row: 5, type });
  c.position = position;
  lane.addCar(c);
}
const shot = (color, damage) => ({ color, damage });

describe('win-condition — goal mode (destroy matching cars)', () => {
  it('fires the win when all goal progress reaches zero', () => {
    const onEnd = vi.fn();
    const goals = [{ type: 'destroyTotal', count: 1 }];
    const { gs, lanes } = makeState({ goals });
    const loop = makeLoop(gs, { onEnd });
    addCar(lanes[0], 'Red', 2, 80);
    loop._resolveShot(shot('Red', 5), 0);   // kills the goal car
    expect(onEnd).toHaveBeenCalledWith(true);
    expect(gs.won).toBe(true);
  });

  it('does not fire the win while goal progress remains', () => {
    const onEnd = vi.fn();
    const goals = [{ type: 'destroyTotal', count: 2 }];
    const { gs, lanes } = makeState({ goals });
    const loop = makeLoop(gs, { onEnd });
    addCar(lanes[0], 'Red', 5, 80);
    addCar(lanes[0], 'Red', 5, 70);
    loop._resolveShot(shot('Red', 5), 0);    // 5 damage kills the first car (hp=5)
    expect(gs.isOver).toBe(false);
    expect(onEnd).not.toHaveBeenCalled();
    expect(gs.goalProgress[0]).toBe(1);  // 1 of 2 goal cars destroyed
  });

  it('fires the win exactly once after all goals met', () => {
    const onEnd = vi.fn();
    const goals = [{ type: 'destroyTotal', count: 1 }];
    const { gs, lanes } = makeState({ goals });
    const loop = makeLoop(gs, { onEnd });
    addCar(lanes[0], 'Red', 2, 80);
    loop._resolveShot(shot('Red', 5), 0);    // win
    loop._resolveShot(shot('Red', 5), 0);    // fire again at the empty board
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('tracks goal progress for destroyColor goals', () => {
    const onEnd = vi.fn();
    const goals = [
      { type: 'destroyColor', color: 'Red', count: 1 },
      { type: 'destroyColor', color: 'Blue', count: 1 },
    ];
    const { gs, lanes } = makeState({ goals });
    const loop = makeLoop(gs, { onEnd });
    addCar(lanes[0], 'Red', 2, 80);
    addCar(lanes[1], 'Blue', 2, 80);
    // Kill Red goal car
    loop._resolveShot(shot('Red', 5), 0);
    expect(gs.goalProgress[0]).toBe(0);  // Red goal complete
    expect(gs.goalProgress[1]).toBe(1);  // Blue goal still pending
    expect(gs.isOver).toBe(false);
    // Kill Blue goal car
    loop._resolveShot(shot('Blue', 5), 1);
    expect(gs.goalProgress[1]).toBe(0);  // Blue goal complete
    expect(onEnd).toHaveBeenCalledWith(true);
  });

  it('fires the win on a boss-level config with goals (same detection path)', () => {
    const onEnd = vi.fn();
    const goals = [
      { type: 'destroyColor', color: 'Red', count: 1 },
      { type: 'destroyType', carType: 'tank', count: 1 },
    ];
    const { gs, lanes } = makeState({ goals, laneTargetCarCount: 3 });
    const loop = makeLoop(gs, { onEnd });
    addCar(lanes[0], 'Red', 5, 80, 'small');
    addCar(lanes[1], 'Blue', 20, 80, 'tank');
    // Kill Red goal
    loop._resolveShot(shot('Red', 5), 0);
    expect(gs.goalProgress[0]).toBe(0);
    expect(gs.goalProgress[1]).toBe(1);
    expect(gs.isOver).toBe(false);
    // Kill tank goal
    loop._resolveShot(shot('Blue', 20), 1);
    expect(gs.goalProgress[1]).toBe(0);
    expect(onEnd).toHaveBeenCalledWith(true);
    expect(gs.won).toBe(true);
  });
});

describe('win-condition — legacy kill goal', () => {
  it('fires the win once targetKills is reached even if cars remain on the board', () => {
    const onEnd = vi.fn();
    const { gs, lanes } = makeState({ spawnBudget: null, targetKills: 1 });
    const loop = makeLoop(gs, { onEnd });
    addCar(lanes[0], 'Red', 5, 80);
    addCar(lanes[0], 'Red', 5, 70);          // a 2nd car that will remain
    loop._resolveShot(shot('Red', 5), 0);    // 1 kill → reaches targetKills
    expect(onEnd).toHaveBeenCalledWith(true);
    expect(gs.won).toBe(true);
    expect(lanes[0].cars.length).toBe(1);    // non-goal car still on board
  });
});
