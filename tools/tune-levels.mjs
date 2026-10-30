// Level auto-tuner — puts every level at the centre of its win-rate band (tools/bands.mjs,
// skill=human, lane barriers) by moving, in this order (2026-10-30, owner: "levels are too short
// and too easy"):
//   too EASY at the authored goals: heavier traffic (heft up to 1), then LONGER goals (up to GS_HI);
//   too HARD at the authored goals: lighter traffic (heft down to HEFT_LO), then a thinner trait
//   mix, then SHORTER goals (down to GS_LO, never below).
// Car HP per TYPE is fixed on every level — only the mix, the traits and the goal count move.
//
//   node tools/tune-levels.mjs 4-40 [runs=200] [--write]   → JSON { id: { heft, ts, gs, win } }
//
// --write stores the result in src/game/lateTuning.js (LevelManager applies L1-40 on load,
// levelDsl.lv() applies L41+). The authored goals stay on cfg.baseGoals, so the tuner always
// starts from the design, never from its own output.
import { LevelManager, LEVEL_COUNT } from '../src/game/LevelManager.js';
import { scaleGoal } from '../src/game/levelDsl.js';
import { bandFor } from './bands.mjs';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';

const [range = `4-${LEVEL_COUNT}`, runsArg = '200'] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const [lo, hi = lo] = range.split('-').map(Number);
const RUNS = Number(runsArg);
const band = (id) => { const b = bandFor(id); return [b.lo, b.hi]; };

// A level's authored trait mix, before any tuning scale was applied (late levels
// carry it as baseTraits; the hand-tuned L1-40 just use traits).
const baseTraitsOf = (cfg) => cfg.baseTraits ?? cfg.traits ?? null;
const scaleTraits = (t, k) => t && Object.fromEntries(Object.entries(t).map(([n, p]) => [n, +(p * k).toFixed(4)]));
const goalsAt = (cfg, k) => (cfg.baseGoals ?? cfg.goals).map(g => scaleGoal(g, k));

function winRate(cfg, heft, traitScale = 1, goalScale = 1) {
  const traits = scaleTraits(baseTraitsOf(cfg), traitScale);
  const c = { ...cfg, worldConfig: { ...cfg.worldConfig, heft }, ...(traits ? { traits } : {}),
    goals: goalsAt(cfg, goalScale) };
  const r = SimulationRunner.fromLevel(c, { skill: 'human' });   // the tuning reference (bands.mjs)
  let w = 0;
  for (let s = 1; s <= RUNS; s++) if (r.runLevel(s).won) w++;
  return (w / RUNS) * 100;
}

const HEFT_LO = 0.15, HEFT_HI = 1;           // some weight always stays in the mix
const GS_LO = 0.5, GS_HI = 1.6;              // goal scale: half the authored count up to 60% longer
const TRAIT_SCALES = [0.85, 0.7, 0.55, 0.4];
// f falls as x rises; find x in [lo0, hi0] with f(x) ~ target.
const bisect = (lo0, hi0, f, target) => {
  let a = lo0, b = hi0;
  for (let i = 0; i < 8; i++) { const m = (a + b) / 2; if (f(m) > target) a = m; else b = m; }
  return (a + b) / 2;
};
// Win rate FALLS as heft rises and as the goal scale rises, so one bisect serves every lever.
const r2 = (x) => Math.round(x * 100) / 100;

const out = {};
for (let id = lo; id <= hi; id++) {
  const lm = new LevelManager(); lm.goToLevel(id); const cfg = lm.current;
  const [bLo, bHi] = band(id); const target = (bLo + bHi) / 2;
  const heft0 = cfg.tuneHeft ?? cfg.worldConfig.heft ?? 0.3;
  let heft = heft0, gs = 1, ts = 1;
  const win = () => winRate(cfg, heft, ts, gs);
  if (win() >= target) {
    // Too easy: heavier first, then longer.
    heft = r2(bisect(heft0, HEFT_HI, (m) => winRate(cfg, m, ts, gs), target));
    if (heft >= HEFT_HI - 0.01 && win() >= target) {
      gs = r2(bisect(1, GS_HI, (m) => winRate(cfg, heft, ts, m), target));
    }
  } else {
    // Too hard: lighter first, then a thinner trait mix, then shorter.
    heft = r2(bisect(HEFT_LO, heft0, (m) => winRate(cfg, m, ts, gs), target));
    if (heft <= HEFT_LO + 0.01 && win() < target && baseTraitsOf(cfg)) {
      for (const t of TRAIT_SCALES) { ts = t; if (win() >= target) break; }
    }
    if (win() < target) {
      gs = r2(bisect(GS_LO, 1, (m) => winRate(cfg, heft, ts, m), target));
      // Goal counts are integers, so win(gs) is a staircase: polish to the nearest step.
      let bestE = Infinity, bestG = gs;
      for (let d = -0.06; d <= 0.0601; d += 0.02) {
        const g2 = r2(Math.min(1, Math.max(GS_LO, gs + d))); const e = Math.abs(winRate(cfg, heft, ts, g2) - target);
        if (e < bestE) { bestE = e; bestG = g2; }
      }
      gs = bestG;
    }
  }
  const w = win();
  out[id] = { heft, ts, gs, win: +w.toFixed(1), band: `${bLo}-${bHi}` };
  const flag = (w < bLo - 3 || w > bHi + 3 || gs <= GS_LO + 0.02) ? '  <-- CHECK' : '';
  console.error(`L${id}: heft ${heft} traits x${ts} goals x${gs} -> ${w.toFixed(1)}% (${bLo}-${bHi})${flag}`);
}
console.log(JSON.stringify(out));
if (process.argv.includes('--write')) {
  const { LATE_TUNING } = await import('../src/game/lateTuning.js');
  const merged = { ...LATE_TUNING };
  for (const [id, r] of Object.entries(out)) merged[id] = { heft: r.heft, ts: r.ts, gs: r.gs };
  const body = Object.entries(merged).sort((a, b) => a[0] - b[0]).map(([id, r]) => `  ${id}: { heft: ${r.heft}, ts: ${r.ts}, gs: ${r.gs} },`).join('\n');
  const { writeFileSync } = await import('node:fs');
  writeFileSync(new URL('../src/game/lateTuning.js', import.meta.url),
    `// GENERATED by \`node tools/tune-levels.mjs 1-200 --write\`. Do not hand-edit.\n// heft = spawn-mix weight, ts = trait-mix scale, gs = goal scale (1 = authored).\nexport const LATE_TUNING = {\n${body}\n};\n`);
  console.error('wrote src/game/lateTuning.js');
}
