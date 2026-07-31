// TASK 1 #5, second instrument. The first was INVALID: it read
// SimulationRunner's `carryOvers`, which is always 0 because the sim's real
// damage path (car.hp -= dmg; shift if dead) DISCARDS overflow. The sim's
// _applyDamage(), which does implement carry-over, is dead code — never called.
//
// This drives the REAL CombatResolver (the one the shipped game calls) over lanes
// built from each level's measured type and colour distributions, and asks: given
// the shipped numbers, how often does a matched shot actually chain-kill?
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

const LEVELS = [4, 8, 13, 20, 30];
const TRIALS = 40000;
const cr = new CombatResolver();
const pct = (a, b) => (b ? (a / b * 100) : 0).toFixed(1);

console.log('#5 CARRY-OVER RATE — real CombatResolver, lanes built from each level\'s own distributions');
console.log('   A matched shot only chains if the NEXT car shares the shooter colour.\n');
console.log('Lvl │ colours │ lane depth │ chain-kills │ mean kills │ mean dmg wasted │ max chain');
console.log('────┼─────────┼────────────┼─────────────┼────────────┼─────────────────┼──────────');

for (const id of LEVELS) {
  const lm = new LevelManager(); lm.goToLevel(id); const c = lm.current;
  const rng = new SeededRandom(1);
  const carDir = new CarDirector({}, rng); carDir.setLevel(id);
  const lanes0 = Array.from({ length: c.laneCount }, (_, i) => new Lane({ id: i }));
  const cols0 = Array.from({ length: c.colCount }, (_, i) => new Column({ id: i }));
  const gs = new GameState({ lanes: lanes0, columns: cols0, colors: c.colors, world: c.worldConfig,
    duration: c.duration, phaseMan: new IntensityPhase(c.duration), laneCount: c.laneCount,
    colCount: c.colCount, gridRows: c.gridRows, spawnBudget: c.spawnBudget,
    laneTargetCarCount: c.laneTargetCarCount, levelId: id });

  // Pools drawn from the shipped directors.
  const pool = [];
  for (let i = 0; i < 3000; i++) {
    gs.phaseMan.update((i / 3000) * c.duration);
    pool.push(carDir._buildCar(c.colors[i % c.colors.length], gs.phaseMan.getParams(), c.worldConfig,
      Array.from({ length: c.gridRows }, (_, r) => r)));
  }
  const sDir = new ShooterDirector({}, new SeededRandom(7), new FairnessArbiter());
  for (let l = 0; l < c.laneCount; l++) { const cc = pool[l * 37 % pool.length]; cc.row = 4; lanes0[l].addCar(cc); }
  const dmgPool = [];
  for (let i = 0; i < 3000; i++) {
    gs.phaseMan.update((i / 3000) * c.duration);
    const sh = sDir.generateShooter(i % c.colCount, gs.asDirectorState(), gs.phaseMan.getParams());
    if (sh) dmgPool.push(sh.damage);
  }

  const depth = Math.max(2, c.laneTargetCarCount ?? 2);
  const r2 = new SeededRandom(99);
  let chains = 0, kills = 0, wasted = 0, maxChain = 0, shots = 0;
  for (let t = 0; t < TRIALS; t++) {
    const lane = new Lane({ id: 0 });
    for (let k = 0; k < depth; k++) {
      const proto = pool[r2.nextInt(0, pool.length - 1)];
      const car = new Car({ color: c.colors[r2.nextInt(0, c.colors.length - 1)], hp: proto.hp, speed: 5, type: proto.type });
      car.hp = proto.hp; car.row = depth - k;
      lane.addCar(car);
    }
    const front = lane.frontCar();
    const dmg = dmgPool[r2.nextInt(0, dmgPool.length - 1)];
    // Only a colour-matched shot can deal damage at all; measure the chain rate
    // among shots that actually connect.
    const res = cr.resolve(new Shooter({ color: front.color, damage: dmg, column: 0 }), lane);
    shots++; kills += res.kills;
    wasted += Math.max(0, dmg - res.damageDealt);
    if (res.kills >= 2) chains++;
    if (res.kills > maxChain) maxChain = res.kills;
  }
  console.log(` ${String(id).padEnd(2)} │ ${String(c.colors.length).padStart(7)} │ ${String(depth).padStart(10)} │ `
    + `${pct(chains, shots).padStart(10)}% │ ${(kills / shots).toFixed(2).padStart(10)} │ `
    + `${(wasted / shots).toFixed(2).padStart(15)} │ ${String(maxChain).padStart(8)}`);
}
