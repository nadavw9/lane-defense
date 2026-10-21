// Shared level-authoring helpers — LevelManager (L1-40) and LateLevels (L41+).
import { BOARD_ROWS } from '../director/TrafficRules.js';
import { LATE_TUNING as tuning } from './lateTuning.js';

const SPD = { base: 5.0, variance: 0.3 };
// `heft` 0..1 = how heavy the spawn mix is (see CarTypes.heftWeights). Car HP per
// TYPE is fixed everywhere: hpMultiplier is always 1.
export const W = (heft) => ({ heft, hpMultiplier: 1, speed: SPD });
export const total = (n) => [{ type: 'destroyTotal', count: n }];

// Goal shorthands.
export const goalTotal = (count) => ({ type: 'destroyTotal', count });
export const goalColor = (color, count) => ({ type: 'destroyColor', color, count });
export const goalType  = (carType, count) => ({ type: 'destroyType', carType, count });
export const goalTrait = (trait, count) => ({ type: 'destroyTrait', trait, count });

/** Goal count x tuning scale. A whole-level 'destroy N cars' goal never drops under 6,
 *  a colour / type / trait side-goal never under 2, so a scaled level keeps its idea. */
export function scaleGoal(g, k) {
  const floor = g.type === 'destroyTotal' ? 6 : 2;
  return { ...g, count: Math.min(g.count, Math.max(floor, Math.round(g.count * k))) };
}

export const COLOR = { R: 'Red', B: 'Blue', G: 'Green', Y: 'Yellow', P: 'Purple', O: 'Orange' };
/** 'ROBY' -> ['Orange'...]: palette from letters, in the order given. */
export const pal = (letters) => [...letters].map(c => COLOR[c]);

/**
 * One 3-lane, 8-row level with the campaign's standard shape. Everything that is
 * not a per-level idea is derived from the id so the late curve ramps smoothly:
 * budget and goals grow with the id; `dense` raises traffic to three cars a lane.
 */
export function lv(id, name, letters, o = {}) {
  const ramp = Math.floor((Math.min(id, 100) - 40) / 6);   // the second tour (L101+) holds L100's budget
  const t = tuning?.[id];                       // sim-tuned numbers (lateTuning.js)
  const scaleTraits = (tr, k) => Object.fromEntries(Object.entries(tr).map(([n, p]) => [n, +(p * k).toFixed(4)]));
  const goals = (o.goals ?? total(o.total ?? 26)).map(g => scaleGoal(g, t?.gs ?? 1));
  return {
    id, name, laneCount: 3, colCount: 3, colors: pal(letters),
    worldConfig: W(o.heft ?? t?.heft ?? 0.3),
    duration: o.duration ?? 110, spawnBudget: o.budget ?? 24 + ramp, laneTargetCarCount: o.dense ? 3 : 2, gridRows: BOARD_ROWS,
    ...(o.traits ? { traits: t?.ts ? scaleTraits(o.traits, t.ts) : o.traits, baseTraits: o.traits } : {}),
    ...(o.hint ? { hintText: o.hint } : {}),
    ...(o.milestone ? { milestone: true } : {}),
    ...(o.initialCars ? { initialCars: o.initialCars } : {}),
    goals,
    baseGoals: o.goals ?? total(o.total ?? 26),    // authored, before the tuning scale
  };
}

// ── Level identity (2026-10-17) ───────────────────────────────────────────────
// Three board elements give levels a face you can see on the first frame:
//   traffic light — a lane that holds still on red ({ lane, green, red, phase } in traffic moves)
//   convoy        — a lane that only brings motorbikes (one hit each: fast, satisfying kills)
//   gift car      — a car with a bow; destroying it pays out a booster (trait 'gift')
// Each is introduced alone on a fixed level (L36 gift, L38 light, L43 convoy; see
// introSchedule.js) and then recurs on a fixed rhythm. Big waves keep their own identity.
export const GIFT_FROM = 23, LIGHT_FROM = 26, CONVOY_FROM = 43;
const LIGHT = (lane, phase) => ({ lane, green: 3, red: 2, phase });

export function identityFor(id, milestone = false) {
  const out = { lights: null, convoy: null, gift: 0 };
  if (typeof id !== 'number') return out;
  if (id === GIFT_FROM) out.gift = 0.14;                     // the intro level shows several
  else if (id > GIFT_FROM) out.gift = 0.05;
  if (milestone) return out;
  if (id === LIGHT_FROM) { out.lights = [LIGHT(1, 0)]; return out; }
  if (id === CONVOY_FROM) { out.convoy = [1]; return out; }
  if (id > LIGHT_FROM && id % 3 === 2) {
    // From L35, every other light level has two lights, out of step (never both red at once).
    out.lights = id >= 35 && id % 6 === 5
      ? [LIGHT(0, 0), LIGHT(2, 2)]
      : [LIGHT(Math.floor(id / 3) % 3, id % 5)];
  } else if (id > CONVOY_FROM && id % 8 === 0) {
    out.convoy = [id % 3];
  }
  return out;
}
