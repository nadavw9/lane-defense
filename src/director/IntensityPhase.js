// IntensityPhase — state machine driving the dramatic arc of a level.
// Phases: CALM → BUILD → PRESSURE → CLIMAX → RELIEF
// Transitions interpolate linearly over PHASE_TRANSITION_DURATION seconds so
// parameters never spike suddenly.
import {
  PHASE_CONFIG,
  PHASE_TRANSITION_DURATION,
  CRISIS,
} from './DirectorConfig.js';

// Proportional share of level duration each phase occupies.
// Chosen to create a smooth intensity curve: slow start, hard middle, graceful end.
// Must sum to exactly 1.0.
const PHASE_PROPORTIONS = [
  { phase: 'CALM',     proportion: 0.15 },
  { phase: 'BUILD',    proportion: 0.22 },
  { phase: 'PRESSURE', proportion: 0.25 },
  { phase: 'CLIMAX',   proportion: 0.18 },
  { phase: 'RELIEF',   proportion: 0.20 },
];

export class IntensityPhase {
  constructor(levelDuration) {
    this._levelDuration = levelDuration;
    this._elapsed = 0;

    // Build an absolute timeline: [{phase, startTime, endTime}, ...]
    this._timeline = [];
    let t = 0;
    for (const { phase, proportion } of PHASE_PROPORTIONS) {
      const duration = levelDuration * proportion;
      this._timeline.push({ phase, startTime: t, endTime: t + duration });
      t += duration;
    }
  }

  // Advance the state machine to the given elapsed time.
  update(elapsedTime) {
    this._elapsed = Math.max(0, Math.min(elapsedTime, this._levelDuration));
  }

  // Returns the name of the current dominant phase ('CALM', 'BUILD', etc.)
  getCurrentPhase() {
    return this._entryAt(this._elapsed).phase;
  }

  // Returns interpolated parameters for the current moment.
  // During the first PHASE_TRANSITION_DURATION seconds of a new phase,
  // numeric params are linearly blended from the previous phase's values.
  // damageSkew (categorical) switches at the transition midpoint.
  // crisisEnabled is true whenever the target phase is in CRISIS.eligiblePhases.
  getParams() {
    const current = this._entryAt(this._elapsed);
    const idx = this._timeline.indexOf(current);
    const timeInPhase = this._elapsed - current.startTime;

    if (idx > 0 && timeInPhase < PHASE_TRANSITION_DURATION) {
      const prev = this._timeline[idx - 1];
      const t = timeInPhase / PHASE_TRANSITION_DURATION; // 0→1 over transition window
      return this._interpolateParams(prev.phase, current.phase, t);
    }

    return this._paramsFor(current.phase);
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  // Return the timeline entry that owns the given time (last entry whose
  // startTime ≤ time — naturally clamps to RELIEF at end of level).
  _entryAt(time) {
    for (let i = this._timeline.length - 1; i >= 0; i--) {
      if (time >= this._timeline[i].startTime) {
        return this._timeline[i];
      }
    }
    return this._timeline[0];
  }

  _paramsFor(phase) {
    const cfg = PHASE_CONFIG[phase];
    return {
      spawnCooldownMultiplier: cfg.spawnMultiplier,
      hpMultiplier:            cfg.hpMultiplier,
      speedMultiplier:         cfg.speedMultiplier,
      damageSkew:              cfg.damageSkew,
      crisisEnabled:           CRISIS.eligiblePhases.includes(phase),
    };
  }

  _interpolateParams(fromPhase, toPhase, t) {
    const from = PHASE_CONFIG[fromPhase];
    const to   = PHASE_CONFIG[toPhase];
    const lerp = (a, b) => a + (b - a) * t;

    return {
      spawnCooldownMultiplier: lerp(from.spawnMultiplier, to.spawnMultiplier),
      hpMultiplier:            lerp(from.hpMultiplier,    to.hpMultiplier),
      speedMultiplier:         lerp(from.speedMultiplier, to.speedMultiplier),
      // Categorical: switch at midpoint of transition
      damageSkew:   t < 0.5 ? from.damageSkew : to.damageSkew,
      crisisEnabled: CRISIS.eligiblePhases.includes(toPhase),
    };
  }
}
