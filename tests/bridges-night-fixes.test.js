// Night review of the bridges merge (2026-11-01, fresh-reviewer findings): a bridged car killed by
// the carry-over of a charged shot must still pass the hit to its partner; a volatile that dies
// through a bridge surges from ITS lane; CONTINUE breaks every bridge (spec §3).
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
import { Shooter }         from '../src/models/Shooter.js';
import { Car }             from '../src/models/Car.js';

const mockApp = { ticker: { add: vi.fn(), remove: vi.fn() } };
function setup() {
  const lanes   = Array.from({ length: 4 }, (_, id) => new Lane({ id }));
  const columns = Array.from({ length: 4 }, (_, id) => new Column({ id }));
  const gs = new GameState({
    lanes, columns, colors: ['Red', 'Blue'],
    world: { hpMultiplier: 1, speed: { base: 5, variance: 0.3 } },
    duration: 90, phaseMan: new IntensityPhase(90),
    laneCount: 3, colCount: 3, gridRows: 5, spawnBudget: 12, laneTargetCarCount: 2,
  });
  gs.goals = [{ type: 'destroyTotal', count: 50 }]; gs.goalProgress = [50];
  gs.bridgesEnabled = true;
  gs.barriers.fill(false);
  const rng = new SeededRandom(3);
  const loop = new GameLoop({
    app: mockApp, gameState: gs, carDir: new CarDirector({}, rng),
    shooterDir: new ShooterDirector({}, rng, new FairnessArbiter()),
    combatResolver: new CombatResolver(), rng, onEnd: vi.fn(), onAdvance: vi.fn(),
  });
  return { gs, loop };
}
const mk = (color, row, hp, type = 'small', extra = {}) => {
  const c = new Car({ color, hp, speed: 5, type }); c.row = row; c.position = row * 25; Object.assign(c, extra); return c;
};
const shot = (color, extra = {}) => Object.assign(new Shooter({ color, damage: 1, column: 0 }), extra);

describe('bridges — the carry-over of a charged shot', () => {
  it('a bridged car killed by the carry-over still passes its hit to its partner', () => {
    const { gs, loop } = setup();
    gs.streakEnabled = true;
    const a = mk('Red', 2, 1), c = mk('Red', 1, 1), d = mk('Red', 1, 3, 'jeep');
    gs.lanes[0].cars = [a, c]; gs.lanes[1].cars = [d];
    expect(loop.addBridge(0, c, 1, d)).toBe(true);
    const blast = vi.fn(); loop._onBridgeBlast = blast;
    loop._resolveShot(shot('Red', { charged: true }), 0);     // power shot: a dies, the carry-over kills c
    expect(gs.lanes[0].cars).not.toContain(a);
    expect(gs.lanes[0].cars).not.toContain(c);
    expect(d.hp).toBe(2);                                      // c's hit (one rung) landed on d
    expect(gs.lanes[1].cars).toContain(d);
    expect(gs.bridges).toHaveLength(0);                        // c died: the bridge is spent
    expect(blast).toHaveBeenCalled();
  });
});

describe('bridges — a volatile dying through a bridge', () => {
  it('surges from the lane the volatile was in, not the lane that was shot', () => {
    const { gs, loop } = setup();
    const a = mk('Red', 2, 1), v = mk('Red', 2, 1, 'small', { trait: 'volatile' });
    gs.lanes[0].cars = [a]; gs.lanes[1].cars = [v]; gs.lanes[2].cars = [mk('Blue', 1, 3)];
    expect(loop.addBridge(0, a, 1, v)).toBe(true);
    const surge = vi.fn(); loop._onSurge = surge;
    loop._resolveShot(shot('Red'), 0);                         // the shot's advance applies the surge
    expect(gs.lanes[1].cars).not.toContain(v);
    expect(surge).toHaveBeenCalledWith(1);
  });
});

describe('bridges — CONTINUE after a loss', () => {
  it('breaks every bridge when the board is pushed back for the rescue', () => {
    const { gs, loop } = setup();
    const f = mk('Blue', 4, 1), a = mk('Red', 3, 1), b = mk('Red', 3, 1);
    gs.lanes[0].cars = [f, a]; gs.lanes[1].cars = [b];
    expect(loop.addBridge(0, a, 1, b)).toBe(true);
    const snap = vi.fn(); loop._onBridgeSnap = snap;
    gs.rescue(10);
    loop.prepareForRescue();
    expect(gs.bridges).toHaveLength(0);
    expect(snap).not.toHaveBeenCalled();                       // a continue is a reset, nothing to animate
  });
});

describe('breach check resolves every lane (second reviewer)', () => {
  it('a lane behind the breaching lane still crashes into its barrier on the same advance', () => {
    const { gs, loop } = setup();
    const MAX = gs.gridRows - 1;
    gs.barriers[0] = false; gs.barriers[1] = true;
    const a = mk('Red', MAX, 1), b = mk('Blue', MAX, 1);
    gs.lanes[0].cars = [a]; gs.lanes[1].cars = [b];
    const smash = vi.fn(); loop._onBarrierSmash = smash;
    loop._advanceGrid();
    expect(gs.isOver).toBe(true);                              // lane 0 had no barrier left: the loss
    expect(gs.barriers[1]).toBe(false);                        // lane 1's car hit its barrier on the same step
    expect(smash).toHaveBeenCalledWith(1, b);
    expect(gs.lanes[1].cars.some(c => c.row > MAX)).toBe(false);
  });
});

describe('a paused loop takes no deploy (second reviewer: a pending drop must not fire into a paused game)', () => {
  it('deploy and deployFromBench refuse while paused, accept after resume', () => {
    const { gs, loop } = setup();
    gs.lanes[0].cars = [mk('Red', 2, 1)];
    const s1 = shot('Red'); gs.columns[0].shooters.push(s1);
    loop.pause();
    expect(loop.deploy(0, 0)).toBe(false);
    expect(gs.columns[0].top()).toBe(s1);
    expect(loop.deployFromBench(shot('Red'), 0)).toBe(false);
    loop.resume();
    expect(loop.deploy(0, 0)).toBe(true);
  });
});
