// SimulationRunner — headless level simulator using discrete row-based movement.
// Ties together all director modules and runs a simulated player to produce
// aggregate stats for tuning the director.
//
// Movement model: discrete rows (0–10, breach at 11+)
// - Each correct-color shot: ALL cars in ALL active lanes advance 1 row
// - Each wrong-color shot: no advance
// - Fresh spawn: row 0
// - Refill: spawn 1 car per advance step per lane (up to laneTargetCarCount, within spawnBudget)
// - Breach: row >= 11 (gridRows = 11, so breach = row > 10)
//
// AI strategy: for each column, fire the top shooter at the most advanced lane
// whose front car matches the shooter's color.  Skill profiles add accuracy
// rolls to model real human behavior.
import { SeededRandom }    from '../utils/SeededRandom.js';
import { FairnessArbiter } from '../director/FairnessArbiter.js';
import { CarDirector }     from '../director/CarDirector.js';
import { ShooterDirector } from '../director/ShooterDirector.js';
import { IntensityPhase }  from '../director/IntensityPhase.js';
import { Lane }            from '../models/Lane.js';
import { Column }          from '../models/Column.js';
import {
  WORLD_CONFIG,
  PHASE_CONFIG,
  RESCUE_TIME_BONUS,
  COMBO_WINDOW,
  DEPLOY_DILATION,
} from '../director/DirectorConfig.js';

const DT = 1 / 60; // seconds per simulation tick (used for fire cooldowns only)

// Simulated-player accuracy and behavior profiles.
// 'optimal' preserves the original perfect-play baseline; all others model
// real human behavior for balance tuning against actual player targets.
// cycleDelay: seconds between column-cycle actions per column.
// Optimal cycles almost instantly (0.1s); real players decide once every few seconds.
// A higher delay means the player sits on a bad color longer → more wasted fire windows.
const SKILL_PROFILES = {
  optimal:  { accuracy: 1.00, useCycle: true,  cycleDelay: 0.10 },
  beginner: { accuracy: 0.60, useCycle: false, cycleDelay: 0    },
  average:  { accuracy: 0.82, useCycle: true,  cycleDelay: 3.0  },
  skilled:  { accuracy: 0.93, useCycle: true,  cycleDelay: 0.75 },
};

// Wraps FairnessArbiter to count the fraction of checks that required a fix.
class CountingArbiter {
  constructor() {
    this._inner = new FairnessArbiter();
    this.overrideCount = 0;
    this.totalCount    = 0;
  }

  checkCar(car, gs) {
    const result = this._inner.checkCar(car, gs);
    this.totalCount++;
    if (result.fixed) this.overrideCount++;
    return result;
  }

  checkShooter(shooter, gs) {
    const result = this._inner.checkShooter(shooter, gs);
    this.totalCount++;
    if (result.fixed) this.overrideCount++;
    return result;
  }
}

export class SimulationRunner {
  // levelConfig: { duration (s), colors (array), world (1–5), worldConfig (optional direct override),
  //               skill ('optimal' | 'beginner' | 'average' | 'skilled'),
  //               levelId (optional) — passed to CarDirector.setLevel() so car-type weights
  //               match the actual level band (bikes-only L1 vs trucks/bigrigs/tanks L15+).
  //               Omit for generic/world-based tests; always supply for per-level balance checks.
  //               laneCount (4 default), laneTargetCarCount (1 default), spawnBudget, gridRows (11 default) }
  // worldConfig takes precedence over world when provided.
  // skill defaults to 'average' — models real human accuracy and cycle behavior.
  constructor(levelConfig = {}) {
    this._cfg = {
      duration:           levelConfig.duration           ?? 90,
      colors:             levelConfig.colors             ?? ['Red', 'Blue'],
      world:              levelConfig.world              ?? 1,
      worldConfig:        levelConfig.worldConfig        ?? null,
      skill:              levelConfig.skill              ?? 'average',
      levelId:            levelConfig.levelId            ?? null,
      laneCount:          levelConfig.laneCount          ?? 4,
      colCount:           levelConfig.colCount           ?? levelConfig.laneCount ?? 4,
      laneTargetCarCount: levelConfig.laneTargetCarCount ?? 1,
      spawnBudget:        levelConfig.spawnBudget        ?? Infinity,
      gridRows:           levelConfig.gridRows           ?? 11,
    };
  }

  // Simulate one complete level deterministically using the given seed.
  // DISCRETE MOVEMENT MODEL: cars advance 1 row per correct-color shot (not per tick).
  // Returns:
  //   won                — true if the level timer expired without a breach
  //   timeElapsed        — seconds survived (or full duration on win)
  //   carsKilled         — total cars destroyed
  //   carryOvers         — kills from carry-over overflow damage
  //   crisisTriggered    — number of CRISIS assists that fired
  //   fairnessOverrides  — number of spawn events where the arbiter had to fix something
  //   totalSpawns        — total cars + shooters checked by the arbiter
  //   maxCombo           — longest consecutive kill streak within COMBO_WINDOW
  //   rescueWouldSave    — true if a 10 s rescue would have covered the remaining time
  runLevel(seed) {
    const { duration, colors, world } = this._cfg;
    const worldConfig = this._cfg.worldConfig ?? WORLD_CONFIG[world];
    const profile     = SKILL_PROFILES[this._cfg.skill] ?? SKILL_PROFILES.average;

    // In discrete model, speed affects fire cadence (faster speed = shorter fire delays).
    // Base speed is typically 3–7; normalize to get a cadence multiplier.
    // Higher speed = lower fire delay multiplier → faster shots.
    const speedBase = worldConfig.speed?.base ?? 5.0;
    const fireDelayMultiplier = 5.0 / speedBase;  // speed 5 → 1.0x delay, speed 10 → 0.5x

    // ── Instantiate subsystems ─────────────────────────────────────────────
    const rng        = new SeededRandom(seed);
    const arbiter    = new CountingArbiter();
    const carDir     = new CarDirector({}, rng);
    if (this._cfg.levelId != null) carDir.setLevel(this._cfg.levelId);
    const shooterDir = new ShooterDirector({}, rng, arbiter);
    const phaseMan   = new IntensityPhase(duration);

    // Respect the level's real lane/column counts so low-lane tutorial levels
    // (L1-3) are simulated faithfully, not always as 4-lane.
    const LANE_N = this._cfg.laneCount;
    const COL_N  = this._cfg.colCount;
    const lanes   = Array.from({ length: LANE_N }, (_, id) => new Lane({ id }));
    const columns = Array.from({ length: COL_N }, (_, id) => new Column({ id }));

    // ── Discrete movement model: cars have integer row (0–gridRows-1, breach at >= gridRows) ──
    // Each correct-color shot advances ALL cars in ALL active lanes by 1 row.
    const BREACH_ROW = this._cfg.gridRows;
    const discreteLanes = Array.from({ length: LANE_N }, (_, id) => ({
      id,
      cars: [],  // Array of { row: number, hp: number, type: string, color: string }
    }));
    let spawnBudgetRemaining = this._cfg.spawnBudget;

    // ── Tracking ───────────────────────────────────────────────────────────
    let carsKilled      = 0;
    let carryOvers      = 0;
    let crisisTriggered = 0;
    let currentCombo    = 0;
    let maxCombo        = 0;
    let lastKillTime    = -Infinity;
    let lostAt          = null;

    // Fidelity instrumentation (per-shot advance invariant). Not used for balance.
    let correctShots    = 0;   // correct-color shots fired
    let totalAdvances   = 0;   // times the grid advanced 1 row
    let maxAdvPerTick   = 0;   // most advances in a single tick (proves multi-shot turns advance per shot)

    // Per-column fire timers: seconds until a column may fire again.
    const fireTimers = Array(COL_N).fill(0);

    // ── Initial state ──────────────────────────────────────────────────────
    // Pre-spawn one car per lane at row 0 so the level starts with active threats.
    for (const lane of discreteLanes) {
      if (spawnBudgetRemaining > 0) {
        const car = carDir.generateCar({ id: lane.id }, 'CALM', worldConfig, colors, this._cfg.gridRows);
        const adjustedHp = Math.max(1, Math.round(car.hp * worldConfig.hpMultiplier));
        lane.cars.push({ row: 0, hp: adjustedHp, type: car.type, color: car.color });
        spawnBudgetRemaining--;
      }
    }

    // Fill all columns before the first tick.
    phaseMan.update(0);
    const initState  = this._buildState(lanes, columns, colors, 0, phaseMan);
    const initParams = phaseMan.getParams();
    shooterDir.fillColumns(columns, initState, initParams);

    // ── Main loop ──────────────────────────────────────────────────────────
    // DISCRETE MODEL: cars advance 1 row per CORRECT-COLOR shot, not per tick.
    // Ticks are only used for fire timers (cool-downs), shooter refill, and cycle delays.
    const totalTicks = Math.ceil(duration * 60);

    for (let tick = 0; tick < totalTicks; tick++) {
      const elapsed = tick * DT;
      phaseMan.update(elapsed);

      const currentPhase = phaseMan.getCurrentPhase();
      const phaseParams  = phaseMan.getParams();
      const phaseCfg     = PHASE_CONFIG[currentPhase];
      const gameState    = this._buildState(lanes, columns, colors, elapsed, phaseMan);

      // 1. Breach check — any car at row >= BREACH_ROW ends the level.
      if (discreteLanes.some(l => l.cars.length > 0 && l.cars[0].row >= BREACH_ROW)) {
        lostAt = elapsed;
        break;
      }

      // 2. Refill shooter columns (does nothing for full columns).
      shooterDir.fillColumns(columns, gameState, phaseParams);

      // 3. AI fires — lane-urgency-first strategy based on row advancement.
      // Fire timers are in seconds; decrement by DT each tick.
      const FP_EPSILON   = 1e-9;

      // Decrement all timers.
      for (let c = 0; c < COL_N; c++) {
        fireTimers[c] = Math.max(0, fireTimers[c] - DT);
        if (fireTimers[c] < FP_EPSILON) fireTimers[c] = 0;
      }

      // Sort lanes by most-advanced car (highest row first).
      const urgentLanes = discreteLanes
        .filter(l => l.cars.length > 0)
        .sort((a, b) => (b.cars[0]?.row ?? -1) - (a.cars[0]?.row ?? -1));

      const usedCols = new Set();
      const advBefore = totalAdvances;   // advances accrued this tick (for the invariant test)

      // Returns true if the simulated player fires the correct color this shot.
      const _isCorrect = () => rng.next() < profile.accuracy;

      // Refill lanes to laneTargetCarCount. Mirrors GameLoop._refillLanes: only
      // 1 car spawns per advance per lane, and only if no car is still in the
      // spawn zone (row < 2), so cars stagger naturally.
      const _refillLanes = () => {
        for (const lane of discreteLanes) {
          if (
            lane.cars.length < this._cfg.laneTargetCarCount &&
            !lane.cars.some(c => c.row < 2) &&
            spawnBudgetRemaining > 0
          ) {
            const car = carDir.generateCar({ id: lane.id }, currentPhase, worldConfig, colors, this._cfg.gridRows);
            const adjustedHp = Math.max(1, Math.round(car.hp * worldConfig.hpMultiplier));
            lane.cars.push({ row: 0, hp: adjustedHp, type: car.type, color: car.color });
            spawnBudgetRemaining--;
          }
        }
      };

      // ONE correct shot → advance ALL cars in ALL lanes by exactly 1 row, then
      // check breach, then refill. Mirrors GameLoop._resolveShot → _advanceGrid,
      // which runs PER SHOT. If 4 lanes fire in a turn, that is 4 advances.
      const _advanceOneRow = () => {
        totalAdvances++;
        for (const lane of discreteLanes) for (const car of lane.cars) car.row++;
        if (discreteLanes.some(l => l.cars.length > 0 && l.cars[0].row >= BREACH_ROW)) {
          lostAt = elapsed;
          return;
        }
        _refillLanes();
      };

      // Fire a shot. A CORRECT shot applies damage then advances the grid by 1
      // row (per-shot). A WRONG shot consumes the bomb but does NOT advance.
      const _fire = (col, lane, isCorrect = true) => {
        if (lostAt !== null) return;
        const s = columns[col].top();
        usedCols.add(col);
        shooterDir.recordDeploy(elapsed);
        fireTimers[col] = s.fireDuration * fireDelayMultiplier;  // speed-based cadence
        columns[col].consume();
        if (!isCorrect) return;   // wrong color = no advance
        correctShots++;

        if (lane.cars.length > 0) {
          const car = lane.cars[0];
          car.hp -= s.damage;
          if (car.hp <= 0) {
            lane.cars.shift();  // remove front car
            carsKilled++;
            currentCombo = (elapsed - lastKillTime <= COMBO_WINDOW)
              ? currentCombo + 1 : 1;
            lastKillTime = elapsed;
            if (currentCombo > maxCombo) maxCombo = currentCombo;
          }
        }
        _advanceOneRow();   // every correct shot advances exactly 1 row
      };

      // Pass A — coverage: one best-match column per lane.
      for (const lane of urgentLanes) {
        if (lostAt !== null) break;
        if (lane.cars.length === 0) continue;
        const car = lane.cars[0];
        let bestCol = -1, bestDmg = -1;
        for (let c = 0; c < COL_N; c++) {
          if (usedCols.has(c) || fireTimers[c] > 0) continue;
          const s = columns[c].top();
          if (s && s.color === car.color && s.damage > bestDmg) {
            bestDmg = s.damage;
            bestCol = c;
          }
        }
        if (bestCol !== -1) _fire(bestCol, lane, _isCorrect());
      }

      // Pass B — focus-fire: pile onto any high-row lane still in danger.
      const CRITICAL_ROW = Math.floor(BREACH_ROW * 0.75);  // 75% of way to breach
      for (const lane of urgentLanes) {
        if (lostAt !== null) break;
        if (lane.cars.length === 0 || lane.cars[0].row < CRITICAL_ROW) continue;
        for (let c = 0; c < COL_N; c++) {
          if (usedCols.has(c) || fireTimers[c] > 0) continue;
          const s = columns[c].top();
          if (s && s.color === lane.cars[0].color) { _fire(c, lane, _isCorrect()); break; }
        }
      }

      // Pass C — cycle: idle columns discard a non-matching top so the column
      // works toward a useful color. cycleDelay models the player's reaction time.
      if (profile.useCycle && lostAt === null) {
        for (let c = 0; c < COL_N; c++) {
          if (usedCols.has(c) || fireTimers[c] > 0) continue;
          if (columns[c].shooters.length > 1) {
            columns[c].consume();
            fireTimers[c] = profile.cycleDelay;
          }
        }
      }

      maxAdvPerTick = Math.max(maxAdvPerTick, totalAdvances - advBefore);
      if (lostAt !== null) break;   // a shot this tick caused a breach

      // 6. Attempt a CRISIS assist when the phase permits it.
      if (phaseParams.crisisEnabled && discreteLanes.some(l => l.cars.length > 0)) {
        // Find the most advanced lane for crisis.
        const crisisLane = discreteLanes.reduce((a, b) =>
          (a.cars[0]?.row ?? -1) > (b.cars[0]?.row ?? -1) ? a : b
        );
        if (crisisLane.cars.length > 0) {
          const car = crisisLane.cars[0];
          car.hp -= 10;  // arbitrary crisis damage
          if (car.hp <= 0) {
            crisisLane.cars.shift();
            carsKilled++;
            crisisTriggered++;
          }
        }
      }
    }

    const won             = lostAt === null;
    const timeElapsed     = won ? duration : lostAt ?? 0;
    const rescueWouldSave = !won && lostAt !== null && lostAt >= duration - RESCUE_TIME_BONUS;

    return {
      won,
      timeElapsed,
      carsKilled,
      carryOvers,
      crisisTriggered,
      fairnessOverrides: arbiter.overrideCount,
      totalSpawns:       arbiter.totalCount,
      maxCombo,
      rescueWouldSave,
      // Fidelity instrumentation — every correct shot advances exactly 1 row.
      correctShots,
      totalAdvances,
      maxAdvPerTick,
    };
  }

  // Run `count` levels starting from startSeed and return aggregate stats.
  runBatch(count, startSeed = 1) {
    let wins            = 0;
    let rescues         = 0;
    let totalKills      = 0;
    let totalCarryOvers = 0;
    let totalCrisis     = 0;
    let totalOverrides  = 0;
    let totalChecks     = 0;

    for (let i = 0; i < count; i++) {
      const r = this.runLevel(startSeed + i);
      if (r.won)             wins++;
      if (r.rescueWouldSave) rescues++;
      totalKills      += r.carsKilled;
      totalCarryOvers += r.carryOvers;
      totalCrisis     += r.crisisTriggered;
      totalOverrides  += r.fairnessOverrides;
      totalChecks     += r.totalSpawns;
    }

    return {
      count,
      winRate:              wins / count,
      avgCarsKilled:        totalKills / count,
      carryOverRate:        totalKills > 0 ? totalCarryOvers / totalKills : 0,
      avgCrisisPerLevel:    totalCrisis / count,
      fairnessOverrideRate: totalChecks > 0 ? totalOverrides / totalChecks : 0,
      // rescueWinRate: fraction of levels that end in a win (including rescued losses)
      rescueWinRate:        (wins + rescues) / count,
    };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  _buildState(lanes, columns, colorPalette, elapsedTime, phaseMan) {
    return {
      lanes,
      columns,
      colorPalette,
      elapsedTime,
      phase: phaseMan.getCurrentPhase(),
    };
  }

  // Apply `damage` to the front car of `lane`; any overflow propagates to the
  // next car (carry-over).  Returns the number of kills and carry-over kills.
  _applyDamage(damage, lane) {
    let kills          = 0;
    let carryOverKills = 0;
    let remaining      = damage;

    while (remaining > 0 && lane.frontCar()) {
      const car = lane.frontCar();
      const hp  = car.hp; // capture before mutation

      car.takeDamage(remaining);

      if (car.isDead()) {
        if (kills > 0) carryOverKills++; // 2nd+ kill in this shot = carry-over
        kills++;
        lane.removeFrontCar();
        remaining = Math.max(0, remaining - hp);
      } else {
        break; // car survived; no overflow
      }
    }

    return { kills, carryOverKills };
  }
}
