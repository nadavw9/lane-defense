// CombatResolver — pure combat logic, no side effects beyond mutating the cars.
// Reads only: shooter.color, shooter.damage
// Writes only: car.hp (via takeDamage), lane.cars (via removeFrontCar)
//
// Rule: CombatResolver never touches game state, renderers, or directors.
export class CombatResolver {
  // Attempt to fire `shooter` at the front car of `lane`.
  //
  // World 1-2 rule: wrong color = 0 damage (no interference yet).
  // Returns { kills, carryOverKills, damageDealt }.
  //   kills          — total cars destroyed by this shot
  //   carryOverKills — kills beyond the first (each = one carry-over)
  //   damageDealt    — total HP removed (useful for partial-damage feedback)
  resolve(shooter, lane) {
    const frontCar = lane.frontCar();
    if (!frontCar) return { kills: 0, carryOverKills: 0, damageDealt: 0 };

    // Color mismatch → no damage in World 1-2.
    if (shooter.color !== frontCar.color) {
      return { kills: 0, carryOverKills: 0, damageDealt: 0 };
    }

    return this._applyDamage(shooter.damage, lane);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  // Cascade damage through the front cars of the lane.
  // Overflow from killing a car carries into the next car.
  _applyDamage(damage, lane) {
    let remaining      = damage;
    let kills          = 0;
    let carryOverKills = 0;
    let damageDealt    = 0;

    while (remaining > 0 && lane.frontCar()) {
      const car = lane.frontCar();
      const hp  = car.hp;

      car.takeDamage(remaining);
      damageDealt += Math.min(remaining, hp);

      if (car.isDead()) {
        // First kill is a normal kill; every subsequent kill is a carry-over.
        if (kills > 0) carryOverKills++;
        kills++;
        lane.removeFrontCar();
        remaining = Math.max(0, remaining - hp);
      } else {
        break; // car survived, no overflow
      }
    }

    return { kills, carryOverKills, damageDealt };
  }
}
