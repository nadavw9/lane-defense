// CarTypes — HP values for each car type.
// CarDirector uses pickCarType() to assign a type to each normal car spawn.
// Car3D uses TYPE_SCALES (in Car3D.js) for visual sizing; the GLB asset for
// each type is mapped in AssetLoader.CAR_ASSET_MAP:
//   small → bike.glb, big → sedan.glb, jeep → van.glb,
//   truck → truck.glb, bigrig → bigrig.glb, tank → procedural (no GLB)

export const CAR_TYPES = {
  small:  { hp:  2, label: 'Motorbike' },
  big:    { hp:  4, label: 'Sedan'     },
  jeep:   { hp:  5, label: 'Van'       },
  truck:  { hp:  6, label: 'Truck'     },
  bigrig: { hp: 10, label: 'Big Rig'   },
  tank:   { hp: 20, label: 'Tank'      },
};

// ── Level-band weight tables ───────────────────────────────────────────────────
// Each band unlocks additional types.  Phase still skews the distribution
// within the allowed set so early phases stay light regardless of level.

// L1–4: FTUE — small + big only.  Keeps HP predictable while teaching controls.
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

// L15+: all types including tank.  FR-4 still caps tank HP if max damage < 8.
const WEIGHTS_FULL = {
  CALM:     [{ value: 'small', weight: 25 }, { value: 'big', weight: 35 }, { value: 'jeep', weight: 25 }, { value: 'truck', weight: 15 }],
  BUILD:    [{ value: 'small', weight: 10 }, { value: 'big', weight: 20 }, { value: 'jeep', weight: 30 }, { value: 'truck', weight: 25 }, { value: 'bigrig', weight: 10 }, { value: 'tank', weight: 5  }],
  PRESSURE: [{ value: 'big',  weight: 5  }, { value: 'jeep', weight: 25 }, { value: 'truck', weight: 35 }, { value: 'bigrig', weight: 20 }, { value: 'tank', weight: 15 }],
  CLIMAX:   [{ value: 'jeep', weight: 5  }, { value: 'truck', weight: 25 }, { value: 'bigrig', weight: 30 }, { value: 'tank', weight: 40 }],
  RELIEF:   [{ value: 'small', weight: 30 }, { value: 'big', weight: 40 }, { value: 'jeep', weight: 20 }, { value: 'truck', weight: 10 }],
};

function bandWeights(level) {
  if (level <= 4)  return WEIGHTS_FTUE;
  if (level <= 8)  return WEIGHTS_MID;
  if (level <= 12) return WEIGHTS_HARD;
  if (level <= 14) return WEIGHTS_HARD_PLUS;
  return WEIGHTS_FULL;
}

export function pickCarType(rng, level, phase) {
  const band    = bandWeights(level ?? 1);
  const weights = band[phase] ?? band.BUILD;
  return rng.weightedPick(weights);
}
