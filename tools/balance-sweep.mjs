// balance-sweep.mjs — MEASURE-ONLY full-game balance sweep (all 40 levels).
//
// Runs the CORRECTED discrete-model simulator across skill profiles for every
// level, checks variance, flags out-of-band levels and curve spikes/dips, and
// prints a report. DOES NOT MODIFY ANY GAME FILE. Read-only measurement.
//
// Usage: node tools/balance-sweep.mjs [--runs=300]

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LevelManager }     from '../src/game/LevelManager.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';
import { pickCarType, CAR_TYPES } from '../src/director/CarTypes.js';
import { SeededRandom }     from '../src/utils/SeededRandom.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNS = parseInt(process.argv.find(a => a.startsWith('--runs='))?.split('=')[1] ?? '300');
const PHASES = ['CALM', 'BUILD', 'PRESSURE', 'CLIMAX', 'RELIEF'];

// ── 1. Discrete-model verification ────────────────────────────────────────────
function verifyDiscreteModel() {
  const issues = [];
  const simSrc = readFileSync(path.join(__dirname, '..', 'src', 'simulation', 'SimulationRunner.js'), 'utf8');
  // Required discrete markers
  for (const marker of ['correctShotFired', 'car.row++', 'BREACH_ROW']) {
    if (!simSrc.includes(marker)) issues.push(`SimulationRunner missing discrete marker "${marker}"`);
  }
  // Forbidden continuous-model call (active code, not comment)
  const lines = simSrc.split('\n');
  lines.forEach((ln, i) => {
    const code = ln.split('//')[0];
    if (/\.advance\s*\(/.test(code) || /lane\.advance/.test(code)) {
      issues.push(`SimulationRunner.js:${i + 1} still calls continuous .advance(): ${ln.trim()}`);
    }
  });
  // balance-sim.js should just delegate to runBatch (no continuous path)
  const cliSrc = readFileSync(path.join(__dirname, 'balance-sim.js'), 'utf8');
  cliSrc.split('\n').forEach((ln, i) => {
    const code = ln.split('//')[0];
    if (/\.advance\s*\(/.test(code)) issues.push(`balance-sim.js:${i + 1} calls .advance(): ${ln.trim()}`);
  });
  return issues;
}

// ── Car types present per level (sampled from the weight bands) ───────────────
function carTypesForLevel(levelId, gridRows, colors) {
  const rng = new SeededRandom(99);
  const avail = (gridRows ?? 11) - 1;
  const seen = new Set();
  for (const phase of PHASES) {
    for (let i = 0; i < 300; i++) seen.add(pickCarType(rng, levelId, phase, avail));
  }
  // Order by HP so the mix reads light→heavy
  return [...seen].sort((a, b) => (CAR_TYPES[a]?.hp ?? 0) - (CAR_TYPES[b]?.hp ?? 0))
    .map(t => CAR_TYPES[t]?.label ?? t);
}

// ── Run one profile twice (different seeds) for a variance estimate ───────────
function runProfile(cfg, levelId, skill) {
  const mk = () => new SimulationRunner({
    duration: cfg.duration, colors: cfg.colors, worldConfig: cfg.worldConfig,
    levelId, skill, laneCount: cfg.laneCount,
    laneTargetCarCount: cfg.laneTargetCarCount, spawnBudget: cfg.spawnBudget,
    gridRows: cfg.gridRows,
  });
  const a = mk().runBatch(RUNS, 1);
  const b = mk().runBatch(RUNS, 1 + RUNS * 7);   // disjoint seed range
  const wrA = a.winRate * 100, wrB = b.winRate * 100;
  return {
    win: (wrA + wrB) / 2,
    spread: Math.abs(wrA - wrB),
    kills: (a.avgCarsKilled + b.avgCarsKilled) / 2,
  };
}

// ── Target bands (from the sweep request) ─────────────────────────────────────
// Returns array of { profile, lo, hi } for the level.
function bandsFor(levelId) {
  if (levelId <= 5)  return [{ p: 'beginner', lo: 85, hi: 100 }, { p: 'average', lo: 80, hi: 100 }];
  if (levelId <= 15) return [{ p: 'average', lo: 60, hi: 80 }, { p: 'skilled', lo: 70, hi: 85 }];
  if (levelId <= 30) return [{ p: 'average', lo: 45, hi: 65 }, { p: 'skilled', lo: 55, hi: 70 }];
  return [{ p: 'skilled', lo: 35, hi: 55 }];   // expert 30-45 has no sim profile
}
function primaryProfile(levelId) { return levelId <= 30 ? 'average' : 'skilled'; }

// ── Run sweep ─────────────────────────────────────────────────────────────────
const modelIssues = verifyDiscreteModel();

const lm = new LevelManager();
const rows = [];
const errors = [];

for (let levelId = 1; levelId <= 40; levelId++) {
  lm.goToLevel(levelId);
  const cfg = lm.current;
  if (!cfg) { errors.push(`L${levelId}: no config`); continue; }

  const profiles = ['beginner', 'average', 'skilled'];
  if (levelId >= 31) profiles.push('optimal');   // high-skill proxy (no "expert" profile exists)

  const res = {};
  for (const skill of profiles) {
    try { res[skill] = runProfile(cfg, levelId, skill); }
    catch (e) { errors.push(`L${levelId}/${skill}: ${e.message}`); res[skill] = null; }
  }
  rows.push({
    levelId,
    types: carTypesForLevel(levelId, cfg.gridRows, cfg.colors),
    colors: cfg.colors.length,
    speed: cfg.worldConfig?.speed?.base ?? '?',
    budget: cfg.spawnBudget ?? '∞',
    ltcc: cfg.laneTargetCarCount,
    gridRows: cfg.gridRows,
    res,
  });
  process.stderr.write(`  L${levelId} done\n`);
}

// ── Report ────────────────────────────────────────────────────────────────────
const pct = (v) => v == null ? '  -  ' : `${v.toFixed(0)}%`.padStart(5);
console.log('\n================ LANE DEFENSE — FULL BALANCE SWEEP ================');
console.log(`Runs per cell: ${RUNS} ×2 seeds (variance check).  Model: discrete row-based.`);

console.log('\n--- DISCRETE-MODEL VERIFICATION ---');
if (modelIssues.length === 0) console.log('PASS — discrete model in use; no continuous .advance() path found.');
else { console.log('FAIL — issues:'); modelIssues.forEach(i => console.log('  ! ' + i)); }
if (errors.length) { console.log('\nSIM ERRORS:'); errors.forEach(e => console.log('  ! ' + e)); }
else console.log('All level sims completed without error.');

console.log('\n--- TABLE: win rate by profile (gridRows=11) ---');
console.log('Lvl | beg | avg | skl | opt | spd | bgt | ltcc | car types');
console.log('----+-----+-----+-----+-----+-----+-----+------+----------------------------');
for (const r of rows) {
  const b = r.res.beginner, a = r.res.average, s = r.res.skilled, o = r.res.optimal;
  const hv = [b, a, s, o].some(x => x && x.spread > 7) ? ' ⚠HV' : '';
  console.log(
    `${String(r.levelId).padStart(3)} |${pct(b?.win)}|${pct(a?.win)}|${pct(s?.win)}|${pct(o?.win)}|` +
    `${String(r.speed).padStart(4)} |${String(r.budget).padStart(4)} |${String(r.ltcc).padStart(5)} | ${r.types.join(', ')}${hv}`,
  );
}

console.log('\n--- OUT-OF-BAND LEVELS ---');
const oob = [];
for (const r of rows) {
  for (const band of bandsFor(r.levelId)) {
    const cell = r.res[band.p];
    if (!cell) continue;
    if (cell.win < band.lo) oob.push({ r, band, cell, dir: 'TOO HARD', delta: (band.lo - cell.win) });
    else if (cell.win > band.hi) oob.push({ r, band, cell, dir: 'TOO EASY', delta: (cell.win - band.hi) });
  }
}
if (oob.length === 0) console.log('None — all measured profiles within their target bands.');
else for (const o of oob) {
  console.log(`L${o.r.levelId} ${o.band.p}: ${o.cell.win.toFixed(0)}% (band ${o.band.lo}-${o.band.hi}%) → ${o.dir} by ${o.delta.toFixed(0)}pts` +
    (o.cell.spread > 7 ? `  [high variance ±${o.cell.spread.toFixed(0)}]` : ''));
}

console.log('\n--- DIFFICULTY-CURVE CHECK (primary profile vs neighbors) ---');
for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  const prof = primaryProfile(r.levelId);
  const cur = r.res[prof]?.win;
  if (cur == null) continue;
  const neigh = [rows[i - 1], rows[i + 1]].filter(n => n && primaryProfile(n.levelId) === prof && n.res[prof]);
  if (neigh.length === 0) continue;
  const avgNeigh = neigh.reduce((s, n) => s + n.res[prof].win, 0) / neigh.length;
  const diff = cur - avgNeigh;
  if (Math.abs(diff) >= 18) {
    console.log(`L${r.levelId} (${prof} ${cur.toFixed(0)}%) ${diff > 0 ? 'SPIKE-EASY' : 'SPIKE-HARD'} vs neighbors avg ${avgNeigh.toFixed(0)}% (Δ${diff.toFixed(0)})`);
  }
}
console.log('\n================ END SWEEP ================');
