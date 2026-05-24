// ShooterDirector — generates shooters for the 4 columns.
// Handles demand-matching (bias toward front-car colors), damage weighting by
// phase difficulty, depth-bait patterns, and the CRISIS assist system.
import {
  DAMAGE_WEIGHTS,
  DEPTH_BAIT,
  CRISIS,
} from './DirectorConfig.js';
import { Shooter } from '../models/Shooter.js';

// Shots before an active lane color must be force-inserted into the queue.
const COLOR_WINDOW = 7;

// Extra weight added to damage values 6-8 based on max car HP on the road.
// Checked in descending HP order; first match wins.
const HP_DAMAGE_BOOST = [
  [10, 12],  // bigrig / tank — strong boost to high-damage values
  [ 7,  6],  // truck — moderate boost
];

export class ShooterDirector {
  constructor(config, rng, fairnessArbiter) {
    this._config  = config;
    this._rng     = rng;
    this._arbiter = fairnessArbiter;

    // Depth-bait tracking per column: how many regular shooters since last bait.
    this._baitCounters = {};  // { colId → count }
    this._nextBaitAt   = {};  // { colId → threshold (3–5) }

    // CRISIS assist state
    this._lastCrisisTime = -Infinity;
    this._deployLog      = []; // timestamps of recent player deploys

    // Color availability window — guarantees every active lane color appears
    // within every COLOR_WINDOW-shot rolling window.
    this._colorLastSeen = {};  // { color → shotIndex }
    this._shotCount     = 0;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  // Generate one shooter for a column.
  // Color: forced if an active lane color is overdue in the availability window;
  //        else 60% demand-match (stack-weighted) toward front-car colors;
  //        40% uniform from palette.
  // Damage: HP-aware pool — scaled by max car HP currently on the road.
  // FairnessArbiter runs after generation and may override color or damage.
  generateShooter(column, gameState, phaseParams) {
    const colId  = this._colId(column);
    const color  = this._overdueColor(gameState) ?? this._demandMatchColor(gameState);
    const damage = this._pickDamageForContext(phaseParams.damageSkew, gameState);
    const shooter = new Shooter({ color, damage, column: colId });
    this._arbiter.checkShooter(shooter, gameState);

    // Track post-arbiter color so the window reflects what was actually delivered.
    this._shotCount++;
    this._colorLastSeen[shooter.color] = this._shotCount;

    return shooter;
  }

  // Create a depth-bait pair:
  //   baitShooter   — weak (damage 2–3), random color, goes in front
  //   rewardShooter — strong (damage 6–8), matches a front-car color, goes behind
  // The caller decides whether to push both to the column (fillColumns does this).
  // FairnessArbiter runs on each shooter.
  createDepthBait(column, gameState) {
    const colId = this._colId(column);

    // Weak bait: visible top, intentionally low-value
    const baitColor  = this._rng.pick(gameState.colorPalette);
    const baitDamage = this._rng.nextInt(2, 3);
    const baitShooter = new Shooter({ color: baitColor, damage: baitDamage, column: colId });
    this._arbiter.checkShooter(baitShooter, gameState);

    // Strong reward: hidden underneath, matches a front car to be tempting
    const rewardColor  = this._frontCarColor(gameState) ?? this._rng.pick(gameState.colorPalette);
    const rewardDamage = this._rng.nextInt(6, 8);
    const rewardShooter = new Shooter({ color: rewardColor, damage: rewardDamage, column: colId });
    this._arbiter.checkShooter(rewardShooter, gameState);

    return { baitShooter, rewardShooter };
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
    const damage   = this._rng.nextInt(CRISIS.minimumDamageOnAssist, 8);
    const shooter  = new Shooter({ color: frontCar.color, damage, column: 0 });

    this._lastCrisisTime = now;
    this._arbiter.checkShooter(shooter, gameState);

    return { shooter, lane: dangerLane };
  }

  // Fill every column that needsRefill() up to COLUMN_DEPTH.
  // Injects a depth-bait pair every DEPTH_BAIT.frequencyRange[0–1] regular shooters.
  fillColumns(columns, gameState, phaseParams) {
    for (const col of columns) {
      if (!col.needsRefill()) continue;

      // Lazy-initialise per-column bait state
      if (this._nextBaitAt[col.id] === undefined) {
        this._nextBaitAt[col.id]   = this._nextBaitThreshold();
        this._baitCounters[col.id] = 0;
      }

      while (col.needsRefill()) {
        if (this._baitCounters[col.id] >= this._nextBaitAt[col.id]) {
          // Inject depth bait
          const { baitShooter, rewardShooter } = this.createDepthBait(col, gameState);
          col.pushBottom(baitShooter);
          if (col.needsRefill()) col.pushBottom(rewardShooter);
          this._baitCounters[col.id] = 0;
          this._nextBaitAt[col.id]   = this._nextBaitThreshold();
        } else {
          const shooter = this.generateShooter(col, gameState, phaseParams);
          col.pushBottom(shooter);
          this._baitCounters[col.id]++;
        }
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

  // Context-aware damage pick:
  //   • bike-only road (max HP ≤ 2): cap pool at values ≤ 4
  //   • heavy car present (max HP ≥ 7): add extra weight to values 6-8
  _pickDamageForContext(skew, gameState) {
    const base  = DAMAGE_WEIGHTS[skew] ?? DAMAGE_WEIGHTS.standard;
    const maxHp = this._maxCarHp(gameState);

    if (maxHp > 0 && maxHp <= 2) {
      const bikePool = base.filter(e => e.value <= 4);
      if (bikePool.length > 0) return this._rng.weightedPick(bikePool);
    }

    let boost = 0;
    for (const [threshold, b] of HP_DAMAGE_BOOST) {
      if (maxHp >= threshold) { boost = b; break; }
    }
    if (boost > 0) {
      const boosted = base.map(e =>
        e.value >= 6 ? { value: e.value, weight: e.weight + boost } : e,
      );
      return this._rng.weightedPick(boosted);
    }

    return this._rng.weightedPick(base);
  }

  _pickDamage(skew) {
    const pool = DAMAGE_WEIGHTS[skew] ?? DAMAGE_WEIGHTS.standard;
    return this._rng.weightedPick(pool);
  }

  // Maximum HP of any car currently on the road across all lanes.
  _maxCarHp(gameState) {
    let max = 0;
    for (const lane of gameState.lanes) {
      for (const car of lane.cars) {
        if (car.hp > max) max = car.hp;
      }
    }
    return max;
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

  _nextBaitThreshold() {
    return this._rng.nextInt(DEPTH_BAIT.frequencyRange[0], DEPTH_BAIT.frequencyRange[1]);
  }
}
