// Headless balance simulator — runs N games of a level, reports difficulty stats.
//
// Usage:
//   node tools/balance-sim.js --level=5 --runs=500 --skill=average
//   node tools/balance-sim.js --level=17 --runs=200 --skill=beginner
//
// Skills: optimal | beginner | average (default) | skilled
//
// Targets vs AVERAGE player (from Phase 3 rebalance):
//   Easy:       75-92% win rate
//   Medium:     50-72%
//   Hard:       28-50%
//   Boss-Hard:  15-32%

import { LevelManager }    from '../src/game/LevelManager.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';

const args    = process.argv.slice(2);
const levelId = parseInt(args.find(a => a.startsWith('--level='))?.split('=')[1] ?? '1');
const runs    = parseInt(args.find(a => a.startsWith('--runs='))?.split('=')[1]  ?? '500');
const skill   = args.find(a => a.startsWith('--skill='))?.split('=')[1] ?? 'average';

const VALID_SKILLS = new Set(['optimal', 'beginner', 'average', 'skilled']);
if (isNaN(levelId) || levelId < 1) {
  console.error('Usage: node tools/balance-sim.js --level=N [--runs=500] [--skill=average]');
  process.exit(1);
}
if (!VALID_SKILLS.has(skill)) {
  console.error(`Unknown skill: ${skill}. Valid: optimal | beginner | average | skilled`);
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
  skill,
});

const stats  = runner.runBatch(runs, 1);
const winPct = (stats.winRate * 100).toFixed(1);
const killPct = stats.avgCarsKilled.toFixed(1);

// Derive expected tier from level id for PASS/FAIL assessment.
// Tiers follow the 8-level block pattern; within each block:
//   slot 0 (N)   = Easy      slot 4 (N+4) = Easy (relief)
//   slot 1 (N+1) = Medium    slot 5 (N+5) = Medium
//   slot 2 (N+2) = Medium    slot 6 (N+6) = Hard
//   slot 3 (N+3) = Hard      slot 7 (N+7) = Boss-Hard
//
// Bands are calibrated for the AVERAGE skill profile.  Other skills have no
// target bands — just report raw numbers.
const TIER_BANDS_AVERAGE = {
  'Easy':       [75, 92],
  'Medium':     [50, 72],
  'Hard':       [28, 50],
  'Boss-Hard':  [15, 32],
};
const TIER_BANDS_OPTIMAL = {
  'Easy':       [85, 95],
  'Medium':     [60, 75],
  'Hard':       [35, 50],
  'Boss-Hard':  [20, 35],
};
const SLOT_TIER = ['Easy', 'Medium', 'Medium', 'Hard', 'Easy', 'Medium', 'Hard', 'Boss-Hard'];
const slot      = (levelId - 1) % 8;
const tier      = SLOT_TIER[slot];
const pct       = parseFloat(winPct);

let status;
if (skill === 'average' || skill === 'optimal') {
  const bands    = skill === 'average' ? TIER_BANDS_AVERAGE : TIER_BANDS_OPTIMAL;
  const [lo, hi] = bands[tier];
  if (pct < lo) {
    status = `❌ FAIL (too hard for ${skill} — ${pct}% < ${lo}%)`;
  } else if (pct > hi) {
    status = `⚠️  WARN (too easy for ${skill} — ${pct}% > ${hi}%)`;
  } else {
    status = '✅ PASS';
  }
} else {
  status = '— (no target band for this skill profile)';
}
const bandInfo = (skill === 'average' || skill === 'optimal')
  ? (() => { const bands = skill === 'average' ? TIER_BANDS_AVERAGE : TIER_BANDS_OPTIMAL; const [lo, hi] = bands[tier]; return `${lo}–${hi}%`; })()
  : 'n/a';

console.log(`\nLevel ${levelId} (${cfg.colors.join('+')} | ${cfg.duration}s | budget=${cfg.spawnBudget ?? 'unlimited'}) — ${runs} runs  [skill: ${skill}]`);
console.log(`Win rate:        ${winPct}%  [target ${bandInfo} for ${tier}]`);
console.log(`Avg cars killed: ${killPct}`);
console.log(`Crisis/level:    ${stats.avgCrisisPerLevel.toFixed(2)}`);
console.log(`Fairness fixes:  ${(stats.fairnessOverrideRate * 100).toFixed(1)}%`);
console.log(status);
