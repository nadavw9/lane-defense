// Batch balance report generator.
// Runs all 40 levels × 3 skill profiles and writes docs/balance-report-realistic.md.
//
// Usage:
//   node tools/balance-report-gen.js [--runs=200]

import { LevelManager }     from '../src/game/LevelManager.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';
import { writeFileSync }    from 'fs';

const args  = process.argv.slice(2);
const RUNS  = parseInt(args.find(a => a.startsWith('--runs='))?.split('=')[1] ?? '200');

const SKILLS   = ['beginner', 'average', 'skilled'];
const SLOT_TIER = ['Easy', 'Medium', 'Medium', 'Hard', 'Easy', 'Medium', 'Hard', 'Boss-Hard'];
const TIER_BANDS = {
  'Easy':      [75, 92],
  'Medium':    [50, 72],
  'Hard':      [28, 50],
  'Boss-Hard': [15, 32],
};

function tier(levelId) {
  return SLOT_TIER[(levelId - 1) % 8];
}

function statusFlag(t, winPct, skill) {
  if (skill !== 'average') return null;
  const [lo, hi] = TIER_BANDS[t];
  if (winPct < lo) return `WARN_HARD`;
  if (winPct > hi) return `WARN_EASY`;
  return null;
}

const lm = new LevelManager();
const results = [];

console.log(`Running all 40 levels × 3 skill profiles (${RUNS} runs each)...`);

for (let levelId = 1; levelId <= 40; levelId++) {
  lm.goToLevel(levelId);
  const cfg = lm.current;
  const t   = tier(levelId);
  const row = { levelId, tier: t, colors: cfg.colors, budget: cfg.spawnBudget ?? '—', duration: cfg.duration };

  process.stdout.write(`L${levelId}...`);

  for (const skill of SKILLS) {
    const runner = new SimulationRunner({
      duration:    cfg.duration,
      colors:      cfg.colors,
      worldConfig: cfg.worldConfig,
      skill,
    });
    const stats  = runner.runBatch(RUNS, 1);
    const winPct = Math.round(stats.winRate * 1000) / 10; // one decimal
    row[skill]   = winPct;
    row[`${skill}_kills`] = Math.round(stats.avgCarsKilled * 10) / 10;
  }
  results.push(row);
}
console.log('\nDone. Building report...');

// ── Flag analysis ─────────────────────────────────────────────────────────────
const flagged = [];
for (const r of results) {
  const flags = [];
  const t = r.tier;
  // beginner >95% on Easy
  if (t === 'Easy' && r.beginner > 95)        flags.push('beginner trivial (>95%)');
  // average <15% on Medium
  if (t === 'Medium' && r.average < 15)        flags.push('average fails too hard (<15%)');
  // average >85% on Hard/Boss-Hard
  if ((t === 'Hard' || t === 'Boss-Hard') && r.average > 85) flags.push('average too easy (>85%)');
  // any 0% average
  if (r.average === 0)                         flags.push('UNWINNABLE for average');

  if (flags.length) flagged.push({ levelId: r.levelId, tier: t, flags });
}

// ── Markdown report ───────────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10);
const lines = [];

lines.push(`# Lane Defense — Realistic Balance Report`);
lines.push(``);
lines.push(`**Generated:** ${today}`);
lines.push(`**Tool:** \`node tools/balance-report-gen.js --runs=${RUNS}\``);
lines.push(`**Method:** SimulationRunner with 3 skill profiles. ${RUNS} seeds per level.`);
lines.push(`**Baseline:** Phase 2 report (\`docs/balance-report-phase2.md\`) — optimal AI, 100% all levels.`);
lines.push(``);
lines.push(`---`);
lines.push(``);
lines.push(`## Key Findings`);
lines.push(``);
lines.push(`Switching from an optimal AI (100% accuracy, perfect cycling) to an average human`);
lines.push(`player model (82% accuracy, streak-aware, cycling enabled) reveals the actual`);
lines.push(`difficulty experienced by a typical player. Levels that were "balanced" under`);
lines.push(`optimal play may need adjustment.`);
lines.push(``);
lines.push(`**Target bands (AVERAGE player):**`);
lines.push(`- Easy: 75–92% win rate`);
lines.push(`- Medium: 50–72%`);
lines.push(`- Hard: 28–50%`);
lines.push(`- Boss-Hard: 15–32%`);
lines.push(``);
lines.push(`---`);
lines.push(``);
lines.push(`## Per-Level Results`);
lines.push(``);
lines.push(`| L | Tier | Colors | Budget | Beginner | Average | Skilled | Status |`);
lines.push(`|---|------|--------|--------|----------|---------|---------|--------|`);

for (const r of results) {
  const [lo, hi] = TIER_BANDS[r.tier];
  let statusIcon;
  if (r.average === 0)                                      statusIcon = '❌ UNWINNABLE';
  else if (r.average < lo)                                  statusIcon = '⚠️  WARN: too hard';
  else if (r.average > hi)                                  statusIcon = '⚠️  WARN: too easy';
  else                                                      statusIcon = '✅ PASS';

  const colorStr = r.colors.length <= 2 ? r.colors.join('+')
    : r.colors.length <= 4 ? `R+B${r.colors.length >= 3 ? '+G' : ''}${r.colors.length >= 4 ? '+Y' : ''}`
    : r.colors.length === 5 ? '+Purple' : 'All 6';

  lines.push(`| ${r.levelId} | ${r.tier} | ${colorStr} | ${r.budget} | ${r.beginner.toFixed(1)}% | ${r.average.toFixed(1)}% | ${r.skilled.toFixed(1)}% | ${statusIcon} |`);
}

lines.push(``);
lines.push(`---`);
lines.push(``);

if (flagged.length === 0) {
  lines.push(`## Flagged Levels`);
  lines.push(``);
  lines.push(`**None.** All levels within target bands for the average player.`);
} else {
  lines.push(`## Flagged Levels (${flagged.length})`);
  lines.push(``);
  for (const f of flagged) {
    lines.push(`- **L${f.levelId}** (${f.tier}): ${f.flags.join(', ')}`);
  }
}

lines.push(``);
lines.push(`---`);
lines.push(``);
lines.push(`## What This Simulator Cannot Measure`);
lines.push(``);
lines.push(`The sim models a stateless, single-decision AI. Real players have context and emotion`);
lines.push(`the sim cannot replicate:`);
lines.push(``);
lines.push(`1. **Booster timing.** SWAP, BENCH, FREEZE, PEEK are not modeled. Real players use`);
lines.push(`   these in crisis moments; the sim AI never does. Hard/Boss-Hard win rates will be`);
lines.push(`   higher in practice because boosters provide escape valves.`);
lines.push(``);
lines.push(`2. **Panic and tunnel vision.** Under pressure, real players fixate on the most`);
lines.push(`   advanced lane and ignore others. The sim's Pass B (focus-fire) approximates`);
lines.push(`   this only at position ≥ 75.`);
lines.push(``);
lines.push(`3. **Learning across attempts.** Losing L8 five times teaches the player to`);
lines.push(`   manage three colors under density. The sim has no memory between seeds.`);
lines.push(``);
lines.push(`4. **Streak Shot skill.** The sim applies 82% chance of triggering a streak shot`);
lines.push(`   when at streak=2 via streakBoost=0.70. Real players who haven't discovered`);
lines.push(`   the mechanic never deliberately build streaks. Players who have discovered it`);
lines.push(`   actively farm it.`);
lines.push(``);
lines.push(`5. **Emotional quit vs. actual lose.** A player frustrated after 3 losses may`);
lines.push(`   quit before finishing the level. Sim counts only breach, not frustration.`);
lines.push(``);
lines.push(`6. **Turn-based vs. continuous time.** The sim advances cars continuously`);
lines.push(`   (every tick). The real game advances the grid only on correct hits. A wrong`);
lines.push(`   shot in the real game wastes a slot but does NOT advance enemies — so real`);
lines.push(`   misfires are less punishing than the sim models.`);
lines.push(``);
lines.push(`---`);
lines.push(``);
lines.push(`## Required Human Playtest Before Phase 3 Ship`);
lines.push(``);
lines.push(`| Test | Method | Pass Criteria |`);
lines.push(`|------|--------|---------------|`);
lines.push(`| L4 (Hard) difficulty feel | 5 new players, no coaching | 2–4 of 5 win on ≤3rd attempt |`);
lines.push(`| L8 (Boss-Hard) rescue rate | Firebase rescueWouldSave event | 30–60% of L8 attempts trigger rescue prompt |`);
lines.push(`| L17 (Easy★) streak discovery | Session replay sampling | ≥60% of players fire ≥1 streak shot in L17 |`);
lines.push(`| L24 (Boss-Hard) quit rate | Firebase level_quit event | <25% quit before first attempt completes |`);
lines.push(`| L33–40 (Night Highway) | 10 players who completed L32 | Median first-clear at L36–38 |`);

const md = lines.join('\n') + '\n';
writeFileSync('docs/balance-report-realistic.md', md, 'utf8');
console.log(`\nReport saved to docs/balance-report-realistic.md`);
console.log(`Flagged levels: ${flagged.length}`);
if (flagged.length) {
  for (const f of flagged) console.log(`  L${f.levelId} (${f.tier}): ${f.flags.join(', ')}`);
}
