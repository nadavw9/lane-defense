// goal-search.mjs — per-level goal-count search for balance.
//
// For each level, binary-searches a single scale factor applied to ALL goals on
// that level (types + inter-goal ratios preserved), rounding to nearest int (min 3),
// to land the win rate in the level's target band:
//   Bosses (10/20/30/40): 20-30%   ·   FTUE (1-5): 60-80%   ·   others: 40-65%.
// 300 runs/candidate (speed over precision — verify final at 500 after).
//
// Reports current → recommended goal counts. Does NOT modify LevelManager.js.

import { LevelManager } from '../src/game/LevelManager.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';

const RUNS = 300;
const BOSSES = new Set([10, 20, 30, 40]);
const bandFor = (id) =>
  BOSSES.has(id) ? [20, 30] :
  (id >= 1 && id <= 5) ? [60, 80] :
  [40, 65];

function scaledGoals(goals, scale) {
  return goals.map(g => ({ ...g, count: Math.max(3, Math.round(g.count * scale)) }));
}
function goalStr(goals) {
  return goals.map(g =>
    g.type === 'destroyTotal' ? `Total:${g.count}` :
    g.type === 'destroyColor' ? `${g.color}:${g.count}` :
    `${g.carType}:${g.count}`
  ).join(', ');
}

function evalLevel(cfg, id, goals) {
  const runner = new SimulationRunner({
    duration: cfg.duration, colors: cfg.colors, worldConfig: cfg.worldConfig,
    levelId: id, skill: 'average', laneCount: cfg.laneCount, colCount: cfg.colCount,
    laneTargetCarCount: cfg.laneTargetCarCount, spawnBudget: cfg.spawnBudget,
    gridRows: cfg.gridRows, goals,
  });
  let wins = 0, winTurns = 0;
  for (let s = 0; s < RUNS; s++) {
    const r = runner.runLevel(1 + s);
    if (r.won) { wins++; winTurns += r.totalAdvances; }
  }
  return { win: (wins / RUNS) * 100, turns: wins ? winTurns / wins : null };
}

console.log(`\nGoal-count search — 40 levels × ${RUNS} runs/candidate  (win decreases as goals scale up)\n`);
console.log('Lvl │ Band   │ Current                        │ Recommended                    │ Win%  │ Turns │ note');
console.log('────┼────────┼────────────────────────────────┼────────────────────────────────┼───────┼───────┼──────');

for (let id = 1; id <= 40; id++) {
  const lm = new LevelManager(); lm.goToLevel(id);
  const cfg = lm.current;
  const goals0 = cfg.goals ?? [];
  const [lo, hi] = bandFor(id);
  const targetMid = (lo + hi) / 2;

  // Binary search on scale. Win decreases as scale increases.
  let sLo = 0.1, sHi = 2.5, best = null;
  for (let it = 0; it < 11; it++) {
    const s = (sLo + sHi) / 2;
    const g = scaledGoals(goals0, s);
    const res = evalLevel(cfg, id, g);
    best = { s, g, ...res };
    if (res.win > targetMid) sLo = s; else sHi = s;   // too easy → raise scale (harder)
  }
  // Use the converged scale's rounded goals; verify.
  const rec = scaledGoals(goals0, best.s);
  const fin = evalLevel(cfg, id, rec);

  let note = 'ok';
  if (fin.win < lo) note = 'STILL HARD (structural)';
  else if (fin.win > hi) note = 'STILL EASY (structural)';

  const turnsStr = fin.turns != null ? fin.turns.toFixed(0).padStart(5) : '   — ';
  console.log(
    `${String(id).padStart(3)} │ ${(lo + '-' + hi + '%').padEnd(6)} │ ${goalStr(goals0).padEnd(30).slice(0, 30)} │ ${goalStr(rec).padEnd(30).slice(0, 30)} │ ${fin.win.toFixed(1).padStart(5)} │ ${turnsStr} │ ${note}`
  );
}
