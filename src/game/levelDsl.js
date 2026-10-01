// Shared level-authoring helpers — LevelManager (L1-40) and LateLevels (L41+).
import { LATE_TUNING as tuning } from './lateTuning.js';

const SPD = { base: 5.0, variance: 0.3 };
// `heft` 0..1 = how heavy the spawn mix is (see CarTypes.heftWeights). Car HP per
// TYPE is fixed everywhere: hpMultiplier is always 1.
export const W = (heft) => ({ heft, hpMultiplier: 1, speed: SPD });
export const total = (n) => [{ type: 'destroyTotal', count: n }];
export const boss = [{ type: 'defeatBoss', count: 1 }];
// Opening rows for the non-boss lanes of a boss level (the boss owns its lane).
export const open = (...lanes) => lanes.flatMap(lane => [{ lane, row: 0 }, { lane, row: 1 }]);

// Goal shorthands.
export const goalTotal = (count) => ({ type: 'destroyTotal', count });
export const goalColor = (color, count) => ({ type: 'destroyColor', color, count });
export const goalType  = (carType, count) => ({ type: 'destroyType', carType, count });
export const goalTrait = (trait, count) => ({ type: 'destroyTrait', trait, count });

export const COLOR = { R: 'Red', B: 'Blue', G: 'Green', Y: 'Yellow', P: 'Purple', O: 'Orange' };
/** 'ROBY' -> ['Orange'...]: palette from letters, in the order given. */
export const pal = (letters) => [...letters].map(c => COLOR[c]);

/**
 * One 3-lane, 8-row level with the campaign's standard shape. Everything that is
 * not a per-level idea is derived from the id so the late curve ramps smoothly:
 * budget and goals grow with the id; `dense` raises traffic to three cars a lane.
 */
export function lv(id, name, letters, o = {}) {
  const ramp = Math.floor((id - 40) / 6);
  const t = tuning?.[id];                       // sim-tuned numbers (lateTuning.js)
  const scaleTraits = (tr, k) => Object.fromEntries(Object.entries(tr).map(([n, p]) => [n, +(p * k).toFixed(4)]));
  const goals = (o.goals ?? total(o.total ?? 26)).map(g => (g.type === 'defeatBoss' || g.type === 'destroyTrait') ? g : { ...g, count: Math.max(1, Math.round(g.count * (t?.gs ?? 1))) });
  return {
    id, name, laneCount: 3, colCount: 3, colors: pal(letters),
    worldConfig: W(o.heft ?? t?.heft ?? 0.3),
    duration: o.duration ?? 110, spawnBudget: o.budget ?? 24 + ramp, laneTargetCarCount: o.dense ? 3 : 2, gridRows: 8,
    ...(o.traits ? { traits: t?.ts ? scaleTraits(o.traits, t.ts) : o.traits, baseTraits: o.traits } : {}),
    ...(o.hint ? { hintText: o.hint } : {}),
    ...(o.initialCars ? { initialCars: o.initialCars } : {}),
    goals,
    baseGoals: o.goals ?? total(o.total ?? 26),    // authored, before the tuning scale
  };
}
