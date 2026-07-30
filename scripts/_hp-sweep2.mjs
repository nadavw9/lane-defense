import { LevelManager } from '../src/game/LevelManager.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';
const RUNS = 400;
function run(id, hp, ltc) {
  const lm = new LevelManager(); lm.goToLevel(id); const c = lm.current;
  const r = new SimulationRunner({ duration: c.duration, colors: c.colors,
    worldConfig: { ...c.worldConfig, hpMultiplier: hp }, levelId: id, skill: 'average',
    laneCount: c.laneCount, colCount: c.colCount, laneTargetCarCount: ltc,
    spawnBudget: c.spawnBudget, gridRows: c.gridRows, goals: c.goals });
  let w = 0; for (let s = 0; s < RUNS; s++) if (r.runLevel(1 + s).won) w++;
  return w / RUNS * 100;
}
console.log('L4 fine sweep (ltc 2), base hp 0.54:');
for (const m of [1.3, 1.4, 1.5, 1.6, 1.7, 1.8]) {
  const hp = +(0.54 * m).toFixed(4);
  console.log(`   hp ${hp} (x${m}) = ${run(4, hp, 2).toFixed(1)}%`);
}
console.log('\nL7 density lever (base hp 0.252):');
for (const ltc of [2, 3]) {
  for (const m of [1.0, 1.5, 2.0, 2.5]) {
    const hp = +(0.252 * m).toFixed(4);
    console.log(`   ltc ${ltc}  hp ${hp} (x${m}) = ${run(7, hp, ltc).toFixed(1)}%`);
  }
}
