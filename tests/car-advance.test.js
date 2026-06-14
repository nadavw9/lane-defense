// Car grid-advance mechanics (turn-based): _advanceGrid moves every car one row
// toward the breach after a shot resolves, then checks breach/win and refills.
// Headless — real GameLoop/GameState/models, no Pixi/Three/DOM.

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

// gridRows=11 → MAX_ROW=10; a car breaches when it advances to row > 10.
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

function car(color, hp, row) {
  const c = new Car({ color, hp, speed: 5, row });
  c.position = row;
  return c;
}
const shot = (color, damage) => ({ color, damage });

describe('car-advance — breach', () => {
  it('a car that advances past the last row triggers game over', () => {
    const onEnd = vi.fn();
    const { gs, lanes } = makeState({ laneCount: 4, spawnBudget: 0 });
    const loop = makeLoop(gs, { onEnd });
    lanes[0].addCar(car('Red', 5, 10));   // at the front row; next advance breaches
    loop._advanceGrid();
    expect(gs.isOver).toBe(true);
    expect(gs.won).toBe(false);
    expect(onEnd).toHaveBeenCalledWith(false, 0);
  });
});

describe('car-advance — stepping', () => {
  it('advances cars exactly one row per shot fired', () => {
    const { gs, lanes } = makeState({ laneCount: 4, spawnBudget: 0 });
    const loop = makeLoop(gs);
    lanes[0].addCar(car('Red', 10, 3));   // survives a damage-3 shot
    loop._resolveShot(shot('Red', 3), 0);
    expect(lanes[0].cars[0].hp).toBe(7);  // survived
    expect(lanes[0].cars[0].row).toBe(4); // advanced exactly 1
  });

  it('all cars in the same lane advance together', () => {
    const { gs, lanes } = makeState({ laneCount: 2, spawnBudget: 0 });
    const loop = makeLoop(gs);
    lanes[0].addCar(car('Red', 5, 0));
    lanes[0].addCar(car('Red', 5, 1));
    lanes[0].addCar(car('Red', 5, 2));
    loop._advanceGrid();
    const rows = lanes[0].cars.map(c => c.row).sort((a, b) => a - b);
    expect(rows).toEqual([1, 2, 3]);
  });

  it('cars in different lanes advance independently', () => {
    const { gs, lanes } = makeState({ laneCount: 4, spawnBudget: 0 });
    const loop = makeLoop(gs);
    lanes[0].addCar(car('Red', 5, 1));
    lanes[1].addCar(car('Blue', 5, 3));
    loop._advanceGrid();
    expect(lanes[0].cars[0].row).toBe(2);
    expect(lanes[1].cars[0].row).toBe(4);
  });
});

describe('car-advance — empty lanes', () => {
  it('shooting an empty lane does not crash or advance the grid', () => {
    const { gs, lanes } = makeState({ laneCount: 4, spawnBudget: 0 });
    const loop = makeLoop(gs);
    lanes[1].addCar(car('Red', 5, 3));   // bystander in another lane
    expect(() => loop._resolveShot(shot('Red', 5), 0)).not.toThrow();
    expect(gs.isOver).toBe(false);
    expect(lanes[1].cars[0].row).toBe(3); // no advance happened
  });

  it('after the last car in a lane is destroyed, no further advances occur there', () => {
    const { gs, lanes } = makeState({ laneCount: 4, spawnBudget: 0 });
    const loop = makeLoop(gs);
    lanes[0].addCar(car('Red', 2, 5));
    lanes[1].addCar(car('Blue', 5, 5)); // keeps the board non-empty (no win)
    loop._resolveShot(shot('Red', 5), 0);  // kills lane 0's only car
    expect(lanes[0].cars.length).toBe(0);
    const lane1Row = lanes[1].cars[0].row;
    loop._resolveShot(shot('Red', 5), 0);  // fire again at the now-empty lane
    expect(lanes[0].cars.length).toBe(0);          // still empty, no crash
    expect(lanes[1].cars[0].row).toBe(lane1Row);   // empty-lane shot did not advance
  });
});

describe('car-advance — spawning', () => {
  it('spawns a new car after advance when spawnBudget > 0', () => {
    const { gs, lanes } = makeState({ laneCount: 1, spawnBudget: 5, laneTargetCarCount: 2 });
    const loop = makeLoop(gs);
    lanes[0].addCar(car('Red', 5, 5));   // 1 car, room for a refill
    loop._advanceGrid();
    expect(lanes[0].cars.length).toBe(2);
    expect(gs.spawnBudget).toBe(4);
  });

  it('does not spawn a new car when spawnBudget = 0', () => {
    const { gs, lanes } = makeState({ laneCount: 1, spawnBudget: 0, laneTargetCarCount: 2 });
    const loop = makeLoop(gs);
    lanes[0].addCar(car('Red', 5, 5));
    loop._advanceGrid();
    expect(lanes[0].cars.length).toBe(1);
    expect(gs.spawnBudget).toBe(0);
  });
});

describe('car-advance — opening density', () => {
  it('every active lane opens with 3 cars at rows 0, 1, 2', () => {
    const { gs, lanes } = makeState({ laneCount: 4, spawnBudget: 50 });
    const loop = makeLoop(gs);
    loop._primeInitialCars();
    for (let i = 0; i < gs.activeLaneCount; i++) {
      const rows = lanes[i].cars.map(c => c.row).sort((a, b) => a - b);
      expect(rows).toEqual([0, 1, 2]);
    }
  });
});
