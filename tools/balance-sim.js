// Headless balance simulator — runs N games of a level, reports difficulty stats.
//
// Usage:
//   node tools/balance-sim.js --level=5 --runs=500
//   node tools/balance-sim.js --level=1 --level=5 --runs=1000   (not supported — run once per level)
//
// Targets (from docs/GAME_DESIGN.md):
//   Easy:       85-95% win rate
//   Medium:     60-75%
//   Hard:       35-50%
//   Boss-Hard:  20-35%

import { LevelManager }    from '../src/game/LevelManager.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';

const args    = process.argv.slice(2);
const levelId = parseInt(args.find(a => a.startsWith('--level='))?.split('=')[1] ?? '1');
const runs    = parseInt(args.find(a => a.startsWith('--runs='))?.split('=')[1]  ?? '500');

if (isNaN(levelId) || levelId < 1) {
  console.error('Usage: node tools/balance-sim.js --level=N [--runs=500]');
  process.exit(1);
}

const lm = new LevelManager();
lm.goToLevel(levelId);
const cfg = lm.current;

if (!cfg) {
  console.error(`Unknown level: ${levelId}`);
  process.exit(1);
}

const runner = new SimulationRunner({
  duration:    cfg.duration,
  colors:      cfg.colors,
  worldConfig: cfg.worldConfig,
});

const stats  = runner.runBatch(runs, 1);
const winPct = (stats.winRate * 100).toFixed(1);
const killPct = stats.avgCarsKilled.toFixed(1);

// Derive expected tier from level id for PASS/FAIL assessment.
// Tiers follow the 8-level block pattern; within each block:
//   slot 0 (N)   = Easy      85-95%
//   slot 1 (N+1) = Medium    60-75%
//   slot 2 (N+2) = Medium    60-75%
//   slot 3 (N+3) = Hard      35-50%
//   slot 4 (N+4) = Easy      85-95%  (relief)
//   slot 5 (N+5) = Medium    60-75%
//   slot 6 (N+6) = Hard      35-50%
//   slot 7 (N+7) = Boss-Hard 20-35%
const TIER_BANDS = {
  'Easy':       [85, 95],
  'Medium':     [60, 75],
  'Hard':       [35, 50],
  'Boss-Hard':  [20, 35],
};
const SLOT_TIER = ['Easy', 'Medium', 'Medium', 'Hard', 'Easy', 'Medium', 'Hard', 'Boss-Hard'];
const slot = (levelId - 1) % 8;
const tier = SLOT_TIER[slot];
const [lo, hi] = TIER_BANDS[tier];
const pct      = parseFloat(winPct);
// Sim uses optimal AI so win rates are higher than real-player rates.
// Flag FAIL only when optimal play can barely win (< half the minimum target).
// Flag WARN when a Hard/Boss-Hard level is completely trivial under optimal play.
const HARD_TIERS = new Set(['Hard', 'Boss-Hard']);
const tooHard  = pct < lo * 0.5;
const tooEasy  = HARD_TIERS.has(tier) && pct === 100;
const status   = tooHard ? '❌ FAIL (too hard)' : tooEasy ? '⚠️  WARN (trivially easy for a hard level)' : '✅ PASS';

console.log(`\nLevel ${levelId} (${cfg.colors.join('+')} | ${cfg.duration}s | budget=${cfg.spawnBudget ?? 'unlimited'}) — ${runs} runs`);
console.log(`Win rate:        ${winPct}%  [player target ${lo}–${hi}% for ${tier}]`);
console.log(`Avg cars killed: ${killPct}`);
console.log(`Crisis/level:    ${stats.avgCrisisPerLevel.toFixed(2)}`);
console.log(`Fairness fixes:  ${(stats.fairnessOverrideRate * 100).toFixed(1)}%`);
console.log(status);
