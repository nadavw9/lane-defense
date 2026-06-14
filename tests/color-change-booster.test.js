// COLOR CHANGE booster activation + recolor. BoosterState manages the two-tap
// activation lifecycle; GameLoop.applyColorChange(from, to) recolors every on-screen
// car of the source colour, consumes one charge, and keeps the board viable.
// Headless — real GameLoop/GameState/BoosterState/CombatResolver/models.

import { describe, it, expect, vi } from 'vitest';
import { GameLoop }        from '../src/game/GameLoop.js';
import { GameState }       from '../src/game/GameState.js';
import { CombatResolver }  from '../src/game/CombatResolver.js';
import { CarDirector }     from '../src/director/CarDirector.js';
import { ShooterDirector } from '../src/director/ShooterDirector.js';
import { FairnessArbiter } from '../src/director/FairnessArbiter.js';
import { IntensityPhase }  from '../src/director/IntensityPhase.js';
import { SeededRandom }    from '../src/utils/SeededRandom.js';
import { BoosterState }    from '../src/game/BoosterState.js';
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
    duration: 90, phaseMan, laneCount, colCount: 4, gridRows: 11, spawnBudget: 0,
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

describe('color-change-booster — activation', () => {
  it('does nothing when activated with 0 charges', () => {
    const bs = new BoosterState();   // 0 charges
    expect(bs.activateColorChange()).toBe(false);
    expect(bs.colorChangeMode).toBe(false);
  });

  it('consumes one charge when a recolor is applied', () => {
    const bs = new BoosterState();
    bs.colorChange = 1;
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs, { boosterState: bs });
    addCar(lanes[0], 'Red', 5, 80);
    const changed = loop.applyColorChange('Red', 'Blue');
    expect(changed).toBe(1);
    expect(bs.colorChange).toBe(0);   // charge spent
  });
});

describe('color-change-booster — recolor', () => {
  it('recolors every car matching the source colour to the target', () => {
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs);
    addCar(lanes[0], 'Red', 5, 80);
    addCar(lanes[1], 'Red', 5, 70);
    addCar(lanes[2], 'Red', 5, 60);
    const changed = loop.applyColorChange('Red', 'Green');
    expect(changed).toBe(3);
    expect(lanes[0].cars[0].color).toBe('Green');
    expect(lanes[1].cars[0].color).toBe('Green');
    expect(lanes[2].cars[0].color).toBe('Green');
  });

  it('leaves cars of other colours unchanged', () => {
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs);
    addCar(lanes[0], 'Red', 5, 80);
    addCar(lanes[1], 'Blue', 5, 70);
    loop.applyColorChange('Red', 'Green');
    expect(lanes[1].cars[0].color).toBe('Blue');   // untouched
  });

  it('does not affect a boss car (its colour is never a player source colour)', () => {
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs);
    addCar(lanes[0], 'Red', 5, 80);
    addCar(lanes[1], 'Boss', 20, 70, 'boss');
    loop.applyColorChange('Red', 'Blue');
    expect(lanes[1].cars[0].color).toBe('Boss');   // excluded
  });

  it('is a safe no-op on an empty board', () => {
    const { gs } = makeState();
    const loop = makeLoop(gs);
    expect(() => loop.applyColorChange('Red', 'Blue')).not.toThrow();
    expect(loop.applyColorChange('Red', 'Blue')).toBe(0);
  });

  it('writes the new colour into GameState', () => {
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs);
    addCar(lanes[0], 'Red', 5, 80);
    loop.applyColorChange('Red', 'Yellow');
    expect(gs.lanes[0].cars[0].color).toBe('Yellow');
  });

  it('makes the recolored car hittable by a bomb of the new colour', () => {
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs);
    addCar(lanes[0], 'Red', 10, 80);
    addCar(lanes[1], 'Green', 9, 70);   // bystander so the board never empties
    loop.applyColorChange('Red', 'Blue');     // car is now Blue
    loop._resolveShot(shot('Blue', 3), 0);    // a Blue bomb now matches it
    expect(lanes[0].cars[0].hp).toBe(7);      // took damage → the new colour is real
  });
});
