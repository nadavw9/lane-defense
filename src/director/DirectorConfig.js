// DirectorConfig — static configuration data for the director system.
// All numbers come from GDD_v1.0 and DirectorSpec_v1.0.
// No runtime logic lives here — only data that other modules read.

// ─── Color Palette ───────────────────────────────────────────────────────────

export const COLORS = ['Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Purple'];

// Colors available from the start; others unlock by cumulative level number.
export const COLOR_UNLOCK_SCHEDULE = {
  Red:    1,   // starter
  Blue:   1,   // starter
  Green:  8,
  Yellow: 20,
  Orange: 30,
  Purple: null, // not scheduled in v1 worlds
};

// ─── Shooter Damage ──────────────────────────────────────────────────────────

// Valid damage values and their fire durations (seconds), per spec table.
export const FIRE_DURATION_BY_DAMAGE = {
  2: 1.5,
  3: 1.7,
  4: 1.9,
  5: 2.0,
  6: 2.2,
  7: 2.3,
  8: 2.5,
};

// Weighted damage pools for each difficulty mode.
// Higher weight = proportionally more likely to be picked.
// Target: 5-8 = 60% of spawns, 2-4 = 40% across standard/easy pools.
export const DAMAGE_WEIGHTS = {
  standard: [
    { value: 2, weight: 5  },
    { value: 3, weight: 15 },
    { value: 4, weight: 20 },
    { value: 5, weight: 28 },
    { value: 6, weight: 18 },
    { value: 7, weight: 10 },
    { value: 8, weight: 4  },
  ],
  hard: [
    { value: 2, weight: 25 },
    { value: 3, weight: 30 },
    { value: 4, weight: 25 },
    { value: 5, weight: 12 },
    { value: 6, weight: 5  },
    { value: 7, weight: 2  },
    { value: 8, weight: 1  },
  ],
  easy: [
    { value: 2, weight: 2 },
    { value: 3, weight: 5 },
    { value: 4, weight: 15 },
    { value: 5, weight: 28 },
    { value: 6, weight: 28 },
    { value: 7, weight: 15 },
    { value: 8, weight: 7 },
  ],
};

// ─── Intensity Phases ────────────────────────────────────────────────────────

// State machine order: CALM → BUILD → PRESSURE → CLIMAX → RELIEF
export const PHASES = ['CALM', 'BUILD', 'PRESSURE', 'CLIMAX', 'RELIEF'];

export const PHASE_CONFIG = {
  CALM: {
    spawnCooldown: { min: 3.5, max: 5.0, average: 4.2 },
    spawnMultiplier: 1.4,       // relative to BUILD baseline
    hpMultiplier:   0.7,
    speedMultiplier: 0.85,
    damageSkew: 'easy',
  },
  BUILD: {
    spawnCooldown: { min: 2.5, max: 3.5, average: 3.0 },
    spawnMultiplier: 1.0,       // baseline
    hpMultiplier:   0.85,
    speedMultiplier: 1.0,
    damageSkew: 'standard',
  },
  PRESSURE: {
    spawnCooldown: { min: 1.8, max: 2.5, average: 2.1 },
    spawnMultiplier: 0.75,
    hpMultiplier:   1.0,
    speedMultiplier: 1.1,
    damageSkew: 'standard',
  },
  CLIMAX: {
    spawnCooldown: { min: 1.2, max: 1.8, average: 1.5 },
    spawnMultiplier: 0.55,
    hpMultiplier:   1.2,
    speedMultiplier: 1.2,
    damageSkew: 'hard',
  },
  RELIEF: {
    spawnCooldown: { min: 3.0, max: 4.0, average: 3.5 },
    spawnMultiplier: 1.2,
    hpMultiplier:   0.8,
    speedMultiplier: 0.9,
    damageSkew: 'easy',
  },
};

// Phase transitions interpolate over this many seconds (no sudden spikes).
export const PHASE_TRANSITION_DURATION = 3; // seconds

// ─── World Config ─────────────────────────────────────────────────────────────

export const WORLD_CONFIG = {
  1: { hpMultiplier: 1.00, speed: { base: 5.0, variance: 0.5 } },
  2: { hpMultiplier: 1.15, speed: { base: 6.0, variance: 0.5 } },
  3: { hpMultiplier: 1.3,  speed: { base: 7.0, variance: 0.7 } },
  4: { hpMultiplier: 1.5,  speed: { base: 8.0, variance: 0.8 } },
  5: { hpMultiplier: 1.7,  speed: { base: 9.0, variance: 1.0 } },
};

// ─── Car HP Generation ────────────────────────────────────────────────────────

// HP = base × world_multiplier × phase_multiplier × variance
export const HP_BASE = { min: 4, max: 20 }; // absolute clamp range
export const HP_VARIANCE = { min: 0.85, max: 1.15 };
export const HP_MINIMUM = 4; // never below this regardless of multipliers

// ─── Lane Config ─────────────────────────────────────────────────────────────

export const LANE_COUNT = 4;
export const LANE_LENGTH = 100; // units
export const CAR_GAP = 8;       // minimum units between cars

// Per-lane spawn queue management.
export const SPAWN_QUEUE = {
  capacity: { min: 8, max: 12 },
  refillThreshold: 4,   // refill when queue drops below this
  batchSize: { min: 4, max: 6 },
};

// ─── Lane Personalities (unlock by world) ────────────────────────────────────

export const LANE_PERSONALITIES = {
  standard: { speedMultiplier: 1.0, hpMultiplier: 1.0, unlocksWorld: 1 },
  express:  { speedMultiplier: 1.3, hpMultiplier: 0.7, unlocksWorld: 2 },
  heavy:    { speedMultiplier: 0.7, hpMultiplier: 1.4, unlocksWorld: 2 },
  convoy:   { spawnPairDelay: 0.5,                      unlocksWorld: 3 },
  vip:      { coinMultiplier: 3,                         unlocksWorld: 4 },
};

// ─── Column / Shooter Config ─────────────────────────────────────────────────

export const COLUMN_COUNT = 4;
export const COLUMN_DEPTH = 6; // shooters per column

// ─── CRISIS Assist ────────────────────────────────────────────────────────────

export const CRISIS = {
  probability: 0.70,
  cooldown: 15,            // seconds
  cooldownSdrLevel3: 10,   // seconds (reduced at SDR level 3)
  triggerDistanceRatio: 0.70, // car must be at ≥70% of lane length
  requiredDeploysWindow: 2,   // player must have deployed ≥2 shooters …
  deployWindowSeconds: 10,    // … within this many seconds
  eligiblePhases: ['PRESSURE', 'CLIMAX', 'RELIEF'],
  // Effect: next top shooter matches most advanced car color; damage ≥ 5
  minimumDamageOnAssist: 5,
};

// ─── Silent Difficulty Reduction (SDR) ───────────────────────────────────────

export const SDR_LEVELS = [
  { failsRequired: 3, hpMultiplier: 0.9, cooldownMultiplier: 1.1, damageBias: 0.10 },
  { failsRequired: 5, hpMultiplier: 0.8, cooldownMultiplier: 1.2, damageBias: 0.20 },
  { failsRequired: 8, hpMultiplier: 0.7, cooldownMultiplier: 1.3, damageBias: 0.30, crisisCooldownOverride: 10 },
];

// ─── Combo System ─────────────────────────────────────────────────────────────

export const COMBO_TIERS = [
  { threshold: 3,  fireSpeedMultiplier: 1.2, coinBonus: 3,  duration: 4 },
  { threshold: 5,  fireSpeedMultiplier: 1.4, coinBonus: 8,  duration: 5 },
  { threshold: 8,  fireSpeedMultiplier: 1.6, coinBonus: 15, duration: 6 },
  { threshold: 12, fireSpeedMultiplier: 2.0, coinBonus: 25, duration: 8 },
];

export const COMBO_WINDOW = 5;       // seconds between kills to maintain combo
export const CARRYOVER_COIN_BONUS = 5; // coins for a carry-over kill

// ─── Deploy Time Dilation ─────────────────────────────────────────────────────

export const DEPLOY_DILATION = {
  speedMultiplier: 0.60, // all cars slow to 60% on deploy
  duration: 0.3,         // seconds
};

// Endpoint mercy: cars slow when approaching the breach.
export const ENDPOINT_SLOWDOWN = {
  triggerDistanceRatio: 0.85, // activates when car is at ≥85% of lane
  speedMultiplier: 0.85,      // 15% reduction
};

// ─── Special Car Types ────────────────────────────────────────────────────────

export const SPECIAL_CARS = {
  shield:      { spawnRateRange: [0.10, 0.15], unlocksWorld: 3 },
  speedBurst:  { spawnRateRange: [0.10, 0.15], unlocksWorld: 3 },
  splitter:    { spawnRateRange: [0.15, 0.20], unlocksWorld: 4 },
  armored:     { spawnRateRange: [0.20, 0.25], unlocksWorld: 5 },
};

export const MAX_SIMULTANEOUS_SPECIAL_CARS = 2;

// ─── Wrong-Color Interference (World 3+) ─────────────────────────────────────

export const WRONG_COLOR_INTERFERENCE = {
  damage: 0,
  slowMultiplier: 0.80, // 20% speed reduction
  slowDuration: 2,      // seconds
  unlocksWorld: 3,
};

// ─── Boss Config ─────────────────────────────────────────────────────────────

export const BOSS = {
  levelDuration: 180,           // seconds
  spawnAtSeconds: 108,          // 60% mark
  hpMultiplier: 5,              // × average world car HP
  speedMultiplier: 0.5,         // base (pre-rage)
  rageSpeedMultiplier: 0.9,
  rageTriggerSeconds: 153,      // 85% of 180s
  colorCycleDuration: 6,        // seconds per color (normal)
  colorCycleRageDuration: 3,    // seconds per color (rage)
  rescueTimeBonus: 15,          // seconds added on rescue
};

// Standard level rescue time bonus.
export const RESCUE_TIME_BONUS = 10; // seconds

// ─── Fairness Rules ───────────────────────────────────────────────────────────
// Thresholds used by FairnessArbiter — kept here for a single source of truth.

export const FAIRNESS = {
  // FR-3: average shooter damage must be ≥ this fraction of average front car HP.
  minDamageToHpRatio: 0.50,
  // FR-4: no car HP may exceed this multiple of the highest available shooter damage.
  maxHpToDamageRatio: 2.50,
  // FR-2: at most this many front cars may share the same color.
  maxSameColorFrontCars: 3,
  // FR-5: minimum distinct colors in the top shooter row.
  minTopShooterColors: 2,
  // Soft rule: at least this fraction of top shooters must be immediately productive.
  minProductiveTopShooters: 2, // out of 4
};

// ─── Depth Bait ───────────────────────────────────────────────────────────────

export const DEPTH_BAIT = {
  // Every Nth-Mth shooter in a column is set as a depth bait (low-value top,
  // high-value second). Randomised within this range.
  frequencyRange: [3, 5],
};

// ─── Special Level Modes ──────────────────────────────────────────────────────

export const SPECIAL_LEVEL_MODES = {
  rushHour: {
    duration: 90,
    spawnMultiplier: 0.5,
    hpMultiplier: 0.6,
  },
  threeLane: {
    activeLanes: 3,
    // FR-2 modified: at most 2 of 3 front cars may share a color.
    maxSameColorFrontCars: 2,
  },
  colorLock: {
    colorCount: 2,
    hpMultiplier: 1.5,
    damageSkew: 'standard',
  },
};

// ─── Simulation Targets ───────────────────────────────────────────────────────
// Used by SimulationRunner to validate director tuning.

export const SIMULATION_TARGETS = {
  winRatePerfectPlay:  { min: 0.95, max: 1.00 },
  winRateAveragePlay:  { min: 0.70, max: 0.80 },
  fairnessViolationRate: 0,          // hard rules: must be 0%
  carryoverRate:       { min: 0.15, max: 0.25 },
  crisisPerLevel:      { min: 1,    max: 3 },
  avgComboLength:      { min: 3,    max: 5 },
};

// ─── Level Content Architecture ───────────────────────────────────────────────

export const LEVEL_ARCHITECTURE = {
  standardPerWorld: 20,
  hardPerWorld: 3,       // 2–3 per world
  bossPerWorld: 1,
  specialPerWorld: 2,
  totalPerWorld: 26,     // approximate
  worldCount: 5,
};
