// CONTINUE after a BOSS breaches must bring the boss back — otherwise its
// defeatBoss goal can never be met and the level runs forever (found by the
// autoplay bot on L20: 225 turns, 335 kills, goal 1 left). Also: the rescue
// push-back keeps every car on its own row (it used to stack them on row 0).
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
import { makeBoss, isBoss } from '../src/director/TrafficRules.js';

const mockApp = { ticker: { add: vi.fn(), remove: vi.fn() } };

function makeLoop() {
  const lanes   = Array.from({ length: 4 }, (_, id) => new Lane({ id }));
  const columns = Array.from({ length: 4 }, (_, id) => new Column({ id }));
  const gs = new GameState({
    lanes, columns, colors: ['Red', 'Blue', 'Green'],
    world: { hpMultiplier: 1, speed: { base: 5, variance: 0.3 } },
    duration: 90, phaseMan: new IntensityPhase(90),
    laneCount: 3, colCount: 3, gridRows: 8, spawnBudget: 12, laneTargetCarCount: 2,
    goals: [{ type: 'defeatBoss', count: 1 }],
  });
  const rng = new SeededRandom(5);
  const onEnd = vi.fn();
  const loop = new GameLoop({
    app: mockApp, gameState: gs, carDir: new CarDirector({}, rng),
    shooterDir: new ShooterDirector({}, rng, new FairnessArbiter()),
    combatResolver: new CombatResolver(), rng, onEnd, onAdvance: vi.fn(),
  });
  return { gs, loop, onEnd };
}

function car(color, row) {
  return { id: Math.random(), color, hp: 3, maxHp: 3, row, position: row / 7 * 100, type: 'big' };
}

describe('rescue after a boss breach', () => {
  it('the boss comes back with its lights, so the level stays winnable', () => {
    const { gs, loop, onEnd } = makeLoop();
    const boss = makeBoss(car('Red', 7), { sequence: ['Red', 'Blue', 'Green'], moveEvery: 1 });
    boss.seqIdx = 1; boss.color = 'Blue'; boss.hp = 2;   // one light already out
    gs.lanes[1].cars = [boss];
    loop._advanceGrid();                                  // boss moves past the last row
    expect(gs.isOver).toBe(true);
    expect(onEnd).toHaveBeenCalledWith(false, 1);
    expect(gs.lanes[1].cars.includes(boss)).toBe(false); // removed on breach

    gs.rescue(10);
    loop.prepareForRescue();
    const back = gs.lanes[1].cars.find(isBoss);
    expect(back).toBe(boss);
    expect(back.hp).toBe(2);                              // lights intact
    expect(back.row).toBeLessThan(gs.gridRows - 1);       // pushed back, not on the line
    expect(gs.lanes[1].cars.filter(c => !isBoss(c)).length).toBe(0);   // the boss owns its lane
    expect(gs.goalProgress[0]).toBe(1);
  });

  it('push-back keeps cars on distinct rows, in order', () => {
    const { gs } = makeLoop();
    gs.lanes[0].cars = [car('Red', 3), car('Blue', 2), car('Green', 1), car('Red', 0)];
    gs.rescue(10);
    const rows = gs.lanes[0].cars.map(c => c.row);
    expect(new Set(rows).size).toBe(rows.length);
    expect(rows).toEqual([...rows].sort((a, b) => b - a));
    expect(rows.every(r => r >= 0)).toBe(true);
  });
});
