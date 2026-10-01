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
//   mender    — a repair truck: heals 1 HP each time traffic moves, unless the
//               shot that moved traffic hit IT. Chip damage on a mender is wasted;
//               finish it or leave it.
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

/** Can a bomb of `bombColor` be fired at this (front) car? */
export function canTarget(car, bombColor, isColorBomb = false) {
  if (!car) return false;
  if (isColorBomb) return true;
  if ((car.armor ?? 0) > 0) return true;       // any colour strips armour
  return car.color === bombColor;
}

/** Rows this car moves on one traffic advance. */
export function stepFor(car) {
  if (car.trait === 'speeder') return 2;
  if (car.moveEvery > 1) {
    car.moveTick = (car.moveTick ?? 0) + 1;
    return car.moveTick % car.moveEvery === 0 ? 1 : 0;
  }
  return 1;
}

/**
 * Move one lane's cars forward. `cars` must be sorted FRONT-FIRST (highest row
 * first). A car never moves into or past the car ahead of it, so a speeder stuck
 * behind a slow car waits. Mutates car.row in place; order is preserved.
 */
export function advanceLaneCars(cars, fixedStep = null) {
  let aheadRow = Infinity;
  for (const car of cars) {
    let r = car.row + (fixedStep ?? stepFor(car));
    if (r >= aheadRow) r = aheadRow - 1;
    if (r < car.row) r = car.row;
    car.row = r;
    aheadRow = r;
  }
}

/**
 * Menders repair 1 HP per traffic move unless they were hit by the shot that
 * caused it. Always clears the per-turn `recentHit` mark, so call it exactly once
 * per lane per traffic move (after the move, before breach checks).
 */
export function healMenders(cars) {
  let healed = 0;
  for (const car of cars) {
    if (car.trait === 'mender' && !car.recentHit && car.hp > 0 && car.hp < car.maxHp) { car.hp += 1; healed++; }
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
export function surgeOtherLanes(lanes, srcLane) {
  lanes.forEach((cars, i) => { if (i !== srcLane) advanceLaneCars(cars, 1); });
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

// ── Boss vehicles (L10 / L20 / L30 / L40) ───────────────────────────────────
// A boss is one giant car with a colour SEQUENCE shown on its roof. Each bomb
// of the current colour knocks out one light (a supercharged bomb knocks out
// two) and the boss takes the next colour; clear the sequence to destroy it.
// Bosses move one row every `moveEvery` turns, their lane gets no other
// traffic, and `reArmor` bosses re-plate after every light (so each light is
// "any bomb, then the right colour").

// A BOMB booster does not erase a boss — it knocks this many lights off.
export const BOMB_BOSS_LIGHTS = 2;

export function isBoss(car) { return !!car?.sequence; }

/** Turn a freshly built car into a boss from an initialCars definition. */
export function makeBoss(car, def) {
  car.type      = 'boss';
  car.sequence  = [...def.sequence];
  car.seqIdx    = 0;
  car.color     = car.sequence[0];
  car.moveEvery = def.moveEvery ?? 2;
  car.moveTick  = 0;
  car.reArmor   = !!def.reArmor;
  car.armor     = car.reArmor ? 1 : 0;
  car.trait     = null;
  car.altColor  = null;
  car.hp        = car.sequence.length;
  car.maxHp     = car.hp;
  return car;
}

/**
 * Knock `n` lights out of a boss. Returns true when the boss is destroyed.
 * Keeps hp in step with the lights left (renderers and goals read hp).
 */
export function hitBoss(car, n = 1) {
  car.seqIdx = Math.min(car.sequence.length, car.seqIdx + n);
  car.hp = car.sequence.length - car.seqIdx;
  if (car.hp <= 0) return true;
  car.color = car.sequence[car.seqIdx];
  if (car.reArmor) car.armor = 1;
  return false;
}

/** A lane holding a boss gets no refill traffic. */
export function laneHasBoss(cars) { return cars.some(isBoss); }

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
  for (const cars of lanes) for (const c of cars) if (c.row === 0) c.row = 1;
  return true;
}
