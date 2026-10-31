// BRIDGES in the live loop (src/game/bridges.js + GameLoop). A hit on a bridged car lands on every
// connected car as part of THIS shot (score, goals, effects); bridges are pruned after every
// advance (speeder, chameleon) and after every hit; a level reset drops them all.
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
import { POINTS }          from '../src/game/score.js';
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
  gs.barriers.fill(false);   // breach tests are elsewhere; keep the board simple
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
const shot = (color) => new Shooter({ color, damage: 1, column: 0 });

describe('making a bridge in the loop', () => {
  it('accepts an eligible pair, refuses the rest, counts it', () => {
    const { gs, loop } = setup();
    const a = mk('Red', 3, 1), b = mk('Red', 3, 1), c = mk('Blue', 3, 1);
    gs.lanes[0].cars = [a]; gs.lanes[1].cars = [b]; gs.lanes[2].cars = [c];
    expect(loop.addBridge(0, a, 1, b)).toBe(true);
    expect(loop.addBridge(0, a, 1, b)).toBe(false);          // already there
    expect(loop.addBridge(1, b, 2, c)).toBe(false);          // colours differ
    expect(gs.bridges).toHaveLength(1);
    expect(gs.bridgesMade).toBe(1);
  });

  it('refuses before the level that teaches it', () => {
    const { gs, loop } = setup();
    gs.bridgesEnabled = false;
    const a = mk('Red', 3, 1), b = mk('Red', 3, 1);
    gs.lanes[0].cars = [a]; gs.lanes[1].cars = [b];
    expect(loop.addBridge(0, a, 1, b)).toBe(false);
    expect(gs.bridges).toHaveLength(0);
  });
});

describe('a shot on a bridged car', () => {
  it('kills both, pays the second as a multi-kill, counts the goal, reports the blast', () => {
    const { gs, loop } = setup();
    const blast = []; loop._onBridgeBlast = (hits) => blast.push(...hits);
    const kills = []; loop._onHit = (_l, _x, _c, _d, k) => kills.push(k);
    const a = mk('Red', 3, 1), b = mk('Red', 3, 1), blue = mk('Blue', 3, 1);
    gs.lanes[0].cars = [a]; gs.lanes[1].cars = [b]; gs.lanes[2].cars = [blue];
    loop.addBridge(0, a, 1, b);
    loop._resolveShot(shot('Red'), 0);
    expect(gs.lanes[1].cars).not.toContain(b);
    expect(gs.lanes[2].cars).toContain(blue);
    expect(gs.score).toBe(2 * POINTS.car + POINTS.multiExtra);
    expect(gs.goalProgress[0]).toBe(48);
    expect(kills).toEqual([2]);
    expect(blast).toEqual([expect.objectContaining({ lane: 1, destroyed: true })]);
    expect(gs.bridges).toHaveLength(0);                       // consumed, not "snapped"
    expect(gs.bridgeKills).toBe(1);
  });

  it('reaches a bridged car behind another car; a third car cannot join the pair', () => {
    const { gs, loop } = setup();
    const a = mk('Red', 2, 1), b = mk('Red', 2, 1), c = mk('Red', 2, 1), front = mk('Blue', 3, 1);   // row 4 would breach on the advance
    gs.lanes[0].cars = [a]; gs.lanes[1].cars = [front, b]; gs.lanes[2].cars = [c];
    expect(loop.addBridge(0, a, 1, b)).toBe(true);
    expect(loop.addBridge(1, b, 2, c)).toBe(false);            // b is taken: a bridge is a pair
    loop._resolveShot(shot('Red'), 0);
    expect(gs.lanes[1].cars).toContain(front);                 // the blue front car is untouched
    expect(gs.lanes[1].cars).not.toContain(b);
    expect(gs.lanes[2].cars).toContain(c);
    expect(gs.score).toBe(2 * POINTS.car + POINTS.multiExtra);
  });

  it('a shrinking partner stays bridged; a charged shot passes both hits', () => {
    const { gs, loop } = setup();
    const snap = vi.fn(); loop._onBridgeSnap = snap;
    const a = mk('Red', 3, 1), b = mk('Red', 3, 2, 'big');
    gs.lanes[0].cars = [a, mk('Red', 2, 1)]; gs.lanes[1].cars = [b];
    loop.addBridge(0, a, 1, b);
    loop._resolveShot(shot('Red'), 0);
    expect(b.hp).toBe(1);
    expect(gs.lanes[1].cars).toContain(b);
    expect(gs.bridges).toHaveLength(0);                       // a died: the bridge is gone, silently
    expect(snap).not.toHaveBeenCalled();
    // charged: the front car of lane 0 is now the red bike behind a; bridge it to b and fire a power shot
    const a2 = gs.lanes[0].frontCar();
    b.row = a2.row; b.position = a2.position;
    expect(loop.addBridge(0, a2, 1, b)).toBe(true);
    gs.streakEnabled = true;
    const s = shot('Red'); s.charged = true;
    loop._resolveShot(s, 0);
    expect(gs.lanes[1].cars).not.toContain(b);
  });

  it('a wrong-colour shot does not cross the bridge', () => {
    const { gs, loop } = setup();
    const a = mk('Red', 3, 1), b = mk('Red', 3, 1);
    gs.lanes[0].cars = [a]; gs.lanes[1].cars = [b];
    loop.addBridge(0, a, 1, b);
    loop._resolveShot(shot('Blue'), 0);
    expect(b.hp).toBe(1);
    expect(gs.bridges).toHaveLength(1);
  });

  it('does not cross when bridges are off for the level', () => {
    const { gs, loop } = setup();
    const a = mk('Red', 3, 1), b = mk('Red', 3, 1);
    gs.lanes[0].cars = [a]; gs.lanes[1].cars = [b];
    loop.addBridge(0, a, 1, b);
    gs.bridgesEnabled = false;
    loop._resolveShot(shot('Red'), 0);
    expect(gs.lanes[1].cars).toContain(b);
  });
});

describe('bridges break on the board', () => {
  it('a speeder leaves its partner behind on the advance: the bridge snaps', () => {
    const { gs, loop } = setup();
    const snapped = []; loop._onBridgeSnap = (brs) => snapped.push(...brs);
    const a = mk('Red', 2, 1, 'small', { trait: 'speeder' }), b = mk('Red', 2, 1);
    gs.lanes[0].cars = [a]; gs.lanes[1].cars = [b]; gs.lanes[2].cars = [mk('Blue', 2, 1)];
    loop.addBridge(0, a, 1, b);
    loop._advanceGrid();
    expect(a.row - b.row).toBeGreaterThan(0.2);
    expect(gs.bridges).toHaveLength(0);
    expect(snapped).toHaveLength(1);
  });

  it('two normal cars stay bridged through an advance; resetLevel drops every bridge', () => {
    const { gs, loop } = setup();
    const a = mk('Red', 2, 1), b = mk('Red', 2, 1);
    gs.lanes[0].cars = [a]; gs.lanes[1].cars = [b]; gs.lanes[2].cars = [mk('Blue', 2, 1)];
    loop.addBridge(0, a, 1, b);
    loop._advanceGrid();
    expect(gs.bridges).toHaveLength(1);
    gs.resetLevel();
    expect(gs.bridges).toHaveLength(0);
    expect(gs.bridgesMade).toBe(0);
  });
});
