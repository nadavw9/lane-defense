// L30 and L39 saturated the goal lever (counts already at the 1-car floor), so
// goalScale cannot make them easier. Remaining honest levers: density (ltc, never
// below 2) and traffic speed. hp stays at the 0.70 type-separation floor.
import { LevelManager }     from '../src/game/LevelManager.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';
const cfgFor = (id) => { const lm = new LevelManager(); lm.goToLevel(id); return lm.current; };
function sim(id, runs, { ltc, speedScale, goalScale, hp }) {
  const cfg = cfgFor(id);
  const goals = (cfg.goals ?? []).map(g => ({ ...g, count: Math.max(1, Math.round(g.count * goalScale)) }));
  const runner = new SimulationRunner({
    duration: cfg.duration, colors: cfg.colors,
    worldConfig: { hpMultiplier: hp, speed: { ...cfg.worldConfig.speed, base: +(cfg.worldConfig.speed.base * speedScale).toFixed(2) } },
    levelId: id, skill: 'average', laneCount: cfg.laneCount, colCount: cfg.colCount,
    laneTargetCarCount: ltc, spawnBudget: cfg.spawnBudget, gridRows: cfg.gridRows, goals,
    initialCars: cfg.initialCars ?? null, spawnScript: cfg.spawnScript ?? null,
    shooterColorWeights: cfg.shooterColorWeights ?? null,
  });
  let w = 0; for (let s = 0; s < runs; s++) if (runner.runLevel(1 + s).won) w++;
  return w / runs * 100;
}
for (const [id, band] of [[30, [40, 55]], [39, [60, 75]]]) {
  console.log(`--- L${id} target ${band[0]}-${band[1]} ---`);
  for (const ltc of [2, 3]) for (const sp of [0.70, 0.78, 0.86]) {
    const w = sim(id, 400, { ltc, speedScale: sp, goalScale: 0.21, hp: 0.70 });
    const ok = w >= band[0] && w <= band[1];
    console.log(`   ltc${ltc} spd×${sp.toFixed(2)}  ${w.toFixed(1)}%  ${ok ? 'OK' : ''}`);
  }
}
