// Near-miss report: how close the losses are, and how often ONE continue turns a loss into a win.
//   node tools/near-miss.mjs [from-to] [runs]
// For each level: loss rate, the share of losses that came with >= 75% of the goal done
// ("near misses"), and the win rate of losers who take one CONTINUE.
import { LevelManager } from '../src/game/LevelManager.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';
const [range = '10-100', runsArg = '300'] = process.argv.slice(2);
const [lo, hi = lo] = range.split('-').map(Number);
const RUNS = Number(runsArg);
const rows = [];
for (let id = lo; id <= hi; id++) {
  const lm = new LevelManager(); lm.goToLevel(id);
  const r0 = SimulationRunner.fromLevel(lm.current, { skill: 'average' });
  const r1 = SimulationRunner.fromLevel(lm.current, { skill: 'average', continues: 1 });
  let losses = 0, near = 0, prog = 0, saved = 0;
  for (let s = 1; s <= RUNS; s++) {
    const a = r0.runLevel(s);
    if (a.won) continue;
    losses++;
    prog += a.progressAtLoss ?? 0;
    if ((a.progressAtLoss ?? 0) >= 0.75) near++;
    if (r1.runLevel(s).won) saved++;
  }
  rows.push({ id, win: 100 - (100 * losses) / RUNS, nearShare: losses ? (100 * near) / losses : 0,
    meanProg: losses ? (100 * prog) / losses : 0, continueWin: losses ? (100 * saved) / losses : 0 });
}
const avg = (k) => rows.reduce((a, r) => a + r[k], 0) / rows.length;
for (const r of rows) console.log(`L${r.id}\twin ${r.win.toFixed(0)}%\tlosses near the end ${r.nearShare.toFixed(0)}%\tmean goal done at loss ${r.meanProg.toFixed(0)}%\tcontinue saves ${r.continueWin.toFixed(0)}%`);
console.log(`MEAN\twin ${avg('win').toFixed(1)}%\tnear ${avg('nearShare').toFixed(1)}%\tgoal-at-loss ${avg('meanProg').toFixed(1)}%\tcontinue saves ${avg('continueWin').toFixed(1)}%`);
