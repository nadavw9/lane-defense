// LevelManager — FTUE level progression and per-level config.
//
// Progression:
//   L1 → 1 lane, 1 col, Red only   — "learn to shoot"
//   L2 → 2 lanes, 2 cols, Red+Blue — "learn color matching"
//   L4 → full board, full Director  — standard game
//
// After L4 the manager stays there; "Next Level" replays the full-board config
// so the Director-driven game runs indefinitely.
//
// HP target notes (do not need to touch Phase 1 files):
//   HP formula: BASE_HP(11.5) × hpMultiplier × CALM_phase(0.70) × variance(≈1.0)
//   FTUE_W1: 11.5 × 0.50 × 0.70 ≈ 4.0  → clamps to HP_MIN = 4  ✓ spec target
//   FTUE_W2: 11.5 × 0.65 × 0.70 ≈ 5.2  → ~5 HP                 ✓ gentle ramp
import { WORLD_CONFIG } from '../director/DirectorConfig.js';

const FTUE_WORLD_1 = { hpMultiplier: 0.50, speed: { base: 4.0, variance: 0.0 } };
const FTUE_WORLD_2 = { hpMultiplier: 0.65, speed: { base: 4.5, variance: 0.3 } };

const PROGRESSION = [
  {
    id:          1,
    laneCount:   1,
    colCount:    1,
    colors:      ['Red'],
    worldConfig: FTUE_WORLD_1,
    duration:    60,
    showArrow:   true,
  },
  {
    id:          2,
    laneCount:   2,
    colCount:    2,
    colors:      ['Red', 'Blue'],
    worldConfig: FTUE_WORLD_2,
    duration:    70,
    showArrow:   false,
  },
  // Level 3 is intentionally skipped — jump straight to full board.
  {
    id:          4,
    laneCount:   4,
    colCount:    4,
    colors:      ['Red', 'Blue'],
    worldConfig: WORLD_CONFIG[1],
    duration:    90,
    showArrow:   false,
  },
];

export class LevelManager {
  constructor() {
    this._idx = 0;
  }

  // The current level config object.
  get current() {
    return PROGRESSION[this._idx];
  }

  // Display number shown in the HUD / win screen.
  get levelNumber() {
    return this.current.id;
  }

  // Move to the next entry.  At the last entry (full-board) further calls
  // remain there — standard Director game plays indefinitely.
  // Returns the new current config.
  advance() {
    if (this._idx < PROGRESSION.length - 1) this._idx++;
    return this.current;
  }

  // True once we've reached the full-board level and beyond.
  get isFinalLevel() {
    return this._idx === PROGRESSION.length - 1;
  }
}
