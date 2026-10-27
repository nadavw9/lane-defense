// CHAIN REACTION across lanes (2026-10-27). Owner: "only 3 lanes, not much room for thinking and
// creativity". Every turn used to have one right answer (match the colour, shoot). Now a car that
// EXPLODES passes one hit to the FRONT car of each neighbouring lane when it has the same colour,
// and a neighbour that explodes passes it on to the next lane. A neighbour that only shrinks, a
// different colour, armour or an empty lane stops it. Only front cars take part, so the order of
// play matters: clear the odd colour in the middle lane first and one shot takes the whole row.
// Every correct shot still moves traffic, so cars destroyed PER SHOT is the resource this rewards.
//
// Pure: shared by GameLoop and SimulationRunner (one rule, like CombatResolver).
export const SPREAD_FROM = 6;   // taught by the CHAIN REACTION card on this level (introSchedule)

export function spreadEnabledFor(cfg) {
  if (typeof cfg?.spread === 'boolean') return cfg.spread;
  return typeof cfg?.id === 'number' ? cfg.id >= SPREAD_FROM : true;
}

/**
 * Pass the explosion in `laneIdx` sideways. Mutates the neighbouring cars like CombatResolver
 * (takeDamage / removeFrontCar / recentHit). Returns the hits in the order they happen, each
 * `{ lane, from, car, destroyed }` (`car` is the car object, still carrying colour/type/trait/
 * position after removal, for the goals and the renderer).
 */
export function spreadAcross(lanes, laneIdx, color, activeLaneCount = lanes.length) {
  const hits = [];
  for (const dir of [-1, 1]) {
    let from = laneIdx;
    for (let l = laneIdx + dir; l >= 0 && l < activeLaneCount; l += dir) {
      const car = lanes[l].frontCar();
      if (!car || (car.armor ?? 0) > 0 || car.color !== color) break;
      car.takeDamage(1);
      car.recentHit = true;           // menders skip this turn's repair, as after a bomb
      const destroyed = car.isDead();
      if (destroyed) lanes[l].removeFrontCar();
      hits.push({ lane: l, from, car, destroyed });
      if (!destroyed) break;
      from = l;
    }
  }
  return hits;
}
