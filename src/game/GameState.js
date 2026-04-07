// GameState — single source of truth for all mutable game data.
// Directors read from it (via asDirectorState()), renderers read from it,
// and GameLoop is the only writer.
//
// Rule: nothing outside GameLoop ever writes to GameState.
import { COMBO_WINDOW, DEPLOY_DILATION, CARRYOVER_COIN_BONUS } from '../director/DirectorConfig.js';

export class GameState {
  // laneCount / colCount — how many of the 4 lanes/columns are active.
  // The renderers always see all 4; inactive ones just have no cars/shooters.
  constructor({ lanes, columns, colors, world, duration, phaseMan,
                laneCount, colCount }) {
    // ── Core collections ───────────────────────────────────────────────────
    this.lanes   = lanes;
    this.columns = columns;

    // Active subset sizes — can be changed between levels without recreating
    // the lane/column arrays.  Default: all active.
    this.activeLaneCount = laneCount ?? lanes.length;
    this.activeColCount  = colCount  ?? columns.length;

    // ── Level config ───────────────────────────────────────────────────────
    this.colors   = colors;
    this.world    = world;
    this.duration = duration;
    this.phaseMan = phaseMan;

    // ── Clock ─────────────────────────────────────────────────────────────
    this.elapsed = 0;

    // ── Combo ─────────────────────────────────────────────────────────────
    this.combo        = 0;
    this.lastKillTime = -Infinity;

    // ── Stats ─────────────────────────────────────────────────────────────
    this.totalKills     = 0;
    this.carryOvers     = 0;
    this.totalDeploys   = 0;
    this.correctDeploys = 0;
    this.wrongDeploys   = 0;
    this.benchUsed      = 0;

    // ── Economy ───────────────────────────────────────────────────────────
    this.coins = 0;

    // ── Win-screen stats ──────────────────────────────────────────────────
    this.maxCombo       = 0;    // highest combo reached this level
    this.maxCarPosition = 0;    // highest position any car reached (0-100 units)

    // ── Rescue ────────────────────────────────────────────────────────────
    this.rescueUsed = false;

    // ── Game over ─────────────────────────────────────────────────────────
    this.isOver = false;
    this.won    = false;

    // ── Deploy time dilation ───────────────────────────────────────────────
    // All cars slow to DEPLOY_DILATION.speedMultiplier for .duration seconds
    // after every shooter deploy.  GameLoop reads this when advancing cars.
    this.dilationUntil = -Infinity;

    // ── Rescue recovery window ─────────────────────────────────────────────
    // After a rescue, all cars slow to 70% for 5 seconds so the player can
    // breathe before the onslaught resumes.
    this.recoveryUntil = -Infinity;
  }

  // ── Active subsets ────────────────────────────────────────────────────────

  // The lanes/columns actually in play for the current level.
  // Directors, GameLoop logic, and breach detection all use these.
  get activeLanes() { return this.lanes.slice(0, this.activeLaneCount); }
  get activeCols()  { return this.columns.slice(0, this.activeColCount); }

  // ── Computed ──────────────────────────────────────────────────────────────

  get phase() {
    return this.phaseMan.getCurrentPhase();
  }

  get timeRemaining() {
    return Math.max(0, this.duration - this.elapsed);
  }

  get speedMultiplier() {
    if (this.elapsed < this.dilationUntil)  return DEPLOY_DILATION.speedMultiplier;
    if (this.elapsed < this.recoveryUntil)  return 0.70; // post-rescue recovery
    return 1.0;
  }

  // ── Mutation helpers (GameLoop only) ─────────────────────────────────────

  // Record a kill.  isCarryOver is true for 2nd+ kills in one shot.
  // Returns the updated combo count.
  recordKill(isCarryOver) {
    this.totalKills++;
    if (isCarryOver) this.carryOvers++;

    this.combo = (this.elapsed - this.lastKillTime <= COMBO_WINDOW)
      ? this.combo + 1
      : 1;
    this.lastKillTime = this.elapsed;

    if (this.combo > this.maxCombo) this.maxCombo = this.combo;

    this.coins += 1 + (isCarryOver ? CARRYOVER_COIN_BONUS : 0);

    return this.combo;
  }

  // Freeze the game and record outcome.
  endGame(won) {
    this.isOver = true;
    this.won    = won;
  }

  // Accept a rescue: add extra seconds, push ALL cars back 40 units, and
  // apply a 5-second 30% speed reduction so the player can recover.
  rescue(extraSeconds) {
    this.isOver        = false;
    this.won           = false;
    this.rescueUsed    = true;
    this.duration     += extraSeconds;
    this.recoveryUntil = this.elapsed + 5;
    for (const lane of this.lanes) {
      for (const car of lane.cars) {
        car.position = Math.max(0, car.position - 40);
      }
    }
  }

  // Full level reset — call before restarting to clear all accumulated state.
  resetLevel() {
    this.elapsed       = 0;
    this.combo         = 0;
    this.lastKillTime  = -Infinity;
    this.totalKills     = 0;
    this.carryOvers     = 0;
    this.totalDeploys   = 0;
    this.correctDeploys = 0;
    this.wrongDeploys   = 0;
    this.benchUsed      = 0;
    this.coins          = 0;
    this.maxCombo      = 0;
    this.maxCarPosition = 0;
    this.rescueUsed    = false;
    this.isOver        = false;
    this.won           = false;
    this.dilationUntil = -Infinity;
    this.recoveryUntil = -Infinity;
    // Restore original duration (rescues add to it; reset removes those additions).
    // Duration is re-supplied by GameLoop.restart() which knows the base value.
    for (const lane of this.lanes)   lane.cars.length = 0;
    for (const col  of this.columns) col.shooters.length = 0;
  }

  // True when a combo was active but the window has since expired.
  isComboExpired() {
    return this.combo > 0 && (this.elapsed - this.lastKillTime) > COMBO_WINDOW;
  }

  resetCombo() {
    this.combo = 0;
  }

  // Trigger deploy time dilation starting from now.
  triggerDilation() {
    this.dilationUntil = this.elapsed + DEPLOY_DILATION.duration;
  }

  // Record a shooter deploy. Only called when a front car exists (no target = no stat).
  recordDeploy(isCorrect) {
    this.totalDeploys++;
    if (isCorrect) this.correctDeploys++;
    else           this.wrongDeploys++;
  }

  // ── Director API ─────────────────────────────────────────────────────────

  // Shape expected by ShooterDirector and FairnessArbiter.
  // Passes only the active subsets so directors never fill inactive slots.
  asDirectorState() {
    return {
      lanes:        this.activeLanes,
      columns:      this.activeCols,
      colorPalette: this.colors,
      elapsedTime:  this.elapsed,
      phase:        this.phase,
    };
  }
}
