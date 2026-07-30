// Find the hpMultiplier that lands each of L4-L8 nearest mid-band (~90%) after
// the BOMB lane-clear change. ltc stays at 2: gridRows 8 is a shallow board and
// the 2026-07-25 pilot already established ltc4 is too dense there, so density is
// the coarse lever and HP is the fine one.
import { LevelManager } from '../src/game/LevelManager.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';
const RUNS = 400, TARGET = 90;
const MULTS = [1.0, 1.15, 1.3, 1.45, 1.6, 1.8, 2.0, 2.3];
for (const id of [4, 5, 6, 7, 8]) {
  const lm = new LevelManager(); lm.goToLevel(id); const c = lm.current;
  const baseHp = c.worldConfig.hpMultiplier;
  const row = [];
  for (const m of MULTS) {
    const wc = { ...c.worldConfig, hpMultiplier: +(baseHp * m).toFixed(4) };
    const r = new SimulationRunner({ duration: c.duration, colors: c.colors, worldConfig: wc,
      levelId: id, skill: 'average', laneCount: c.laneCount, colCount: c.colCount,
      laneTargetCarCount: c.laneTargetCarCount, spawnBudget: c.spawnBudget,
      gridRows: c.gridRows, goals: c.goals });
    let w = 0; for (let s = 0; s < RUNS; s++) if (r.runLevel(1 + s).won) w++;
    row.push({ m, hp: wc.hpMultiplier, win: w / RUNS * 100 });
  }
  const best = row.reduce((a, b) => Math.abs(b.win - TARGET) < Math.abs(a.win - TARGET) ? b : a);
  console.log(`L${id}  base hp ${baseHp}`);
  console.log('   ' + row.map((r) => `x${r.m}=${r.win.toFixed(1)}%`).join('  '));
  console.log(`   -> nearest ${TARGET}%: hp ${best.hp} (x${best.m}) = ${best.win.toFixed(1)}%`);
}
