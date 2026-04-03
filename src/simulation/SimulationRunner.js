// SimulationRunner — headless level simulator.
// Ties together all director modules and runs a simple AI player to produce
// aggregate stats for tuning the director.
//
// AI strategy: for each column, fire the top shooter at the most advanced lane
// whose front car matches the shooter's color. This models "average play" — the
// player always picks the right color but doesn't plan ahead around depth bait.
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

const DT = 1 / 60; // seconds per simulation tick

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
  // levelConfig: { duration (s), colors (array), world (1–5), difficulty (unused, reserved) }
  constructor(levelConfig = {}) {
    this._cfg = {
      duration: levelConfig.duration ?? 90,
      colors:   levelConfig.colors   ?? ['Red', 'Blue'],
      world:    levelConfig.world    ?? 1,
    };
  }

  // Simulate one complete level deterministically using the given seed.
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
    const worldConfig = WORLD_CONFIG[world];

    // ── Instantiate subsystems ─────────────────────────────────────────────
    const rng        = new SeededRandom(seed);
    const arbiter    = new CountingArbiter();
    const carDir     = new CarDirector({}, rng);
    const shooterDir = new ShooterDirector({}, rng, arbiter);
    const phaseMan   = new IntensityPhase(duration);

    const lanes   = [0, 1, 2, 3].map(id => new Lane({ id }));
    const columns = [0, 1, 2, 3].map(id => new Column({ id }));

    // ── Tracking ───────────────────────────────────────────────────────────
    let carsKilled      = 0;
    let carryOvers      = 0;
    let crisisTriggered = 0;
    let currentCombo    = 0;
    let maxCombo        = 0;
    let lastKillTime    = -Infinity;
    let lostAt          = null;

    // Deploy time dilation: tracks the end-time of the current slow window.
    // Every shooter deploy slows all cars to DEPLOY_DILATION.speedMultiplier for
    // DEPLOY_DILATION.duration seconds, modelling the in-game deploy animation pause.
    let dilationActiveUntil = -Infinity;

    // Per-column fire timers: seconds until a column may fire again.
    const fireTimers = [0, 0, 0, 0];

    // ── Initial state ──────────────────────────────────────────────────────
    // Pre-spawn one car per lane so the level starts with active threats.
    const calmCfg = PHASE_CONFIG['CALM'];
    for (const lane of lanes) {
      const car = carDir.generateCar(lane, 'CALM', worldConfig, colors);
      lane.addCar(car);
      carDir.resetSpawnTimer(lane, calmCfg);
    }

    // Fill all columns before the first tick.
    phaseMan.update(0);
    const initState  = this._buildState(lanes, columns, colors, 0, phaseMan);
    const initParams = phaseMan.getParams();
    shooterDir.fillColumns(columns, initState, initParams);

    // ── Main loop ──────────────────────────────────────────────────────────
    const totalTicks = Math.ceil(duration * 60);

    for (let tick = 0; tick < totalTicks; tick++) {
      const elapsed = tick * DT;
      phaseMan.update(elapsed);

      const currentPhase = phaseMan.getCurrentPhase();
      const phaseParams  = phaseMan.getParams();      // interpolated (damageSkew, etc.)
      const phaseCfg     = PHASE_CONFIG[currentPhase]; // raw (spawn cooldowns)
      const gameState    = this._buildState(lanes, columns, colors, elapsed, phaseMan);

      // 1. Advance all cars toward the breach.
      // Deploy dilation slows all cars when a shooter was recently deployed.
      const speedMult = elapsed < dilationActiveUntil
        ? DEPLOY_DILATION.speedMultiplier : 1.0;
      for (const lane of lanes) {
        lane.advance(DT * speedMult);
      }

      // 2. Breach check — any car at position ≥ 100 ends the level.
      if (lanes.some(l => l.isBreached())) {
        lostAt = elapsed;
        break;
      }

      // 3. Spawn new cars when each lane's cooldown expires.
      carDir.updateSpawnTimers(lanes, DT, phaseCfg);
      for (const lane of lanes) {
        if (carDir.isReadyToSpawn(lane)) {
          const car = carDir.generateCar(lane, currentPhase, worldConfig, colors);
          lane.addCar(car);
          carDir.resetSpawnTimer(lane, phaseCfg);
        }
      }

      // 4. Refill shooter columns (does nothing for full columns).
      shooterDir.fillColumns(columns, gameState, phaseParams);

      // 5. AI fires — lane-urgency-first strategy:
      //
      //   Pass A (coverage): for each lane sorted by front-car position desc,
      //   find the highest-damage ready column whose top matches the lane's
      //   color. This ensures the most-advanced car always gets the best
      //   available shot, and each lane gets at most one column.
      //
      //   Pass B (focus-fire): any remaining ready columns can pile onto
      //   critical lanes (position ≥ CRITICAL_POS) that still have HP left.
      //   Models a player redirecting idle fingers to the most dangerous lane.
      //
      //   Pass C (cycle): idle columns with no matching lane discard their top
      //   shooter so the column advances toward a useful color.
      //
      // Fire-timer precision: subtract DT and snap to 0 when the result is
      // below floating-point noise, preventing a 1-tick delay caused by
      // 2.2 − 132×(1/60) ≈ 3e-16 > 0 failing the readiness check.
      const CRITICAL_POS = 75;
      const FP_EPSILON   = 1e-9;

      // Decrement all timers up front.
      for (let c = 0; c < 4; c++) {
        fireTimers[c] = Math.max(0, fireTimers[c] - DT);
        if (fireTimers[c] < FP_EPSILON) fireTimers[c] = 0;
      }

      // Sort lanes most-urgent first.
      const urgentLanes = lanes
        .filter(l => l.frontCar() !== null)
        .sort((a, b) => b.frontCar().position - a.frontCar().position);

      const usedCols = new Set();

      const _fire = (col, lane) => {
        const s = columns[col].top();
        usedCols.add(col);
        shooterDir.recordDeploy(elapsed);
        dilationActiveUntil = elapsed + DEPLOY_DILATION.duration;
        fireTimers[col] = s.fireDuration;
        columns[col].consume();
        const { kills, carryOverKills } = this._applyDamage(s.damage, lane);
        carsKilled += kills;
        carryOvers += carryOverKills;
        if (kills > 0) {
          currentCombo = (elapsed - lastKillTime <= COMBO_WINDOW)
            ? currentCombo + kills : kills;
          lastKillTime  = elapsed;
          if (currentCombo > maxCombo) maxCombo = currentCombo;
        }
      };

      // Pass A — coverage: one best-match column per lane.
      for (const lane of urgentLanes) {
        const car = lane.frontCar();
        let bestCol = -1, bestDmg = -1;
        for (let c = 0; c < 4; c++) {
          if (usedCols.has(c) || fireTimers[c] > 0) continue;
          const s = columns[c].top();
          if (s && s.color === car.color && s.damage > bestDmg) {
            bestDmg = s.damage;
            bestCol = c;
          }
        }
        if (bestCol !== -1) _fire(bestCol, lane);
      }

      // Pass B — focus-fire: pile onto any critical lane still in danger.
      for (const lane of urgentLanes) {
        const car = lane.frontCar();
        if (!car || car.position < CRITICAL_POS) break; // sorted desc, rest are safe
        for (let c = 0; c < 4; c++) {
          if (usedCols.has(c) || fireTimers[c] > 0) continue;
          const s = columns[c].top();
          if (s && s.color === car.color) { _fire(c, lane); break; }
        }
      }

      // Pass C — cycle: idle columns discard a non-matching top so the column
      // works toward a useful color. Short delay models the player's decision time.
      for (let c = 0; c < 4; c++) {
        if (usedCols.has(c) || fireTimers[c] > 0) continue;
        if (columns[c].shooters.length > 1) {
          columns[c].consume();
          fireTimers[c] = 0.1; // fast cycle — models quick color-scouting
        }
      }

      // 6. Attempt a CRISIS assist when the phase permits it.
      if (phaseParams.crisisEnabled) {
        const crisis = shooterDir.triggerCrisis(gameState);
        if (crisis) {
          crisisTriggered++;
          const { kills, carryOverKills } = this._applyDamage(
            crisis.shooter.damage, crisis.lane
          );
          carsKilled += kills;
          carryOvers += carryOverKills;
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
