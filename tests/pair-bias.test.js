// Spawning for BRIDGES (2026-10-31): from the bridges level, a car arriving beside a car that
// just arrived in the previous lane at the same row copies its colour with probability PAIR_P,
// so side-by-side pairs (the raw material of a bridge) are common on the board. A scripted colour
// (L1 firstColors) wins; a neighbour colour outside the palette is ignored; bias 0 = the old
// uniform pick with no extra rng draw.
import { describe, it, expect, vi } from 'vitest';
import { CarDirector }     from '../src/director/CarDirector.js';
import { SeededRandom }    from '../src/utils/SeededRandom.js';
import { PAIR_P }          from '../src/director/DirectorConfig.js';
import { GameLoop }        from '../src/game/GameLoop.js';
import { GameState }       from '../src/game/GameState.js';
import { CombatResolver }  from '../src/game/CombatResolver.js';
import { ShooterDirector } from '../src/director/ShooterDirector.js';
import { FairnessArbiter } from '../src/director/FairnessArbiter.js';
import { IntensityPhase }  from '../src/director/IntensityPhase.js';
import { Lane }            from '../src/models/Lane.js';
import { Column }          from '../src/models/Column.js';

const WORLD = { hpMultiplier: 1, speed: { base: 5, variance: 0.3 } };
const PAL = ['Red', 'Blue', 'Green'];

describe('CarDirector pair bias', () => {
  it('PAIR_P is a real probability', () => {
    expect(PAIR_P).toBeGreaterThan(0.3);
    expect(PAIR_P).toBeLessThan(0.7);
  });

  it('bias 1 copies the neighbour colour every time; bias 0 never forces it', () => {
    const cd = new CarDirector({}, new SeededRandom(7));
    cd.setPairBias(1);
    for (let i = 0; i < 20; i++) expect(cd.generateCar({ id: 1 }, 'CALM', WORLD, PAL, 5, 'Blue').color).toBe('Blue');
    const cd0 = new CarDirector({}, new SeededRandom(7));
    cd0.setPairBias(0);
    const colors = new Set(Array.from({ length: 40 }, () => cd0.generateCar({ id: 1 }, 'CALM', WORLD, PAL, 5, 'Blue').color));
    expect(colors.size).toBeGreaterThan(1);
  });

  it('a scripted colour wins over the neighbour; a neighbour outside the palette is ignored', () => {
    const cd = new CarDirector({}, new SeededRandom(3));
    cd.setPairBias(1);
    cd.setColorScript(['Red']);
    expect(cd.generateCar({ id: 1 }, 'CALM', WORLD, PAL, 5, 'Blue').color).toBe('Red');
    const c = cd.generateCar({ id: 1 }, 'CALM', WORLD, PAL, 5, 'Purple').color;
    expect(PAL).toContain(c);
  });

  it('without a neighbour the pick is uniform and deterministic as before', () => {
    const a = new CarDirector({}, new SeededRandom(11)); a.setPairBias(PAIR_P);
    const b = new CarDirector({}, new SeededRandom(11));
    for (let i = 0; i < 10; i++) {
      expect(a.generateCar({ id: 0 }, 'CALM', WORLD, PAL, 5, null).color).toBe(b.generateCar({ id: 0 }, 'CALM', WORLD, PAL, 5).color);
    }
  });
});

describe('GameLoop passes the neighbour colour', () => {
  function setup(bias) {
    const lanes   = Array.from({ length: 3 }, (_, id) => new Lane({ id }));
    const columns = Array.from({ length: 3 }, (_, id) => new Column({ id }));
    const gs = new GameState({
      lanes, columns, colors: PAL, world: WORLD, duration: 90, phaseMan: new IntensityPhase(90),
      laneCount: 3, colCount: 3, gridRows: 5, spawnBudget: 12, laneTargetCarCount: 2,
    });
    gs.goals = [{ type: 'destroyTotal', count: 50 }]; gs.goalProgress = [50];
    const rng = new SeededRandom(5);
    const carDir = new CarDirector({}, rng); carDir.setPairBias(bias);
    const loop = new GameLoop({
      app: { ticker: { add: vi.fn(), remove: vi.fn() } }, gameState: gs, carDir,
      shooterDir: new ShooterDirector({}, rng, new FairnessArbiter()),
      combatResolver: new CombatResolver(), rng, onEnd: vi.fn(), onAdvance: vi.fn(),
    });
    return { gs, loop };
  }

  it('the opening deal pairs every row across the lanes at bias 1', () => {
    const { gs, loop } = setup(1);
    loop._primeInitialCars();
    for (const row of gs.openingRows) {
      const colors = gs.lanes.map(l => l.cars.find(c => Math.abs(c.row - row) < 1e-6)?.color);
      expect(new Set(colors).size).toBe(1);
    }
  });

  it('a refill pairs the arrivals of neighbouring lanes at bias 1', () => {
    const { gs, loop } = setup(1);
    loop._refillLanes();
    const rows = gs.lanes[0].cars.map(c => c.row);
    for (const row of rows) {
      const colors = gs.lanes.map(l => l.cars.find(c => Math.abs(c.row - row) < 1e-6)?.color).filter(Boolean);
      expect(new Set(colors).size).toBe(1);
    }
  });

  it('at bias 0 the opening deal is not all pairs', () => {
    const { gs, loop } = setup(0);
    loop._primeInitialCars();
    const allSame = gs.openingRows.every(row => new Set(gs.lanes.map(l => l.cars.find(c => Math.abs(c.row - row) < 1e-6)?.color)).size === 1);
    expect(allSame).toBe(false);
  });
});
