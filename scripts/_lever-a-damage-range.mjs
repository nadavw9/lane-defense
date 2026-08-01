// LEVER A — narrow the pilot's bomb-damage range so the number on the bomb means
// something against car HP 2/3/4. Measurement only.
//
// Verifies the clamp BINDS across all four damage sources before trusting any
// downstream number (pool, depth-bait bait, depth-bait reward, CRISIS assist).
import { LevelManager }    from '../src/game/LevelManager.js';
import { ShooterDirector } from '../src/director/ShooterDirector.js';
import { FairnessArbiter } from '../src/director/FairnessArbiter.js';
import { CarDirector }     from '../src/director/CarDirector.js';
import { IntensityPhase }  from '../src/director/IntensityPhase.js';
import { SeededRandom }    from '../src/utils/SeededRandom.js';
import { GameState }       from '../src/game/GameState.js';
import { Lane }            from '../src/models/Lane.js';
import { Column }          from '../src/models/Column.js';
import { Car }             from '../src/models/Car.js';
import { Shooter }         from '../src/models/Shooter.js';
import { CombatResolver }  from '../src/game/CombatResolver.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';

const RANGES = [null, [2, 5], [2, 4], [1, 4], [1, 3]];
const label  = (r) => (r ? `${r[0]}-${r[1]}` : 'shipped 2-8');
const pct    = (a, b) => (b ? (a / b * 100) : 0).toFixed(1);
const cr = new CombatResolver();

// ── 0. Does the clamp bind on every source? ──────────────────────────────────
console.log('0) CLAMP BINDS ON ALL FOUR DAMAGE SOURCES?');
{
  const lm = new LevelManager(); lm.goToLevel(5); const c = lm.current;
  for (const range of RANGES.filter(Boolean)) {
    const rng = new SeededRandom(3);
    const sd = new ShooterDirector({}, rng, new FairnessArbiter());
    sd.setDamageRange(range);
    const lanes = Array.from({ length: c.laneCount }, (_, i) => new Lane({ id: i }));
    const cols  = Array.from({ length: c.colCount }, (_, i) => new Column({ id: i }));
    const gs = new GameState({ lanes, columns: cols, colors: c.colors, world: c.worldConfig,
      duration: c.duration, phaseMan: new IntensityPhase(c.duration), laneCount: c.laneCount,
      colCount: c.colCount, gridRows: c.gridRows, spawnBudget: c.spawnBudget,
      laneTargetCarCount: c.laneTargetCarCount, levelId: 5 });
    for (let l = 0; l < c.laneCount; l++) {
      const car = new Car({ color: c.colors[0], hp: 3, speed: 5, type: 'big' });
      car.hp = 3; car.row = 5; car.position = 80; lanes[l].addCar(car);
    }
    const ds = { pool: [], bait: [], reward: [], crisis: [] };
    for (let i = 0; i < 2000; i++) {
      gs.phaseMan.update((i / 2000) * c.duration);
      const ph = gs.phaseMan.getParams();
      ds.pool.push(sd.generateShooter(i % c.colCount, gs.asDirectorState(), ph).damage);
      const b = sd.createDepthBait(i % c.colCount, gs.asDirectorState());
      ds.bait.push(b.baitShooter.damage); ds.reward.push(b.rewardShooter.damage);
    }
    // CRISIS needs deploy activity + a car past 70%.
    for (let i = 0; i < 400; i++) {
      sd.recordDeploy(i); sd.recordDeploy(i + 0.1);
      const st = { ...gs.asDirectorState(), elapsedTime: i * 20, phase: 'CLIMAX' };
      const res = sd.triggerCrisis(st);
      if (res) ds.crisis.push(res.shooter.damage);
    }
    const bad = Object.entries(ds).filter(([, v]) => v.some((d) => d < range[0] || d > range[1]));
    const rangeOf = (v) => (v.length ? `${Math.min(...v)}-${Math.max(...v)}` : 'n/a');
    console.log(`   range ${label(range).padEnd(11)} pool ${rangeOf(ds.pool).padEnd(5)} bait ${rangeOf(ds.bait).padEnd(5)}`
      + ` reward ${rangeOf(ds.reward).padEnd(5)} crisis ${rangeOf(ds.crisis).padEnd(5)}  ${bad.length ? 'LEAK: ' + bad.map(([k]) => k).join(',') : 'all clamped'}`);
  }
}

// ── 1. One-shot + chain rates against the pilot's real HP mix ────────────────
console.log('\n1) ONE-SHOT AND CHAIN RATES vs pilot car HP at m=0.70');
console.log('   (HP mix sampled from the live CarDirector at each level)\n');
console.log('range       │ lvl │ one-shot │ survive │ chain-kill │ merged one-shot');
console.log('────────────┼─────┼──────────┼─────────┼────────────┼────────────────');
for (const range of RANGES) {
  for (const id of [5, 8]) {
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
    for (let i = 0; i < 2000; i++) {
      gs.phaseMan.update((i / 2000) * c.duration);
      cars.push(cd._buildCar(c.colors[i % c.colors.length], gs.phaseMan.getParams(), c.worldConfig,
        Array.from({ length: c.gridRows }, (_, r) => r)));
    }
    const sd = new ShooterDirector({}, new SeededRandom(7), new FairnessArbiter());
    sd.setDamageRange(range);
    for (let l = 0; l < c.laneCount; l++) { const cc = cars[l * 37 % cars.length]; cc.row = 4; lanes[l].addCar(cc); }
    const dmgs = [];
    for (let i = 0; i < 2000; i++) {
      gs.phaseMan.update((i / 2000) * c.duration);
      dmgs.push(sd.generateShooter(i % c.colCount, gs.asDirectorState(), gs.phaseMan.getParams()).damage);
    }
    const merged = []; for (let i = 0; i + 2 < dmgs.length; i += 3) merged.push(dmgs[i] + dmgs[i + 1] + dmgs[i + 2]);

    let one = 0, tot = 0, mOne = 0;
    const S = 600;
    for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) {
      const hp = cars[(i * 13) % cars.length].hp; tot++;
      if (dmgs[(j * 17) % dmgs.length] >= hp) one++;
      if (merged[(j * 17) % merged.length] >= hp) mOne++;
    }
    // chain rate on real lane compositions
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
    console.log(`${label(range).padEnd(11)} │ L${id}  │ ${pct(one, tot).padStart(7)}% │ ${pct(tot - one, tot).padStart(6)}% │ `
      + `${pct(chains, shots).padStart(9)}% │ ${pct(mOne, tot).padStart(14)}%`);
  }
}

// ── 2. Win rates against bandFor() ───────────────────────────────────────────
console.log('\n2) L4-L8 WIN RATES per range (500 runs, skill=average; FTUE band 85-95)\n');
console.log('range       │   L4 │   L5 │   L6 │   L7 │   L8 │ out of band');
console.log('────────────┼──────┼──────┼──────┼──────┼──────┼────────────');
for (const range of RANGES) {
  const wins = [];
  for (const id of [4, 5, 6, 7, 8]) {
    const lm = new LevelManager(); lm.goToLevel(id); const c = lm.current;
    const r = new SimulationRunner({ duration: c.duration, colors: c.colors, worldConfig: c.worldConfig,
      levelId: id, skill: 'average', laneCount: c.laneCount, colCount: c.colCount,
      laneTargetCarCount: c.laneTargetCarCount, spawnBudget: c.spawnBudget, gridRows: c.gridRows,
      goals: c.goals, damageRange: range });
    let w = 0; for (let s = 0; s < 500; s++) if (r.runLevel(1 + s).won) w++;
    wins.push(w / 500 * 100);
  }
  const oob = wins.map((w, i) => (w < 85 || w > 95) ? `L${[4, 5, 6, 7, 8][i]}` : null).filter(Boolean);
  console.log(`${label(range).padEnd(11)} │ ${wins.map((w) => w.toFixed(1).padStart(4)).join(' │ ')} │ ${oob.length ? oob.join(',') : 'none'}`);
}
