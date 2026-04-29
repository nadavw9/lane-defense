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

// Phase-weighted type distribution.
// CALM/RELIEF: lightweight vehicles.  PRESSURE/CLIMAX: heavy vehicles.
// Level-based refinement (e.g., gating tanks to high levels) is added in Issue G.
const PHASE_WEIGHTS = {
  CALM:     [{ value: 'small', weight: 50 }, { value: 'big', weight: 40 }, { value: 'jeep', weight: 10 }],
  BUILD:    [{ value: 'small', weight: 25 }, { value: 'big', weight: 40 }, { value: 'jeep', weight: 25 }, { value: 'truck', weight: 10 }],
  PRESSURE: [{ value: 'big',  weight: 20 }, { value: 'jeep', weight: 35 }, { value: 'truck', weight: 35 }, { value: 'tank', weight: 10 }],
  CLIMAX:   [{ value: 'jeep', weight: 15 }, { value: 'truck', weight: 35 }, { value: 'tank',  weight: 50 }],
  RELIEF:   [{ value: 'small', weight: 40 }, { value: 'big', weight: 45 }, { value: 'jeep', weight: 15 }],
};

export function pickCarType(rng, phase) {
  const weights = PHASE_WEIGHTS[phase] ?? PHASE_WEIGHTS.BUILD;
  return rng.weightedPick(weights);
}
