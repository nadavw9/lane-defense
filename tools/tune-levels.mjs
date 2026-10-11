// Level auto-tuner — finds the `heft` (spawn-mix weight, 0 = lightest car types,
// 1 = heaviest; see CarTypes.heftWeights) that puts each level at the centre of
// its win-rate band (tools/balance-sim.js bands, skill=average), and when even
// the lightest mix is too hard, the goal scale that fixes it. Car HP per TYPE is
// fixed on every level — only the mix moves.
//
//   node tools/tune-levels.mjs 4-40 [runs=200]   → JSON { id: { hp, goalScale, win } }
//
// It only RECOMMENDS; LevelManager.js stays the hand-edited source of truth.
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

// Boss goals and 'kill N of trait X' goals are the level's identity — never scaled.
const scalable = () => true;

function winRate(cfg, heft, traitScale = 1, goalScale = 1) {
  const traits = scaleTraits(baseTraitsOf(cfg), traitScale);
  const c = { ...cfg, worldConfig: { ...cfg.worldConfig, heft }, ...(traits ? { traits } : {}),
    goals: goalsAt(cfg, goalScale) };
  const r = SimulationRunner.fromLevel(c, { skill: 'average' });
  let w = 0;
  for (let s = 1; s <= RUNS; s++) if (r.runLevel(s).won) w++;
  return (w / RUNS) * 100;
}

const HEFT_HI = 1;
// One-hit ladder model: the GOAL COUNT is the main lever (a car takes 1-3 hits, so
// the old goals are ~2x too long). Per level: keep the authored heft, bisect the goal
// scale to the band centre; a level whose goals are unscalable (trait-only) bisects
// heft instead. Floor of 6 cars so a level never collapses into a handful of kills.
const GS_LO = 0.4, GS_HI = 1;
const goalsAt = (cfg, k) => (cfg.baseGoals ?? cfg.goals).map(g => scaleGoal(g, k));
const bisect = (lo0, hi0, f, target) => {            // f falls as x rises; find x with f(x) ~ target
  let a = lo0, b = hi0;
  for (let i = 0; i < 8; i++) { const m = (a + b) / 2; if (f(m) > target) a = m; else b = m; }
  return (a + b) / 2;
};
const r2 = (x) => Math.round(x * 100) / 100;

const out = {};
for (let id = lo; id <= hi; id++) {
  const lm = new LevelManager(); lm.goToLevel(id); const cfg = lm.current;
  const [bLo, bHi] = band(id); const target = (bLo + bHi) / 2;
  const scalableLevel = (cfg.baseGoals ?? cfg.goals).some(scalable);
  const heft0 = cfg.tuneHeft ?? cfg.worldConfig.heft ?? 0.3;
  let heft = heft0, gs = scalableLevel ? GS_HI : 1, ts = 1;
  // Order of freedom: raise heft when too easy at full goals; else shrink goals (floor GS_LO);
  // else ease heft; last, thin out the trait mix. Authored goals stay the design.
  if (winRate(cfg, heft, ts, gs) >= target) {
    heft = r2(bisect(heft0, 1, (m) => winRate(cfg, m, ts, gs), target));
  } else if (scalableLevel) {
    gs = r2(bisect(GS_LO, GS_HI, (m) => winRate(cfg, heft, ts, m), target));
    // Goal counts are integers, so win(gs) is a staircase: polish to the nearest step.
    let bestE = Infinity, bestG = gs;
    for (let d = -0.08; d <= 0.0801; d += 0.02) {
      const g2 = r2(Math.min(GS_HI, Math.max(GS_LO, gs + d))); const e = Math.abs(winRate(cfg, heft, ts, g2) - target);
      if (e < bestE) { bestE = e; bestG = g2; }
    }
    gs = bestG;
    const traitGoal = (cfg.baseGoals ?? cfg.goals).some(g => g.type === 'destroyTrait');
    if ((gs <= GS_LO + 0.01 || winRate(cfg, heft, ts, gs) < bLo) && winRate(cfg, heft, ts, gs) < target) {
      gs = Math.min(gs, GS_LO + 0.0001) > GS_LO ? gs : GS_LO;
      if (winRate(cfg, heft, ts, gs) < bLo) gs = GS_LO;
      if (traitGoal) {
        // A trait goal starves on supply, not on car weight: pick the trait mix that serves best.
        let best = [1, winRate(cfg, heft, 1, gs)];
        for (const t of [1.5, 2, 3, 4]) { const w = winRate(cfg, heft, t, gs); if (w > best[1]) best = [t, w]; if (w >= target) break; }
        ts = best[0];
      }
      if (winRate(cfg, heft, ts, gs) < target) {
        heft = r2(heft0 - bisect(0, heft0, (m) => 100 - winRate(cfg, heft0 - m, ts, gs), 100 - target));
      }
      if (winRate(cfg, heft, ts, gs) < target && !traitGoal && (cfg.baseTraits ?? cfg.traits)) {
        for (const t of [0.85, 0.7, 0.55, 0.4]) { ts = t; if (winRate(cfg, heft, ts, gs) >= target) break; }
      }
    }
  } else {
    heft = r2(bisect(0, heft0, (m) => 100 - winRate(cfg, heft0 - m, ts, gs), 100 - target));
    heft = r2(heft0 - heft);
  }
  const win = winRate(cfg, heft, ts, gs);
  out[id] = { heft, ts, gs, win: +win.toFixed(1), band: `${bLo}-${bHi}` };
  const flag = (win < bLo - 3 || win > bHi + 3 || gs <= GS_LO + 0.02) ? '  <-- CHECK' : '';
  console.error(`L${id}: heft ${heft} traits x${ts} goals x${gs} -> ${win.toFixed(1)}% (${bLo}-${bHi})${flag}`);
}
console.log(JSON.stringify(out));
if (process.argv.includes('--write')) {
  const { LATE_TUNING } = await import('../src/game/lateTuning.js');
  const merged = { ...LATE_TUNING };
  for (const [id, r] of Object.entries(out)) merged[id] = { heft: r.heft, ts: r.ts, gs: r.gs };
  const body = Object.entries(merged).sort((a, b) => a[0] - b[0]).map(([id, r]) => `  ${id}: { heft: ${r.heft}, ts: ${r.ts}, gs: ${r.gs} },`).join('\n');
  const { writeFileSync } = await import('node:fs');
  writeFileSync(new URL('../src/game/lateTuning.js', import.meta.url),
    `// GENERATED by \`node tools/tune-levels.mjs 41-100 --write\`. Do not hand-edit.\n// heft = spawn-mix weight, ts = trait-mix scale, gs = goal scale (1 = authored).\nexport const LATE_TUNING = {\n${body}\n};\n`);
  console.error('wrote src/game/lateTuning.js');
}
