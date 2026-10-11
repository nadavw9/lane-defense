// TrafficRules — the V2 car rules, shared by the live game (GameLoop, DragDrop)
// and the balance simulator (SimulationRunner). Pure functions over plain car
// records ({ row, color, trait, armor, altColor, ... }), so both sides run the
// SAME rules by construction rather than by keeping two copies in sync.
//
// Special cars (one trait per car):
//   armored   — steel plates block the first hit. ANY colour of bomb knocks them
//               off (no damage). After that it is an ordinary car.
//   speeder   — moves 2 rows per turn instead of 1 (never passes the car ahead).
//   chameleon — switches between two colours every time traffic moves; the other
//               colour is shown on the car so the player can time the shot.
//   plated    — heavy plating: TWO hits (any colour) to strip it, then an ordinary car.
//   mender    — a repair truck: repairs one rung after two traffic moves
//               without a hit. Keep shooting it and it never heals.
//   volatile  — a fuel hauler: when destroyed it shoves every OTHER lane's traffic
//               one extra row forward. Kill it when the road can take the surge.
//   phantom   — colour hidden (a dark silhouette) until it reaches PHANTOM_REVEAL_ROW.
//               Rules are unchanged; the player must plan with what the deal shows.
//
// Hot Streak: destroy at least one car on 3 shots in a row and the next bomb is
// SUPERCHARGED — double damage, and its carry-over smashes through cars of ANY
// colour (armour and the boss still stop it). A shot that hits without destroying
// a car resets the streak.

// ORDER MATTERS: rollTrait walks this list accumulating probabilities, so appending
// new traits keeps the random stream of every existing level byte-identical.
export const TRAITS = ['speeder', 'armored', 'chameleon', 'plated', 'mender', 'volatile', 'phantom'];

// Phantoms show their colour from this row on (row 0 is the hidden staging row).
export const PHANTOM_REVEAL_ROW = 4;
export function isHiddenPhantom(car) {
  return car?.trait === 'phantom' && car.row < PHANTOM_REVEAL_ROW;
}

// Which car types may carry each trait. Speeders are light vehicles; armour goes
// on the mid-weight bodies where plating reads; chameleons on anything but a tank.
export const TRAIT_TYPES = {
  speeder:   new Set(['small', 'big', 'jeep']),
  armored:   new Set(['big', 'jeep', 'truck', 'bigrig']),
  chameleon: new Set(['small', 'big', 'jeep', 'truck']),
  plated:    new Set(['big', 'jeep', 'truck', 'bigrig']),
  mender:    new Set(['small', 'big', 'jeep', 'truck']),
  volatile:  new Set(['big', 'jeep', 'truck']),
  phantom:   new Set(['small', 'big', 'jeep', 'truck', 'bigrig']),
};

export const STREAK_TO_CHARGE = 3;

// ── Half-row steps ───────────────────────────────────────────────────────────
// A car is one ROW long. Every correct shot advances traffic ONE STEP, and a step
// is 1/stepsPerRow of a row, so a longer journey (more shots to the breach) needs
// no longer road and no smaller cars. stepsPerRow = 1 is the legacy whole-row
// model (what unit tests that do not opt in still run). With 2, rows are exact
// halves in binary, so row arithmetic and === comparisons stay exact.
export const STEPS_PER_ROW = 2;
export const stepSize = (stepsPerRow = 1) => 1 / Math.max(1, stepsPerRow || 1);

/**
 * Lowest spawn row (in steps) where a new car fits: no existing car within one
 * car length. With whole rows this is exactly the old "lowest unoccupied row".
 * Returns -1 when the lane is physically full.
 */
export function freeSpawnRow(cars, step = 1, rows = Infinity) {
  for (let r = 0; r < rows; r += step) {
    if (!cars.some(c => Math.abs(c.row - r) < 1)) return r;
  }
  return -1;
}

/** Can a bomb of `bombColor` be fired at this (front) car? */
export function canTarget(car, bombColor, isColorBomb = false) {
  if (!car) return false;
  if (isColorBomb) return true;
  if ((car.armor ?? 0) > 0) return true;       // any colour strips armour
  return car.color === bombColor;
}

/** Rows this car moves on one traffic advance. */
export function stepFor(car, step = 1) {
  if (car.trait === 'speeder') return 2 * step;
  return step;
}

/**
 * Move one lane's cars forward. `cars` must be sorted FRONT-FIRST (highest row
 * first). A car never moves into or past the car ahead of it, so a speeder stuck
 * behind a slow car waits. Mutates car.row in place; order is preserved.
 */
export function advanceLaneCars(cars, fixedStep = null, step = 1) {
  let aheadRow = Infinity;
  for (const car of cars) {
    let r = car.row + (fixedStep ?? stepFor(car, step));
    if (r > aheadRow - 1) r = aheadRow - 1;
    if (r < car.row) r = car.row;
    car.row = r;
    aheadRow = r;
  }
}

/**
 * Menders repair one rung after two traffic moves without a hit. Always clears the per-turn `recentHit` mark, so call it exactly once
 * per lane per traffic move (after the move, before breach checks).
 */
export function healMenders(cars) {
  let healed = 0;
  for (const car of cars) {
    if (car.trait === 'mender') {
      // One rung back after two quiet moves; a hit restarts the clock. (One-hit bombs mean
      // a mender that healed on every move could never be shrunk by a player who also
      // has to shoot other lanes.)
      car.quiet = car.recentHit ? 0 : (car.quiet ?? 0) + 1;
      if (car.quiet >= 2 && car.hp > 0 && car.hp < car.maxHp) { car.hp += 1; healed++; car.quiet = 0; }
    }
    car.recentHit = false;
  }
  return healed;
}

/** True when this destroyed-car record shoves the other lanes (see `volatile`). */
export function causesSurge(destroyed) {
  return (destroyed ?? []).some(d => d.trait === 'volatile');
}

/**
 * A volatile car just died in `srcLane`: every OTHER lane's traffic moves one
 * extra row. `lanes` = arrays of cars (front-first). Returns nothing; breach is
 * checked by the caller exactly as for a normal advance.
 */
export function surgeOtherLanes(lanes, srcLane, step = 1) {
  lanes.forEach((cars, i) => { if (i !== srcLane) advanceLaneCars(cars, step, step); });
}

/** Chameleons flip to their other colour. Call once per traffic move. */
export function flipChameleons(cars) {
  for (const car of cars) {
    if (car.trait === 'chameleon' && car.altColor) {
      const c = car.color; car.color = car.altColor; car.altColor = c;
    }
  }
}

/**
 * Give a freshly built car a trait, per the level's trait table
 * ({ speeder?: p, armored?: p, chameleon?: p } — probabilities per spawn).
 * Consumes rng ONLY when a table is present, so levels without traits keep
 * exactly the random stream they always had.
 */
export function rollTrait(car, table, rng, palette) {
  if (!table) return car;
  const roll = rng.next();
  let acc = 0;
  for (const t of TRAITS) {
    const p = table[t] ?? 0;
    if (p <= 0) continue;
    acc += p;
    if (roll < acc) {
      if (!TRAIT_TYPES[t].has(car.type)) return car;
      applyTrait(car, t, rng, palette);
      return car;
    }
  }
  return car;
}

export function applyTrait(car, trait, rng, palette) {
  if (trait === 'chameleon') {
    const others = (palette ?? []).filter(c => c !== car.color);
    if (others.length === 0) return car;
    car.altColor = others[Math.floor(rng.next() * others.length)];
  }
  car.trait = trait;
  if (trait === 'armored') car.armor = 1;
  if (trait === 'plated')  car.armor = 2;
  return car;
}

/**
 * Streak bookkeeping after a resolved hit. Returns the new { streak, charged }.
 * `kills` is the number of cars the shot destroyed; `usedCharge` is whether this
 * shot was the supercharged one (the charge is spent either way).
 */
export function nextStreak(streak, charged, kills, usedCharge) {
  if (usedCharge) charged = false;
  if (kills > 0) {
    streak += 1;
    if (streak >= STREAK_TO_CHARGE) { charged = true; streak = 0; }
  } else {
    streak = 0;
  }
  return { streak, charged };
}

// Row 0 is a STAGING row, hidden behind the goal band (projection.row0CoverY):
// cars there are invisible until the next advance. In a turn-based game the
// board only advances on a shot, so a refill that leaves EVERY car at row 0
// shows the player an empty road with nothing to shoot — a soft-lock (L1 after
// the first kill: one lane, one car per lane). When no car is visible, step
// the staged cars into row 1 so the board always has a target. It only fires
// when the board is visually empty, so it cannot add pressure to a live board.
// Shared by GameLoop and SimulationRunner (parity). `lanes` = arrays of cars.
export function revealStagedCars(lanes) {
  let any = false;
  for (const cars of lanes) for (const c of cars) {
    if (c.row >= 1) return false;   // something is already visible
    any = true;
  }
  if (!any) return false;
  for (const cars of lanes) for (const c of cars) if (c.row < 1) c.row = 1;
  return true;
}
