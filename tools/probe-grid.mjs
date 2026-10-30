// Difficulty landscape probe: win% and average turns for a level over a (heft, goal scale) grid,
// with the human profile. Used to choose the tuner's order of levers (2026-10-30).
//   node tools/probe-grid.mjs <level> [runs=200] [skill=human]
import { LevelManager } from '../src/game/LevelManager.js';
import { scaleGoal } from '../src/game/levelDsl.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';

const [idArg = '8', runsArg = '200', skill = 'human'] = process.argv.slice(2);
const id = Number(idArg), RUNS = Number(runsArg);
const lm = new LevelManager(); lm.goToLevel(id); const cfg = lm.current;
const goals0 = cfg.baseGoals ?? cfg.goals;
const HEFTS = [0, 0.3, 0.6, 1];
const GS = [0.5, 1, 1.5, 2, 2.5];
console.log(`L${id} ${cfg.name}  authored heft ${cfg.worldConfig.heft}  goals ${JSON.stringify(goals0.map(g => g.count))}  profile ${skill}`);
console.log('heft \\ goals ' + GS.map(g => `x${g}`.padStart(14)).join(''));
for (const heft of HEFTS) {
  let row = String(heft).padEnd(12);
  for (const gs of GS) {
    const c = { ...cfg, worldConfig: { ...cfg.worldConfig, heft }, goals: goals0.map(g => scaleGoal(g, gs)) };
    const r = SimulationRunner.fromLevel(c, { skill });
    let w = 0, turns = 0, lost = 0;
    for (let s = 1; s <= RUNS; s++) { const res = r.runLevel(s); if (res.won) { w++; turns += res.totalAdvances; } lost += res.barriersLost; }
    row += `${(100 * w / RUNS).toFixed(0).padStart(5)}% ${w ? (turns / w).toFixed(0).padStart(3) : '  -'}t ${(lost / RUNS).toFixed(1)}b`.padStart(14);
  }
  console.log(row);
}
