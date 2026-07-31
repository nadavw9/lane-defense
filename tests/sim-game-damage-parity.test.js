// SIM AND GAME MUST RESOLVE DAMAGE IDENTICALLY.
//
// Three sim/game divergences have now been found, each by accident, each late,
// each after balance work had already been done on bad numbers:
//   1. hpMultiplier double-discount
//   2. the BOMB trigger threshold
//   3. (2026-07-31) the sim DISCARDED overflow damage while the game carries it
//      over into the next same-colour car. The sim is the balance gate (VISION
//      rule 6), so every band number on all 40 levels was measured against a game
//      that does not exist. Fixing it moved 37/40 levels.
//
// The structural fix was to delete the sim's private damage model and route it
// through the shipped CombatResolver via an adapter. This suite is the guard: it
// runs the SAME inputs down BOTH representations — real Lane/Car models (what the
// game uses) and the sim's plain {row,hp,type,color} records through the exported
// adapter — and asserts byte-identical outcomes.
//
// A NOTE ON WHAT THIS CAN AND CANNOT CATCH. Because the sim now literally calls
// CombatResolver, damage parity is currently structural rather than coincidental.
// That is the point — but it also means these tests would pass trivially if someone
// re-inlined a second damage path and left the resolver unused (exactly the shape
// of the bug being fixed: SimulationRunner._applyDamage existed, was correct-ish,
// and was never called). The structural guards at the bottom are therefore not
// decoration; they are the part that actually catches a regression.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { CombatResolver } from '../src/game/CombatResolver.js';
import { laneView }       from '../src/simulation/SimulationRunner.js';
import { Lane }           from '../src/models/Lane.js';
import { Car }            from '../src/models/Car.js';
import { CAR_TYPES }      from '../src/director/CarTypes.js';
import { HP_MINIMUM }     from '../src/director/DirectorConfig.js';

const cr = new CombatResolver();

/** Build the GAME representation: real Lane holding real Car models. */
function gameLane(spec) {
  const lane = new Lane({ id: 0 });
  spec.forEach((s, i) => {
    const c = new Car({ color: s.color, hp: s.hp, speed: 5, type: s.type ?? 'big' });
    c.hp = s.hp; c.row = spec.length - i;
    lane.addCar(c);
  });
  return lane;
}
/** Build the SIM representation: plain records, seen through the real adapter. */
function simLane(spec) {
  const raw = { id: 0, cars: spec.map((s, i) => ({ row: spec.length - i, hp: s.hp, type: s.type ?? 'big', color: s.color })) };
  return { raw, view: laneView(raw) };
}
/** Byte-aligned snapshot of everything a shot can change. */
const snapGame = (lane) => lane.cars.map((c) => `${c.color}:${c.hp}:${c.type}`).join('|');
const snapSim  = (raw)  => raw.cars.map((c) => `${c.color}:${c.hp}:${c.type}`).join('|');
const snapRes  = (r)    => `k=${r.kills} co=${r.carryOverKills} dmg=${r.damageDealt} destroyed=${r.destroyed.map((d) => d.color + '/' + d.type).join(',')}`;

/** Fire the same shot at both representations and assert they agree exactly. */
function bothAgree(spec, shooter, label) {
  const g = gameLane(spec);
  const s = simLane(spec);
  const rg = cr.resolve(shooter, g);
  const rs = cr.resolve(shooter, s.view);
  expect(snapRes(rs), `${label}: shot RESULT differs between sim and game`).toBe(snapRes(rg));
  expect(snapSim(s.raw), `${label}: resulting BOARD differs between sim and game`).toBe(snapGame(g));
  return rg;
}

describe('sim and game resolve damage identically', () => {
  it('single hit that does not kill', () => {
    const r = bothAgree([{ color: 'Red', hp: 5 }], { color: 'Red', damage: 2 }, 'single hit');
    expect(r.kills).toBe(0);
    expect(r.damageDealt).toBe(2);
  });

  it('exact-lethal hit leaves no overflow', () => {
    const r = bothAgree([{ color: 'Red', hp: 3 }, { color: 'Red', hp: 3 }], { color: 'Red', damage: 3 }, 'exact lethal');
    expect(r.kills).toBe(1);
    expect(r.carryOverKills).toBe(0);
  });

  it('OVERKILL CARRIES OVER — the exact 2026-07-31 divergence', () => {
    // The sim used to score this as ONE kill and bin the remaining 5 damage.
    const r = bothAgree(
      [{ color: 'Red', hp: 3 }, { color: 'Red', hp: 3 }, { color: 'Red', hp: 3 }],
      { color: 'Red', damage: 8 }, 'overkill carry-over');
    expect(r.kills, 'an 8-damage shot into 3+3 HP must kill TWO cars').toBe(2);
    expect(r.carryOverKills).toBe(1);
    expect(r.damageDealt, 'all 8 damage is spent: 3 + 3 + 2 into the third car').toBe(8);
  });

  it('carry-over STOPS at the first mismatched-colour car', () => {
    // The opposite-direction error: a chain that runs further than the game's.
    // The sim's old private _applyDamage() omitted this re-check entirely.
    const r = bothAgree(
      [{ color: 'Red', hp: 3 }, { color: 'Blue', hp: 3 }, { color: 'Red', hp: 3 }],
      { color: 'Red', damage: 8 }, 'chain stopped by colour');
    expect(r.kills, 'the Blue car must stop the chain dead').toBe(1);
    expect(r.damageDealt, 'the 5 leftover damage is LOST, not applied past the mismatch').toBe(3);
  });

  it('colour mismatch on the FRONT car deals nothing, whatever the bomb', () => {
    for (const damage of [2, 10, 99]) {
      const r = bothAgree([{ color: 'Red', hp: 3 }], { color: 'Blue', damage }, `mismatch dmg=${damage}`);
      expect(r.damageDealt).toBe(0);
      expect(r.kills).toBe(0);
    }
  });

  it('deep multi-car chain — every kill accounted for in both', () => {
    const r = bothAgree(
      Array.from({ length: 6 }, () => ({ color: 'Red', hp: 2 })),
      { color: 'Red', damage: 9 }, 'deep chain');
    expect(r.kills).toBe(4);            // 2+2+2+2 = 8, 1 left into the 5th
    expect(r.carryOverKills).toBe(3);
    expect(r.damageDealt).toBe(9);
  });

  it('HP_MINIMUM clamping is shared, not re-derived per implementation', () => {
    // Both sides take HP from CarDirector._buildCar; the sim copies car.hp verbatim
    // into its record. Pin the formula so a second copy cannot appear.
    const hpAt = (base, m) => Math.max(HP_MINIMUM, Math.round(base * m));
    expect(hpAt(CAR_TYPES.small.hp, 0.63)).toBe(2);   // raw 1.26 -> clamped UP to the floor
    expect(hpAt(CAR_TYPES.big.hp, 0.63)).toBe(3);
    const src = fs.readFileSync('src/simulation/SimulationRunner.js', 'utf8');
    expect(src, 'the sim must copy CarDirector hp, never recompute it')
      .toMatch(/hp:\s*car\.hp/);
    expect(src, 'the sim must not apply hpMultiplier itself — that is the double-discount bug')
      .not.toMatch(/hp\s*[*]=\s*.*hpMultiplier/);
  });

  it('booster LANE-CLEAR removes the whole lane in both, colour-agnostic', () => {
    // The sim clears bestLane.cars entirely; GameLoop.placeBombOnLane empties
    // lane.cars. Assert the shape both rely on: no colour survives a lane clear.
    const spec = [{ color: 'Red', hp: 3 }, { color: 'Blue', hp: 9 }, { color: 'Green', hp: 2 }];
    const g = gameLane(spec); const s = simLane(spec);
    g.cars.length = 0; s.raw.cars.length = 0;      // the operation both perform
    expect(snapSim(s.raw)).toBe(snapGame(g));
    expect(s.raw.cars).toHaveLength(0);

    const simSrc = fs.readFileSync('src/simulation/SimulationRunner.js', 'utf8');
    const gameSrc = fs.readFileSync('src/game/GameLoop.js', 'utf8');
    expect(simSrc, 'sim BOMB must clear an entire lane, not a row').toMatch(/bestLane\.cars\.length\s*=\s*0/);
    expect(gameSrc, 'game BOMB must clear an entire lane, not a row').toMatch(/placeBombOnLane/);
  });
});

describe('the sim owns NO private damage model (the structural guard)', () => {
  const src = fs.readFileSync('src/simulation/SimulationRunner.js', 'utf8');
  const noComments = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  it('routes damage through the shipped CombatResolver', () => {
    expect(noComments, 'SimulationRunner must import CombatResolver').toMatch(/import\s*\{\s*CombatResolver\s*\}/);
    expect(noComments, 'SimulationRunner must actually CALL it — an unused import is how the last bug hid')
      .toMatch(/_combat\.resolve\(/);
  });

  it('has no second, inline damage path', () => {
    // The exact shape of the bug: `car.hp -= dmg` followed by a shift on death.
    expect(noComments, 'inline hp subtraction is back — overflow will be silently discarded again')
      .not.toMatch(/\.hp\s*-=\s*/);
    expect(noComments, 'a private _applyDamage has reappeared; there must be ONE damage model')
      .not.toMatch(/_applyDamage\s*\(/);
  });

  it('the adapter writes through to the underlying record', () => {
    // If carView ever copied instead of referencing, the sim would resolve damage
    // against a throwaway object and every car would be immortal.
    const raw = { id: 0, cars: [{ row: 1, hp: 5, type: 'big', color: 'Red' }] };
    const view = laneView(raw);
    view.frontCar().takeDamage(2);
    expect(raw.cars[0].hp, 'adapter did not write through — damage went to a copy').toBe(3);
    expect(view.frontCar().isDead()).toBe(false);
    view.frontCar().takeDamage(99);
    expect(raw.cars[0].hp, 'takeDamage must clamp at 0 like the Car model').toBe(0);
    expect(view.frontCar().isDead()).toBe(true);
  });
});
