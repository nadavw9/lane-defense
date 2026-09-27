// V2 rules (src/director/TrafficRules.js): special cars, Hot Streak, bosses —
// the pure rules, the shared CombatResolver, and the live GameLoop wiring.
import { describe, it, expect, vi } from 'vitest';
import {
  canTarget, advanceLaneCars, flipChameleons, nextStreak, rollTrait,
  makeBoss, hitBoss, isBoss, TRAIT_TYPES,
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

  it('carries over through cars of any colour; a normal shot stops at the first mismatch', () => {
    const mk = () => laneOf(car({ color: 'Red', hp: 1 }), car({ color: 'Blue', hp: 1 }), car({ color: 'Green', hp: 1 }));
    expect(combat.resolve({ color: 'Red', damage: 3 }, mk()).kills).toBe(1);
    expect(combat.resolve({ color: 'Red', damage: 3 }, mk(), { power: true }).kills).toBe(3);
  });

  it('streak charges after 3 kill shots, a non-kill hit resets it, the charge is spent by one shot', () => {
    let s = { streak: 0, charged: false };
    s = nextStreak(s.streak, s.charged, 1, false); expect(s).toEqual({ streak: 1, charged: false });
    s = nextStreak(s.streak, s.charged, 2, false); expect(s).toEqual({ streak: 2, charged: false });
    s = nextStreak(s.streak, s.charged, 1, false); expect(s).toEqual({ streak: 0, charged: true });
    s = nextStreak(s.streak, s.charged, 0, true);  expect(s).toEqual({ streak: 0, charged: false });
    s = nextStreak(1, false, 0, false);            expect(s).toEqual({ streak: 0, charged: false });
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

describe('boss vehicles', () => {
  const mkBoss = (def = {}) => makeBoss(car({}), { sequence: ['Red', 'Blue', 'Red'], ...def });

  it('shows the first colour, loses a light per matching bomb, and dies when the sequence ends', () => {
    const b = mkBoss();
    expect(isBoss(b)).toBe(true);
    expect(b.color).toBe('Red');
    const lane = laneOf(b);
    expect(combat.resolve({ color: 'Blue', damage: 9 }, lane).hit).toBe(false);
    expect(combat.resolve({ color: 'Red', damage: 9 }, lane)).toMatchObject({ hit: true, kills: 0 });
    expect(b.color).toBe('Blue');
    expect(combat.resolve({ color: 'Blue', damage: 1 }, lane, { power: true })).toMatchObject({ kills: 1 });
    expect(lane.cars).toHaveLength(0);
  });

  it('moves one row every `moveEvery` turns', () => {
    const b = mkBoss({ moveEvery: 2 }); b.row = 0;
    advanceLaneCars([b]); expect(b.row).toBe(0);
    advanceLaneCars([b]); expect(b.row).toBe(1);
  });

  it('a re-armouring boss plates up again after every light', () => {
    const b = mkBoss({ reArmor: true });
    expect(b.armor).toBe(1);
    const lane = laneOf(b);
    combat.resolve({ color: 'Green', damage: 1 }, lane);   // plates off
    combat.resolve({ color: 'Red', damage: 1 }, lane);     // light 1
    expect(b.armor).toBe(1);
    expect(b.color).toBe('Blue');
  });

  it('hitBoss keeps hp equal to the lights left', () => {
    const b = mkBoss();
    hitBoss(b, 2);
    expect(b.hp).toBe(1);
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

  it('three kill shots charge the streak; the charged shot doubles damage', () => {
    const { gs, lanes, loop } = buildLoop();
    gs.streakEnabled = true;
    for (let i = 0; i < 3; i++) {
      put(loop, lanes[0], { color: 'Red', row: 6, hp: 1 });
      loop._resolveShot(new Shooter({ color: 'Red', damage: 2, column: 0 }), 0);
      lanes[0].cars.length = 0; lanes[1].cars.length = 0; lanes[2].cars.length = 0;
    }
    expect(gs.streakCharged).toBe(true);
    const big = put(loop, lanes[0], { color: 'Red', row: 2, hp: 4 });
    loop._resolveShot(new Shooter({ color: 'Red', damage: 2, column: 0 }), 0);
    expect(lanes[0].cars.includes(big)).toBe(false);
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

  it('a boss lane gets no refill traffic, and a BOMB booster takes two lights, not the boss', () => {
    const { gs, lanes, loop } = buildLoop();
    const boss = makeBoss(car({}), { sequence: ['Red', 'Blue', 'Red', 'Blue'] });
    boss.row = 0; boss.position = 0; lanes[1].addCar(boss);
    put(loop, lanes[0], { color: 'Red', row: 3, hp: 99 });
    loop._resolveShot(new Shooter({ color: 'Red', damage: 1, column: 0 }), 0);   // chip lane 0
    expect(lanes[1].cars).toEqual([boss]);
    loop._boosterState = { consumeBomb: () => true, bombs: 0 };
    loop.placeBombOnLane(1);
    expect(lanes[1].cars).toEqual([boss]);
    expect(boss.hp).toBe(2);
    expect(gs.isOver).toBe(false);
  });
});

describe('simulator parity', () => {
  it('runs a boss level and a trait level without throwing and reports V2 instrumentation', () => {
    const boss = new SimulationRunner({
      colors: ['Red', 'Blue', 'Green'], laneCount: 3, colCount: 3, gridRows: 8, levelId: 10,
      laneTargetCarCount: 2, worldConfig: { hpMultiplier: 0.7, speed: { base: 5, variance: 0 } },
      initialCars: [{ lane: 1, row: 0, sequence: ['Red', 'Blue', 'Green', 'Red'], moveEvery: 2 }],
      goals: [{ type: 'destroyType', carType: 'boss', count: 1 }],
    }).runLevel(1);
    expect(typeof boss.won).toBe('boolean');
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
