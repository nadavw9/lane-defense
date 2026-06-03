// Color-bomb streak proposal sim.
//
// Evaluates candidate streak lengths for the proposed "earn a color bomb by
// landing N consecutive correct-colour shots" mechanic. For each level and each
// N in {3,4,5,6}, reports the average number of color bombs a player would earn
// per level (a color bomb is earned every N consecutive correct shots; the
// streak resets on a wrong-colour shot or when a bomb is earned).
//
// Usage: node tools/colorbomb-streak-sim.js [--runs=2000]
//
// NOTE: tuning-only tool. Uses the SimulationRunner onShot hook (default-off).
import { LevelManager }     from '../src/game/LevelManager.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';

const args = process.argv.slice(2);
const RUNS = parseInt(args.find(a => a.startsWith('--runs='))?.split('=')[1] ?? '2000');

const LEVELS = [9, 16, 25];          // early / mid / late game
const CANDIDATES = [3, 4, 5, 6];     // streak lengths to evaluate
const SKILLS = ['skilled', 'average', 'optimal'];  // 'skilled' = "competent"

const lm = new LevelManager();

function evaluate(levelId, skill) {
  lm.goToLevel(levelId);
  const cfg = lm.current;

  // Per-run streak state, reset before each runLevel via resetRun().
  const streak = {};   // N -> current consecutive-correct count
  let   earns  = {};   // N -> color bombs earned this run
  const resetRun = () => { for (const n of CANDIDATES) { streak[n] = 0; earns[n] = 0; } };
  resetRun();

  const onShot = (isCorrect) => {
    for (const n of CANDIDATES) {
      if (isCorrect) {
        streak[n]++;
        if (streak[n] >= n) { earns[n]++; streak[n] = 0; }  // earn + reset
      } else {
        streak[n] = 0;  // wrong-colour shot breaks the streak
      }
    }
  };

  const runner = new SimulationRunner({
    duration: cfg.duration, colors: cfg.colors, worldConfig: cfg.worldConfig,
    levelId, skill, laneCount: cfg.laneCount, laneTargetCarCount: cfg.laneTargetCarCount,
    spawnBudget: cfg.spawnBudget, gridRows: cfg.gridRows, onShot,
  });

  const totals = {}; for (const n of CANDIDATES) totals[n] = 0;
  let totalCorrect = 0, totalShots = 0, wins = 0;

  for (let i = 0; i < RUNS; i++) {
    resetRun();
    // count shots via a wrapping observer
    let correct = 0, shots = 0;
    runner._cfg.onShot = (isCorrect) => { shots++; if (isCorrect) correct++; onShot(isCorrect); };
    const r = runner.runLevel(1000 + i);
    for (const n of CANDIDATES) totals[n] += earns[n];
    totalCorrect += correct; totalShots += shots; if (r.won) wins++;
  }

  return {
    levelId, skill,
    colors: cfg.colors.length,
    spawnBudget: cfg.spawnBudget,
    winRate: (wins / RUNS * 100),
    avgShots: totalShots / RUNS,
    avgCorrect: totalCorrect / RUNS,
    perN: Object.fromEntries(CANDIDATES.map(n => [n, totals[n] / RUNS])),
  };
}

console.log(`\nColor-bomb streak proposal — ${RUNS} runs/level/skill`);
console.log(`Bombs earned per level = avg count of N-consecutive-correct streaks (reset on wrong shot / on earn)\n`);

for (const levelId of LEVELS) {
  lm.goToLevel(levelId);
  const cfg = lm.current;
  console.log(`── L${levelId}  (${cfg.colors.length} colours | budget=${cfg.spawnBudget} | lanes=${cfg.laneCount}) ──`);
  console.log(`skill     win%   shots  correct |  N=3   N=4   N=5   N=6   (color bombs / level)`);
  for (const skill of SKILLS) {
    const e = evaluate(levelId, skill);
    const f = (x) => x.toFixed(2).padStart(5);
    console.log(
      `${skill.padEnd(8)} ${e.winRate.toFixed(0).padStart(3)}%  ${e.avgShots.toFixed(1).padStart(5)}  ${e.avgCorrect.toFixed(1).padStart(6)}  | ` +
      `${f(e.perN[3])} ${f(e.perN[4])} ${f(e.perN[5])} ${f(e.perN[6])}`
    );
  }
  console.log('');
}
