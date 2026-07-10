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
  HP_MINIMUM,
} from '../director/DirectorConfig.js';
import { CAR_TYPES } from '../director/CarTypes.js';
import { openingRowsForLevel } from '../game/LevelManager.js';

const DT = 1 / 60; // seconds per simulation tick (used for fire cooldowns only)

// Simulated-player accuracy and behavior profiles.
// 'optimal' preserves the original perfect-play baseline; all others model
// real human behavior for balance tuning against actual player targets.
// cycleDelay: seconds between column-cycle actions per column.
// Optimal cycles almost instantly (0.1s); real players decide once every few seconds.
// A higher delay means the player sits on a bad color longer → more wasted fire windows.
// boosterIQ: probability the sim capitalizes on an AVAILABLE booster/streak this
// turn (WS3 §3b booster-aware modeling). optimal = 0 → boosters OFF, preserving the
// original perfect-play baseline exactly. All booster logic below is gated on
// `boosterIQ > 0`, so the optimal profile is byte-for-byte unchanged.
const SKILL_PROFILES = {
  optimal:  { accuracy: 1.00, useCycle: true,  cycleDelay: 0.10, boosterIQ: 0.00 },
  beginner: { accuracy: 0.60, useCycle: false, cycleDelay: 0,    boosterIQ: 0.30 },
  average:  { accuracy: 0.82, useCycle: true,  cycleDelay: 3.0,  boosterIQ: 0.70 },
  skilled:  { accuracy: 0.93, useCycle: true,  cycleDelay: 0.75, boosterIQ: 0.95 },
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
      gridRows:           levelConfig.gridRows           ?? 16,
      // Level Goal System: array of { type, color?, carType?, count }. When present,
      // the sim WINS by completing every goal (matching the live game), not by a
      // generic kill target. Empty/omitted → legacy kill-target behaviour.
      goals:              levelConfig.goals              ?? [],
      // Optional per-shot observer for tuning tools. Called once per fired bomb
      // with the shot's correctness (true = correct-colour, false = wrong).
      // Default null → zero behaviour change for balance runs and tests.
      onShot:             levelConfig.onShot             ?? null,
      // §3c boss fields — SIM PARITY IS A HARD REQUIREMENT (VISION rule 6): the
      // sim must model scripted bosses identically to the live game or it can't
      // measure them. Both wire into the SAME CarDirector implementation.
      initialCars:        levelConfig.initialCars        ?? null,   // INFRA-A scripted opening
      spawnScript:        levelConfig.spawnScript        ?? null,   // INFRA-C staged waves
    };
  }

  // Simulate one complete level deterministically using the given seed.
  // DISCRETE MOVEMENT MODEL: cars advance 1 row per correct-color shot (not per tick).
  // Termination: win when (1) all goal progress = 0 if goals exist, or (2) legacy targetKills
  // reached if no goals; lose on breach; or timeout on MAX_TURNS safety cap.
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

    // speed.base is intentionally NOT read: the shipped game is turn-based, so
    // car speed has zero effect on difficulty. Difficulty comes only from
    // laneTargetCarCount, spawnBudget (now a density knob), car HP, colors, and gridRows.

    // ── Instantiate subsystems ─────────────────────────────────────────────
    const rng        = new SeededRandom(seed);
    const arbiter    = new CountingArbiter();
    const carDir     = new CarDirector({}, rng);
    if (this._cfg.levelId != null) carDir.setLevel(this._cfg.levelId);
    carDir.setSpawnScript(this._cfg.spawnScript);   // §3c INFRA-C (same impl as live game)
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
    // With infinite spawn, we no longer track budget depletion for win. Instead,
    // win comes from goal completion (if goals exist) or legacy targetKills (if no goals).
    // The old budget is kept for opening spawns (prime initial cars) but not as a limit.
    const totalBudget = Number.isFinite(this._cfg.spawnBudget)
      ? this._cfg.spawnBudget
      : Math.max(8, Math.round(duration / 3));

    // ── Tracking ───────────────────────────────────────────────────────────
    let carsKilled      = 0;
    let carryOvers      = 0;
    let crisisTriggered = 0;
    let currentCombo    = 0;
    let maxCombo        = 0;
    let lastKillTime    = -Infinity;
    let lostAt          = null;

    // ── Booster / streak modeling (WS3 §3b) — all gated on boosterIQ > 0 ────────
    // Earn rules mirror the shipped game; USE is probabilistic per boosterIQ so a
    // higher-skill profile capitalizes on available boosters more often.
    const boosterIQ        = profile.boosterIQ ?? 0;
    let   streakCount      = 0;       // consecutive correct SHOTS (VISION streak = 3 in a row)
    let   powerReady       = false;   // a double-damage power shot is banked
    let   freezeCharges    = 0;       // earned 3-kill chain → +1, cap 2
    let   freezeSkips      = 0;       // pending advance-skips from an activated freeze
    let   bombCharges      = 0;       // earned +1 per 10 kills, cap 3
    let   nextBombKill     = 10;
    let   colorChangeCharges = 0;     // earned ~per 2 consecutive multi-kills, cap 2

    // ── Level goals (mirrors GameState.applyKillToGoals / isGoalMet) ──────────
    const goals        = this._cfg.goals ?? [];
    const hasGoals     = goals.length > 0;
    const goalProgress = goals.map(g => g.count);
    const totalGoalCount = goals.reduce((s, g) => s + g.count, 0);
    const applyKillToGoals = (color, type) => {
      for (let i = 0; i < goals.length; i++) {
        const g = goals[i];
        const match = g.type === 'destroyTotal'
          || (g.type === 'destroyColor' && color === g.color)
          || (g.type === 'destroyType'  && type  === g.carType);
        if (match) goalProgress[i] = Math.max(0, goalProgress[i] - 1);
      }
    };
    const goalsMet = () => hasGoals && goalProgress.every(r => r === 0);

    // Fidelity instrumentation (per-shot advance invariant). Not used for balance.
    let correctShots    = 0;   // correct-color shots fired
    let totalAdvances   = 0;   // times the grid advanced 1 row
    let maxAdvPerTick   = 0;   // most advances in a single turn (per-shot invariant check)

    // ── Initial state ──────────────────────────────────────────────────────
    // Open with the SAME uniform density as the shipped game (rows [0,1,2]), so the
    // balance sim reflects reality. Push FRONT-FIRST (highest row first) so cars[0]
    // stays the front car — the rest of the sim relies on that invariant (refills
    // append row-0 cars at the back).
    // No budget limit on opening cars — boards prime fully regardless of spawnBudget.
    if (this._cfg.initialCars && this._cfg.initialCars.length > 0) {
      // §3c INFRA-A scripted opening — mirrors GameLoop._primeInitialCars: each
      // entry { lane?, row?, type?, color? } fully defines one car (hp recomputed
      // for a named type); the array defines the ENTIRE opening board.
      for (const def of this._cfg.initialCars) {
        const li  = Math.min(LANE_N - 1, Math.max(0, def.lane ?? 0));
        const car = carDir.generateCar({ id: li }, 'CALM', worldConfig, colors, this._cfg.gridRows);
        const type  = (def.type && CAR_TYPES[def.type]) ? def.type : car.type;
        const color = (def.color && colors.includes(def.color)) ? def.color : car.color;
        // hp for a named type: base × mult with the live HP_MINIMUM clamp — the
        // SAME formula as GameLoop._primeInitialCars / CarDirector._buildCar.
        const hp = (def.type && CAR_TYPES[def.type])
          ? Math.max(HP_MINIMUM, Math.round(CAR_TYPES[def.type].hp * worldConfig.hpMultiplier))
          : car.hp;
        discreteLanes[li].cars.push({ row: def.row ?? 0, hp, type, color });
      }
      for (const lane of discreteLanes) lane.cars.sort((a, b) => b.row - a.row);   // cars[0] = front
    } else {
      const _openRows = openingRowsForLevel(this._cfg.levelId);   // back→front, e.g. [0,1,2]
      for (const lane of discreteLanes) {
        // Push FRONT-FIRST (highest row first) so cars[0] stays the front car.
        for (let k = _openRows.length - 1; k >= 0; k--) {
          const car = carDir.generateCar({ id: lane.id }, 'CALM', worldConfig, colors, this._cfg.gridRows);
          // car.hp is already scaled by hpMultiplier in CarDirector._buildCar —
          // re-multiplying here was a live↔sim parity bug (pre-89e7c67 leftover,
          // when the sim was the only place the multiplier applied): the sim
          // fought ~half-hp heavy cars (L30 tank live 11 vs sim 6).
          lane.cars.push({ row: _openRows[k], hp: car.hp, type: car.type, color: car.color });
        }
      }
    }

    // Fill all columns before the first tick.
    phaseMan.update(0);
    const initState  = this._buildState(lanes, columns, colors, 0, phaseMan);
    const initParams = phaseMan.getParams();
    shooterDir.fillColumns(columns, initState, initParams);

    // ── Main loop — TURN-BASED, NO CLOCK ─────────────────────────────────────
    // Mirrors the shipped game: cars move ONLY on a correct shot, spawns happen
    // per advance. With infinite spawn, WIN comes from carsKilled >= some threshold
    // (approximated by total advances), LOSS = breach, or TIMEOUT = MAX_TURNS cap.
    // There is NO time pressure and speed.base has NO effect — difficulty falls
    // out of laneTargetCarCount, spawnBudget (now a density knob), car HP, colors, gridRows.
    // A synthetic `elapsed` is derived from TURN PROGRESS (not a clock) purely
    // so intensity phases (car-type mix / crisis) still ramp CALM → CLIMAX.
    const MAX_TURNS    = 3000;   // safety bound; a real level completes in < 100 turns,
                                 // so hitting this means the goal is effectively unreachable → loss
    const CRITICAL_ROW = Math.floor(BREACH_ROW * 0.75);

    const _isCorrect = () => rng.next() < profile.accuracy;

    // Top EVERY active lane up to laneTargetCarCount each advance (mirrors
    // GameLoop._refillLanes). No budget limit — lanes refill indefinitely to match
    // goal-based play. Each new car goes at the lowest unoccupied spawn row (0,1,…)
    // so fills don't stack; then re-sort descending by row so cars[0] stays the
    // front car (discreteLanes are plain objects, so unlike Lane this won't auto-sort).
    const _refillLanes = (phase) => {
      // §3c INFRA-C rate: the spawnScript stage may override the lane-fill target
      // (L20 surge crests/lulls). Same line as GameLoop._refillLanes — parity.
      const target = carDir.scriptRate() ?? this._cfg.laneTargetCarCount;
      for (const lane of discreteLanes) {
        let added = false;
        while (lane.cars.length < target) {
          let row = 0;
          while (lane.cars.some(c => c.row === row)) row++;
          if (row >= this._cfg.gridRows) break;   // lane physically full
          const car = carDir.generateCar({ id: lane.id }, phase, worldConfig, colors, this._cfg.gridRows);
          // No re-multiplication: car.hp already carries hpMultiplier (see the
          // opening-block parity note). Carry-over bait cars keep their 1-2 hp.
          lane.cars.push({ row, hp: car.hp, type: car.type, color: car.color });
          added = true;
        }
        if (added) lane.cars.sort((a, b) => b.row - a.row);   // cars[0] = front (highest row)
      }
    };

    // ONE correct shot → advance ALL cars 1 row, breach-check, refill. Per shot.
    const _advanceOneRow = (phase) => {
      totalAdvances++;
      // FREEZE: an activated freeze skips this advance entirely — cars don't move
      // forward, no breach, no refill (mirrors "your next shot is free, no cars advance").
      if (freezeSkips > 0) { freezeSkips--; return; }
      for (const lane of discreteLanes) for (const car of lane.cars) car.row++;
      if (discreteLanes.some(l => l.cars.length > 0 && l.cars[0].row >= BREACH_ROW)) {
        lostAt = totalAdvances;   // marker (shot index), not a wall-clock time
        return;
      }
      _refillLanes(phase);
    };

    // Safety heuristic for realistic level simulation: assume a level is "won" if
    // the player can kill enough cars (rough proxy for goal completion). With infinite
    // spawn, we can't use budget as an exit criterion, so we use:
    // - A kill threshold based on duration (longer levels = more time to kill cars).
    // - A stall guard to exit unplayable states.
    // Rough scale: 90s level → ~20 kills. Adjust for actual duration.
    const KILL_TARGET = Math.round(20 * (duration / 90));   // legacy fallback (no goals)

    let turns  = 0;
    let stalls = 0;
    while (turns < MAX_TURNS) {
      turns++;

      // Stop when:
      //   1. LOSS: a car breached (lostAt !== null) → won=false
      //   2. WIN: all goals complete (goal mode) / kill target reached (legacy)
      //   3. TIMEOUT: MAX_TURNS safety cap
      if (lostAt !== null) break;
      if (hasGoals ? goalsMet() : carsKilled >= KILL_TARGET) break;

      // Phase from progress (goal completion in goal mode, else kills/target) so the
      // car-type mix still ramps CALM → CLIMAX. Shot-driven, NOT a clock.
      const progress = hasGoals
        ? 1 - goalProgress.reduce((s, r) => s + r, 0) / Math.max(1, totalGoalCount)
        : Math.min(1, carsKilled / Math.max(1, KILL_TARGET));
      const elapsed = duration * progress;
      carDir.setProgress(progress);   // §3c spawnScript stage keyed on kill-progress (parity w/ GameLoop)
      phaseMan.update(elapsed);
      const phase       = phaseMan.getCurrentPhase();
      const phaseParams = phaseMan.getParams();
      const gameState   = this._buildState(lanes, columns, colors, elapsed, phaseMan);

      shooterDir.fillColumns(columns, gameState, phaseParams);

      // ── Booster USE (WS3 §3b; skill-gated — optimal boosterIQ 0 skips all of this) ──
      if (boosterIQ > 0) {
        // FREEZE — a front car within 3 rows of breach → activate to skip the next advance.
        if (freezeCharges > 0
            && discreteLanes.some(l => l.cars.length > 0 && l.cars[0].row >= this._cfg.gridRows - 3)
            && rng.next() < boosterIQ) {
          freezeCharges--; freezeSkips++;
        }
        // BOMB — a single row shared by ≥3 cars (across lanes) → clear that whole row.
        if (bombCharges > 0) {
          const rowCounts = new Map();
          for (const l of discreteLanes) for (const c of l.cars) rowCounts.set(c.row, (rowCounts.get(c.row) ?? 0) + 1);
          let bestRow = -1, bestN = 0;
          for (const [row, n] of rowCounts) if (n > bestN) { bestN = n; bestRow = row; }
          if (bestN >= 3 && rng.next() < boosterIQ) {
            bombCharges--;
            for (const l of discreteLanes) {
              for (let i = l.cars.length - 1; i >= 0; i--) {
                if (l.cars[i].row === bestRow) {
                  const car = l.cars[i];
                  l.cars.splice(i, 1);
                  carsKilled++;
                  applyKillToGoals(car.color, car.type);
                }
              }
            }
          }
        }
        // COLOR CHANGE — ≥3 front cars share a colour that no column can currently
        // match → recolour those front cars to an available bomb colour (unlocks them).
        if (colorChangeCharges > 0) {
          const avail = new Set(columns.map(c => c.top()?.color).filter(Boolean));
          const frontCounts = new Map();
          for (const l of discreteLanes) if (l.cars.length > 0) {
            const col = l.cars[0].color;
            frontCounts.set(col, (frontCounts.get(col) ?? 0) + 1);
          }
          let lockColor = null;
          for (const [col, n] of frontCounts) if (n >= 3 && !avail.has(col)) { lockColor = col; break; }
          if (lockColor && avail.size > 0 && rng.next() < boosterIQ) {
            colorChangeCharges--;
            const target = [...avail][0];
            for (const l of discreteLanes) if (l.cars.length > 0 && l.cars[0].color === lockColor) l.cars[0].color = target;
          }
        }
      }

      const urgentLanes = discreteLanes
        .filter(l => l.cars.length > 0)
        .sort((a, b) => b.cars[0].row - a.cars[0].row);

      const usedCols  = new Set();
      const advBefore = totalAdvances;
      let didFire = false, didCycle = false;

      // Fire: CORRECT shot → damage + advance 1 row. WRONG shot → wasted bomb,
      // no advance (no cadence/time cost — there is no clock).
      const _fire = (col, lane, isCorrect = true) => {
        if (lostAt !== null) return;
        const s = columns[col].top();
        usedCols.add(col);
        shooterDir.recordDeploy(elapsed);
        columns[col].consume();
        if (this._cfg.onShot) this._cfg.onShot(isCorrect);  // tuning hook (per fired bomb)
        if (!isCorrect) { streakCount = 0; powerReady = false; return; }  // wrong shot breaks the streak
        correctShots++;
        didFire = true;
        streakCount++;
        if (lane.cars.length > 0) {
          const car = lane.cars[0];
          let dmg = s.damage;
          // STREAK power shot: 3 correct in a row banks a double-damage shot; a
          // higher-skill profile is more likely to cash it in (boosterIQ roll).
          if (boosterIQ > 0 && powerReady && rng.next() < boosterIQ) {
            dmg *= 2; powerReady = false; streakCount = 0;
          }
          car.hp -= dmg;
          if (car.hp <= 0) {
            lane.cars.shift();
            carsKilled++;
            applyKillToGoals(car.color, car.type);   // credit the level's goals
            currentCombo = (totalAdvances - lastKillTime <= COMBO_WINDOW) ? currentCombo + 1 : 1;
            lastKillTime = totalAdvances;
            if (currentCombo > maxCombo) maxCombo = currentCombo;
            // ── Booster EARN (skill-gated; mirrors shipped earn rules) ──────────
            if (boosterIQ > 0) {
              if (currentCombo % 3 === 0 && freezeCharges < 2) freezeCharges++;               // 3-kill chain → freeze
              if (carsKilled >= nextBombKill && bombCharges < 3) { bombCharges++; nextBombKill += 10; }  // 10 kills → bomb
              if (currentCombo % 4 === 0 && colorChangeCharges < 2) colorChangeCharges++;      // ~2 consecutive multi-kills → color change
            }
          }
        }
        if (boosterIQ > 0 && streakCount >= 3) powerReady = true;   // bank the power shot
        _advanceOneRow(phase);
      };

      // Pass A — coverage: best-match column per urgent lane.
      for (const lane of urgentLanes) {
        if (lostAt !== null) break;
        const car = lane.cars[0];
        let bestCol = -1, bestDmg = -1;
        for (let c = 0; c < COL_N; c++) {
          if (usedCols.has(c)) continue;
          const s = columns[c].top();
          if (s && s.color === car.color && s.damage > bestDmg) { bestDmg = s.damage; bestCol = c; }
        }
        if (bestCol !== -1) _fire(bestCol, lane, _isCorrect());
      }

      // Pass B — focus-fire on lanes near breach.
      for (const lane of urgentLanes) {
        if (lostAt !== null) break;
        if (lane.cars.length === 0 || lane.cars[0].row < CRITICAL_ROW) continue;
        for (let c = 0; c < COL_N; c++) {
          if (usedCols.has(c)) continue;
          const s = columns[c].top();
          if (s && s.color === lane.cars[0].color) { _fire(c, lane, _isCorrect()); break; }
        }
      }

      maxAdvPerTick = Math.max(maxAdvPerTick, totalAdvances - advBefore);
      if (lostAt !== null) break;

      // Pass C — cyclers (avg/skilled/optimal) churn idle columns toward a match.
      if (profile.useCycle) {
        for (let c = 0; c < COL_N; c++) {
          if (usedCols.has(c)) continue;
          if (columns[c].shooters.length > 1) { columns[c].consume(); didCycle = true; }
        }
      }

      // (No CRISIS assist in the floor model: the FairnessArbiter already
      // guarantees a viable matching column every turn, so the assist is
      // redundant here. The old free no-advance kill diverged from the real
      // game — crisis grants a BOMB the player must fire, not a free kill —
      // and could empty the board with budget remaining, stalling the loop.)

      // Stall guard: a turn with no fire and no cycle would loop forever. Force
      // one column to discard (models the game's viability guard giving the
      // player a fresh top), guaranteeing state changes toward a match.
      if (!didFire && !didCycle) {
        let fc = -1, mx = 1;
        for (let c = 0; c < COL_N; c++) if (columns[c].shooters.length > mx) { mx = columns[c].shooters.length; fc = c; }
        if (fc !== -1) columns[fc].consume();
        else if (++stalls > 50) break;   // no bombs to cycle — abandon
      } else {
        stalls = 0;
      }
    }

    // Win: no breach + goals complete (goal mode) / kill target met (legacy).
    // Never wins on budget exhaustion (infinite spawn). Breach (or MAX_TURNS) = loss.
    const won = lostAt === null && (hasGoals ? goalsMet() : carsKilled >= KILL_TARGET);
    const timeElapsed     = 0;       // no wall-clock in the turn-based model
    const rescueWouldSave = false;   // (timer-based rescue heuristic n/a without a clock)

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
      turns,
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
