// Supply-bias margin at every canonical boss after the BOMB lane-clear change.
// REPORT ONLY — bosses must be PLAYED, not simmed, before any retune lands.
//
// The margin is how much harder an extreme red-scarce supply makes a level than
// an unbiased one. A colour-agnostic LANE clear can substitute for colour supply,
// so it erodes exactly the mechanism a scarcity-built boss depends on.
import { LevelManager } from '../src/game/LevelManager.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';
const RUNS = 300;
function run(id, weights) {
  const lm = new LevelManager(); lm.goToLevel(id); const c = lm.current;
  const r = new SimulationRunner({ duration: c.duration, colors: c.colors,
    worldConfig: c.worldConfig, levelId: id, skill: 'average',
    laneCount: c.laneCount, colCount: c.colCount, laneTargetCarCount: c.laneTargetCarCount,
    spawnBudget: c.spawnBudget, gridRows: c.gridRows, goals: c.goals,
    initialCars: c.initialCars, spawnScript: c.spawnScript, shooterColorWeights: weights });
  let w = 0; for (let s = 0; s < RUNS; s++) if (r.runLevel(1 + s).won) w++;
  return w / RUNS * 100;
}
console.log(`Boss supply-bias margins  (${RUNS} runs, skill=average, boosterIQ 0.70)`);
console.log('Extreme bias = {Blue:50, Red:1}. Margin = unbiased - biased, in points.\n');
console.log('Lvl │ shipped weights   │ colors      │ unbiased │ biased │ margin');
console.log('────┼───────────────────┼─────────────┼──────────┼────────┼────────');
for (const id of [10, 20, 30, 40]) {
  const lm = new LevelManager(); lm.goToLevel(id); const c = lm.current;
  const un = run(id, null), bi = run(id, { Blue: 50, Red: 1 });
  const w = c.shooterColorWeights ? JSON.stringify(c.shooterColorWeights) : '(none)';
  console.log(` ${String(id).padEnd(2)} │ ${w.padEnd(17)} │ ${c.colors.join('/').padEnd(11)} │ `
    + `${un.toFixed(1).padStart(7)}% │ ${bi.toFixed(1).padStart(5)}% │ ${(un - bi).toFixed(1).padStart(5)}pts`);
}
