// Headless balance simulator — runs N games per level, reports goal-based difficulty.
//
// Usage:
//   node tools/balance-sim.js --level=5   --runs=500 --skill=average
//   node tools/balance-sim.js --level=all --runs=500
//
// Skills: optimal | beginner | average (default) | skilled
//
// Win = complete every level goal (destroyTotal / destroyColor / destroyType) with no
// breach. Cars spawn infinitely (no budget win). Reports per level: win rate, avg
// turns-to-win (grid advances), avg kills/shot, the goal summary, and a flag.
//
// Flags (per task): win<20% too hard · win>80% too easy · turns>25 too long · turns<5 too short.

import { LevelManager } from '../src/game/LevelManager.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';

const args  = process.argv.slice(2);
const levelArg = args.find(a => a.startsWith('--level='))?.split('=')[1] ?? '1';
const runs  = parseInt(args.find(a => a.startsWith('--runs='))?.split('=')[1] ?? '500');
const skill = args.find(a => a.startsWith('--skill='))?.split('=')[1] ?? 'average';

const VALID_SKILLS = new Set(['optimal', 'beginner', 'average', 'skilled']);
if (!VALID_SKILLS.has(skill)) {
  console.error(`Unknown skill: ${skill}. Valid: optimal | beginner | average | skilled`);
  process.exit(1);
}

const TOTAL_LEVELS = 40;
const levelIds = levelArg === 'all'
  ? Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1)
  : levelArg.split(',').map(s => parseInt(s.replace(/^L/i, ''), 10)).filter(n => !Number.isNaN(n));

function goalSummary(goals) {
  if (!goals?.length) return '(none)';
  return goals.map(g =>
    g.type === 'destroyTotal' ? `Total:${g.count}`
    : g.type === 'destroyColor' ? `${g.color}:${g.count}`
    : `${g.carType}:${g.count}`
  ).join(', ');
}

function flagFor(winPct, avgTurns) {
  const f = [];
  if (winPct < 20) f.push('TOO HARD');
  else if (winPct > 80) f.push('TOO EASY');
  if (avgTurns != null && avgTurns > 25) f.push('TOO LONG');
  else if (avgTurns != null && avgTurns < 5) f.push('TOO SHORT');
  return f.length ? f.join(' + ') : 'OK';
}

function runOne(levelId) {
  const lm = new LevelManager();
  lm.goToLevel(levelId);
  const cfg = lm.current;
  const runner = new SimulationRunner({
    duration: cfg.duration, colors: cfg.colors, worldConfig: cfg.worldConfig,
    levelId, skill, laneCount: cfg.laneCount, colCount: cfg.colCount,
    laneTargetCarCount: cfg.laneTargetCarCount, spawnBudget: cfg.spawnBudget,
    gridRows: cfg.gridRows, goals: cfg.goals ?? [],
  });

  let wins = 0, winTurns = 0, totalKills = 0, totalShots = 0;
  for (let s = 0; s < runs; s++) {
    const r = runner.runLevel(1 + s);
    totalKills += r.carsKilled;
    totalShots += r.correctShots;
    if (r.won) { wins++; winTurns += r.totalAdvances; }
  }
  const winPct   = (wins / runs) * 100;
  const avgTurns = wins > 0 ? winTurns / wins : null;
  const killsPerShot = totalShots > 0 ? totalKills / totalShots : 0;
  return { levelId, cfg, winPct, avgTurns, killsPerShot, wins };
}

// ── Run + table ────────────────────────────────────────────────────────────────
console.log(`\nBalance sim — ${levelIds.length} level(s) × ${runs} runs  [skill: ${skill}]  (win = all goals met, no breach)\n`);
console.log('Lvl │ Goals                              │ Win%  │ AvgTurns │ Kills/Shot │ Flag');
console.log('────┼────────────────────────────────────┼───────┼──────────┼────────────┼──────────────────');

const results = [];
for (const id of levelIds) {
  const r = runOne(id);
  results.push(r);
  const goalsStr = goalSummary(r.cfg.goals).padEnd(34).slice(0, 34);
  const turnsStr = r.avgTurns != null ? r.avgTurns.toFixed(1).padStart(8) : '     —  ';
  const flag = flagFor(r.winPct, r.avgTurns);
  console.log(
    `${String(id).padStart(3)} │ ${goalsStr} │ ${r.winPct.toFixed(1).padStart(5)} │ ${turnsStr} │ ${r.killsPerShot.toFixed(2).padStart(10)} │ ${flag}`
  );
}

// ── Summary of flagged levels ────────────────────────────────────────────────────
const flagged = results.filter(r => flagFor(r.winPct, r.avgTurns) !== 'OK');
console.log(`\n${flagged.length} / ${results.length} levels flagged.`);
if (flagged.length) {
  console.log('Flagged:', flagged.map(r => `L${r.levelId}(${flagFor(r.winPct, r.avgTurns)})`).join('  '));
}
const avgWin = results.reduce((s, r) => s + r.winPct, 0) / results.length;
console.log(`Mean win rate across levels: ${avgWin.toFixed(1)}%  (target band 40–65% tool-less)`);
