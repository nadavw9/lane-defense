// Win detection, checked inside _advanceGrid after a shot resolves. Two modes:
//   • budget mode  — win when spawnBudget is spent AND every active lane is empty.
//   • legacy mode  — win when totalKills reaches targetKills (spawnBudget === null),
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

describe('win-condition — budget mode (clear the board)', () => {
  it('fires the win when all cars are destroyed and the budget is spent', () => {
    const onEnd = vi.fn();
    const { gs, lanes } = makeState({ spawnBudget: 0 });
    const loop = makeLoop(gs, { onEnd });
    addCar(lanes[0], 'Red', 2, 80);
    loop._resolveShot(shot('Red', 5), 0);   // kills the last car
    expect(onEnd).toHaveBeenCalledWith(true);
    expect(gs.won).toBe(true);
  });

  it('does not fire the win while goal cars remain on the board', () => {
    const onEnd = vi.fn();
    const { gs, lanes } = makeState({ spawnBudget: 0 });
    const loop = makeLoop(gs, { onEnd });
    addCar(lanes[0], 'Red', 5, 80);
    addCar(lanes[0], 'Red', 5, 70);          // a 2nd car behind
    loop._resolveShot(shot('Red', 5), 0);    // kills only the front (exact HP)
    expect(gs.isOver).toBe(false);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('fires the win exactly once', () => {
    const onEnd = vi.fn();
    const { gs, lanes } = makeState({ spawnBudget: 0 });
    const loop = makeLoop(gs, { onEnd });
    addCar(lanes[0], 'Red', 2, 80);
    loop._resolveShot(shot('Red', 5), 0);    // win
    loop._resolveShot(shot('Red', 5), 0);    // fire again at the empty board
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('does not win while spawnBudget remains (more cars still coming)', () => {
    const onEnd = vi.fn();
    const { gs, lanes } = makeState({ spawnBudget: 5 });
    const loop = makeLoop(gs, { onEnd });
    addCar(lanes[0], 'Red', 2, 80);
    loop._resolveShot(shot('Red', 5), 0);    // clears the visible car, but budget > 0
    expect(gs.isOver).toBe(false);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('fires the win on a boss-level config (same detection path)', () => {
    const onEnd = vi.fn();
    const { gs, lanes } = makeState({ spawnBudget: 0, laneTargetCarCount: 3 });
    const loop = makeLoop(gs, { onEnd });
    addCar(lanes[0], 'Red', 5, 80, 'boss');  // boss car, matchable colour
    loop._resolveShot(shot('Red', 5), 0);    // destroys the boss → board clear
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
