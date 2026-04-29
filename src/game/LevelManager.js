// LevelManager — FTUE level progression and per-level config.
//
// Progression:
//   L1  → 1 lane, 1 col, Red only              — "learn to shoot"
//   L2  → 2 lanes, 2 cols, Red+Blue            — "learn color matching"
//   L3  → 3 lanes, 3 cols, Red+Blue            — "third lane, same colors"
//   L4  → 4 lanes, 4 cols, Red+Blue            — full board, still very easy
//   L5  → full board, slightly harder           — combo introduced
//   L6–L7  → gradual ramp; BENCH unlocks at L6
//   L8  → Green unlocked; SWAP booster unlocks
//   L9–L10 → approaching W1 standard
//   L11 → full W1; PEEK booster unlocks at L12
//   L13 → hard level
//   L14 → FREEZE booster unlocks (2 free charges granted)
//   L16 → rush-hour special (fast spawn, low HP)
//   L18 → hard level
//   L20 → 3-lane special, Yellow unlocked
//
// Feature unlock thresholds (based on level being played):
//   bench  visible from L6+
//   swap   visible from L8+
//   peek   visible from L12+
//   freeze visible from L14+
import { WORLD_CONFIG } from '../director/DirectorConfig.js';

// ── Per-level world configs (HP multiplier + car speed) ───────────────────────
const FTUE_WORLD_1 = { hpMultiplier: 0.50, speed: { base: 3.0, variance: 0.0 } };
const FTUE_WORLD_2 = { hpMultiplier: 0.55, speed: { base: 3.5, variance: 0.2 } };

const EARLY_3  = { hpMultiplier: 0.50, speed: { base: 3.0, variance: 0.2 } };
const EARLY_4  = { hpMultiplier: 0.60, speed: { base: 3.5, variance: 0.3 } };
const EARLY_5  = { hpMultiplier: 0.65, speed: { base: 3.5, variance: 0.3 } };
const EARLY_6  = { hpMultiplier: 0.70, speed: { base: 3.8, variance: 0.4 } };
const EARLY_7  = { hpMultiplier: 0.80, speed: { base: 4.2, variance: 0.4 } };
const EARLY_8  = { hpMultiplier: 0.85, speed: { base: 4.5, variance: 0.4 } };
const EARLY_9  = { hpMultiplier: 0.90, speed: { base: 4.8, variance: 0.5 } };
const EARLY_10 = { hpMultiplier: 0.95, speed: { base: 5.0, variance: 0.5 } };

const HARD = { hpMultiplier: 1.10, speed: { base: 5.2, variance: 0.5 } };
const RUSH = { hpMultiplier: 0.60, speed: { base: 5.0, variance: 0.5 } };

// ── Level progression ─────────────────────────────────────────────────────────

const PROGRESSION = [
  // ── FTUE: near-impossible to lose — learn the controls ────────────────────
  { id: 1,  laneCount: 1, colCount: 1, colors: ['Red'],           worldConfig: FTUE_WORLD_1, duration:  60, targetKills: 5, showArrow: true,  hintText: 'Drag the matching shooter to the lane', initialCars: [{ row: 4, type: 'small' }, { row: 2, type: 'small' }, { row: 0, type: 'small' }] },
  { id: 2,  laneCount: 2, colCount: 2, colors: ['Red', 'Blue'],   worldConfig: FTUE_WORLD_2, duration:  70, showArrow: false, hintText: 'Color must match! Wrong color = no damage' },
  { id: 3,  laneCount: 3, colCount: 3, colors: ['Red', 'Blue'],   worldConfig: EARLY_3,      duration:  90, showArrow: false, hintText: null, showAreaLabels: true },
  { id: 4,  laneCount: 4, colCount: 4, colors: ['Red', 'Blue'],   worldConfig: EARLY_4,      duration:  90, showArrow: false, hintText: null },

  // ── Early full board: forgiving, still learning ────────────────────────────
  { id: 5,  laneCount: 4, colCount: 4, colors: ['Red', 'Blue'],                worldConfig: EARLY_5,         duration: 100, showArrow: false, hintText: null },

  // ── L6: bench unlocks ─────────────────────────────────────────────────────
  { id: 6,  laneCount: 4, colCount: 4, colors: ['Red', 'Blue'],                worldConfig: EARLY_6,         duration: 100, showArrow: false, hintText: 'NEW! Bench — store unwanted shooters for later' },
  { id: 7,  laneCount: 4, colCount: 4, colors: ['Red', 'Blue'],                worldConfig: EARLY_7,         duration: 100, showArrow: false, hintText: null },

  // ── L8: Green unlocked; SWAP booster unlocks ──────────────────────────────
  { id: 8,  laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],       worldConfig: EARLY_8,         duration: 100, showArrow: false, hintText: 'NEW! Green shooters + SWAP booster to exchange column colors' },
  { id: 9,  laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],       worldConfig: EARLY_9,         duration: 100, showArrow: false, hintText: null },
  { id: 10, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],       worldConfig: EARLY_10,        duration: 100, showArrow: false, hintText: null },

  // ── W1 standard ───────────────────────────────────────────────────────────
  { id: 11, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],       worldConfig: WORLD_CONFIG[1], duration: 100, showArrow: false, hintText: null },

  // ── L12: PEEK booster unlocks ─────────────────────────────────────────────
  { id: 12, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],       worldConfig: WORLD_CONFIG[1], duration: 100, showArrow: false, hintText: 'NEW! PEEK booster — reveal upcoming shooter colors' },
  { id: 13, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],       worldConfig: HARD,            duration:  90, showArrow: false, hintText: null }, // hard level

  // ── L14: FREEZE booster unlocks (2 free charges granted) ─────────────────
  { id: 14, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],       worldConfig: WORLD_CONFIG[1], duration: 100, showArrow: false, hintText: 'NEW! FREEZE booster — stop all cars for 10 seconds! (2 free)' },
  { id: 15, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],       worldConfig: WORLD_CONFIG[1], duration: 100, showArrow: false, hintText: null },
  { id: 16, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],       worldConfig: RUSH,            duration:  90, showArrow: false, hintText: null }, // rush hour
  { id: 17, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],       worldConfig: WORLD_CONFIG[1], duration: 100, showArrow: false, hintText: null },
  { id: 18, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],       worldConfig: HARD,            duration:  90, showArrow: false, hintText: null }, // hard level
  { id: 19, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],       worldConfig: WORLD_CONFIG[1], duration: 100, showArrow: false, hintText: null },

  // ── L20: 3-lane special, Yellow unlocked ──────────────────────────────────
  { id: 20, laneCount: 3, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: WORLD_CONFIG[1], duration: 100, showArrow: false, hintText: 'NEW! Yellow shooters unlocked!' },

  // ═══════════════════════════════════════════════════════════════════════════
  // WORLD 2 — Full palette unlocked, escalating difficulty
  // ═══════════════════════════════════════════════════════════════════════════

  // ── W2 intro: reintroduce with Yellow, slightly harder ─────────────────────
  { id: 21, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: { hpMultiplier: 1.0,  speed: { base: 5.0, variance: 0.5 } }, duration: 100, hintText: 'Welcome to World 2!' },
  { id: 22, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: { hpMultiplier: 1.05, speed: { base: 5.2, variance: 0.5 } }, duration: 100, hintText: null },
  { id: 23, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: { hpMultiplier: 1.1,  speed: { base: 5.4, variance: 0.5 } }, duration:  95, hintText: null },

  // ── L24: Purple unlocked ──────────────────────────────────────────────────
  { id: 24, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple'], worldConfig: { hpMultiplier: 1.0,  speed: { base: 5.2, variance: 0.5 } }, duration: 100, hintText: 'NEW! Purple shooters!' },
  { id: 25, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple'], worldConfig: { hpMultiplier: 1.1,  speed: { base: 5.4, variance: 0.5 } }, duration:  95, hintText: null },
  { id: 26, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple'], worldConfig: { hpMultiplier: 1.15, speed: { base: 5.5, variance: 0.6 } }, duration:  90, hintText: null }, // hard
  { id: 27, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple'], worldConfig: { hpMultiplier: 0.70, speed: { base: 5.5, variance: 0.6 } }, duration:  90, hintText: null }, // rush
  { id: 28, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple'], worldConfig: { hpMultiplier: 1.2,  speed: { base: 5.6, variance: 0.6 } }, duration:  90, hintText: null },
  { id: 29, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple'], worldConfig: { hpMultiplier: 1.2,  speed: { base: 5.8, variance: 0.6 } }, duration:  90, hintText: null },

  // ── L30: Orange unlocked — full 6-color palette ────────────────────────────
  { id: 30, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'], worldConfig: { hpMultiplier: 1.1,  speed: { base: 5.5, variance: 0.6 } }, duration: 100, hintText: 'NEW! Orange unlocked — all 6 colors!' },
  { id: 31, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'], worldConfig: { hpMultiplier: 1.15, speed: { base: 5.6, variance: 0.6 } }, duration:  95, hintText: null },
  { id: 32, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'], worldConfig: { hpMultiplier: 1.2,  speed: { base: 5.8, variance: 0.7 } }, duration:  90, hintText: null },
  { id: 33, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'], worldConfig: { hpMultiplier: 0.70, speed: { base: 6.0, variance: 0.7 } }, duration:  85, hintText: null }, // rush
  { id: 34, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'], worldConfig: { hpMultiplier: 1.25, speed: { base: 6.0, variance: 0.7 } }, duration:  90, hintText: null }, // hard
  { id: 35, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'], worldConfig: { hpMultiplier: 1.25, speed: { base: 6.2, variance: 0.7 } }, duration:  90, hintText: null },
  { id: 36, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'], worldConfig: { hpMultiplier: 1.3,  speed: { base: 6.2, variance: 0.8 } }, duration:  85, hintText: null },
  { id: 37, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'], worldConfig: { hpMultiplier: 0.75, speed: { base: 6.5, variance: 0.8 } }, duration:  80, hintText: null }, // sprint rush
  { id: 38, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'], worldConfig: { hpMultiplier: 1.35, speed: { base: 6.5, variance: 0.8 } }, duration:  85, hintText: null }, // hard
  { id: 39, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'], worldConfig: { hpMultiplier: 1.35, speed: { base: 6.8, variance: 0.8 } }, duration:  85, hintText: null },

  // ── L40: 3-lane grandmaster finale ────────────────────────────────────────
  { id: 40, laneCount: 3, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'], worldConfig: { hpMultiplier: 1.5, speed: { base: 7.0, variance: 0.8 } }, duration: 120, hintText: 'GRANDMASTER FINALE — good luck!' },
];

export class LevelManager {
  constructor() {
    this._idx       = 0;
    this._autoTuner = null;
  }

  // Wire up AutoTuner so difficulty modifiers are applied to level configs.
  // Call once on app startup, before the first level is started.
  setAutoTuner(autoTuner) {
    this._autoTuner = autoTuner;
  }

  // The current level config object, with AutoTuner modifiers applied if any.
  get current() {
    const cfg = PROGRESSION[this._idx];
    if (!this._autoTuner) return cfg;

    const mod = this._autoTuner.getModifier(cfg.id);
    // Only copy when a modifier is actually non-trivial, to avoid churn.
    if (mod.speedFactor === 1.0 && mod.hpFactor === 1.0) return cfg;

    return {
      ...cfg,
      worldConfig: {
        hpMultiplier: cfg.worldConfig.hpMultiplier * mod.hpFactor,
        speed: {
          base:     cfg.worldConfig.speed.base     * mod.speedFactor,
          variance: cfg.worldConfig.speed.variance,
        },
      },
    };
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

  // Jump directly to a level by id (1-40).  No-op for unknown ids.
  goToLevel(id) {
    const idx = PROGRESSION.findIndex(cfg => cfg.id === id);
    if (idx >= 0) this._idx = idx;
  }

  // True once we've reached the last level.
  get isFinalLevel() {
    return this._idx === PROGRESSION.length - 1;
  }

  // World number for the current level (1 = L1-20, 2 = L21-40).
  get world() { return this.current.id <= 20 ? 1 : 2; }

  // Total number of levels.
  get totalLevels() { return PROGRESSION.length; }

  // Returns all level configs for a given world number.
  getLevelsForWorld(worldNum) {
    const start = (worldNum - 1) * 20 + 1;
    const end   = worldNum * 20;
    return PROGRESSION.filter(cfg => cfg.id >= start && cfg.id <= end);
  }

  /**
   * Generate an escalating config for Survival mode.
   * Each wave is 30s. Difficulty increases every wave.
   * @param {number} wave — starting from 1
   */
  static getSurvivalConfig(wave) {
    const speed   = Math.min(9.5, 4.0 + wave * 0.28);
    const hp      = Math.min(2.0, 0.65 + wave * 0.04);
    const colors  = wave < 4  ? ['Red', 'Blue']
                  : wave < 8  ? ['Red', 'Blue', 'Green']
                  : wave < 12 ? ['Red', 'Blue', 'Green', 'Yellow']
                  : wave < 16 ? ['Red', 'Blue', 'Green', 'Yellow', 'Purple']
                  :              ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'];
    return {
      id:          `survival_w${wave}`,
      isSurvival:  true,
      wave,
      laneCount:   4,
      colCount:    4,
      colors,
      worldConfig: { hpMultiplier: hp, speed: { base: speed, variance: 0.6 } },
      duration:    30,   // 30s per wave
      noRescue:    true,
    };
  }
}
