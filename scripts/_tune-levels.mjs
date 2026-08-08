// Retune L9-L40 into their bandFor() bands after the 3-lane / 8-row conversion.
//
// LEVER FLOORS. hpMultiplier never goes below 0.70 (below ~0.63 small/big/jeep
// collapse to the same integer HP and the vehicles stop reading as different
// types) and laneTargetCarCount never goes below 2 or above 3 (ltc4 floods an
// 8-row board to 0-1% win). Those are the non-degeneracy rules; everything here
// respects them by construction.
//
// Search is a BINARY SEARCH on one monotonic difficulty scalar d, not a grid.
// Win% falls monotonically as d rises, so ~10 probes locate the band instead of
// several hundred. d maps to the three honest levers together:
//   d < 0  easier : fewer goal cars, slightly slower traffic
//   d > 0  harder : more goal cars, higher hp, slightly faster traffic
// Goal count is weighted heaviest because throughput is the dominant constraint
// on a shallow board — the same lever L4-L8 used ("goal 33->21", "goals 14->7").
import { LevelManager }     from '../src/game/LevelManager.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';

const BOSS = new Set([10, 20, 30, 40]);
const bandFor = (id) => BOSS.has(id) ? { lo: 40, hi: 55 }
  : id <= 9 ? { lo: 85, hi: 95 }
  : id <= 26 ? { lo: 70, hi: 82 }
  : { lo: 60, hi: 75 };

const cfgFor = (id) => { const lm = new LevelManager(); lm.goToLevel(id); return lm.current; };

// d -> concrete levers. Continuous and monotonic in difficulty.
function levers(d, baseHp) {
  const goalScale  = d <= 0 ? 1 + d * 0.80 : 1 + d * 0.90;
  const hpScale    = d <= 0 ? 1            : 1 + d * 0.55;
  const speedScale = 1 + d * 0.18;
  const hp = Math.max(0.70, +(baseHp * hpScale).toFixed(3));
  return { goalScale: Math.max(0.12, goalScale), hp, speedScale };
}

function sim(cfg, id, runs, d, ltc) {
  const L = levers(d, cfg.worldConfig.hpMultiplier);
  const goals = (cfg.goals ?? []).map((g) => ({ ...g,
    count: Math.max(1, Math.round(g.count * L.goalScale)) }));
  const world = { hpMultiplier: L.hp,
    speed: { ...cfg.worldConfig.speed,
      base: +(cfg.worldConfig.speed.base * L.speedScale).toFixed(2) } };
  const runner = new SimulationRunner({
    duration: cfg.duration, colors: cfg.colors, worldConfig: world, levelId: id,
    skill: 'average', laneCount: cfg.laneCount, colCount: cfg.colCount,
    laneTargetCarCount: ltc, spawnBudget: cfg.spawnBudget, gridRows: cfg.gridRows,
    goals, initialCars: cfg.initialCars ?? null, spawnScript: cfg.spawnScript ?? null,
    shooterColorWeights: cfg.shooterColorWeights ?? null,
  });
  let wins = 0;
  for (let s = 0; s < runs; s++) if (runner.runLevel(1 + s).won) wins++;
  return (wins / runs) * 100;
}

const ids = (process.argv[2] ?? '9-40').split(',').flatMap((tok) => {
  const [a, b] = tok.split('-').map(Number);
  return b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a];
});

const SEARCH = 120, VERIFY = 400;
const out = {};
for (const id of ids) {
  const cfg = cfgFor(id), band = bandFor(id), mid = (band.lo + band.hi) / 2;
  const ltc = BOSS.has(id) ? 3 : 2;

  let lo = -1.2, hi = 2.2, best = null, bestErr = Infinity;
  for (let it = 0; it < 11; it++) {
    const d = (lo + hi) / 2;
    const w = sim(cfg, id, SEARCH, d, ltc);
    const err = Math.abs(w - mid);
    if (err < bestErr) { bestErr = err; best = { d, w }; }
    if (w > mid) lo = d; else hi = d;      // harder when winning too much
    if (err < 1.5) break;
  }
  const verified = sim(cfg, id, VERIFY, best.d, ltc);
  const L = levers(best.d, cfg.worldConfig.hpMultiplier);
  const inBand = verified >= band.lo && verified <= band.hi;
  out[id] = { d: +best.d.toFixed(4), ltc, hp: L.hp,
    goalScale: +L.goalScale.toFixed(3), speedScale: +L.speedScale.toFixed(3), verified };
  console.log(`L${String(id).padStart(2)} ${BOSS.has(id) ? 'BOSS' : '    '} `
    + `goal×${L.goalScale.toFixed(2)} hp${L.hp.toFixed(2)} spd×${L.speedScale.toFixed(2)} ltc${ltc}  `
    + `verify ${verified.toFixed(1)}%  band ${band.lo}-${band.hi}  ${inBand ? 'OK' : '*** OUT ***'}`);
}
console.log('\nJSON:' + JSON.stringify(out));
