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
// Reference profile for the target bands: skill=average (booster-aware, boosterIQ 0.70).
// Bands (2026-07-10, post merge-fix baseline):
//   Tutorial L1-3: win% exempt (~100% correct) · FTUE L4-9: 85-95% ·
//   mid non-boss L10-26: 70-82% · late non-boss L27-40: 60-75%
//   Bosses L10/20/30/40: 40-55% at this profile — reported but deferred to §3c
//   (scripted waves), so out-of-band bosses flag "BOSS §3c", never TOO EASY/HARD.
// Turns: >70 too long (genuine grind; goal-driven levels legitimately run 35-55) · <5 too short.

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

const BOSS_LEVELS = new Set([10, 20, 30, 40]);
// L1-L3 are tutorial: ~100% is correct (L3 has no losing mechanism at brisk HP —
// 3 lanes/2 colors; the tutorial→game transition marker is L4). Win% never flags.
const TUTORIAL_LEVELS = new Set([1, 2, 3]);

// Target bands at the reference profile (skill=average, boosterIQ 0.70).
function bandFor(levelId) {
  if (TUTORIAL_LEVELS.has(levelId)) return { lo: 85, hi: 100, tutorial: true };
  if (BOSS_LEVELS.has(levelId)) return { lo: 40, hi: 55, boss: true };
  if (levelId <= 9)  return { lo: 85, hi: 95, boss: false };
  if (levelId <= 26) return { lo: 70, hi: 82, boss: false };
  return { lo: 60, hi: 75, boss: false };
}

function flagFor(levelId, winPct, avgTurns) {
  const band = bandFor(levelId);
  const f = [];
  if (winPct < band.lo || winPct > band.hi) {
    // Bosses are deferred to §3c scripted waves — report drift, don't call them broken.
    if (band.boss) f.push('BOSS §3c');
    else f.push(winPct < band.lo ? 'TOO HARD' : 'TOO EASY');
  }
  if (avgTurns != null && avgTurns > 70) f.push('TOO LONG');
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
    initialCars: cfg.initialCars ?? null, spawnScript: cfg.spawnScript ?? null,   // §3c bosses
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
console.log(`\nBalance sim — ${levelIds.length} level(s) × ${runs} runs  [skill: ${skill}]  (win = all goals met, no breach)`);
console.log(`Bands @ average+boosterIQ0.70 — tutorial L1-3: exempt · FTUE L4-9: 85-95 · mid L10-26: 70-82 · late L27-40: 60-75 · bosses: 40-55 (§3c)\n`);
console.log('Lvl │ Goals                              │ Win%  │ Band  │ AvgTurns │ Kills/Shot │ Flag');
console.log('────┼────────────────────────────────────┼───────┼───────┼──────────┼────────────┼──────────────────');

const results = [];
for (const id of levelIds) {
  const r = runOne(id);
  results.push(r);
  const goalsStr = goalSummary(r.cfg.goals).padEnd(34).slice(0, 34);
  const turnsStr = r.avgTurns != null ? r.avgTurns.toFixed(1).padStart(8) : '     —  ';
  const band = bandFor(id);
  const bandStr = `${band.lo}-${band.hi}`.padStart(5);
  const flag = flagFor(id, r.winPct, r.avgTurns);
  console.log(
    `${String(id).padStart(3)} │ ${goalsStr} │ ${r.winPct.toFixed(1).padStart(5)} │ ${bandStr} │ ${turnsStr} │ ${r.killsPerShot.toFixed(2).padStart(10)} │ ${flag}`
  );
}

// ── Summary of flagged levels ────────────────────────────────────────────────────
const flagged = results.filter(r => flagFor(r.levelId, r.winPct, r.avgTurns) !== 'OK');
console.log(`\n${flagged.length} / ${results.length} levels flagged.`);
if (flagged.length) {
  console.log('Flagged:', flagged.map(r => `L${r.levelId}(${flagFor(r.levelId, r.winPct, r.avgTurns)})`).join('  '));
}
const avgWin = results.reduce((s, r) => s + r.winPct, 0) / results.length;
console.log(`Mean win rate across levels: ${avgWin.toFixed(1)}%  [reference profile: average, booster-aware]`);
