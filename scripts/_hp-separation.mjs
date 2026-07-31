// TASK 2 — quantify the HP-spread collapse. Report only.
//
// hpMultiplier is currently BOTH the difficulty lever and the car-type-legibility
// lever, and they pull opposite ways: low multiplier = easier, but round() then
// crushes distinct car types onto the same integer HP, so the board stops
// communicating that a Van is tougher than a Car.
import { CAR_TYPES }  from '../src/director/CarTypes.js';
import { HP_MINIMUM } from '../src/director/DirectorConfig.js';
import { LevelManager } from '../src/game/LevelManager.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';

const hpAt = (base, m) => Math.max(HP_MINIMUM, Math.round(base * m));
const TYPES = Object.entries(CAR_TYPES).sort((a, b) => a[1].hp - b[1].hp);

console.log('='.repeat(88));
console.log('2a) SEPARATION THRESHOLD PER ADJACENT PAIR');
console.log(`    hp = max(${HP_MINIMUM}, round(base x m)).  "separated" = the pair has different integer HP.`);
console.log('='.repeat(88));
console.log('\npair                     │ base │ separates at m >= │ still separated at every m above?');
console.log('─────────────────────────┼──────┼───────────────────┼──────────────────────────────────');
for (let i = 0; i + 1 < TYPES.length; i++) {
  const [na, a] = TYPES[i], [nb, b] = TYPES[i + 1];
  let first = null; const recollide = [];
  for (let m = 0.01; m <= 2.0005; m += 0.01) {
    const sep = hpAt(a.hp, m) !== hpAt(b.hp, m);
    if (sep && first === null) first = m;
    if (!sep && first !== null) recollide.push(m.toFixed(2));
  }
  console.log(`${(na + ' / ' + nb).padEnd(24)} │ ${(a.hp + '/' + b.hp).padStart(4)} │ `
    + `${(first === null ? 'never' : first.toFixed(2)).padStart(17)} │ `
    + (recollide.length ? `NO — re-collides at m = ${recollide.slice(0, 6).join(', ')}${recollide.length > 6 ? ' ...' : ''}` : 'yes, monotonic'));
}

console.log('\n' + '='.repeat(88));
console.log('2b) FULL SEPARATION OF THE PILOT\'S TYPES (small/big/jeep) — what m is needed, and what it costs');
console.log('='.repeat(88));
const pilotTypes = ['small', 'big', 'jeep'];
let fullSep = null;
for (let m = 0.01; m <= 3.0005; m += 0.01) {
  const hps = pilotTypes.map((t) => hpAt(CAR_TYPES[t].hp, m));
  if (new Set(hps).size === pilotTypes.length) { fullSep = m; break; }
}
console.log(`\n  smallest m giving small/big/jeep three DISTINCT HP values: ${fullSep.toFixed(2)}`);
console.log(`     -> ${pilotTypes.map((t) => `${t} ${hpAt(CAR_TYPES[t].hp, fullSep)}hp`).join(', ')}`);
console.log(`  (shipped pilot multipliers are 0.63-0.702 — all BELOW this)`);

console.log('\n  Unretuned win rate at the separation multiplier (500 runs, skill=average):');
console.log('\n  Lvl │ shipped m │ shipped win │  sep m │ win at sep m │ band 85-95');
console.log('  ────┼───────────┼─────────────┼────────┼──────────────┼───────────');
for (const id of [4, 5, 6, 7, 8]) {
  const lm = new LevelManager(); lm.goToLevel(id); const c = lm.current;
  const runAt = (m) => {
    const r = new SimulationRunner({ duration: c.duration, colors: c.colors,
      worldConfig: { ...c.worldConfig, hpMultiplier: m }, levelId: id, skill: 'average',
      laneCount: c.laneCount, colCount: c.colCount, laneTargetCarCount: c.laneTargetCarCount,
      spawnBudget: c.spawnBudget, gridRows: c.gridRows, goals: c.goals });
    let w = 0; for (let s = 0; s < 500; s++) if (r.runLevel(1 + s).won) w++;
    return w / 500 * 100;
  };
  const shipped = c.worldConfig.hpMultiplier;
  const a = runAt(shipped), b = runAt(fullSep);
  const flag = b < 85 ? `TOO HARD by ${(85 - b).toFixed(1)}pts` : b > 95 ? `TOO EASY by ${(b - 95).toFixed(1)}pts` : 'in band';
  console.log(`   ${String(id).padEnd(2)} │ ${shipped.toFixed(3).padStart(9)} │ ${a.toFixed(1).padStart(10)}% │ `
    + `${fullSep.toFixed(2).padStart(6)} │ ${b.toFixed(1).padStart(11)}% │ ${flag}`);
}

console.log('\n' + '='.repeat(88));
console.log('2c) IS THE COLLAPSE PILOT-SPECIFIC? Same check at the shipped mid/late multipliers.');
console.log('='.repeat(88));
console.log('\nLvl │    m │ spawning types -> HP                                    │ collapse?');
console.log('────┼──────┼─────────────────────────────────────────────────────────┼──────────');
const SPAWNING = { 4: ['small', 'big'], 8: ['small', 'big', 'jeep'],
  13: ['small', 'big', 'jeep', 'truck', 'bigrig'],
  20: ['small', 'big', 'jeep', 'truck', 'bigrig', 'tank'],
  30: ['jeep', 'truck', 'bigrig', 'tank'] };
for (const id of [4, 8, 13, 20, 30]) {
  const lm = new LevelManager(); lm.goToLevel(id);
  const m = lm.current.worldConfig.hpMultiplier;
  const ts = SPAWNING[id];
  const map = ts.map((t) => `${t}:${hpAt(CAR_TYPES[t].hp, m)}`);
  const hps = ts.map((t) => hpAt(CAR_TYPES[t].hp, m));
  const dup = hps.length - new Set(hps).size;
  console.log(` ${String(id).padEnd(2)} │ ${m.toFixed(2).padStart(4)} │ ${map.join(' ').padEnd(55)} │ `
    + (dup ? `YES — ${dup} type${dup > 1 ? 's' : ''} collapsed` : 'no'));
}
