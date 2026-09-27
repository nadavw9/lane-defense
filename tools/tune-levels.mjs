// Level auto-tuner — finds the hpMultiplier that puts each level at the centre
// of its win-rate band (tools/balance-sim.js bands, skill=average), and when the
// hp floor still leaves a level too hard, the goal scale that does.
//
//   node tools/tune-levels.mjs 4-40 [runs=200]   → JSON { id: { hp, goalScale, win } }
//
// It only RECOMMENDS; LevelManager.js stays the hand-edited source of truth.
import { LevelManager } from '../src/game/LevelManager.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';

const [range = '4-40', runsArg = '200'] = process.argv.slice(2);
const [lo, hi = lo] = range.split('-').map(Number);
const RUNS = Number(runsArg);
const BOSS = new Set([10, 20, 30, 40]);
const band = (id) => BOSS.has(id) ? [40, 55] : id <= 9 ? [85, 95] : id <= 26 ? [70, 82] : [60, 75];

function winRate(cfg, hp, goalScale) {
  const c = { ...cfg, worldConfig: { ...cfg.worldConfig, hpMultiplier: hp },
    goals: cfg.goals.map(g => ({ ...g, count: g.type === 'defeatBoss' ? g.count : Math.max(1, Math.round(g.count * goalScale)) })) };
  const r = SimulationRunner.fromLevel(c, { skill: 'average' });
  let w = 0;
  for (let s = 1; s <= RUNS; s++) if (r.runLevel(s).won) w++;
  return (w / RUNS) * 100;
}

const out = {};
for (let id = lo; id <= hi; id++) {
  const lm = new LevelManager(); lm.goToLevel(id); const cfg = lm.current;
  const [bLo, bHi] = band(id); const target = (bLo + bHi) / 2;
  let goalScale = 1;
  let a = 0.35, b = 1.4;
  // Too hard even at the hp floor → shrink the goals first.
  while (winRate(cfg, a, goalScale) < target && goalScale > 0.45) goalScale = +(goalScale - 0.1).toFixed(2);
  for (let i = 0; i < 8; i++) {
    const m = (a + b) / 2;
    if (winRate(cfg, m, goalScale) > target) a = m; else b = m;
  }
  const hp = Math.round(((a + b) / 2) * 100) / 100;
  const win = winRate(cfg, hp, goalScale);
  out[id] = { hp, goalScale, win: +win.toFixed(1), band: `${bLo}-${bHi}` };
  console.error(`L${id}: hp ${hp} goals x${goalScale} -> ${win.toFixed(1)}% (${bLo}-${bHi})`);
}
console.log(JSON.stringify(out));
