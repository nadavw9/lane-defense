// V2 rules (src/director/TrafficRules.js): special cars, Hot Streak, bosses —
// the pure rules, the shared CombatResolver, and the live GameLoop wiring.
import { describe, it, expect, vi } from 'vitest';
import {
  canTarget, advanceLaneCars, flipChameleons, nextStreak, rollTrait,
  TRAIT_TYPES,
} from '../src/director/TrafficRules.js';
import { CombatResolver }  from '../src/game/CombatResolver.js';
import { GameLoop }        from '../src/game/GameLoop.js';
import { GameState }       from '../src/game/GameState.js';
import { CarDirector }     from '../src/director/CarDirector.js';
import { ShooterDirector } from '../src/director/ShooterDirector.js';
import { FairnessArbiter } from '../src/director/FairnessArbiter.js';
import { IntensityPhase }  from '../src/director/IntensityPhase.js';
import { SeededRandom }    from '../src/utils/SeededRandom.js';
import { Lane }            from '../src/models/Lane.js';
import { Column }          from '../src/models/Column.js';
import { Shooter }         from '../src/models/Shooter.js';
import { Car }             from '../src/models/Car.js';
import { BenchStorage }    from '../src/game/BenchStorage.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';

const car = (o) => Object.assign(new Car({ color: o.color ?? 'Red', hp: o.hp ?? 3, type: o.type ?? 'big' }), o);
const laneOf = (...cars) => { const l = new Lane({ id: 0 }); l.cars.push(...cars); return l; };
const combat = new CombatResolver();

describe('armoured cars', () => {
  it('any colour can target an armoured car; only matching colours target a plain one', () => {
    expect(canTarget(car({ color: 'Red', armor: 1 }), 'Blue')).toBe(true);
    expect(canTarget(car({ color: 'Red' }), 'Blue')).toBe(false);
    expect(canTarget(car({ color: 'Red' }), 'Red')).toBe(true);
  });

  it('the first hit removes the plates, deals no damage, and still counts as a hit', () => {
    const c = car({ color: 'Red', hp: 3, armor: 1 });
    const res = combat.resolve({ color: 'Blue', damage: 8 }, laneOf(c));
    expect(res).toMatchObject({ hit: true, armorBroken: true, kills: 0, damageDealt: 0 });
    expect(c.armor).toBe(0);
    expect(c.hp).toBe(3);
    // Now it is an ordinary car: wrong colour misses, right colour kills.
    expect(combat.resolve({ color: 'Blue', damage: 8 }, laneOf(c)).hit).toBe(false);
  });

  it('armour stops a carry-over cascade', () => {
    const lane = laneOf(car({ color: 'Red', hp: 1 }), car({ color: 'Red', hp: 1, armor: 1 }));
    const res = combat.resolve({ color: 'Red', damage: 9 }, lane);
    expect(res.kills).toBe(1);
    expect(lane.cars).toHaveLength(1);
    expect(lane.cars[0].armor).toBe(1);
  });
});

describe('Hot Streak supercharged shot', () => {
  it('doubles damage', () => {
    const c = car({ color: 'Red', hp: 6 });
    const res = combat.resolve({ color: 'Red', damage: 3 }, laneOf(c), { power: true });
    expect(res.kills).toBe(1);
  });

  it('its second hit carries over only to a same-colour car, like any carry-over (owner, 2026-10-18)', () => {
    const mixed = () => laneOf(car({ color: 'Red', hp: 1 }), car({ color: 'Blue', hp: 1 }));
    expect(combat.resolve({ color: 'Red', damage: 1 }, mixed(), { power: true }).kills).toBe(1);
    const lane = mixed();
    combat.resolve({ color: 'Red', damage: 1 }, lane, { power: true });
    expect(lane.frontCar().hp).toBe(1);                       // the blue car behind is untouched
    const same = () => laneOf(car({ color: 'Red', hp: 1 }), car({ color: 'Red', hp: 1 }));
    expect(combat.resolve({ color: 'Red', damage: 1 }, same(), { power: true }).kills).toBe(2);
  });

  it('streak charges after 3 destroying shots IN A ROW; a shot that destroys nothing breaks the run', () => {
    let s = { streak: 0, charged: false };
    s = nextStreak(s.streak, s.charged, 1, false); expect(s).toEqual({ streak: 1, charged: false });
    s = nextStreak(s.streak, s.charged, 2, false); expect(s).toEqual({ streak: 2, charged: false });   // a multi-kill is ONE step
    s = nextStreak(s.streak, s.charged, 0, false); expect(s).toEqual({ streak: 0, charged: false });   // shrink-only hit resets
    s = nextStreak(s.streak, s.charged, 1, false); s = nextStreak(s.streak, s.charged, 1, false);
    s = nextStreak(s.streak, s.charged, 1, false); expect(s).toEqual({ streak: 0, charged: true });
    s = nextStreak(s.streak, s.charged, 0, true);  expect(s).toEqual({ streak: 0, charged: false });   // the charge is spent by one shot
  });
});

describe('speeders and chameleons', () => {
  it('a speeder moves two rows, an ordinary car one', () => {
    const cars = [car({ row: 3, trait: 'speeder' })];
    advanceLaneCars(cars);
    expect(cars[0].row).toBe(5);
  });

  it('nobody passes the car ahead', () => {
    const front = car({ row: 4 }), speeder = car({ row: 3, trait: 'speeder' });
    const cars = [front, speeder];
    advanceLaneCars(cars);
    expect(front.row).toBe(5);
    expect(speeder.row).toBe(4);
  });

  it('a chameleon swaps colours each traffic move', () => {
    const c = car({ color: 'Red', trait: 'chameleon', altColor: 'Blue' });
    flipChameleons([c]); expect(c.color).toBe('Blue');
    flipChameleons([c]); expect(c.color).toBe('Red');
  });

  it('traits land only on compatible car types, and a trait-free table draws no randomness', () => {
    const rng = new SeededRandom(1);
    const before = rng.next(); const rng2 = new SeededRandom(1);
    rollTrait(car({ type: 'tank' }), null, rng2, ['Red']);
    expect(rng2.next()).toBe(before);   // no draw consumed
    const tank = rollTrait(car({ type: 'tank' }), { speeder: 1 }, new SeededRandom(3), ['Red']);
    expect(tank.trait).toBe(null);
    expect(TRAIT_TYPES.speeder.has('small')).toBe(true);
  });
});

// ── Live GameLoop wiring ──────────────────────────────────────────────────────
const mockApp = { ticker: { add: vi.fn(), remove: vi.fn() } };
function buildLoop({ colors = ['Red', 'Blue'], laneCount = 3, gridRows = 8 } = {}) {
  const lanes   = Array.from({ length: 4 }, (_, id) => new Lane({ id }));
  const columns = Array.from({ length: 4 }, (_, id) => new Column({ id }));
  const gs = new GameState({
    lanes, columns, colors, world: { hpMultiplier: 1, speed: { base: 5, variance: 0 } },
    duration: 90, phaseMan: new IntensityPhase(90), laneCount, colCount: 3, gridRows,
    spawnBudget: 10, laneTargetCarCount: 1, goals: [{ type: 'destroyTotal', count: 99 }],
  });
  const rng = new SeededRandom(7);
  const loop = new GameLoop({
    app: mockApp, gameState: gs, carDir: new CarDirector({}, rng),
    shooterDir: new ShooterDirector({}, rng, new FairnessArbiter()),
    combatResolver: new CombatResolver(), rng,
  });
  return { gs, lanes, loop, gridRows };
}
const put = (loop, lane, props, gridRows = 8) => {
  const c = car(props);
  c.position = loop._rowToPosition(c.row ?? 0, gridRows);
  lane.addCar(c);
  return c;
};

describe('GameLoop V2 wiring', () => {
  it('knocking armour off advances traffic', () => {
    const { lanes, loop } = buildLoop();
    const armored = put(loop, lanes[0], { color: 'Red', row: 3, armor: 1, trait: 'armored' });
    const other   = put(loop, lanes[1], { color: 'Red', row: 2, hp: 99 });
    loop._resolveShot(new Shooter({ color: 'Blue', damage: 4, column: 0 }), 0);
    expect(armored.armor).toBe(0);
    expect(armored.row).toBe(4);
    expect(other.row).toBe(3);
  });

  // Three kill shots in a row, then the front row (column tops) carries the charge.
  const chargeUp = (gs, lanes, loop) => {
    gs.streakEnabled = true;
    for (let c = 0; c < 3; c++) gs.columns[c].shooters = [new Shooter({ color: 'Red', column: c }), new Shooter({ color: 'Red', column: c })];
    for (let i = 0; i < 3; i++) {
      put(loop, lanes[0], { color: 'Red', row: 6, hp: 1 });
      loop._resolveShot(new Shooter({ color: 'Red', damage: 2, column: 0 }), 0);
      lanes[0].cars.length = 0; lanes[1].cars.length = 0; lanes[2].cars.length = 0;
    }
  };

  it('three kill shots charge the front row; a charged bomb doubles damage and spends the charge', () => {
    const { gs, lanes, loop } = buildLoop();
    chargeUp(gs, lanes, loop);
    expect(gs.streakCharged).toBe(true);
    expect([0, 1, 2].map(c => gs.columns[c].top().charged)).toEqual([true, true, true]);
    expect(gs.columns[0].shooters[1].charged).toBe(false);          // the bomb behind is not
    const big = put(loop, lanes[0], { color: 'Red', row: 2, hp: 2 });   // one-hit bombs: only a doubled hit kills it
    const shot = gs.columns[1].top(); gs.columns[1].consume();
    loop._resolveShot(shot, 0);
    expect(lanes[0].cars.includes(big)).toBe(false);
    expect(gs.streakCharged).toBe(false);
    expect([0, 2].map(c => gs.columns[c].top().charged)).toEqual([false, false]);
  });

  it('a charged bomb moved to the bench keeps its charge; the bomb behind it does not get one', () => {
    const { gs, lanes, loop } = buildLoop();
    const bench = new BenchStorage(4);
    loop._benchStorage = bench;
    chargeUp(gs, lanes, loop);
    const moved = gs.columns[0].top(); gs.columns[0].consume(); bench.store(moved);
    expect(moved.charged).toBe(true);
    expect(gs.columns[0].top().charged).toBe(false);
    // Firing the plain bomb that rose in behind it is a normal shot; the charge stays.
    const plain = gs.columns[0].top(); gs.columns[0].consume();
    const car2 = put(loop, lanes[0], { color: 'Red', row: 2, hp: 2 });
    loop._resolveShot(plain, 0);
    expect(car2.hp).toBe(1);
    expect(moved.charged).toBe(true);
    expect(gs.streakCharged).toBe(true);
  });

  it('firing a charged bomb from another column clears the charge on the benched one', () => {
    const { gs, lanes, loop } = buildLoop();
    const bench = new BenchStorage(4);
    loop._benchStorage = bench;
    chargeUp(gs, lanes, loop);
    const moved = gs.columns[0].top(); gs.columns[0].consume(); bench.store(moved);
    const shot = gs.columns[2].top(); gs.columns[2].consume();
    put(loop, lanes[0], { color: 'Red', row: 2, hp: 2 });
    loop._resolveShot(shot, 0);
    expect(moved.charged).toBe(false);
    expect(gs.columns[1].top().charged).toBe(false);
    expect(gs.streakCharged).toBe(false);
  });

  it('streak is inert when the level has it off', () => {
    const { gs, lanes, loop } = buildLoop();
    for (let i = 0; i < 3; i++) {
      put(loop, lanes[0], { color: 'Red', row: 6, hp: 1 });
      loop._resolveShot(new Shooter({ color: 'Red', damage: 2, column: 0 }), 0);
      lanes[0].cars.length = 0;
    }
    expect(gs.streakCharged).toBe(false);
  });

  it('a BOMB booster clears the whole lane it is dropped on, any colour', () => {
    const { gs, lanes, loop } = buildLoop();
    put(loop, lanes[1], { color: 'Red', row: 0, hp: 3 });
    put(loop, lanes[1], { color: 'Blue', row: 2, hp: 3 });
    put(loop, lanes[0], { color: 'Red', row: 3, hp: 99 });
    loop._boosterState = { consumeBomb: () => true, bombs: 0 };
    loop.placeBombOnLane(1);
    expect(lanes[1].cars.length).toBe(0);
    expect(lanes[0].cars.length).toBe(1);
    expect(gs.isOver).toBe(false);
  });
});

describe('simulator parity', () => {
  it('runs a trait level without throwing and reports V2 instrumentation', () => {
    const traits = new SimulationRunner({
      colors: ['Red', 'Blue', 'Green'], laneCount: 3, colCount: 3, gridRows: 8, levelId: 12,
      laneTargetCarCount: 2, worldConfig: { hpMultiplier: 0.7, speed: { base: 5, variance: 0 } },
      traits: { armored: 0.3, speeder: 0.2, chameleon: 0.2 },
      goals: [{ type: 'destroyTotal', count: 25 }],
    }).runLevel(2);
    expect(traits.armorBreaks).toBeGreaterThan(0);
    expect(traits.powerShots).toBeGreaterThan(0);
  });
});
