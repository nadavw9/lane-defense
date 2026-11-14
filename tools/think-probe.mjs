// Does lane ORDER matter on a level? The human profile shoots the closest car first; the careless
// player (laneOrder 'random') shoots any lane its bombs fit. A level that makes the player think
// shows a gap: the careful player passes, the careless one smashes barriers or loses.
// Owner 2026-11-14: L1-3 had "no thinking at all"; chosen fix: "which lane first".
//   node tools/think-probe.mjs [levels=1-6] [runs=300]
import { LevelManager } from '../src/game/LevelManager.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';

const [range = '1-6', runsArg = '300'] = process.argv.slice(2);
const [a, b = a] = range.split('-').map(Number);
const RUNS = Number(runsArg);
const lm = new LevelManager();

function measure(cfg, laneOrder) {
  const r = SimulationRunner.fromLevel(cfg, { skill: 'human', laneOrder });
  let won = 0, barriers = 0, anyBarrier = 0, turns = 0;
  for (let s = 1; s <= RUNS; s++) {
    const res = r.runLevel(s);
    if (res.won) { won++; turns += res.totalAdvances; }
    barriers += res.barriersLost;
    if (res.barriersLost > 0) anyBarrier++;
  }
  const pct = (x) => `${(100 * x / RUNS).toFixed(0)}%`.padStart(4);
  return `win ${pct(won)}  barrier lost in ${pct(anyBarrier)} of runs (${(barriers / RUNS).toFixed(2)}/run)  ${won ? (turns / won).toFixed(0) : '-'} shots`;
}

console.log(`runs ${RUNS} per cell, human profile`);
for (let id = a; id <= b; id++) {
  lm.goToLevel(id);
  const cfg = lm.current;
  console.log(`L${id} ${cfg.name}`);
  console.log(`  closest first: ${measure(cfg, 'threat')}`);
  console.log(`  careless:      ${measure(cfg, 'random')}`);
}
