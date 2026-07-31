// TASK 1 (2026-07-31) — does bomb power matter ANYWHERE, or only fail on the pilot?
//
// The 97% overkill figure came from L4-L8, which only ever spawn small/big/jeep
// (base HP 2/4/5). truck/bigrig/tank arrive at L9/L13/L15. So the pilot may simply
// be structurally incapable of expressing bomb power while heavy levels do it fine.
// Same six measurements, on L13/L20/L30 at their SHIPPED config, with L4/L8 kept
// alongside as the control. Measures only — changes nothing.
import { LevelManager }    from '../src/game/LevelManager.js';
import { CarDirector }     from '../src/director/CarDirector.js';
import { ShooterDirector } from '../src/director/ShooterDirector.js';
import { FairnessArbiter } from '../src/director/FairnessArbiter.js';
import { IntensityPhase }  from '../src/director/IntensityPhase.js';
import { SeededRandom }    from '../src/utils/SeededRandom.js';
import { CAR_TYPES }       from '../src/director/CarTypes.js';
import { HP_MINIMUM }      from '../src/director/DirectorConfig.js';
import { GameState }       from '../src/game/GameState.js';
import { Lane }            from '../src/models/Lane.js';
import { Column }          from '../src/models/Column.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';

const LEVELS = [4, 8, 13, 20, 30];
const N = 4000;
const pct = (a, b) => (b ? (a / b * 100) : 0).toFixed(1);
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

const data = {};

for (const id of LEVELS) {
  const lm = new LevelManager(); lm.goToLevel(id); const c = lm.current;
  const rng = new SeededRandom(1);
  const carDir = new CarDirector({}, rng); carDir.setLevel(id);
  const lanes = Array.from({ length: c.laneCount }, (_, i) => new Lane({ id: i }));
  const columns = Array.from({ length: c.colCount }, (_, i) => new Column({ id: i }));
  const gs = new GameState({ lanes, columns, colors: c.colors, world: c.worldConfig,
    duration: c.duration, phaseMan: new IntensityPhase(c.duration),
    laneCount: c.laneCount, colCount: c.colCount, gridRows: c.gridRows,
    spawnBudget: c.spawnBudget, laneTargetCarCount: c.laneTargetCarCount, levelId: id });

  // ── cars ──
  const cars = [];
  for (let i = 0; i < N; i++) {
    gs.phaseMan.update((i / N) * c.duration);
    cars.push(carDir._buildCar(c.colors[i % c.colors.length], gs.phaseMan.getParams(), c.worldConfig,
      Array.from({ length: c.gridRows }, (_, r) => r)));
  }
  // ── bombs (real call site shape: generateShooter(column, asDirectorState(), phaseParams)) ──
  const rng2 = new SeededRandom(7);
  const sDir = new ShooterDirector({}, rng2, new FairnessArbiter());
  for (let l = 0; l < c.laneCount; l++) { const car = cars[l * 37 % cars.length]; car.row = 4; lanes[l].addCar(car); }
  const dmgs = [];
  for (let i = 0; i < N; i++) {
    gs.phaseMan.update((i / N) * c.duration);
    const sh = sDir.generateShooter(i % c.colCount, gs.asDirectorState(), gs.phaseMan.getParams());
    if (sh) dmgs.push(sh.damage);
  }
  const merged = [];
  for (let i = 0; i + 2 < dmgs.length; i += 3) merged.push(dmgs[i] + dmgs[i + 1] + dmgs[i + 2]);

  data[id] = { cfg: c, cars, dmgs, merged };
}

console.log('='.repeat(96));
console.log('1) + 6) ACTUAL INTEGER CAR HP, AND WHETHER DISTINCT TYPES COLLAPSE ONTO THE SAME HP');
console.log(`    hp = max(HP_MINIMUM=${HP_MINIMUM}, round(baseHp x hpMultiplier))`);
console.log('='.repeat(96));
for (const id of LEVELS) {
  const { cfg: c, cars } = data[id];
  const byType = new Map();
  for (const car of cars) { if (!byType.has(car.type)) byType.set(car.type, { n: 0, hp: car.hp }); byType.get(car.type).n++; }
  const entries = [...byType.entries()].sort((a, b) => CAR_TYPES[a[0]].hp - CAR_TYPES[b[0]].hp);
  console.log(`\nL${id}  hpMult ${c.worldConfig.hpMultiplier}  ${c.laneCount} lanes, gridRows ${c.gridRows}`);
  for (const [type, v] of entries) {
    const raw = CAR_TYPES[type].hp * c.worldConfig.hpMultiplier;
    console.log(`    ${type.padEnd(7)} base ${String(CAR_TYPES[type].hp).padStart(2)} -> raw ${raw.toFixed(2).padStart(6)}`
      + ` -> HP ${String(v.hp).padStart(3)}${Math.round(raw) < HP_MINIMUM ? ' (clamped)' : ''}   ${pct(v.n, cars.length).padStart(5)}% of spawns`);
  }
  // collapse detection
  const hpOf = new Map();
  for (const [type, v] of entries) { if (!hpOf.has(v.hp)) hpOf.set(v.hp, []); hpOf.get(v.hp).push(type); }
  const collapsed = [...hpOf.entries()].filter(([, ts]) => ts.length > 1);
  const uniq = [...hpOf.keys()].sort((a, b) => a - b);
  console.log(`    distinct HP on board: [${uniq.join(', ')}]  (${uniq.length} value${uniq.length === 1 ? '' : 's'} across ${entries.length} type${entries.length === 1 ? '' : 's'})`);
  console.log(collapsed.length
    ? `    COLLAPSED: ${collapsed.map(([hp, ts]) => `${ts.join('+')} all = ${hp}hp`).join(';  ')}`
    : '    no collapse — every spawning type has its own HP');
}

console.log('\n' + '='.repeat(96));
console.log('2) BOMB DAMAGE   |   3) OVERKILL   |   4) DOES ANY TYPE SURVIVE A MEDIAN BOMB');
console.log('='.repeat(96));
console.log('\nLvl │ base dmg      │ med │ merged        │ one-shot % │ merged 1-shot │ types surviving median bomb');
console.log('────┼───────────────┼─────┼───────────────┼────────────┼───────────────┼────────────────────────────');
for (const id of LEVELS) {
  const { cars, dmgs, merged } = data[id];
  const med = median(dmgs);
  let one = 0, tot = 0, mOne = 0;
  const S = 700;
  for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) {
    const hp = cars[(i * 13) % cars.length].hp;
    tot++;
    if (dmgs[(j * 17) % dmgs.length] >= hp) one++;
    if (merged[(j * 17) % merged.length] >= hp) mOne++;
  }
  const byType = new Map();
  for (const car of cars) byType.set(car.type, car.hp);
  const survive = [...byType.entries()].filter(([, hp]) => hp > med).map(([t, hp]) => `${t}(${hp})`);
  console.log(` ${String(id).padEnd(2)} │ ${(Math.min(...dmgs) + '-' + Math.max(...dmgs)).padEnd(13)} │ `
    + `${String(med).padStart(3)} │ ${(Math.min(...merged) + '-' + Math.max(...merged)).padEnd(13)} │ `
    + `${pct(one, tot).padStart(9)}% │ ${pct(mOne, tot).padStart(12)}% │ ${survive.length ? survive.join(', ') : 'NONE — every type dies to the median bomb'}`);
}

console.log('\n' + '='.repeat(96));
console.log('5) HOW OFTEN CARRY-OVER (chain-kill) ACTUALLY FIRES — bomb power\'s only current expression');
console.log('   Measured by running the shipped level in SimulationRunner and reading carryOvers/kills.');
console.log('='.repeat(96));
console.log('\nLvl │ runs │ kills/run │ carry-overs/run │ % of kills that were a carry-over');
console.log('────┼──────┼───────────┼─────────────────┼──────────────────────────────────');
for (const id of LEVELS) {
  const c = data[id].cfg;
  const r = new SimulationRunner({ duration: c.duration, colors: c.colors, worldConfig: c.worldConfig,
    levelId: id, skill: 'average', laneCount: c.laneCount, colCount: c.colCount,
    laneTargetCarCount: c.laneTargetCarCount, spawnBudget: c.spawnBudget, gridRows: c.gridRows,
    goals: c.goals, initialCars: c.initialCars, spawnScript: c.spawnScript,
    shooterColorWeights: c.shooterColorWeights });
  const RUNS = 200;
  let kills = 0, co = 0;
  for (let s = 0; s < RUNS; s++) { const res = r.runLevel(1 + s); kills += res.carsKilled; co += res.carryOvers; }
  console.log(` ${String(id).padEnd(2)} │ ${String(RUNS).padStart(4)} │ ${(kills / RUNS).toFixed(1).padStart(9)} │ `
    + `${(co / RUNS).toFixed(2).padStart(15)} │ ${pct(co, kills).padStart(9)}%`);
}
