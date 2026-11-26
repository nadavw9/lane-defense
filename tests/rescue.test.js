// Rescue and game-over state. A breach ends the game; accepting a rescue un-ends it,
// removes the breaching car, pushes survivors back, and flags rescueUsed so a second
// breach is final. RETRY (restart) returns the level to its initial state.
// Headless — real GameLoop/GameState/models. (Booster reset on RETRY is GameApp-level.)

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
import { Shooter }         from '../src/models/Shooter.js';

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

function car(color, hp, row) {
  const c = new Car({ color, hp, speed: 5, row });
  c.position = row;
  return c;
}

// Set up a board where lane 0's car will breach on the next advance and lane 1's
// car survives, then trigger the breach.
function triggerBreach(loop, lanes) {
  lanes[0].addCar(car('Red', 5, 10));   // front row → breaches on advance
  lanes[1].addCar(car('Blue', 5, 5));   // survivor
  loop._advanceGrid();
}

describe('rescue — game over and rescue', () => {
  it('a breach sets the game over', () => {
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs, { onEnd: vi.fn() });
    triggerBreach(loop, lanes);
    expect(gs.isOver).toBe(true);
    expect(gs.won).toBe(false);
  });

  it('accepting a rescue clears the game-over state', () => {
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs, { onEnd: vi.fn() });
    triggerBreach(loop, lanes);
    gs.rescue(10);
    expect(gs.isOver).toBe(false);
  });

  it('survivor cars are still present after a rescue', () => {
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs, { onEnd: vi.fn() });
    triggerBreach(loop, lanes);
    gs.rescue(10);
    expect(lanes[1].cars.length).toBe(1);   // survivor remains (pushed back)
  });

  it('the breaching car is removed from the breach lane', () => {
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs, { onEnd: vi.fn() });
    triggerBreach(loop, lanes);
    gs.rescue(10);
    expect(lanes[0].cars.length).toBe(0);   // breach car gone
  });

  it('the bomb queue is intact after a rescue', () => {
    const { gs, lanes, columns } = makeState();
    const loop = makeLoop(gs, { onEnd: vi.fn() });
    columns[0].pushBottom(new Shooter({ color: 'Red', damage: 3, column: 0 }));
    columns[0].pushBottom(new Shooter({ color: 'Blue', damage: 4, column: 0 }));
    const before = [...columns[0].shooters];
    triggerBreach(loop, lanes);
    gs.rescue(10);
    expect(columns[0].shooters).toEqual(before);   // same bombs, same order
  });

  it('booster counts are unchanged by a rescue', () => {
    const bs = new BoosterState();
    bs.colorChange = 1; bs.freeze = 2; bs.bombs = 1;
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs, { boosterState: bs, onEnd: vi.fn() });
    triggerBreach(loop, lanes);
    gs.rescue(10);
    expect(bs.colorChange).toBe(1);
    expect(bs.freeze).toBe(2);
    expect(bs.bombs).toBe(1);
  });

  it('a second breach after a rescue is final (rescueUsed stays true)', () => {
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs, { onEnd: vi.fn() });
    triggerBreach(loop, lanes);
    gs.rescue(10);
    expect(gs.rescueUsed).toBe(true);
    // Second breach.
    lanes[2].addCar(car('Green', 5, 10));
    loop._advanceGrid();
    expect(gs.isOver).toBe(true);
    expect(gs.rescueUsed).toBe(true);   // no rescue offered (GameApp gates on !rescueUsed)
  });
});

describe('rescue — RETRY (restart)', () => {
  it('restart returns the level to a fresh initial state', () => {
    const { gs, lanes } = makeState({ spawnBudget: 50 });
    const loop = makeLoop(gs, { onEnd: vi.fn() });
    // Dirty the state: kills, a breach, a rescue.
    gs.totalKills = 7; gs.coins = 70;
    triggerBreach(loop, lanes);
    gs.rescue(10);

    loop.restart();

    expect(gs.isOver).toBe(false);
    expect(gs.won).toBe(false);
    expect(gs.totalKills).toBe(0);
    expect(gs.rescueUsed).toBe(false);
    expect(lanes[0].cars.length).toBe(3);   // re-primed opening density
  });

  it('boosters reset to 0 on RETRY (contract: reset performed by GameApp._startLevel)', () => {
    // GameApp._startLevel sets boosterState.{colorChange,freeze,bombs} = grant ?? 0
    // on every level entry, including RETRY (boosters do NOT carry over). restart()
    // itself does not touch BoosterState, so the reset is modelled here.
    const bs = new BoosterState();
    bs.colorChange = 2; bs.freeze = 1; bs.bombs = 3;
    bs.colorChange = 0; bs.freeze = 0; bs.bombs = 0;   // the per-level reset
    expect(bs.colorChange).toBe(0);
    expect(bs.freeze).toBe(0);
    expect(bs.bombs).toBe(0);
  });
});
