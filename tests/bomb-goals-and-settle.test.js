// BOMB booster — goal credit and post-clear settle (2026-09-27).
//
// Two live defects, both found by reading GameLoop.placeBombOnLane against the sim:
//
// 1. GOAL CREDIT. Every other kill path (combat, rainbow colour bomb) calls
//    gs.applyKillToGoals for each destroyed car. placeBombOnLane never did — not in
//    the row-clear era, not after the lane-clear conversion, not since the goal
//    system landed (d88a990). So on a goal level, cars destroyed by BOMB counted for
//    nothing. SimulationRunner, meanwhile, DID credit BOMB kills (sim line ~433), so
//    every balance number assumed a BOMB the player never actually got.
//
// 2. EMPTY-BOARD SOFT-LOCK. A BOMB removes cars without a grid advance, and lanes
//    only refill inside _advanceGrid. If the cleared lane was the only one holding
//    cars (L1 is a single lane; the bomb charge arrives at 10 kills of a 13-kill
//    goal), nothing can be fired at, so nothing advances, so nothing refills —
//    the level freezes with no way to win or lose.
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

function makeState({ laneCount = 3, goals = [], ltc = 2 } = {}) {
  const lanes   = Array.from({ length: laneCount }, (_, id) => new Lane({ id }));
  const columns = Array.from({ length: laneCount }, (_, id) => new Column({ id }));
  const gs = new GameState({
    lanes, columns,
    colors:   ['Red', 'Blue', 'Green'],
    world:    { hpMultiplier: 1, speed: { base: 5, variance: 0.5 } },
    duration: 90, phaseMan: new IntensityPhase(90),
    laneCount, colCount: laneCount, gridRows: 8,
    spawnBudget: 10, laneTargetCarCount: ltc, goals,
  });
  return { gs, lanes };
}

function makeLoop(gs, bombs = 1) {
  const rng = new SeededRandom(7);
  const boosterState = {
    bombs, bombsMax: 3,
    consumeBomb() { if (this.bombs <= 0) return false; this.bombs--; return true; },
    isFrozen() { return false; },
  };
  const loop = new GameLoop({
    app: mockApp, gameState: gs,
    carDir:     new CarDirector({}, rng),
    shooterDir: new ShooterDirector({}, rng, new FairnessArbiter()),
    combatResolver: new CombatResolver(), rng, boosterState,
  });
  loop._onEnd = vi.fn();
  return loop;
}

function addCar(lane, color, row, type = 'big') {
  const c = new Car({ color, hp: 5, speed: 5, type });
  c.row = row; c.position = row * 10;
  lane.addCar(c);
  return c;
}

describe('BOMB booster credits level goals', () => {
  it('destroyColor goals count cars destroyed by BOMB', () => {
    const { gs, lanes } = makeState({ goals: [{ type: 'destroyColor', color: 'Red', count: 9 }] });
    const loop = makeLoop(gs);
    addCar(lanes[0], 'Red', 5);
    addCar(lanes[0], 'Red', 3);
    addCar(lanes[0], 'Blue', 1);
    addCar(lanes[1], 'Red', 4);          // other lane — must NOT be credited
    loop.placeBombOnLane(0, 5);
    expect(gs.goalProgress[0]).toBe(7);  // 9 − the two red cars in lane 0
  });

  it('destroyType and destroyTotal goals count BOMB kills', () => {
    const { gs, lanes } = makeState({ goals: [
      { type: 'destroyType', carType: 'bigrig', count: 1 },
      { type: 'destroyTotal', count: 10 },
    ] });
    const loop = makeLoop(gs);
    addCar(lanes[2], 'Green', 6, 'bigrig');
    addCar(lanes[2], 'Blue',  2, 'small');
    loop.placeBombOnLane(2, 6);
    expect(gs.goalProgress).toEqual([0, 8]);
  });

  it('a BOMB that completes the goals wins the level', () => {
    const { gs, lanes } = makeState({ goals: [{ type: 'destroyColor', color: 'Red', count: 2 }] });
    const loop = makeLoop(gs);
    addCar(lanes[1], 'Red', 6);
    addCar(lanes[1], 'Red', 2);
    addCar(lanes[0], 'Blue', 5);
    loop.placeBombOnLane(1, 6);
    expect(gs.isOver).toBe(true);
    expect(loop._onEnd).toHaveBeenCalledWith(true);
  });
});

describe('BOMB never leaves an unplayable empty board', () => {
  it('refills when the cleared lane was the only one with cars (1-lane L1 shape)', () => {
    const { gs, lanes } = makeState({ laneCount: 1, ltc: 1,
      goals: [{ type: 'destroyTotal', count: 13 }] });
    const loop = makeLoop(gs);
    addCar(lanes[0], 'Red', 6);
    loop.placeBombOnLane(0, 6);
    expect(gs.isOver).toBe(false);
    expect(lanes[0].cars.length).toBeGreaterThan(0);   // playable again
    expect(lanes[0].cars.every(c => c.row <= 1)).toBe(true); // fresh spawn, not an advance
  });

  it('does NOT refill or advance when other lanes still hold cars', () => {
    const { gs, lanes } = makeState({ goals: [{ type: 'destroyTotal', count: 20 }] });
    const loop = makeLoop(gs);
    addCar(lanes[0], 'Red', 6);
    const survivor = addCar(lanes[1], 'Blue', 4);
    loop.placeBombOnLane(0, 6);
    expect(lanes[0].cars.length).toBe(0);      // cleared lane stays clear this turn
    expect(survivor.row).toBe(4);              // nobody moved
  });
});
