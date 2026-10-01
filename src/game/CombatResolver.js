// CombatResolver — pure combat logic, no side effects beyond mutating the cars.
// Reads only: shooter.color, shooter.damage, car.hp/color/armor
// Writes only: car.hp (via takeDamage), car.armor, lane.cars (via removeFrontCar)
//
// Rule: CombatResolver never touches game state, renderers, or directors.
// Shared by GameLoop and SimulationRunner — there is ONE damage model.
import { isBoss, hitBoss } from '../director/TrafficRules.js';
const MISS = Object.freeze({ hit: false, kills: 0, carryOverKills: 0, damageDealt: 0, destroyed: [] });

export class CombatResolver {
  // Attempt to fire `shooter` at the front car of `lane`.
  //
  // Returns { hit, kills, carryOverKills, damageDealt, destroyed, armorBroken? }.
  //   hit            — the shot connected (a hit advances traffic; a miss does not)
  //   kills          — total cars destroyed by this shot
  //   carryOverKills — kills beyond the first (each = one carry-over)
  //   damageDealt    — total HP removed (useful for partial-damage feedback)
  //   destroyed      — array of { color, type } for each destroyed car
  //   armorBroken    — the shot knocked the plates off an armoured car (no damage)
  //
  // opts.power — the Hot Streak supercharged shot: double damage, and the
  //              carry-over continues through cars of any colour.
  resolve(shooter, lane, opts = {}) {
    const frontCar = lane.frontCar();
    if (!frontCar) return MISS;

    // Armour takes the first hit from ANY bomb, and absorbs all of it.
    // (Plated cars carry 2 plates: each hit strips one, `armorLeft` says how many remain.)
    if ((frontCar.armor ?? 0) > 0) {
      frontCar.armor -= 1;
      return { hit: true, armorBroken: true, armorLeft: frontCar.armor, kills: 0, carryOverKills: 0, damageDealt: 0, destroyed: [] };
    }

    // Colour mismatch → no damage.
    if (shooter.color !== frontCar.color) return MISS;

    const power = !!opts.power;

    // A boss loses one light per bomb (two when supercharged); no carry-over.
    if (isBoss(frontCar)) {
      const lights = power ? 2 : 1;
      const before = frontCar.hp;
      const dead = hitBoss(frontCar, lights);
      const destroyed = dead ? [{ color: frontCar.color, type: frontCar.type, trait: frontCar.trait ?? null }] : [];
      if (dead) lane.removeFrontCar();
      return { hit: true, bossHit: true, kills: dead ? 1 : 0, carryOverKills: 0,
               damageDealt: before - Math.max(0, frontCar.hp), destroyed };
    }

    const res = this._applyDamage(shooter.damage * (power ? 2 : 1), shooter.color, lane, power);
    res.hit = true;
    return res;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  // Cascade damage through the front cars of the lane.
  // Colour is re-checked on every car after the first: overflow that reaches a
  // mismatched car stops dead — unless `pierce` (a supercharged shot). Armour
  // always stops the cascade.
  _applyDamage(damage, shooterColor, lane, pierce = false) {
    let remaining      = damage;
    let kills          = 0;
    let carryOverKills = 0;
    let damageDealt    = 0;
    const destroyed    = [];

    while (remaining > 0 && lane.frontCar()) {
      const car = lane.frontCar();

      if (kills > 0) {
        if ((car.armor ?? 0) > 0 || isBoss(car)) break;
        if (!pierce && car.color !== shooterColor) break;
      }

      const hp = car.hp;
      car.takeDamage(remaining);
      damageDealt += Math.min(remaining, hp);

      car.recentHit = true;   // menders skip this turn's repair
      if (car.isDead()) {
        destroyed.push({ color: car.color, type: car.type, trait: car.trait ?? null });
        if (kills > 0) carryOverKills++;
        kills++;
        lane.removeFrontCar();
        remaining = Math.max(0, remaining - hp);
      } else {
        break; // car survived, no overflow
      }
    }

    return { kills, carryOverKills, damageDealt, destroyed };
  }
}
