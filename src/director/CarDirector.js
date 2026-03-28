// CarDirector — decides which cars to spawn: their HP, speed, color, and timing.
// Constructor takes the full DirectorConfig and a SeededRandom instance so all
// randomness is deterministic and testable.
import { PHASE_CONFIG, HP_MINIMUM, HP_VARIANCE, HP_BASE } from './DirectorConfig.js';
import { Car } from '../models/Car.js';

// Base HP before world/phase multipliers are applied.
// Chosen so W1+CALM produces values ~5–7 and W5+CLIMAX approaches the 20-unit ceiling.
const BASE_HP = 9;

export class CarDirector {
  constructor(config, rng) {
    this._config = config;
    this._rng    = rng;
    // { laneId → remainingCooldownSeconds }
    this._spawnTimers = {};
  }

  // Generate a single car for the given lane, phase, and world settings.
  // HP formula: BASE_HP × worldHpMultiplier × phaseHpMultiplier × variance(0.85–1.15)
  // Result is rounded and clamped to [HP_MINIMUM, HP_BASE.max].
  generateCar(lane, phase, worldConfig, colorPalette) {
    const color = this.assignColor(colorPalette, null);
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
}
