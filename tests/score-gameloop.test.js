// GameLoop keeps the score (src/game/score.js) on every resolved shot; the simulator scores the
// same way, so the star targets it generates match what a player can reach.
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
    laneCount: 2, colCount: 2, gridRows: 5, spawnBudget: 12, laneTargetCarCount: 2,
  });
  gs.goals = [{ type: 'destroyTotal', count: 50 }]; gs.goalProgress = [50];
  const rng = new SeededRandom(3);
  const loop = new GameLoop({
    app: mockApp, gameState: gs, carDir: new CarDirector({}, rng),
    shooterDir: new ShooterDirector({}, rng, new FairnessArbiter()),
    combatResolver: new CombatResolver(), rng, onEnd: vi.fn(), onAdvance: vi.fn(),
  });
  return { gs, loop };
}
const mk = (color, row, hp, type) => { const c = new Car({ color, hp, speed: 5, type }); c.row = row; c.position = row * 25; c.type = type; return c; };
const bike = (_id, color, row) => mk(color, row, 1, 'small');

describe('the game keeps score per shot', () => {
  it('starts at zero and pays a kill, then a combo kill', () => {
    const { gs, loop } = setup();
    expect(gs.score).toBe(0);
    gs.lanes[0].cars = [bike(1, 'Red', 3)];
    gs.lanes[1].cars = [bike(2, 'Blue', 2)];
    loop._resolveShot(new Shooter({ color: 'Red', damage: 1, column: 0 }), 0);
    expect(gs.score).toBe(POINTS.car);
    gs.lanes[1].cars = [bike(3, 'Blue', 3)];
    loop._resolveShot(new Shooter({ color: 'Blue', damage: 1, column: 1 }), 1);
    expect(gs.score).toBe(2 * POINTS.car + POINTS.chainStep);
  });

  it('a hit that only shrinks a car keeps the combo and pays its bonus (owner 2026-10-22)', () => {
    const { gs, loop } = setup();
    gs.lanes[0].cars = [bike(1, 'Red', 3)];
    loop._resolveShot(new Shooter({ color: 'Red', damage: 1, column: 0 }), 0);
    gs.lanes[0].cars = [mk('Red', 3, 2, 'big')];
    loop._resolveShot(new Shooter({ color: 'Red', damage: 1, column: 0 }), 0);   // shrinks, no kill
    expect(gs.scoreChain).toBe(2);
    expect(gs.score).toBe(POINTS.car + POINTS.chainStep);
  });

  it('a wrong-colour shot breaks the combo', () => {
    const { gs, loop } = setup();
    gs.lanes[0].cars = [bike(1, 'Red', 3)];
    loop._resolveShot(new Shooter({ color: 'Red', damage: 1, column: 0 }), 0);
    gs.lanes[0].cars = [bike(2, 'Red', 3)];
    loop._resolveShot(new Shooter({ color: 'Blue', damage: 1, column: 1 }), 0);  // no match: wasted
    expect(gs.scoreChain).toBe(0);
    gs.lanes[0].cars = [bike(3, 'Red', 3)];
    loop._resolveShot(new Shooter({ color: 'Red', damage: 1, column: 0 }), 0);
    expect(gs.score).toBe(2 * POINTS.car);   // no combo bonus after the break
  });

  it('the combo on screen is the combo that pays: onKill reports it, maxCombo records it', () => {
    const { gs, loop } = setup();
    const seen = [];
    loop._onKill = (c) => seen.push(c);
    for (let i = 0; i < 3; i++) {
      gs.elapsed += 60;   // slow, thoughtful play: the old 2-second kill window would have reset
      gs.lanes[0].cars = [bike(i, 'Red', 3)];
      loop._resolveShot(new Shooter({ color: 'Red', damage: 1, column: 0 }), 0);
    }
    expect(seen).toEqual([1, 2, 3]);
    expect(gs.maxCombo).toBe(3);
  });

  it('a new level starts from zero', () => {
    const { gs } = setup();
    gs.score = 900; gs.scoreChain = 4;
    gs.resetLevel();
    expect(gs.score).toBe(0);
    expect(gs.scoreChain).toBe(0);
  });
});

// CHAIN REACTION across lanes (src/game/spread.js): the neighbour's explosion is part of the SHOT,
// so it pays like a multi-kill, counts for the goals and drives the same kill effects.
describe('a destroyed car spreads to same-colour neighbours', () => {
  function setup3() {
    const t = setup();
    t.gs.activeLaneCount = 3;
    t.gs.spreadEnabled = true;
    return t;
  }
  it('pays the neighbour as an extra car of the same shot and reports the spread', () => {
    const { gs, loop } = setup3();
    const spread = []; loop._onSpread = (hits) => spread.push(...hits);
    const kills = []; loop._onHit = (_l, _x, _c, _d, k) => kills.push(k);
    const red = bike(2, 'Red', 2), blue = bike(3, 'Blue', 2);
    gs.lanes[0].cars = [bike(1, 'Red', 3)];
    gs.lanes[1].cars = [red];
    gs.lanes[2].cars = [blue];
    loop._resolveShot(new Shooter({ color: 'Red', damage: 1, column: 0 }), 0);
    expect(gs.lanes[1].cars).not.toContain(red);     // (the advance that follows refills the lanes)
    expect(gs.lanes[2].cars).toContain(blue);
    expect(gs.score).toBe(2 * POINTS.car + POINTS.multiExtra);
    expect(gs.goalProgress[0]).toBe(48);
    expect(kills).toEqual([2]);
    expect(spread).toEqual([expect.objectContaining({ lane: 1, from: 0, destroyed: true })]);
  });
  it('a neighbour that only shrinks is reported but not paid as a kill', () => {
    const { gs, loop } = setup3();
    const spread = []; loop._onSpread = (hits) => spread.push(...hits);
    gs.lanes[0].cars = [bike(1, 'Red', 3)];
    gs.lanes[1].cars = [mk('Red', 2, 3, 'jeep')];
    loop._resolveShot(new Shooter({ color: 'Red', damage: 1, column: 0 }), 0);
    expect(gs.lanes[1].frontCar().hp).toBe(2);
    expect(gs.score).toBe(POINTS.car);
    expect(spread).toEqual([expect.objectContaining({ lane: 1, destroyed: false })]);
  });
  it('does nothing before the level that teaches it, and on a shot that destroys nothing', () => {
    const { gs, loop } = setup3();
    gs.spreadEnabled = false;
    const red = bike(2, 'Red', 2);
    gs.lanes[0].cars = [bike(1, 'Red', 3)];
    gs.lanes[1].cars = [red];
    loop._resolveShot(new Shooter({ color: 'Red', damage: 1, column: 0 }), 0);
    expect(gs.lanes[1].cars).toContain(red);
    expect(red.hp).toBe(1);
    gs.spreadEnabled = true;
    gs.lanes[0].cars = [mk('Red', 3, 2, 'big')];
    gs.lanes[1].cars = [red];
    loop._resolveShot(new Shooter({ color: 'Red', damage: 1, column: 0 }), 0);   // shrinks only
    expect(gs.lanes[1].cars).toContain(red);
    expect(red.hp).toBe(1);
  });
});
