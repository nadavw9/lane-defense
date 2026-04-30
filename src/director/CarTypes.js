// CarTypes — fixed HP values and 3D geometry scale factors for each car type.
// CarDirector uses pickCarType() to assign a type to each normal car spawn.
// Car3D reads car.type to apply the matching geometry scale and visual variant.

export const CAR_TYPES = {
  small: { hp:  2, scaleX: 0.80, scaleY: 0.80, scaleZ: 0.85, label: 'Compact' },
  big:   { hp:  4, scaleX: 1.00, scaleY: 1.00, scaleZ: 1.00, label: 'Sedan'   },
  jeep:  { hp:  5, scaleX: 1.05, scaleY: 1.10, scaleZ: 1.10, label: 'Jeep'    },
  truck: { hp:  6, scaleX: 1.20, scaleY: 1.10, scaleZ: 1.20, label: 'Truck'   },
  tank:  { hp: 20, scaleX: 1.40, scaleY: 1.20, scaleZ: 1.50, label: 'Tank'    },
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

// L9–12: truck unlocked.  Challenging phase approaching W1 standard.
const WEIGHTS_HARD = {
  CALM:     [{ value: 'small', weight: 30 }, { value: 'big', weight: 40 }, { value: 'jeep', weight: 25 }, { value: 'truck', weight: 5  }],
  BUILD:    [{ value: 'small', weight: 15 }, { value: 'big', weight: 35 }, { value: 'jeep', weight: 35 }, { value: 'truck', weight: 15 }],
  PRESSURE: [{ value: 'big',  weight: 15 }, { value: 'jeep', weight: 40 }, { value: 'truck', weight: 45 }],
  CLIMAX:   [{ value: 'jeep', weight: 25 }, { value: 'truck', weight: 75 }],
  RELIEF:   [{ value: 'small', weight: 35 }, { value: 'big', weight: 40 }, { value: 'jeep', weight: 20 }, { value: 'truck', weight: 5  }],
};

// L13+: all types including tank.  FR-4 still caps tank HP if max damage < 8.
const WEIGHTS_FULL = {
  CALM:     [{ value: 'small', weight: 25 }, { value: 'big', weight: 35 }, { value: 'jeep', weight: 25 }, { value: 'truck', weight: 15 }],
  BUILD:    [{ value: 'small', weight: 10 }, { value: 'big', weight: 25 }, { value: 'jeep', weight: 35 }, { value: 'truck', weight: 25 }, { value: 'tank', weight: 5  }],
  PRESSURE: [{ value: 'big',  weight: 10 }, { value: 'jeep', weight: 30 }, { value: 'truck', weight: 40 }, { value: 'tank', weight: 20 }],
  CLIMAX:   [{ value: 'jeep', weight: 10 }, { value: 'truck', weight: 35 }, { value: 'tank', weight: 55 }],
  RELIEF:   [{ value: 'small', weight: 30 }, { value: 'big', weight: 40 }, { value: 'jeep', weight: 20 }, { value: 'truck', weight: 10 }],
};

function bandWeights(level) {
  if (level <= 4)  return WEIGHTS_FTUE;
  if (level <= 8)  return WEIGHTS_MID;
  if (level <= 12) return WEIGHTS_HARD;
  return WEIGHTS_FULL;
}

export function pickCarType(rng, level, phase) {
  const band    = bandWeights(level ?? 1);
  const weights = band[phase] ?? band.BUILD;
  return rng.weightedPick(weights);
}
