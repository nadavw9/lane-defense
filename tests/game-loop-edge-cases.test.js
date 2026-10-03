// Edge cases found in the 2026-10-03 subsystem review:
//  - a FROZEN advance used to skip the empty-board refill (soft-lock),
//  - a volatile surge marker survived into the next level.
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

function setup(boosterState) {
  const lanes   = Array.from({ length: 2 }, (_, id) => new Lane({ id }));
  const columns = Array.from({ length: 4 }, (_, id) => new Column({ id }));
  const gs = new GameState({
    lanes, columns, colors: ['Red', 'Blue', 'Green'],
    world: { hpMultiplier: 1, speed: { base: 5, variance: 0.5 } },
    duration: 90, phaseMan: new IntensityPhase(90),
    laneCount: 2, colCount: 4, gridRows: 11,
  });
  const rng = new SeededRandom(3);
  const loop = new GameLoop({
    app: mockApp, gameState: gs,
    carDir: new CarDirector({}, rng),
    shooterDir: new ShooterDirector({}, rng, new FairnessArbiter()),
    combatResolver: new CombatResolver(), rng, boosterState,
  });
  return { gs, loop, lanes };
}

describe('frozen advance keeps the board playable', () => {
  const frozen = () => ({ isFrozen: () => true, consumeFreezeShot() {}, freeze: 0, bombs: 0, colorChange: 0 });

  it('refills an EMPTY road instead of leaving nothing to shoot', () => {
    const { gs, loop, lanes } = setup(frozen());
    expect(lanes.every(l => l.cars.length === 0)).toBe(true);
    loop._advanceGrid();
    expect(lanes.some(l => l.cars.length > 0)).toBe(true);
    // and at least one car is visible (row >= 1), not hidden behind the goal band
    expect(lanes.some(l => l.cars.some(c => c.row >= 1))).toBe(true);
    expect(gs.isOver).toBe(false);
  });

  it('reveals row-0 staged cars when the road would look empty', () => {
    const { loop, lanes } = setup(frozen());
    const c = new Car({ color: 'Red', hp: 3, speed: 5 }); c.row = 0; c.position = 0;
    lanes[0].addCar(c);
    loop._advanceGrid();
    expect(c.row).toBe(1);
  });

  it('does not move or add cars on a board that is already playable', () => {
    const { loop, lanes } = setup(frozen());
    const c = new Car({ color: 'Red', hp: 3, speed: 5 }); c.row = 4; c.position = 40;
    lanes[0].addCar(c);
    loop._advanceGrid();
    expect(c.row).toBe(4);
    expect(lanes[1].cars.length).toBe(0);
  });
});

describe('volatile surge marker', () => {
  it('is cleared by restart() so it cannot surge the next level', () => {
    const { loop } = setup(null);
    loop._surgeFromLane = 1;
    loop.restart();
    expect(loop._surgeFromLane).toBeNull();
  });
});
