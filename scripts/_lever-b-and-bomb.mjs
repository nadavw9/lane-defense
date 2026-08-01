// LEVER B — truck pulled into L6-L8 — plus TASK 3, the interaction with the
// lane-clear BOMB booster. Measurement only.
import { LevelManager }    from '../src/game/LevelManager.js';
import { CarDirector }     from '../src/director/CarDirector.js';
import { ShooterDirector } from '../src/director/ShooterDirector.js';
import { FairnessArbiter } from '../src/director/FairnessArbiter.js';
import { IntensityPhase }  from '../src/director/IntensityPhase.js';
import { SeededRandom }    from '../src/utils/SeededRandom.js';
import { GameState }       from '../src/game/GameState.js';
import { Lane }            from '../src/models/Lane.js';
import { Column }          from '../src/models/Column.js';
import { Car }             from '../src/models/Car.js';
import { Shooter }         from '../src/models/Shooter.js';
import { CombatResolver }  from '../src/game/CombatResolver.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';
import { CAR_TYPES }       from '../src/director/CarTypes.js';

const pct = (a, b) => (b ? (a / b * 100) : 0).toFixed(1);
const cr = new CombatResolver();
const LEVELS = [4, 5, 6, 7, 8];

function sample(id) {
  const lm = new LevelManager(); lm.goToLevel(id); const c = lm.current;
  const rng = new SeededRandom(1);
  const cd = new CarDirector({}, rng); cd.setLevel(id);
  const lanes = Array.from({ length: c.laneCount }, (_, i) => new Lane({ id: i }));
  const cols  = Array.from({ length: c.colCount }, (_, i) => new Column({ id: i }));
  const gs = new GameState({ lanes, columns: cols, colors: c.colors, world: c.worldConfig,
    duration: c.duration, phaseMan: new IntensityPhase(c.duration), laneCount: c.laneCount,
    colCount: c.colCount, gridRows: c.gridRows, spawnBudget: c.spawnBudget,
    laneTargetCarCount: c.laneTargetCarCount, levelId: id });
  const cars = [];
  for (let i = 0; i < 3000; i++) {
    gs.phaseMan.update((i / 3000) * c.duration);
    cars.push(cd._buildCar(c.colors[i % c.colors.length], gs.phaseMan.getParams(), c.worldConfig,
      Array.from({ length: c.gridRows }, (_, r) => r)));
  }
  const sd = new ShooterDirector({}, new SeededRandom(7), new FairnessArbiter());
  for (let l = 0; l < c.laneCount; l++) { const cc = cars[l * 37 % cars.length]; cc.row = 4; lanes[l].addCar(cc); }
  const dmgs = [];
  for (let i = 0; i < 3000; i++) {
    gs.phaseMan.update((i / 3000) * c.duration);
    dmgs.push(sd.generateShooter(i % c.colCount, gs.asDirectorState(), gs.phaseMan.getParams()).damage);
  }
  return { c, cars, dmgs };
}

console.log('1) CAR HP + TYPE MIX with truck in L6-L8 (m=0.70)');
console.log('lvl │ types -> HP (share of spawns)                                    │ distinct HP');
console.log('────┼──────────────────────────────────────────────────────────────────┼────────────');
const data = {};
for (const id of LEVELS) {
  const s = sample(id); data[id] = s;
  const by = new Map();
  for (const car of s.cars) { if (!by.has(car.type)) by.set(car.type, { n: 0, hp: car.hp }); by.get(car.type).n++; }
  const parts = [...by.entries()].sort((a, b) => CAR_TYPES[a[0]].hp - CAR_TYPES[b[0]].hp)
    .map(([t, v]) => `${t}:${v.hp}hp(${pct(v.n, s.cars.length)}%)`);
  const uniq = [...new Set(s.cars.map((x) => x.hp))].sort((a, b) => a - b);
  console.log(` ${String(id).padEnd(2)} │ ${parts.join(' ').padEnd(64)} │ [${uniq.join(',')}]`);
}

console.log('\n2) ONE-SHOT / SURVIVAL / MULTI-HIT — the legibility numbers');
console.log('lvl │ one-shot │ SURVIVES │ needs 2+ hits │ chain-kill │ merged one-shot');
console.log('────┼──────────┼──────────┼───────────────┼────────────┼────────────────');
for (const id of LEVELS) {
  const { c, cars, dmgs } = data[id];
  const merged = []; for (let i = 0; i + 2 < dmgs.length; i += 3) merged.push(dmgs[i] + dmgs[i + 1] + dmgs[i + 2]);
  let one = 0, tot = 0, mOne = 0;
  const S = 600;
  for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) {
    const hp = cars[(i * 13) % cars.length].hp; tot++;
    if (dmgs[(j * 17) % dmgs.length] >= hp) one++;
    if (merged[(j * 17) % merged.length] >= hp) mOne++;
  }
  const r2 = new SeededRandom(99); let chains = 0, shots = 0;
  const depth = Math.max(2, c.laneTargetCarCount ?? 2);
  for (let t = 0; t < 20000; t++) {
    const lane = new Lane({ id: 0 });
    for (let k = 0; k < depth; k++) {
      const proto = cars[r2.nextInt(0, cars.length - 1)];
      const car = new Car({ color: c.colors[r2.nextInt(0, c.colors.length - 1)], hp: proto.hp, speed: 5, type: proto.type });
      car.hp = proto.hp; car.row = depth - k; lane.addCar(car);
    }
    const f = lane.frontCar();
    const res = cr.resolve(new Shooter({ color: f.color, damage: dmgs[r2.nextInt(0, dmgs.length - 1)], column: 0 }), lane);
    shots++; if (res.kills >= 2) chains++;
  }
  console.log(` ${String(id).padEnd(2)} │ ${pct(one, tot).padStart(7)}% │ ${pct(tot - one, tot).padStart(7)}% │ `
    + `${pct(tot - one, tot).padStart(12)}% │ ${pct(chains, shots).padStart(9)}% │ ${pct(mOne, tot).padStart(14)}%`);
}

console.log('\n3) WIN RATES + BOMB BOOSTER VALUE (500 runs, band 85-95)');
console.log('   BOMB clears a whole lane regardless of colour, so heavier cars make it');
console.log('   MORE valuable while ordinary shots get weaker — watch for it becoming the');
console.log('   only viable strategy.\n');
console.log('lvl │  win% │ flag        │ bombs/lvl │ cars per fire │ % of all kills from BOMB');
console.log('────┼───────┼─────────────┼───────────┼───────────────┼─────────────────────────');
for (const id of LEVELS) {
  const c = data[id].c;
  const mk = () => new SimulationRunner({ duration: c.duration, colors: c.colors, worldConfig: c.worldConfig,
    levelId: id, skill: 'average', laneCount: c.laneCount, colCount: c.colCount,
    laneTargetCarCount: c.laneTargetCarCount, spawnBudget: c.spawnBudget, gridRows: c.gridRows, goals: c.goals });
  const r = mk();
  let w = 0, fired = 0, bombKills = 0, kills = 0;
  for (let s = 0; s < 500; s++) {
    const res = r.runLevel(1 + s);
    if (res.won) w++;
    fired += res.bombsFired ?? 0; bombKills += res.bombKills ?? 0; kills += res.carsKilled;
  }
  const win = w / 500 * 100;
  const flag = win < 85 ? 'TOO HARD' : win > 95 ? 'TOO EASY' : 'OK';
  console.log(` ${String(id).padEnd(2)} │ ${win.toFixed(1).padStart(5)} │ ${flag.padEnd(11)} │ `
    + `${(fired / 500).toFixed(2).padStart(9)} │ ${(fired ? bombKills / fired : 0).toFixed(2).padStart(13)} │ ${pct(bombKills, kills).padStart(23)}%`);
}
