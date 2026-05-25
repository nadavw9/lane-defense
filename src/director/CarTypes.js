// CarTypes — HP values for each car type.
// CarDirector uses pickCarType() to assign a type to each normal car spawn.
// Car3D uses TYPE_SCALES (in Car3D.js) for visual sizing; the GLB asset for
// each type is mapped in AssetLoader.CAR_ASSET_MAP:
//   small → bike.glb, big → sedan.glb, jeep → van.glb,
//   truck → truck.glb, bigrig → bigrig.glb, tank → procedural (no GLB)

export const CAR_TYPES = {
  small:  { hp:  2, label: 'Motorbike', minSpawnRow: 0 },
  big:    { hp:  4, label: 'Sedan',     minSpawnRow: 0 },
  jeep:   { hp:  5, label: 'Van',       minSpawnRow: 1 },
  truck:  { hp:  6, label: 'Truck',     minSpawnRow: 2 },
  bigrig: { hp: 10, label: 'Big Rig',   minSpawnRow: 3 },
  tank:   { hp: 20, label: 'Tank',      minSpawnRow: 4 },
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

// L15+: all types including tank.  FR-4 still caps tank HP if max damage < 8.
const WEIGHTS_FULL = {
  CALM:     [{ value: 'small', weight: 25 }, { value: 'big', weight: 35 }, { value: 'jeep', weight: 25 }, { value: 'truck', weight: 15 }],
  BUILD:    [{ value: 'small', weight: 10 }, { value: 'big', weight: 20 }, { value: 'jeep', weight: 30 }, { value: 'truck', weight: 25 }, { value: 'bigrig', weight: 10 }, { value: 'tank', weight: 5  }],
  PRESSURE: [{ value: 'big',  weight: 5  }, { value: 'jeep', weight: 25 }, { value: 'truck', weight: 35 }, { value: 'bigrig', weight: 20 }, { value: 'tank', weight: 15 }],
  CLIMAX:   [{ value: 'jeep', weight: 5  }, { value: 'truck', weight: 25 }, { value: 'bigrig', weight: 30 }, { value: 'tank', weight: 40 }],
  RELIEF:   [{ value: 'small', weight: 30 }, { value: 'big', weight: 40 }, { value: 'jeep', weight: 20 }, { value: 'truck', weight: 10 }],
};

function bandWeights(level) {
  if (level === 1)  return WEIGHTS_L1;
  if (level <= 4)   return WEIGHTS_FTUE;
  if (level <= 8)   return WEIGHTS_MID;
  if (level <= 12)  return WEIGHTS_HARD;
  if (level <= 14)  return WEIGHTS_HARD_PLUS;
  if (level === 17) return WEIGHTS_L17_BIGRIG;
  return WEIGHTS_FULL;
}

export function pickCarType(rng, level, phase, availableRows) {
  const band = bandWeights(level ?? 1);
  let weights = band[phase] ?? band.BUILD;
  if (availableRows !== undefined) {
    const filtered = weights.filter(w => (CAR_TYPES[w.value]?.minSpawnRow ?? 0) <= availableRows);
    if (filtered.length > 0) weights = filtered;
  }
  return rng.weightedPick(weights);
}
