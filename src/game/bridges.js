// BRIDGES across lanes (2026-10-31). Owner: "for two cars to be hit you must CREATE A LINK between
// them: two adjacent lanes whose cars are the same colour; then hitting one hits the other. A triple
// bridge is allowed. A speeder on one side breaks it. Without bridges the level should not be
// passable." Replaces the automatic CHAIN REACTION (spread.js), which nobody understood because it
// happened without the player doing anything.
//
// A bridge joins two cars in ADJACENT lanes, SAME colour, SIDE BY SIDE (same row), both on the
// visible road (row >= 1), neither armoured at that moment. Any row, not only the front: a bridge
// made deep in the lanes is a plan that pays when the pair arrives. Bridges share cars, so A-B and
// B-C make a triple. A hit on any bridged car (queue bomb) lands the same hit on every connected
// car, even one that is not the front car of its lane. A bridge breaks when either car leaves, when
// the rows differ (a speeder takes two steps a turn), or when the colours differ (chameleon flip).
//
// Pure: shared by GameLoop and SimulationRunner (one rule, like CombatResolver). Cars have no id,
// so a bridge keeps the car OBJECTS; `pruneBridges` must run after every advance and every hit.
export const BRIDGES_FROM = 6;   // taught by the BRIDGES card on this level (introSchedule)
const EPS = 1e-6;

export function bridgesEnabledFor(cfg) {
  if (typeof cfg?.bridges === 'boolean') return cfg.bridges;
  return typeof cfg?.id === 'number' ? cfg.id >= BRIDGES_FROM : true;
}

const sideBySide = (a, b) => Math.abs(a.row - b.row) < EPS;
const onRoad     = (c) => c.row >= 1 - EPS;
const bare       = (c) => (c.armor ?? 0) === 0;
const pairOk     = (a, b) => a !== b && a.color === b.color && sideBySide(a, b) && onRoad(a) && onRoad(b) && bare(a) && bare(b);

/** Every pair of cars that could be bridged right now: `[{ a: { lane, car }, b: { lane, car } }]`, lane a < lane b. */
export function eligiblePairs(lanes, activeLaneCount = lanes.length) {
  const out = [];
  for (let l = 0; l + 1 < activeLaneCount; l++) {
    for (const a of lanes[l]?.cars ?? []) {
      for (const b of lanes[l + 1]?.cars ?? []) {
        if (pairOk(a, b)) out.push({ a: { lane: l, car: a }, b: { lane: l + 1, car: b } });
      }
    }
  }
  return out;
}

/** True when these two car objects form an eligible pair (adjacent lanes inside the active ones). */
export function canBridge(lanes, activeLaneCount, carA, carB) {
  const la = laneOf(lanes, carA, activeLaneCount), lb = laneOf(lanes, carB, activeLaneCount);
  if (la < 0 || lb < 0 || Math.abs(la - lb) !== 1) return false;
  return pairOk(carA, carB);
}

export function laneOf(lanes, car, activeLaneCount = lanes.length) {
  for (let l = 0; l < activeLaneCount; l++) if (lanes[l]?.cars?.includes(car)) return l;
  return -1;
}

/** The bridge joining these two cars, or null. */
export function bridgeBetween(bridges, carA, carB) {
  return bridges.find(br => (br.a.car === carA && br.b.car === carB) || (br.a.car === carB && br.b.car === carA)) ?? null;
}

/** Adds the bridge (lane a kept lower). Returns false when it already exists. */
export function addBridge(bridges, laneA, carA, laneB, carB) {
  if (bridgeBetween(bridges, carA, carB)) return false;
  bridges.push(laneA < laneB ? { a: { lane: laneA, car: carA }, b: { lane: laneB, car: carB } }
                             : { a: { lane: laneB, car: carB }, b: { lane: laneA, car: carA } });
  return true;
}

/** Every car reachable from `car` over the bridges, the car itself included. */
export function connected(bridges, car) {
  const seen = new Set([car]);
  const queue = [car];
  while (queue.length) {
    const c = queue.pop();
    for (const br of bridges) {
      const other = br.a.car === c ? br.b.car : br.b.car === c ? br.a.car : null;
      if (other && !seen.has(other)) { seen.add(other); queue.push(other); }
    }
  }
  return seen;
}

/**
 * Drops every bridge that no longer holds (a car gone from its lane, rows apart, colours apart).
 * Mutates `bridges`; returns the removed ones (for the snap effect).
 */
export function pruneBridges(lanes, bridges, activeLaneCount = lanes.length) {
  const removed = [];
  for (let i = bridges.length - 1; i >= 0; i--) {
    const br = bridges[i];
    const la = laneOf(lanes, br.a.car, activeLaneCount), lb = laneOf(lanes, br.b.car, activeLaneCount);
    const ok = la >= 0 && lb >= 0 && Math.abs(la - lb) === 1 && br.a.car.color === br.b.car.color && sideBySide(br.a.car, br.b.car);
    if (!ok) { removed.push(br); bridges.splice(i, 1); }
  }
  return removed;
}

/**
 * The shot hit `hitCar` for `damage`; land the same damage on every OTHER car connected to it.
 * Mutates the cars like CombatResolver (takeDamage / removal from the lane / recentHit). Returns
 * the hits in chain order, each `{ lane, car, destroyed }` (`car` keeps colour/type/trait/position
 * after removal, for goals and the renderer). Does not prune: the caller prunes after the shot.
 */
export function bridgeHits(lanes, bridges, hitCar, damage = 1, activeLaneCount = lanes.length) {
  const hits = [];
  if (!bridges.length) return hits;
  for (const car of connected(bridges, hitCar)) {
    if (car === hitCar) continue;
    const l = laneOf(lanes, car, activeLaneCount);
    if (l < 0) continue;
    // Car objects (models/Car) and the simulator's plain records share this path.
    if (typeof car.takeDamage === 'function') car.takeDamage(damage); else car.hp = Math.max(0, car.hp - damage);
    car.recentHit = true;           // menders skip this turn's repair, as after a bomb
    const destroyed = car.hp <= 0;
    if (destroyed) lanes[l].cars.splice(lanes[l].cars.indexOf(car), 1);
    hits.push({ lane: l, car, destroyed });
  }
  return hits;
}
