// LANE BARRIERS (2026-10-30, docs/superpowers/specs/2026-10-30-lane-barriers-design.md §3.1).
// Every lane starts a level with one barrier at the breach line. The first car through a lane
// crashes into it: car and barrier are destroyed, nothing is credited, the level goes on. The
// second car through the SAME lane is the loss. Shared rule: TrafficRules.resolveBreach, run by
// GameLoop and SimulationRunner alike.
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
import { resolveBreach }   from '../src/director/TrafficRules.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';
import { LevelManager }    from '../src/game/LevelManager.js';

const mockApp = { ticker: { add: vi.fn(), remove: vi.fn() } };
const ROWS = 6, MAX_ROW = ROWS - 1;

function build(overrides = {}) {
  const lanes   = Array.from({ length: 4 }, (_, id) => new Lane({ id }));
  const columns = Array.from({ length: 4 }, (_, id) => new Column({ id }));
  const gs = new GameState({
    lanes, columns, colors: ['Red', 'Blue', 'Green'],
    world: { hpMultiplier: 1, speed: { base: 5, variance: 0.5 } },
    duration: 90, phaseMan: new IntensityPhase(90), laneCount: 3, colCount: 3, gridRows: ROWS,
    spawnBudget: 0, goals: [{ type: 'destroyTotal', count: 10 }],
  });
  const rng = new SeededRandom(1);
  const onEnd = vi.fn();
  const loop = new GameLoop({
    app: mockApp, gameState: gs,
    carDir: new CarDirector({}, rng), shooterDir: new ShooterDirector({}, rng, new FairnessArbiter()),
    combatResolver: new CombatResolver(), rng, onEnd, ...overrides,
  });
  const smash = vi.fn();
  loop._onBarrierSmash = smash;
  return { gs, lanes, loop, onEnd, smash };
}
function put(lane, row, extra = {}) {
  const c = new Car({ color: 'Red', hp: 1, speed: 5, row, ...extra });
  c.position = (row / MAX_ROW) * 100;
  lane.addCar(c);
  return c;
}

describe('resolveBreach (pure rule)', () => {
  it('nothing over the line: nothing happens', () => {
    expect(resolveBreach([{ row: 3 }, { row: 1 }], MAX_ROW, true)).toEqual({ crashed: null, breached: [] });
  });
  it('one car over the line with a barrier: it crashes, nothing breaches', () => {
    const a = { row: MAX_ROW + 1 };
    expect(resolveBreach([a, { row: 2 }], MAX_ROW, true)).toEqual({ crashed: a, breached: [] });
  });
  it('one car over the line without a barrier: it breaches', () => {
    const a = { row: MAX_ROW + 0.25 };
    expect(resolveBreach([a], MAX_ROW, false)).toEqual({ crashed: null, breached: [a] });
  });
  it('two cars over the line with a barrier: the front one crashes, the other breaches', () => {
    const a = { row: MAX_ROW + 2 }, b = { row: MAX_ROW + 1 };
    expect(resolveBreach([b, a, { row: 1 }], MAX_ROW, true)).toEqual({ crashed: a, breached: [b] });
  });
});

describe('GameLoop barriers', () => {
  it('every active lane starts with a barrier', () => {
    const { gs } = build();
    expect(gs.barriers.slice(0, 3)).toEqual([true, true, true]);
    expect(gs.barriersLost).toBe(0);
  });

  it('the first car through a lane smashes the barrier: car gone, level goes on, nothing credited', () => {
    const { gs, lanes, loop, onEnd, smash } = build();
    const car = put(lanes[0], MAX_ROW);
    put(lanes[1], 1);
    loop._advanceGrid();
    expect(gs.isOver).toBe(false);
    expect(onEnd).not.toHaveBeenCalled();
    expect(gs.barriers[0]).toBe(false);
    expect(gs.barriersLost).toBe(1);
    expect(lanes[0].cars.includes(car)).toBe(false);
    expect(gs.totalKills).toBe(0);
    expect(gs.goalProgress[0]).toBe(10);
    expect(gs.coins).toBe(0);
    expect(smash).toHaveBeenCalledWith(0, car);
  });

  it('the second car through the same lane is the loss', () => {
    const { gs, lanes, loop, onEnd } = build();
    put(lanes[0], MAX_ROW);
    loop._advanceGrid();
    put(lanes[0], MAX_ROW);
    loop._advanceGrid();
    expect(gs.isOver).toBe(true);
    expect(gs.won).toBe(false);
    expect(onEnd).toHaveBeenCalledWith(false, 0);
  });

  it('each lane has its own barrier', () => {
    const { gs, lanes, loop } = build();
    put(lanes[0], MAX_ROW);
    loop._advanceGrid();
    put(lanes[1], MAX_ROW);
    loop._advanceGrid();
    expect(gs.isOver).toBe(false);
    expect(gs.barriers.slice(0, 3)).toEqual([false, false, true]);
    expect(gs.barriersLost).toBe(2);
  });

  it('a continue pushes traffic back and restores no barrier', () => {
    const { gs, lanes, loop } = build();
    put(lanes[0], MAX_ROW);
    loop._advanceGrid();
    put(lanes[0], MAX_ROW);
    loop._advanceGrid();
    expect(gs.isOver).toBe(true);
    gs.rescue(0);
    expect(gs.isOver).toBe(false);
    expect(gs.barriers[0]).toBe(false);
  });

  it('a restart gives every lane its barrier back', () => {
    const { gs, lanes, loop } = build();
    put(lanes[0], MAX_ROW);
    loop._advanceGrid();
    expect(gs.barriers[0]).toBe(false);
    gs.resetLevel();
    expect(gs.barriers.slice(0, 3)).toEqual([true, true, true]);
    expect(gs.barriersLost).toBe(0);
  });
});

describe('SimulationRunner barriers', () => {
  const level = (id) => { const lm = new LevelManager(); lm.goToLevel(id); return lm.current; };

  it('reports barriers lost and plays the same rule as the game: one free breach per lane', () => {
    const r = SimulationRunner.fromLevel(level(10), { skill: 'human' });
    let lost = 0, wins = 0, lostWithAll = 0;
    for (let s = 1; s <= 60; s++) {
      const res = r.runLevel(s);
      expect(res.barriersLost).toBeGreaterThanOrEqual(0);
      expect(res.barriersLost).toBeLessThanOrEqual(3);
      lost += res.barriersLost; if (res.won) wins++;
      if (!res.won && res.barriersLost === 0) lostWithAll++;
    }
    expect(lost).toBeGreaterThan(0);
    expect(lostWithAll).toBe(0);   // a level cannot be lost while every barrier still stands
    // Without barriers the same seeds win less often.
    const r0 = SimulationRunner.fromLevel({ ...level(10), barriers: false }, { skill: 'human' });
    let wins0 = 0;
    for (let s = 1; s <= 60; s++) if (r0.runLevel(s).won) wins0++;
    expect(wins).toBeGreaterThan(wins0);
  });
});
