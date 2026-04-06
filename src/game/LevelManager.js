// LevelManager — FTUE level progression and per-level config.
//
// Progression:
//   L1  → 1 lane, 1 col, Red only              — "learn to shoot"
//   L2  → 2 lanes, 2 cols, Red+Blue            — "learn color matching"
//   L3  → 3 lanes, 3 cols, Red+Blue            — "third lane, same colors"
//   L4  → 4 lanes, 4 cols, Red+Blue            — full board, still very easy
//   L5  → full board, slightly harder           — combo introduced
//   L6–L7  → gradual ramp, still 2 colors
//   L8  → Green unlocked; ramp continues
//   L9–L10 → approaching W1 standard
//   L11–L15 → full W1; L13/L18 are hard levels
//   L16 → rush-hour special (fast spawn, low HP)
//   L17–L19 → W1 standard
//   L20 → 3-lane special, Yellow unlocked
//
// HP target notes:
//   HP formula: BASE_HP(11.5) × hpMultiplier × CALM_phase(0.70) × variance(≈1.0)
//   EARLY_3:   11.5 × 0.50 × 0.70 ≈ 4.0  → clamps to HP_MIN=4   ✓ nearly impossible to lose
//   EARLY_4:   11.5 × 0.60 × 0.70 ≈ 4.8  → ~5 HP                ✓ very forgiving
//   WORLD_CONFIG[1]: 11.5 × 1.00 × 0.70 ≈ 8.0 in CALM            ✓ W1 standard
import { WORLD_CONFIG } from '../director/DirectorConfig.js';

// ── Per-level world configs (HP multiplier + car speed) ───────────────────────
// FTUE worlds: near-zero variance so cars behave predictably for new players.
const FTUE_WORLD_1 = { hpMultiplier: 0.50, speed: { base: 3.0, variance: 0.0 } };
const FTUE_WORLD_2 = { hpMultiplier: 0.55, speed: { base: 3.5, variance: 0.2 } };

// Intermediate ramp: gradually closes the gap to full W1 over levels 3-10.
const EARLY_3  = { hpMultiplier: 0.50, speed: { base: 3.0, variance: 0.2 } };
const EARLY_4  = { hpMultiplier: 0.60, speed: { base: 3.5, variance: 0.3 } };
const EARLY_5  = { hpMultiplier: 0.65, speed: { base: 3.5, variance: 0.3 } };
const EARLY_6  = { hpMultiplier: 0.70, speed: { base: 3.8, variance: 0.4 } };
const EARLY_7  = { hpMultiplier: 0.80, speed: { base: 4.2, variance: 0.4 } };
const EARLY_8  = { hpMultiplier: 0.85, speed: { base: 4.5, variance: 0.4 } };
const EARLY_9  = { hpMultiplier: 0.90, speed: { base: 4.8, variance: 0.5 } };
const EARLY_10 = { hpMultiplier: 0.95, speed: { base: 5.0, variance: 0.5 } };

// Hard levels (L13, L18): 10% more HP and slightly faster than W1 baseline.
const HARD     = { hpMultiplier: 1.10, speed: { base: 5.2, variance: 0.5 } };

// Rush hour (L16): low HP but fast spawn — feels hectic, not punishing.
const RUSH     = { hpMultiplier: 0.60, speed: { base: 5.0, variance: 0.5 } };

// ── Level progression ─────────────────────────────────────────────────────────

const PROGRESSION = [
  // ── FTUE: near-impossible to lose — learn the controls ────────────────────
  { id: 1,  laneCount: 1, colCount: 1, colors: ['Red'],                        worldConfig: FTUE_WORLD_1,    duration:  60, showArrow: true  },
  { id: 2,  laneCount: 2, colCount: 2, colors: ['Red', 'Blue'],                worldConfig: FTUE_WORLD_2,    duration:  70, showArrow: false },
  { id: 3,  laneCount: 3, colCount: 3, colors: ['Red', 'Blue'],                worldConfig: EARLY_3,         duration:  90, showArrow: false },
  { id: 4,  laneCount: 4, colCount: 4, colors: ['Red', 'Blue'],                worldConfig: EARLY_4,         duration:  90, showArrow: false },

  // ── Early full board: forgiving, still learning ────────────────────────────
  { id: 5,  laneCount: 4, colCount: 4, colors: ['Red', 'Blue'],                worldConfig: EARLY_5,         duration: 100, showArrow: false },
  { id: 6,  laneCount: 4, colCount: 4, colors: ['Red', 'Blue'],                worldConfig: EARLY_6,         duration: 100, showArrow: false },
  { id: 7,  laneCount: 4, colCount: 4, colors: ['Red', 'Blue'],                worldConfig: EARLY_7,         duration: 100, showArrow: false },

  // ── Green unlocked at L8; ramp to W1 standard by L11 ──────────────────────
  { id: 8,  laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],       worldConfig: EARLY_8,         duration: 100, showArrow: false },
  { id: 9,  laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],       worldConfig: EARLY_9,         duration: 100, showArrow: false },
  { id: 10, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],       worldConfig: EARLY_10,        duration: 100, showArrow: false },

  // ── W1 standard ───────────────────────────────────────────────────────────
  { id: 11, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],       worldConfig: WORLD_CONFIG[1], duration: 100, showArrow: false },
  { id: 12, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],       worldConfig: WORLD_CONFIG[1], duration: 100, showArrow: false },
  { id: 13, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],       worldConfig: HARD,            duration:  90, showArrow: false }, // hard level
  { id: 14, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],       worldConfig: WORLD_CONFIG[1], duration: 100, showArrow: false },
  { id: 15, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],       worldConfig: WORLD_CONFIG[1], duration: 100, showArrow: false },
  { id: 16, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],       worldConfig: RUSH,            duration:  90, showArrow: false }, // rush hour: low HP, fast spawn
  { id: 17, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],       worldConfig: WORLD_CONFIG[1], duration: 100, showArrow: false },
  { id: 18, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],       worldConfig: HARD,            duration:  90, showArrow: false }, // hard level
  { id: 19, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],       worldConfig: WORLD_CONFIG[1], duration: 100, showArrow: false },

  // ── L20: 3-lane special, Yellow unlocked ──────────────────────────────────
  { id: 20, laneCount: 3, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: WORLD_CONFIG[1], duration: 100, showArrow: false },
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

  // Move to the next entry.  Stays at the last entry once L20 is reached.
  // Returns the new current config.
  advance() {
    if (this._idx < PROGRESSION.length - 1) this._idx++;
    return this.current;
  }

  // Jump directly to a level by id (1-20).  No-op for unknown ids.
  goToLevel(id) {
    const idx = PROGRESSION.findIndex(cfg => cfg.id === id);
    if (idx >= 0) this._idx = idx;
  }

  // True once we've reached the last level.
  get isFinalLevel() {
    return this._idx === PROGRESSION.length - 1;
  }
}
