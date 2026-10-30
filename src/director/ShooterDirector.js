// ShooterDirector — generates shooters for the 4 columns.
// Handles demand-matching (bias toward front-car colors), damage weighting by
// phase difficulty and depth-bait patterns.
import { Shooter } from '../models/Shooter.js';

// Shots before an active lane color must be force-inserted into the queue.
const COLOR_WINDOW = 7;

export class ShooterDirector {
  constructor(config, rng, fairnessArbiter) {
    this._config  = config;
    this._rng     = rng;
    this._arbiter = fairnessArbiter;

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
}
