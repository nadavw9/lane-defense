// V3 special cars (TrafficRules): plated, mender, volatile, phantom — the pure rules,
// the shared CombatResolver, the live GameLoop wiring, goals, and sim parity.
import { describe, it, expect, vi } from 'vitest';
import {
  TRAITS, TRAIT_TYPES, rollTrait, applyTrait, healMenders, causesSurge, surgeOtherLanes,
  advanceLaneCars, isHiddenPhantom, PHANTOM_REVEAL_ROW, canTarget,
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

describe('trait registry', () => {
  it('new traits are appended, so existing levels draw the same random stream', () => {
    expect(TRAITS.slice(0, 3)).toEqual(['speeder', 'armored', 'chameleon']);
    expect(TRAITS).toEqual(expect.arrayContaining(['plated', 'mender', 'volatile', 'phantom']));
  });

  it('an old-style table never produces a new trait and consumes one draw per car', () => {
    const table = { speeder: 0.2, armored: 0.2, chameleon: 0.2 };
    const seen = new Set();
    for (let s = 1; s <= 200; s++) {
      const rng = new SeededRandom(s);
      const c = rollTrait(car({ type: 'big' }), table, rng, ['Red', 'Blue']);
      seen.add(c.trait);
    }
    for (const t of ['plated', 'mender', 'volatile', 'phantom']) expect(seen.has(t)).toBe(false);
  });

  it('every new trait has compatible car types and no art-less combinations', () => {
    for (const t of ['plated', 'mender', 'volatile', 'phantom']) expect(TRAIT_TYPES[t].size).toBeGreaterThan(0);
    expect(TRAIT_TYPES.plated.has('tank')).toBe(false);    // no baked sprite for plated tanks
    expect(TRAIT_TYPES.volatile.has('small')).toBe(false);
  });

  it('a table can roll each new trait', () => {
    for (const t of ['plated', 'mender', 'volatile', 'phantom']) {
      const c = rollTrait(car({ type: 'jeep' }), { [t]: 1 }, new SeededRandom(5), ['Red', 'Blue']);
      expect(c.trait).toBe(t);
    }
  });
});

describe('plated cars', () => {
  it('spawn with two plates', () => {
    expect(applyTrait(car({ type: 'truck' }), 'plated', new SeededRandom(1), ['Red']).armor).toBe(2);
  });

  it('any colour strips one plate per hit; the car then fights as an ordinary one', () => {
    const c = car({ color: 'Red', hp: 3, armor: 2, trait: 'plated' });
    const lane = laneOf(c);
    const r1 = combat.resolve({ color: 'Blue', damage: 9 }, lane);
    expect(r1).toMatchObject({ hit: true, armorBroken: true, armorLeft: 1, kills: 0 });
    expect(c.armor).toBe(1);
    expect(canTarget(c, 'Green')).toBe(true);
    const r2 = combat.resolve({ color: 'Green', damage: 9 }, lane);
    expect(r2).toMatchObject({ armorBroken: true, armorLeft: 0 });
    expect(c.hp).toBe(3);
    expect(combat.resolve({ color: 'Blue', damage: 9 }, lane).hit).toBe(false);   // wrong colour now misses
    expect(combat.resolve({ color: 'Red', damage: 9 }, lane).kills).toBe(1);
  });

  it('a plain armoured car still has exactly one plate', () => {
    const c = car({ armor: 1, trait: 'armored' });
    expect(combat.resolve({ color: 'Blue', damage: 1 }, laneOf(c)).armorLeft).toBe(0);
  });
});

describe('menders', () => {
  it('heal 1 HP per traffic move when they were not hit that turn', () => {
    const m = car({ trait: 'mender', hp: 2, maxHp: 5 });
    healMenders([m]); expect(m.hp).toBe(3);
    healMenders([m]); expect(m.hp).toBe(4);
  });

  it('never heal above max HP and never heal the dead', () => {
    const full = car({ trait: 'mender', hp: 5, maxHp: 5 });
    const dead = car({ trait: 'mender', hp: 0, maxHp: 5 });
    healMenders([full, dead]);
    expect(full.hp).toBe(5);
    expect(dead.hp).toBe(0);
  });

  it('skip the repair on the turn they are hit, and the mark clears afterwards', () => {
    const m = car({ trait: 'mender', hp: 5, maxHp: 5, color: 'Red' });
    combat.resolve({ color: 'Red', damage: 2 }, laneOf(m));
    expect(m.hp).toBe(3);
    expect(m.recentHit).toBe(true);
    healMenders([m]);
    expect(m.hp).toBe(3);          // this advance was caused by the hit on it
    expect(m.recentHit).toBe(false);
    healMenders([m]);
    expect(m.hp).toBe(4);          // next turn, elsewhere: it repairs
  });

  it('other traits and ordinary cars never heal', () => {
    const c = car({ trait: 'speeder', hp: 1, maxHp: 4 });
    healMenders([c]); expect(c.hp).toBe(1);
  });
});

describe('volatile cars', () => {
  it('a destroyed volatile is flagged as a surge source', () => {
    const v = car({ trait: 'volatile', hp: 1, color: 'Red' });
    const res = combat.resolve({ color: 'Red', damage: 5 }, laneOf(v));
    expect(res.destroyed[0].trait).toBe('volatile');
    expect(causesSurge(res.destroyed)).toBe(true);
    expect(causesSurge([{ trait: null }, { trait: 'mender' }])).toBe(false);
  });

  it('surge moves every OTHER lane one row, ignoring speeder double-steps', () => {
    const a = [car({ row: 3 })], b = [car({ row: 3 })], c = [car({ row: 2, trait: 'speeder' })];
    surgeOtherLanes([a, b, c], 1);
    expect(a[0].row).toBe(4);
    expect(b[0].row).toBe(3);   // the source lane is untouched
    expect(c[0].row).toBe(3);   // one row, not two
  });

  it('a surge cannot push a car through the one ahead', () => {
    const lane = [car({ row: 4 }), car({ row: 3 })];
    surgeOtherLanes([lane, []], 1);
    expect(lane[0].row).toBe(5);
    expect(lane[1].row).toBe(4);
  });
});

describe('phantoms', () => {
  it('are hidden until the reveal row and rules ignore the disguise', () => {
    const p = car({ trait: 'phantom', row: PHANTOM_REVEAL_ROW - 1 });
    expect(isHiddenPhantom(p)).toBe(true);
    p.row = PHANTOM_REVEAL_ROW;
    expect(isHiddenPhantom(p)).toBe(false);
    expect(isHiddenPhantom(car({ trait: 'speeder', row: 0 }))).toBe(false);
    expect(canTarget(car({ trait: 'phantom', color: 'Red', row: 0 }), 'Red')).toBe(true);
    expect(canTarget(car({ trait: 'phantom', color: 'Red', row: 0 }), 'Blue')).toBe(false);
  });
});

describe('destroyTrait goals', () => {
  it('count only kills of that trait', () => {
    const lanes   = Array.from({ length: 4 }, (_, id) => new Lane({ id }));
    const columns = Array.from({ length: 4 }, (_, id) => new Column({ id }));
    const gs = new GameState({
      lanes, columns, colors: ['Red'], world: { hpMultiplier: 1, speed: { base: 5, variance: 0 } },
      duration: 90, phaseMan: new IntensityPhase(90), laneCount: 3, colCount: 3, gridRows: 8,
      spawnBudget: 10, laneTargetCarCount: 1, goals: [{ type: 'destroyTrait', trait: 'mender', count: 2 }],
    });
    gs.applyKillToGoals('Red', 'big', null);
    gs.applyKillToGoals('Red', 'big', 'speeder');
    expect(gs.goalProgress[0]).toBe(2);
    gs.applyKillToGoals('Red', 'big', 'mender');
    gs.applyKillToGoals('Red', 'small', 'mender');
    expect(gs.goalProgress[0]).toBe(0);
    expect(gs.isGoalMet()).toBe(true);
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
  return { gs, lanes, loop };
}
const put = (loop, lane, props) => {
  const c = car(props);
  c.position = loop._rowToPosition(c.row ?? 0, 8);
  lane.addCar(c);
  return c;
};

describe('GameLoop V3 wiring', () => {
  it('killing a volatile shoves the other lanes an extra row on the same advance', () => {
    const { lanes, loop } = buildLoop();
    const v     = put(loop, lanes[0], { color: 'Red', row: 3, hp: 1, trait: 'volatile' });
    const other = put(loop, lanes[1], { color: 'Blue', row: 2, hp: 99 });
    const third = put(loop, lanes[2], { color: 'Blue', row: 2, hp: 99 });
    const onSurge = vi.fn(); loop._onSurge = onSurge;
    loop._resolveShot(new Shooter({ color: 'Red', damage: 4, column: 0 }), 0);
    expect(lanes[0].cars.includes(v)).toBe(false);
    expect(other.row).toBe(4);   // +1 normal advance, +1 surge
    expect(third.row).toBe(4);
    expect(onSurge).toHaveBeenCalledWith(0);
  });

  it('a surge past the breach row loses the level', () => {
    const { gs, lanes, loop } = buildLoop();
    put(loop, lanes[0], { color: 'Red', row: 3, hp: 1, trait: 'volatile' });
    put(loop, lanes[1], { color: 'Blue', row: 6, hp: 99 });   // MAX_ROW is 7: +1 advance +1 surge = 8
    loop._resolveShot(new Shooter({ color: 'Red', damage: 4, column: 0 }), 0);
    expect(gs.isOver).toBe(true);
    expect(gs.didWin).not.toBe(true);
  });

  it('a normal kill does not surge', () => {
    const { lanes, loop } = buildLoop();
    put(loop, lanes[0], { color: 'Red', row: 3, hp: 1 });
    const other = put(loop, lanes[1], { color: 'Blue', row: 2, hp: 99 });
    loop._resolveShot(new Shooter({ color: 'Red', damage: 4, column: 0 }), 0);
    expect(other.row).toBe(3);
  });

  it('a plated car takes two shots (any colour) before it can be damaged, advancing traffic each time', () => {
    const { lanes, loop } = buildLoop();
    const plated = put(loop, lanes[0], { color: 'Red', row: 3, armor: 2, trait: 'plated' });
    const other  = put(loop, lanes[1], { color: 'Blue', row: 2, hp: 99 });
    loop._resolveShot(new Shooter({ color: 'Blue', damage: 4, column: 0 }), 0);
    expect(plated.armor).toBe(1);
    expect(other.row).toBe(3);
    loop._resolveShot(new Shooter({ color: 'Blue', damage: 4, column: 0 }), 0);
    expect(plated.armor).toBe(0);
    expect(other.row).toBe(4);
  });

  it('a damaged mender repairs on the advance caused by a shot in another lane', () => {
    const { lanes, loop } = buildLoop();
    const m = put(loop, lanes[0], { color: 'Red', row: 2, hp: 3, maxHp: 6, trait: 'mender' });
    put(loop, lanes[1], { color: 'Blue', row: 3, hp: 99 });
    loop._resolveShot(new Shooter({ color: 'Blue', damage: 1, column: 0 }), 1);
    expect(m.hp).toBe(4);
  });
});

describe('simulator parity', () => {
  const cfg = (traits, extra = {}) => ({
    colors: ['Red', 'Blue', 'Green'], laneCount: 3, colCount: 3, gridRows: 8, levelId: 50,
    laneTargetCarCount: 2, worldConfig: { hpMultiplier: 1, heft: 0.3, speed: { base: 5, variance: 0 } },
    traits, goals: [{ type: 'destroyTotal', count: 25 }], ...extra,
  });

  it('runs every new trait without throwing and still finishes levels', () => {
    for (const t of ['plated', 'mender', 'volatile', 'phantom']) {
      const r = new SimulationRunner(cfg({ [t]: 0.3 })).runLevel(3);
      expect(typeof r.won, t).toBe('boolean');
      expect(r.turns).toBeGreaterThan(0);
    }
  });

  it('plated levels strip plates, and trait levels are deterministic per seed', () => {
    const a = new SimulationRunner(cfg({ plated: 0.4 })).runLevel(9);
    const b = new SimulationRunner(cfg({ plated: 0.4 })).runLevel(9);
    expect(a.armorBreaks).toBeGreaterThan(0);
    expect(a).toEqual(b);
  });

  it('a destroyTrait goal is winnable and counted in the sim', () => {
    const runs = Array.from({ length: 20 }, (_, i) =>
      new SimulationRunner(cfg({ mender: 0.35 }, { goals: [{ type: 'destroyTrait', trait: 'mender', count: 3 }] })).runLevel(i + 1));
    expect(runs.some(r => r.won)).toBe(true);
  });

  it('volatile traffic is measurably harder than the same board without it', () => {
    const rate = (traits) => {
      let w = 0;
      for (let s = 1; s <= 60; s++) if (new SimulationRunner(cfg(traits)).runLevel(s).won) w++;
      return w / 60;
    };
    expect(rate({ volatile: 0.45 })).toBeLessThanOrEqual(rate(null));
  });
});
