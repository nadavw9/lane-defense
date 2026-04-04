// CarDirector — decides which cars to spawn: their HP, speed, color, and timing.
// Constructor takes the full DirectorConfig and a SeededRandom instance so all
// randomness is deterministic and testable.
import { PHASE_CONFIG, HP_MINIMUM, HP_VARIANCE, HP_BASE } from './DirectorConfig.js';
import { Car } from '../models/Car.js';

// Base HP before world/phase multipliers are applied.
// 11.5 chosen so W1+CALM produces HP ~8, W1+CLIMAX ~14, W5+CLIMAX clamps to 20.
// This keeps the average-play AI win rate in the 75–80% target range when
// carry-over pairs (HP 1–2) are injected every 3–7 normal cars.
const BASE_HP = 11.5;

export class CarDirector {
  constructor(config, rng) {
    this._config = config;
    this._rng    = rng;
    // { laneId → remainingCooldownSeconds }
    this._spawnTimers = {};

    // Carry-over opportunity state, tracked per lane.
    // Every CARRY_OVER_INTERVAL spawns the director injects a bait+reward pair:
    //   bait   — HP 1–2, random color from palette
    //   reward — same color as bait, HP 1–2
    // Total pair HP is 2–4, so dmg≥3 (82% of shots) can chain-kill any pair.
    // The pair is placed every 3–7 normal cars so carry-over opportunities are
    // frequent enough to hit the 15–20% target without dominating the spawn queue.
    this._carryOverCounters   = {}; // { laneId → cars since last pair }
    this._carryOverThresholds = {}; // { laneId → next trigger count }
    this._pendingPairColors   = {}; // { laneId → bait color } when reward car is due
  }

  // Generate a single car for the given lane, phase, and world settings.
  // HP formula: BASE_HP × worldHpMultiplier × phaseHpMultiplier × variance(0.85–1.15)
  // Result is rounded and clamped to [HP_MINIMUM, HP_BASE.max].
  //
  // Carry-over pairs are injected every CARRY_OVER_INTERVAL spawns: a weak bait
  // car (HP 1–2) followed immediately on the next spawn call by a same-color
  // reward car (also HP 1–2).  Total pair HP is 2–4, so any dmg≥3 shot can
  // chain-kill both, creating a reliable carry-over opportunity.
  generateCar(lane, phase, worldConfig, colorPalette) {
    const laneId = lane.id ?? lane;

    // Lazy-init per-lane carry-over counters.
    if (this._carryOverCounters[laneId] === undefined) {
      this._carryOverCounters[laneId]   = 0;
      this._carryOverThresholds[laneId] = this._nextCarryOverThreshold();
    }

    // If the previous car in this lane was a bait, emit the same-color reward car.
    if (this._pendingPairColors[laneId] !== undefined) {
      const color = this._pendingPairColors[laneId];
      delete this._pendingPairColors[laneId];
      return this._buildCarryOverCar(color, worldConfig);
    }

    // Normal spawn: pick color, increment counter.
    const color = this.assignColor(colorPalette, null);
    this._carryOverCounters[laneId]++;

    // Time to start a carry-over pair?
    if (this._carryOverCounters[laneId] >= this._carryOverThresholds[laneId]) {
      this._carryOverCounters[laneId]   = 0;
      this._carryOverThresholds[laneId] = this._nextCarryOverThreshold();
      this._pendingPairColors[laneId]   = color; // next spawn will match
      return this._buildCarryOverCar(color, worldConfig); // bait car
    }

    return this._buildCar(color, phase, worldConfig);
  }

  // Pick a color from colorPalette.
  // colorBudget: array of {value, weight} objects for weighted selection, or null for uniform.
  // Budget entries whose value isn't in colorPalette are ignored.
  assignColor(colorPalette, colorBudget) {
    if (!colorBudget || colorBudget.length === 0) {
      return this._rng.pick(colorPalette);
    }
    const options = colorBudget.filter(o => colorPalette.includes(o.value));
    if (options.length === 0) return this._rng.pick(colorPalette);
    return this._rng.weightedPick(options);
  }

  // Decrement per-lane cooldown timers by deltaTime (seconds).
  // A lane whose timer hasn't been initialised is given a fresh cooldown on first call.
  // Timers floor at 0 — call isReadyToSpawn() to check.
  updateSpawnTimers(lanes, deltaTime, phaseParams) {
    for (const lane of lanes) {
      if (this._spawnTimers[lane.id] === undefined) {
        this._spawnTimers[lane.id] = this._randomCooldown(phaseParams);
      }
      this._spawnTimers[lane.id] = Math.max(0, this._spawnTimers[lane.id] - deltaTime);
    }
  }

  // True when the lane's spawn cooldown has expired.
  isReadyToSpawn(lane) {
    return (this._spawnTimers[lane.id] ?? 0) === 0;
  }

  // Reset a lane's spawn timer to a new random cooldown for the current phase.
  resetSpawnTimer(lane, phaseParams) {
    this._spawnTimers[lane.id] = this._randomCooldown(phaseParams);
  }

  // Return the current remaining cooldown for a lane (useful for testing / UI).
  getSpawnTimer(lane) {
    return this._spawnTimers[lane.id] ?? 0;
  }

  // Generate `count` cars for a lane's spawn queue.
  // Enforces: no more than 2 consecutive cars of the same color.
  // params: { phase, worldConfig, colorPalette, colorBudget? }
  generateBatch(lane, count, params) {
    const { phase, worldConfig, colorPalette, colorBudget = null } = params;
    const cars = [];
    let lastColor = null;
    let run = 0; // length of the current same-color streak

    for (let i = 0; i < count; i++) {
      // When 2 consecutive same-color cars have already been queued, exclude that
      // color to prevent a 3rd.  Only possible if palette has > 1 color.
      let palette = colorPalette;
      let budget  = colorBudget;
      if (run >= 2 && colorPalette.length > 1) {
        palette = colorPalette.filter(c => c !== lastColor);
        budget  = budget ? budget.filter(o => o.value !== lastColor) : null;
      }

      const color = this.assignColor(palette, budget);
      run    = (color === lastColor) ? run + 1 : 1;
      lastColor = color;

      cars.push(this._buildCar(color, phase, worldConfig));
    }

    return cars;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  _buildCar(color, phase, worldConfig) {
    const phaseConfig = PHASE_CONFIG[phase];
    const variance = this._rng.nextFloat(HP_VARIANCE.min, HP_VARIANCE.max);
    const rawHp    = BASE_HP * worldConfig.hpMultiplier * phaseConfig.hpMultiplier * variance;
    const hp       = Math.max(HP_MINIMUM, Math.min(HP_BASE.max, Math.round(rawHp)));

    const speed = worldConfig.speed.base +
      this._rng.nextFloat(-worldConfig.speed.variance, worldConfig.speed.variance);

    return new Car({ color, hp, speed });
  }

  _randomCooldown(phaseParams) {
    const { min, max } = phaseParams.spawnCooldown;
    return this._rng.nextFloat(min, max);
  }

  // Build a carry-over bait or reward car: HP 1–2, world-appropriate speed.
  // HP is deliberately below HP_MINIMUM so that a dmg≥2 shot can chain-kill both
  // (1+2=3, exploitable by any dmg≥3 = 82% of shots), creating reliable carry-over
  // opportunities.  These are special mechanic cars — HP_MIN=4 applies to normal
  // car spawning only.
  _buildCarryOverCar(color, worldConfig) {
    const hp    = this._rng.nextInt(1, 2);
    const speed = worldConfig.speed.base +
      this._rng.nextFloat(-worldConfig.speed.variance, worldConfig.speed.variance);
    return new Car({ color, hp, speed });
  }

  // Returns a random interval (3–7) before the next carry-over pair is injected.
  _nextCarryOverThreshold() {
    return this._rng.nextInt(3, 7);
  }
}
