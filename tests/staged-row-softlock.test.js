// Row 0 is a hidden staging row (behind the goal band). A refill that leaves
// every car at row 0 shows an EMPTY road in a turn-based game where nothing
// moves until the player shoots — a soft-lock. Reported on device 2026-09-28:
// L1, kill the first motorbike, "no other car appears".
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
import { revealStagedCars } from '../src/director/TrafficRules.js';

const mockApp = { ticker: { add: vi.fn(), remove: vi.fn() } };

function makeLoop({ laneCount, laneTargetCarCount = 1, gridRows = 8 }) {
  const lanes   = Array.from({ length: 4 }, (_, id) => new Lane({ id }));
  const columns = Array.from({ length: 4 }, (_, id) => new Column({ id }));
  const gs = new GameState({
    lanes, columns, colors: ['Red'],
    world: { hpMultiplier: 0.3, speed: { base: 5, variance: 0.3 } },
    duration: 60, phaseMan: new IntensityPhase(60),
    laneCount, colCount: laneCount, gridRows, spawnBudget: 5, laneTargetCarCount,
    goals: [{ type: 'destroyTotal', count: 10 }],
  });
  const rng = new SeededRandom(3);
  const loop = new GameLoop({
    app: mockApp, gameState: gs,
    carDir: new CarDirector({}, rng),
    shooterDir: new ShooterDirector({}, rng, new FairnessArbiter()),
    combatResolver: new CombatResolver(), rng, onEnd: vi.fn(), onAdvance: vi.fn(),
  });
  return { gs, loop };
}

const visible = (gs) => gs.lanes.slice(0, gs.activeLaneCount).flatMap(l => l.cars).filter(c => c.row >= 1);

describe('staged row 0 never leaves an empty-looking road', () => {
  it('L1 shape: after the only visible car dies, the next car is visible (row >= 1)', () => {
    const { gs, loop } = makeLoop({ laneCount: 1 });
    gs.lanes[0].cars = [];            // the player killed everything on the board
    loop._advanceGrid();              // the shot's advance → refill
    expect(gs.lanes[0].cars.length).toBe(1);
    expect(visible(gs).length).toBe(1);
  });

  it('booster clear of the whole board also refills to a visible car', () => {
    const { gs, loop } = makeLoop({ laneCount: 1 });
    gs.lanes[0].cars = [];
    loop._settleAfterClear();
    expect(visible(gs).length).toBeGreaterThan(0);
  });

  it('does not touch a live board: row-0 spawns stay staged when something is visible', () => {
    const lanes = [[{ row: 3 }, { row: 0 }], [{ row: 0 }]];
    expect(revealStagedCars(lanes)).toBe(false);
    expect(lanes[1][0].row).toBe(0);
  });

  it('empty board: nothing to reveal', () => {
    expect(revealStagedCars([[], []])).toBe(false);
  });

  it('three lanes all staged: every staged car steps in', () => {
    const lanes = [[{ row: 0 }], [{ row: 0 }], [{ row: 0 }]];
    expect(revealStagedCars(lanes)).toBe(true);
    expect(lanes.flat().every(c => c.row === 1)).toBe(true);
  });
});
