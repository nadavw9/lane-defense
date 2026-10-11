// ShooterDirector — generates shooters for the 4 columns.
// Handles demand-matching (bias toward front-car colors), damage weighting by
// phase difficulty, depth-bait patterns, and the CRISIS assist system.
import { CRISIS } from './DirectorConfig.js';
import { Shooter } from '../models/Shooter.js';

// Shots before an active lane color must be force-inserted into the queue.
const COLOR_WINDOW = 7;

export class ShooterDirector {
  constructor(config, rng, fairnessArbiter) {
    this._config  = config;
    this._rng     = rng;
    this._arbiter = fairnessArbiter;

    // CRISIS assist state
    this._lastCrisisTime = -Infinity;
    this._deployLog      = []; // timestamps of recent player deploys

    // Color availability window — guarantees every active lane color appears
    // within every COLOR_WINDOW-shot rolling window.
    this._colorLastSeen = {};  // { color → shotIndex }
    this._shotCount     = 0;

    // §3c L10 v2 — per-level bomb-SUPPLY color bias (null = off).
    this._colorBias = null;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  // §3c L10 v2 "The Bench Test" — bias the bomb SUPPLY toward one color so the
  // lock lives in the QUEUE, not the board (a 2-color board can't lock: any
  // bomb color almost always has a matching front). weights: { color: weight },
  // e.g. { Blue: 3, Red: 1 } → ~75% Blue rolls. Replaces the demand-match /
  // uniform roll only; the _overdueColor fairness floor and the FairnessArbiter
  // (FR-1 top-row-match, FR-5 two-colors-on-top) still run, so the scarce color
  // is guaranteed to keep appearing — scarcity, never starvation.
  // Wired from the level config (shooterColorWeights) by BOTH GameApp and
  // SimulationRunner — single implementation, parity by construction (same
  // pattern as CarDirector.setSpawnScript).
  setColorBias(weights) {
    const entries = weights
      ? Object.entries(weights).filter(([, w]) => Number.isFinite(w) && w > 0)
      : [];
    this._colorBias = entries.length > 0
      ? entries.map(([value, weight]) => ({ value, weight }))
      : null;
  }

  // Generate one shooter for a column.
  // Color: forced if an active lane color is overdue in the availability window;
  //        else 60% demand-match (stack-weighted) toward front-car colors;
  //        40% uniform from palette.
  // Every bomb is one hit, so a bomb is a colour and nothing else.
  // FairnessArbiter runs after generation and may override color or damage.
  generateShooter(column, gameState, phaseParams) {
    const colId  = this._colId(column);
    const color  = this._overdueColor(gameState) ?? this._biasedColor(gameState) ?? this._demandMatchColor(gameState);
    const shooter = new Shooter({ color, column: colId });
    this._arbiter.checkShooter(shooter, gameState);

    // Track post-arbiter color so the window reflects what was actually delivered.
    this._shotCount++;
    this._colorLastSeen[shooter.color] = this._shotCount;

    return shooter;
  }

  // Record a player shooter deploy so CRISIS eligibility can be evaluated.
  // Call this every time the player drags a shooter into a lane.
  recordDeploy(time) {
    this._deployLog.push(time);
    // Keep only entries within the eligibility window
    this._deployLog = this._deployLog.filter(
      t => time - t <= CRISIS.deployWindowSeconds
    );
  }

  // Attempt to trigger a CRISIS assist.
  // All four conditions must be satisfied:
  //   1. 15 s cooldown has expired
  //   2. Current phase is eligible (PRESSURE / CLIMAX / RELIEF), if phase provided
  //   3. Player deployed ≥ 2 shooters in the last 10 s
  //   4. At least one car is past 70% of the lane
  // Even when all conditions are met, only fires with 70% probability.
  //
  // Returns { shooter, lane } on success, or null.
  // gameState may include `phase` (string) and must include `elapsedTime` (number).
  triggerCrisis(gameState) {
    const now = gameState.elapsedTime ?? 0;

    // 1. Cooldown
    if (now - this._lastCrisisTime < CRISIS.cooldown) return null;

    // 2. Phase eligibility (permissive if phase not provided)
    if (gameState.phase && !CRISIS.eligiblePhases.includes(gameState.phase)) return null;

    // 3. Player activity
    const windowStart  = now - CRISIS.deployWindowSeconds;
    const recentCount  = this._deployLog.filter(t => t >= windowStart).length;
    if (recentCount < CRISIS.requiredDeploysWindow) return null;

    // 4. Dangerous car
    const dangerLane = this._mostDangerousLane(gameState);
    if (!dangerLane) return null;

    // 5. Probability gate (70%)
    if (this._rng.next() >= CRISIS.probability) return null;

    // Generate guaranteed-match shooter
    const frontCar = dangerLane.frontCar();
    const shooter  = new Shooter({ color: frontCar.color, column: 0 });

    this._lastCrisisTime = now;
    this._arbiter.checkShooter(shooter, gameState);

    return { shooter, lane: dangerLane };
  }

  // Fill every column that needsRefill() up to COLUMN_DEPTH.
  fillColumns(columns, gameState, phaseParams) {
    for (const col of columns) {
      while (col.needsRefill()) {
        col.pushBottom(this.generateShooter(col, gameState, phaseParams));
      }
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  _colId(column) {
    return (column !== null && typeof column === 'object') ? column.id : column;
  }

  // Return the most-overdue active lane color if any color has been absent for
  // COLOR_WINDOW shots; null otherwise.  "Active" = any color present in lanes.
  _overdueColor(gameState) {
    const active = new Set();
    for (const lane of gameState.lanes) {
      for (const car of lane.cars) active.add(car.color);
    }
    if (active.size === 0) return null;

    let oldest = null, oldestSeen = this._shotCount;
    for (const color of active) {
      const lastSeen = this._colorLastSeen[color] ?? 0;
      if (this._shotCount - lastSeen >= COLOR_WINDOW && lastSeen < oldestSeen) {
        oldest     = color;
        oldestSeen = lastSeen;
      }
    }
    return oldest;
  }

  // §3c L10 v2: weighted roll from the supply bias, restricted to the level's
  // palette. Returns null when no bias is set (falls through to demand-match).
  // Depth-bait pairs intentionally bypass this — the reward's front-car match
  // is its own designed mechanic.
  _biasedColor(gameState) {
    if (!this._colorBias) return null;
    const inPalette = this._colorBias.filter(e => gameState.colorPalette.includes(e.value));
    if (inPalette.length === 0) return null;
    return this._rng.weightedPick(inPalette);
  }

  // 60% chance to reroll toward a current front-car color; 40% uniform palette.
  // When demand-matching, colors are weighted by their total stack depth across
  // all lanes so a color with more queued cars gets proportionally higher odds.
  _demandMatchColor(gameState) {
    const frontCars = gameState.lanes.map(l => l.frontCar()).filter(Boolean);
    if (frontCars.length > 0 && this._rng.next() < 0.6) {
      const stackCounts = {};
      for (const lane of gameState.lanes) {
        for (const car of lane.cars) {
          stackCounts[car.color] = (stackCounts[car.color] ?? 0) + 1;
        }
      }
      const weighted = frontCars.map(c => ({
        value:  c.color,
        weight: stackCounts[c.color] ?? 1,
      }));
      return this._rng.weightedPick(weighted);
    }
    return this._rng.pick(gameState.colorPalette);
  }

  // Pick a random front-car color, or null if no front cars exist.
  _frontCarColor(gameState) {
    const frontCars = gameState.lanes.map(l => l.frontCar()).filter(Boolean);
    if (frontCars.length === 0) return null;
    return this._rng.pick(frontCars.map(c => c.color));
  }

  // Return the lane whose most-advanced car is furthest down the track
  // and past the CRISIS trigger threshold (≥70%).
  _mostDangerousLane(gameState) {
    let best    = null;
    let bestRatio = CRISIS.triggerDistanceRatio; // minimum to qualify
    for (const lane of gameState.lanes) {
      const car = lane.frontCar();
      if (!car) continue;
      const ratio = car.distanceRatio();
      if (ratio >= bestRatio) {
        bestRatio = ratio;
        best      = lane;
      }
    }
    return best;
  }
}
