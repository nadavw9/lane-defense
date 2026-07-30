// Derive N for the BOMB threat trigger (skill=average / boosterIQ 0.70).
//
// The old trigger was YIELD-based (a row shared by >=3 cars). For a LANE clear the
// yield is deterministic — whatever that lane holds — so yield cannot drive the
// decision. Threat can: fire when a lane's front car is within N rows of breach.
//
// N is chosen so the BOMB fires about as often as it does today. That isolates the
// mechanic change from a difficulty change: if the fire rate moves a lot, the level
// got easier or harder for reasons unrelated to what the bomb now does.
import { LevelManager } from '../src/game/LevelManager.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';

const RUNS = 400;
const LEVELS = [4, 5, 6, 7, 8];

function measure(id, bombThreatRows) {
  const lm = new LevelManager(); lm.goToLevel(id); const c = lm.current;
  const r = new SimulationRunner({
    duration: c.duration, colors: c.colors, worldConfig: c.worldConfig, levelId: id,
    skill: 'average', laneCount: c.laneCount, colCount: c.colCount,
    laneTargetCarCount: c.laneTargetCarCount, spawnBudget: c.spawnBudget,
    gridRows: c.gridRows, goals: c.goals,
    ...(bombThreatRows == null ? {} : { bombThreatRows }),
  });
  let wins = 0, fired = 0, bombKills = 0;
  for (let s = 0; s < RUNS; s++) {
    const res = r.runLevel(1 + s);
    if (res.won) wins++;
    fired += res.bombsFired ?? 0;
    bombKills += res.bombKills ?? 0;
  }
  return {
    win: wins / RUNS * 100,
    firesPerLevel: fired / RUNS,
    killsPerFire: fired ? bombKills / fired : 0,
    gridRows: c.gridRows, lanes: c.laneCount,
  };
}

console.log('N sweep — skill=average, boosterIQ 0.70, %d runs/level\n', RUNS);
console.log('  N | ' + LEVELS.map((l) => `L${l} fires/lvl`.padStart(13)).join(''));
for (const N of [1, 2, 3, 4, 5]) {
  const row = LEVELS.map((l) => measure(l, N).firesPerLevel.toFixed(2).padStart(13)).join('');
  console.log(`  ${N} |${row}`);
}

console.log('\nDetail at each N (win% / fires per level / cars per fire):');
for (const N of [1, 2, 3, 4, 5]) {
  const parts = LEVELS.map((l) => {
    const m = measure(l, N);
    return `L${l} ${m.win.toFixed(1)}% ${m.firesPerLevel.toFixed(2)}f ${m.killsPerFire.toFixed(2)}c`;
  });
  console.log(`  N=${N}  ` + parts.join('  '));
}

console.log('\nBoard depth (threat row = gridRows - N):');
for (const l of LEVELS) {
  const m = measure(l, 3);
  console.log(`  L${l}  gridRows=${m.gridRows}  lanes=${m.lanes}`);
}
