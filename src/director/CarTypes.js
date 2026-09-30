import { HP_MINIMUM } from './DirectorConfig.js';

// CarTypes — HP values for each car type.
// CarDirector uses pickCarType() to assign a type to each normal car spawn.
// Car3D uses TYPE_SCALES (in Car3D.js) for visual sizing; the GLB asset for
// each type is mapped in AssetLoader.CAR_ASSET_MAP:
//   small → bike.glb, big → sedan.glb, jeep → van.glb,
//   truck → truck.glb, bigrig → bigrig.glb, tank → procedural (no GLB)

// Base HP — reverted to the pre-gridRows-16 values after the balance sim showed the
// raised HP overshot (tool-less win rate ~6%); hpMultiplier still applies live.
export const CAR_TYPES = {
  small:  { hp:  2, label: 'Motorbike', minSpawnRow: 0 },
  big:    { hp:  3, label: 'Car',       minSpawnRow: 0 },
  jeep:   { hp:  4, label: 'Van',       minSpawnRow: 1 },
  truck:  { hp:  5, label: 'Truck',     minSpawnRow: 2 },
  bigrig: { hp:  7, label: 'Big Rig',   minSpawnRow: 3 },
  tank:   { hp: 12, label: 'Tank',      minSpawnRow: 4 },
};

// ── Level-band weight tables ───────────────────────────────────────────────────
// Each band unlocks additional types.  Phase still skews the distribution
// within the allowed set so early phases stay light regardless of level.

// L1: FTUE intro — bikes only.  One car type = zero color confusion on first play.
const WEIGHTS_L1 = {
  CALM:     [{ value: 'small', weight: 1 }],
  BUILD:    [{ value: 'small', weight: 1 }],
  PRESSURE: [{ value: 'small', weight: 1 }],
  CLIMAX:   [{ value: 'small', weight: 1 }],
  RELIEF:   [{ value: 'small', weight: 1 }],
};

// L2–4: FTUE — small + big only.  Sedan introduced at L2.
const WEIGHTS_FTUE = {
  CALM:     [{ value: 'small', weight: 60 }, { value: 'big', weight: 40 }],
  BUILD:    [{ value: 'small', weight: 40 }, { value: 'big', weight: 60 }],
  PRESSURE: [{ value: 'small', weight: 25 }, { value: 'big', weight: 75 }],
  CLIMAX:   [{ value: 'small', weight: 15 }, { value: 'big', weight: 85 }],
  RELIEF:   [{ value: 'small', weight: 55 }, { value: 'big', weight: 45 }],
};

// L5–8: jeep unlocked.  Players now have a full color palette starting in L8.
const WEIGHTS_MID = {
  CALM:     [{ value: 'small', weight: 45 }, { value: 'big', weight: 40 }, { value: 'jeep', weight: 15 }],
  BUILD:    [{ value: 'small', weight: 25 }, { value: 'big', weight: 45 }, { value: 'jeep', weight: 30 }],
  PRESSURE: [{ value: 'big',  weight: 30 }, { value: 'jeep', weight: 55 }, { value: 'small', weight: 15 }],
  CLIMAX:   [{ value: 'big',  weight: 20 }, { value: 'jeep', weight: 80 }],
  RELIEF:   [{ value: 'small', weight: 45 }, { value: 'big', weight: 40 }, { value: 'jeep', weight: 15 }],
};

// L6–L8: truck pulled forward from L9 (2026-08-01, LEVER B).
//
// WHY: on small/big/jeep alone the pilot's car HP is 2/3/4 at hpMultiplier 0.70,
// against a bomb-damage pool of 2-8. 94% of matched shots one-shot, so the number
// on the bomb is decorative — the user's "no connection between bomb power and car
// HP". Narrowing the damage range (LEVER A) does not fix it: survival is governed
// by the pool's LOW end, and clamping the top to 2-5/2-4 leaves the one-shot rate
// at 94.1% unchanged. Truck (base 7 -> 5 HP here) is the first type that a large
// share of the pool CANNOT one-shot, which is what makes HP visible.
//
// THE OTHER LEVER WAS MEASURED AND REJECTED. Narrowing the bomb-damage range was
// tried first (a per-level clamp on all four damage sources) and is NOT here
// because it does not work in band:
//   2-5  -> survival UNCHANGED at 9.0%. Truck is 5 HP, and clamping the top to 5
//           still lets a 5 one-shot it. Survival is set by the pool's LOW end.
//   2-4  -> survival 14.8%, but L4 (96.2) and L8 (84.6) both leave the 85-95 band,
//           and it deletes the 5-8 bombs entirely, which makes the bomb NUMBERS
//           less varied — working against the very legibility it was meant to add.
//   1-3  -> survival 39.9%, win rates collapse to 63-79%. Nowhere near band.
// Truck is the cheaper lever: it costs no retune at all.
//
// Truck share here is ~19% of spawns (heavier than the first variant tried, which
// gave only ~10% and moved survival 6.0% -> 8.9%). At 19% survival is 12.2% and
// every level stays in band unretuned. Still gentler than WEIGHTS_HARD's L9 mix
// (truck 5/15/55) — truck leads the back half here, it does not own the level.
//
// PROGRESSION NOTE: truck's intro card now fires at L6 instead of L9. Cards are
// driven by the level's actual car types, so this works with no special handling,
// but WEIGHTS_HARD's "clean truck introduction" comment now describes L6, not L9.
//
// HONEST LIMIT: this does NOT fully solve "no connection between bomb power and
// car HP". It moves the one-shot rate 94.0% -> 87.8% on L6-L8. The ceiling for ANY
// in-band configuration measured was ~15% survival, because bomb damage 2-8 against
// car HP 2-5 barely overlaps. Closing it further needs bigrig-weight cars (11 base)
// this early, which is a different design decision.
const WEIGHTS_MID_TRUCK = {
  CALM:     [{ value: 'small', weight: 40 }, { value: 'big', weight: 40 }, { value: 'jeep', weight: 20 }],
  BUILD:    [{ value: 'small', weight: 15 }, { value: 'big', weight: 35 }, { value: 'jeep', weight: 30 }, { value: 'truck', weight: 20 }],
  PRESSURE: [{ value: 'big',   weight: 15 }, { value: 'jeep', weight: 40 }, { value: 'truck', weight: 45 }],
  CLIMAX:   [{ value: 'big',   weight: 10 }, { value: 'jeep', weight: 40 }, { value: 'truck', weight: 50 }],
  RELIEF:   [{ value: 'small', weight: 40 }, { value: 'big', weight: 35 }, { value: 'jeep', weight: 25 }],
};

// L9–12: truck unlocked.  No bigrig yet — clean truck introduction.
const WEIGHTS_HARD = {
  CALM:     [{ value: 'small', weight: 30 }, { value: 'big', weight: 40 }, { value: 'jeep', weight: 25 }, { value: 'truck', weight: 5  }],
  BUILD:    [{ value: 'small', weight: 15 }, { value: 'big', weight: 35 }, { value: 'jeep', weight: 35 }, { value: 'truck', weight: 15 }],
  PRESSURE: [{ value: 'big',  weight: 10 }, { value: 'jeep', weight: 35 }, { value: 'truck', weight: 55 }],
  CLIMAX:   [{ value: 'jeep', weight: 20 }, { value: 'truck', weight: 80 }],
  RELIEF:   [{ value: 'small', weight: 35 }, { value: 'big', weight: 40 }, { value: 'jeep', weight: 20 }, { value: 'truck', weight: 5  }],
};

// L13–14: bigrig unlocked.  No tank yet.
const WEIGHTS_HARD_PLUS = {
  CALM:     [{ value: 'small', weight: 25 }, { value: 'big', weight: 35 }, { value: 'jeep', weight: 25 }, { value: 'truck', weight: 15 }],
  BUILD:    [{ value: 'small', weight: 10 }, { value: 'big', weight: 25 }, { value: 'jeep', weight: 30 }, { value: 'truck', weight: 25 }, { value: 'bigrig', weight: 10 }],
  PRESSURE: [{ value: 'big',  weight: 10 }, { value: 'jeep', weight: 25 }, { value: 'truck', weight: 40 }, { value: 'bigrig', weight: 25 }],
  CLIMAX:   [{ value: 'jeep', weight: 10 }, { value: 'truck', weight: 40 }, { value: 'bigrig', weight: 50 }],
  RELIEF:   [{ value: 'small', weight: 30 }, { value: 'big', weight: 40 }, { value: 'jeep', weight: 20 }, { value: 'truck', weight: 10 }],
};

// L17 BigRig-heavy, no tank. BigRigs reward sustained accuracy — multiple hits
// prompts organic color-bomb discovery.
const WEIGHTS_L17_BIGRIG = {
  CALM:     [{ value: 'small', weight: 20 }, { value: 'big', weight: 30 }, { value: 'jeep', weight: 25 }, { value: 'bigrig', weight: 25 }],
  BUILD:    [{ value: 'small', weight: 5  }, { value: 'big', weight: 20 }, { value: 'jeep', weight: 25 }, { value: 'bigrig', weight: 50 }],
  PRESSURE: [{ value: 'big',  weight: 10 }, { value: 'jeep', weight: 20 }, { value: 'truck', weight: 20 }, { value: 'bigrig', weight: 50 }],
  CLIMAX:   [{ value: 'jeep', weight: 10 }, { value: 'truck', weight: 20 }, { value: 'bigrig', weight: 70 }],
  RELIEF:   [{ value: 'small', weight: 30 }, { value: 'big', weight: 40 }, { value: 'jeep', weight: 20 }, { value: 'bigrig', weight: 10 }],
};

// L30 boss "Industrial Finale" (WS3 §3c, INFRA-B): tank-heavy — ≈40% tanks across
// the level (VISION rule 5: the designed challenge is planning multi-shot sequences
// under weight). Remainder bigrig/truck/jeep keeps the board genuinely heavy.
// bigrig stays in EVERY phase (the level has a destroyType:bigrig goal — audit-gated).
const WEIGHTS_L30_TANK = {
  CALM:     [{ value: 'jeep', weight: 20 }, { value: 'truck', weight: 30 }, { value: 'bigrig', weight: 25 }, { value: 'tank', weight: 25 }],
  BUILD:    [{ value: 'jeep', weight: 15 }, { value: 'truck', weight: 20 }, { value: 'bigrig', weight: 25 }, { value: 'tank', weight: 40 }],
  PRESSURE: [{ value: 'jeep', weight: 10 }, { value: 'truck', weight: 20 }, { value: 'bigrig', weight: 25 }, { value: 'tank', weight: 45 }],
  CLIMAX:   [{ value: 'truck', weight: 20 }, { value: 'bigrig', weight: 30 }, { value: 'tank', weight: 50 }],
  RELIEF:   [{ value: 'jeep', weight: 25 }, { value: 'truck', weight: 30 }, { value: 'bigrig', weight: 20 }, { value: 'tank', weight: 25 }],
};

// L15+: all types including tank.  FR-4 still caps tank HP if max damage < 8.
const WEIGHTS_FULL = {
  CALM:     [{ value: 'small', weight: 25 }, { value: 'big', weight: 35 }, { value: 'jeep', weight: 25 }, { value: 'truck', weight: 15 }],
  BUILD:    [{ value: 'small', weight: 10 }, { value: 'big', weight: 20 }, { value: 'jeep', weight: 30 }, { value: 'truck', weight: 25 }, { value: 'bigrig', weight: 10 }, { value: 'tank', weight: 5  }],
  PRESSURE: [{ value: 'big',  weight: 5  }, { value: 'jeep', weight: 25 }, { value: 'truck', weight: 35 }, { value: 'bigrig', weight: 20 }, { value: 'tank', weight: 15 }],
  CLIMAX:   [{ value: 'jeep', weight: 5  }, { value: 'truck', weight: 25 }, { value: 'bigrig', weight: 30 }, { value: 'tank', weight: 40 }],
  RELIEF:   [{ value: 'small', weight: 30 }, { value: 'big', weight: 40 }, { value: 'jeep', weight: 20 }, { value: 'truck', weight: 10 }],
};

// RARE-TYPE GOAL LEVELS — L31, L32, L36, L39 (2026-08-08).
//
// These four carry destroyType goals for bigrig or tank. Those types gate on
// minSpawnRow (bigrig 3, tank 4), and pickCarType filters by availableRows — so on
// the 8-row board the L9-L40 conversion introduced, they clear the gate far less
// often than they did at 16 rows. A goal asking for 3 bigrigs on a board that
// rarely spawns one is not "hard", it is a level waiting on the RNG.
//
// bigrig and tank weights x2.5 in the phases that carry them, so the goal stays
// reachable. Applied ONLY to these four levels rather than to WEIGHTS_FULL, which
// L33/34/35/37/38/40 also use and which must keep its existing type mix.
const scaleRare = (phases, k) => Object.fromEntries(
  Object.entries(phases).map(([phase, ws]) => [phase, ws.map((w) =>
    (w.value === 'bigrig' || w.value === 'tank') ? { ...w, weight: Math.round(w.weight * k) } : w)]));
const WEIGHTS_RARE_GOAL = scaleRare(WEIGHTS_FULL, 2.5);
const RARE_GOAL_LEVELS = new Set([15]);   // V2: "Meet the tank" — tanks must actually show up

// Exported for the level-config audit (tests/audit-level-config.test.js), which
// verifies every destroyType goal targets a car type actually spawnable at that level.
export function bandWeights(level) {
  // V2 level table (2026-09-27, see LevelManager). Types arrive: bike L1, car L2,
  // van L5, truck L8, big rig L12, tank L15.
  if (RARE_GOAL_LEVELS.has(level)) return WEIGHTS_RARE_GOAL;
  if (level === 1)  return WEIGHTS_L1;
  if (level <= 4)   return WEIGHTS_FTUE;
  if (level <= 7)   return WEIGHTS_MID;
  if (level <= 11)  return WEIGHTS_MID_TRUCK;   // trucks from L8 ("Heavy load")
  if (level <= 14)  return WEIGHTS_HARD_PLUS;   // big rigs from L12
  if (level === 18) return WEIGHTS_L17_BIGRIG;  // "Big rigs"
  return WEIGHTS_FULL;                          // tank from L15
}

// Difficulty lives in WHICH cars spawn, never in how tough a given type is: a
// Motorbike is 2 HP and a Car is 4 HP on every level. `heft` (0..1, per level)
// tilts the band's weights toward heavier types (1) or lighter ones (0); 0.5 is
// the band table as written. Only tilts among types the band already allows, so
// the manual / intro cards (spawnableTypesFor) are unaffected.
const HEFT_SPREAD = 4;
export function heftWeights(weights, heft) {
  if (heft == null || heft === 0.5) return weights;
  const logs = weights.map(w => Math.log(CAR_TYPES[w.value]?.hp ?? 1));
  const lo = Math.min(...logs), hi = Math.max(...logs);
  if (hi === lo) return weights;
  const s = (Math.max(0, Math.min(1, heft)) - 0.5) * HEFT_SPREAD;
  return weights.map((w, i) => ({ ...w, weight: w.weight * Math.exp(s * ((logs[i] - lo) / (hi - lo) - 0.5)) }));
}

export function pickCarType(rng, level, phase, availableRows, heft) {
  const band = bandWeights(level ?? 1);
  let weights = band[phase] ?? band.BUILD;
  if (availableRows !== undefined) {
    const filtered = weights.filter(w => (CAR_TYPES[w.value]?.minSpawnRow ?? 0) <= availableRows);
    if (filtered.length > 0) weights = filtered;
  }
  return rng.weightedPick(heftWeights(weights, heft));
}

// ── Canonical per-level HP ─────────────────────────────────────────────────────
//
// THE ONE PLACE THAT TURNS A CAR TYPE INTO THE HP IT ACTUALLY SPAWNS WITH.
//
// This formula existed as FOUR independent copies — CarDirector._buildCar,
// GameLoop._primeInitialCars, SimulationRunner's initialCars path, and a
// hand-maintained table in HpGuideOverlay. The overlay's copy is why the car
// manual shipped wrong: its numbers (3/6/8/10/15/30) were CAR_TYPES' real base
// values when it was written (0f4b7fa) and were never updated when the balance
// pass took them to 2/4/5/7/11/20. A comment there said "keep in sync with
// CarTypes.js"; a comment is not a mechanism.
//
// Every caller now routes through this, so the manual cannot disagree with the
// board again. HP_MINIMUM lives in DirectorConfig; importing it here would make
// CarTypes depend on the director config, so it is passed by the single import
// site below instead — no, it is imported: CarTypes is already config-layer.
export function carHpFor(type, hpMultiplier = 1.0) {
  const base = CAR_TYPES[type]?.hp;
  if (base == null) return null;
  return Math.max(HP_MINIMUM, Math.round(base * (hpMultiplier ?? 1.0)));
}

// Which car types can actually appear on a level, so the manual never lists a
// Tank on a level that cannot spawn one.
//
// UNION of three sources, because CarDirector draws from all three:
//   1. the level's band-weight table  (pickCarType)
//   2. spawnScript stage weights      (_pickScriptedType, the §3c bosses) — these
//      do NOT replace the band table: _buildCar picks the scripted type OR falls
//      back to pickCarType, so a stage that yields nothing falls through to the
//      weights and both can appear on the same level
//   3. the scripted opening board     (initialCars)
// then filtered by minSpawnRow against the board depth, which is what pickCarType
// itself filters on.
//
// GameApp._levelCarTypes (the level-start intro cards) delegates here so the
// manual and the intro cards can never disagree about what a level spawns.
export function spawnableTypesFor(level, gridRows = 16, cfg = null) {
  const out  = new Set();
  const fits = (t) => CAR_TYPES[t] && (CAR_TYPES[t].minSpawnRow ?? 0) <= gridRows;

  for (const phase of Object.values(bandWeights(level ?? 1))) {
    for (const w of phase) if (fits(w.value)) out.add(w.value);
  }
  // spawnScript weights are a { type: weight } OBJECT, not [{value,weight}].
  for (const stage of cfg?.spawnScript ?? []) {
    for (const t of Object.keys(stage.weights ?? {})) if (fits(t)) out.add(t);
  }
  for (const car of cfg?.initialCars ?? []) {
    if (car.type && fits(car.type)) out.add(car.type);
  }

  // 4. THE CARRY-OVER BAIT/REWARD PAIR, which is type 'small' on EVERY level and
  //    ignores the weight table completely (CarDirector._buildCarryOverCar, reached
  //    from the per-lane carry-over counter, which is not level-gated). L30's table
  //    is jeep/truck/bigrig/tank with no 'small' at all, yet bikes demonstrably
  //    appear there — so omitting this would grey out Motorbike in the manual on a
  //    level where the player can see one on the road.
  //
  //    Caveat worth knowing: a bait bike carries hp 1-2 regardless of hpMultiplier,
  //    so it can have LESS hp than the manual's Motorbike row states. That is the
  //    bait mechanic, not a drifted number, and it is not something this function
  //    can express — the manual documents types, and bait cars are a type-'small'
  //    car with off-table hp.
  if (fits('small')) out.add('small');

  return out;
}
