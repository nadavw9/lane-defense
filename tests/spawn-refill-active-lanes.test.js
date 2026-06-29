// Spawn refill across active lanes (regression for the <4-lane spawn bug):
// _refillLanes must evaluate EVERY active lane each advance and top each one up to
// laneTargetCarCount — never just lane 0, never a random subset, never a hardcoded
// 4 lanes. Inactive lanes (index >= activeLaneCount) must stay untouched.
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

const mockApp = { ticker: { add: vi.fn(), remove: vi.fn() } };

// Always build the full 4 Lane objects (as the live game does), but only mark
// `laneCount` of them active — so the test catches both a hardcoded-4 iteration
// (would fill inactive lanes) and a too-narrow iteration (would skip active lanes).
function makeLoop({ laneCount, laneTargetCarCount = 2, spawnBudget = 12, gridRows = 16 }) {
  const lanes    = Array.from({ length: 4 }, (_, id) => new Lane({ id }));
  const columns  = Array.from({ length: 4 }, (_, id) => new Column({ id }));
  const gs = new GameState({
    lanes, columns,
    colors:   ['Red', 'Blue', 'Green'],
    world:    { hpMultiplier: 1, speed: { base: 5, variance: 0.5 } },
    duration: 90, phaseMan: new IntensityPhase(90),
    laneCount, colCount: laneCount, gridRows,
    spawnBudget, laneTargetCarCount,
  });
  const rng  = new SeededRandom(7);
  const loop = new GameLoop({
    app: mockApp, gameState: gs,
    carDir:     new CarDirector({}, rng),
    shooterDir: new ShooterDirector({}, rng, new FairnessArbiter()),
    combatResolver: new CombatResolver(),
    rng, onEnd: vi.fn(), onAdvance: vi.fn(),
  });
  return { gs, loop };
}

describe('spawn refill — every active lane evaluated', () => {
  it('2-lane level: BOTH active lanes refill to laneTargetCarCount after an advance', () => {
    const { gs, loop } = makeLoop({ laneCount: 2, laneTargetCarCount: 2 });
    // Both active lanes start empty — both should be evaluated and filled.
    loop._refillLanes();
    expect(gs.lanes[0].cars.length).toBe(2);
    expect(gs.lanes[1].cars.length).toBe(2);
    // Not just lane 0: lane 1 must have received cars too.
    expect(gs.lanes[1].cars.length).toBeGreaterThan(0);
  });

  it('does not touch inactive lanes (no hardcoded 4) — lanes 2 and 3 stay empty', () => {
    const { gs, loop } = makeLoop({ laneCount: 2, laneTargetCarCount: 2 });
    loop._refillLanes();
    expect(gs.activeLaneCount).toBe(2);
    expect(gs.lanes[2].cars.length).toBe(0);
    expect(gs.lanes[3].cars.length).toBe(0);
  });

  it('3-lane level: all THREE active lanes get cars (not a random subset)', () => {
    const { gs, loop } = makeLoop({ laneCount: 3, laneTargetCarCount: 2 });
    loop._refillLanes();
    for (let li = 0; li < 3; li++) {
      expect(gs.lanes[li].cars.length).toBe(2);
    }
    expect(gs.lanes[3].cars.length).toBe(0);
  });

  it('a single drained active lane is topped back up to target in one advance', () => {
    const { gs, loop } = makeLoop({ laneCount: 2, laneTargetCarCount: 2 });
    loop._primeInitialCars();          // both lanes prime to 3 cars (rows 0,1,2)
    gs.lanes[0].cars = [];             // simulate the player clearing lane 0
    loop._advanceGrid();               // moves cars, then refills every active lane
    // Lane 0 was emptied → refilled to target; lane 1 still above target (kept its cars).
    expect(gs.lanes[0].cars.length).toBe(2);
    expect(gs.lanes[1].cars.length).toBeGreaterThanOrEqual(2);
    // Front-car invariant preserved (cars[0] is the highest row in the lane).
    const rows = gs.lanes[0].cars.map(c => c.row);
    expect(gs.lanes[0].frontCar().row).toBe(Math.max(...rows));
  });

  it('new spawns occupy distinct rows (no two cars stacked at the same position)', () => {
    const { gs, loop } = makeLoop({ laneCount: 2, laneTargetCarCount: 3 });
    loop._refillLanes();
    const rows = gs.lanes[0].cars.map(c => c.row);
    expect(new Set(rows).size).toBe(rows.length);   // all distinct
  });
});
