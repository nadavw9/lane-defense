// Tests for the booster redesign (FIX 4):
//   - BoosterState COLOR CHANGE lifecycle (activate / select car / consume / cancel)
//   - colorChangeThresholdForLevel tier defaults
//   - GameLoop.applyColorChange recolors matching on-screen cars + consumes a charge
//   - GameLoop._checkColorChangeEarn earns once when level coins cross the threshold
//   - GameLoop.prepareForRescue refills empty columns the breach skipped

import { describe, it, expect, vi } from 'vitest';
import { GameLoop }        from '../src/game/GameLoop.js';
import { GameState }       from '../src/game/GameState.js';
import { BoosterState }    from '../src/game/BoosterState.js';
import { CombatResolver }  from '../src/game/CombatResolver.js';
import { CarDirector }     from '../src/director/CarDirector.js';
import { ShooterDirector } from '../src/director/ShooterDirector.js';
import { FairnessArbiter } from '../src/director/FairnessArbiter.js';
import { IntensityPhase }  from '../src/director/IntensityPhase.js';
import { SeededRandom }    from '../src/utils/SeededRandom.js';
import { Lane }            from '../src/models/Lane.js';
import { Column }          from '../src/models/Column.js';
import { Car }             from '../src/models/Car.js';
import { colorChangeThresholdForLevel } from '../src/game/LevelManager.js';

const mockApp = { ticker: { add: vi.fn(), remove: vi.fn() } };

function makeState({ laneCount = 4 } = {}) {
  const lanes    = Array.from({ length: laneCount }, (_, id) => new Lane({ id }));
  const columns  = Array.from({ length: 4 }, (_, id) => new Column({ id }));
  const phaseMan = new IntensityPhase(90);
  const gs = new GameState({
    lanes, columns,
    colors:   ['Red', 'Blue', 'Green', 'Yellow'],
    world:    { hpMultiplier: 1, speed: { base: 5, variance: 0.5 } },
    duration: 90, phaseMan, laneCount, colCount: 4,
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

describe('BoosterState — COLOR CHANGE lifecycle', () => {
  it('does not activate without a charge', () => {
    const bs = new BoosterState();
    expect(bs.activateColorChange()).toBe(false);
    expect(bs.colorChangeMode).toBe(false);
  });

  it('activates, records a car colour, then consumes one charge', () => {
    const bs = new BoosterState();
    bs.colorChange = 2;
    expect(bs.activateColorChange()).toBe(true);
    expect(bs.colorChangeMode).toBe(true);
    expect(bs.setColorChangeCar('Red')).toBe(true);
    expect(bs.colorChangeFromColor).toBe('Red');
    expect(bs.consumeColorChange()).toBe(true);
    expect(bs.colorChange).toBe(1);
    expect(bs.colorChangeMode).toBe(false);
    expect(bs.colorChangeFromColor).toBe(null);
  });

  it('cancel clears mode without spending a charge', () => {
    const bs = new BoosterState();
    bs.colorChange = 1;
    bs.activateColorChange();
    bs.cancelColorChange();
    expect(bs.colorChangeMode).toBe(false);
    expect(bs.colorChange).toBe(1);
  });

  it('has no swap API anymore', () => {
    const bs = new BoosterState();
    expect(bs.swap).toBeUndefined();
    expect(bs.activateSwap).toBeUndefined();
    expect(bs.tapSwapColumn).toBeUndefined();
  });
});

describe('colorChangeThresholdForLevel — tier defaults', () => {
  it('uses the per-tier defaults with boss premium', () => {
    expect(colorChangeThresholdForLevel(1)).toBe(60);
    expect(colorChangeThresholdForLevel(5)).toBe(60);
    expect(colorChangeThresholdForLevel(6)).toBe(80);
    expect(colorChangeThresholdForLevel(15)).toBe(80);
    expect(colorChangeThresholdForLevel(16)).toBe(100);
    expect(colorChangeThresholdForLevel(29)).toBe(100);
    expect(colorChangeThresholdForLevel(31)).toBe(120);
    // Bosses cost the most.
    for (const boss of [10, 20, 30, 40]) expect(colorChangeThresholdForLevel(boss)).toBe(150);
  });
});

describe('GameLoop.applyColorChange', () => {
  it('recolors every on-screen car of the source colour and consumes a charge', () => {
    const { gs, lanes } = makeState({ laneCount: 3 });
    const bs = new BoosterState(); bs.colorChange = 1;
    const loop = makeLoop(gs, { boosterState: bs });

    const red0 = new Car({ color: 'Red', hp: 5, speed: 5 }); red0.row = 4; red0.position = 44; lanes[0].addCar(red0);
    const red1 = new Car({ color: 'Red', hp: 5, speed: 5 }); red1.row = 6; red1.position = 66; lanes[1].addCar(red1);
    const blue = new Car({ color: 'Blue', hp: 5, speed: 5 }); blue.row = 5; blue.position = 55; lanes[2].addCar(blue);

    const changed = loop.applyColorChange('Red', 'Green');
    expect(changed).toBe(2);
    expect(lanes[0].cars[0].color).toBe('Green');
    expect(lanes[1].cars[0].color).toBe('Green');
    expect(lanes[2].cars[0].color).toBe('Blue');   // untouched
    expect(bs.colorChange).toBe(0);                 // charge spent
  });

  it('is a no-op (no charge spent) when nothing matches', () => {
    const { gs, lanes } = makeState({ laneCount: 2 });
    const bs = new BoosterState(); bs.colorChange = 1;
    const loop = makeLoop(gs, { boosterState: bs });
    const blue = new Car({ color: 'Blue', hp: 5, speed: 5 }); blue.row = 5; blue.position = 55; lanes[0].addCar(blue);

    expect(loop.applyColorChange('Red', 'Green')).toBe(0);
    expect(bs.colorChange).toBe(1);
  });
});

describe('GameLoop._checkColorChangeEarn', () => {
  it('earns exactly one COLOR CHANGE when coins first cross the threshold', () => {
    const { gs } = makeState();
    const bs = new BoosterState();
    const loop = makeLoop(gs, { boosterState: bs });
    loop._onColorChangeEarned = vi.fn();
    gs.colorChangeThreshold = 30;
    gs.colorChangeEarned    = false;

    gs.coins = 20; loop._checkColorChangeEarn();
    expect(bs.colorChange).toBe(0);                // below threshold

    gs.coins = 30; loop._checkColorChangeEarn();
    expect(bs.colorChange).toBe(1);                // crossed → earned
    expect(gs.colorChangeEarned).toBe(true);
    expect(loop._onColorChangeEarned).toHaveBeenCalledTimes(1);

    gs.coins = 90; loop._checkColorChangeEarn();
    expect(bs.colorChange).toBe(1);                // never earns twice in a level
  });
});

describe('GameLoop.prepareForRescue', () => {
  it('refills empty columns that the breach early-return skipped', () => {
    const { gs, lanes, columns } = makeState({ laneCount: 3 });
    const bs = new BoosterState();
    const loop = makeLoop(gs, { boosterState: bs });

    // A front car so shuffle/refill have a colour target.
    const car = new Car({ color: 'Red', hp: 5, speed: 5 }); car.row = 4; car.position = 44; lanes[0].addCar(car);
    // Empty every active column (simulating the depleted post-breach board).
    for (const col of gs.activeCols) col.shooters.length = 0;

    loop.prepareForRescue();

    const anyFilled = gs.activeCols.some((c) => c.top() != null);
    expect(anyFilled).toBe(true);   // player has bombs to deploy again
  });
});
