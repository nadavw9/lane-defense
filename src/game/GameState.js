// GameState — single source of truth for all mutable game data.
// Directors read from it (via asDirectorState()), renderers read from it,
// and GameLoop is the only writer.
//
// Rule: nothing outside GameLoop ever writes to GameState.
import { COMBO_WINDOW, DEPLOY_DILATION, CARRYOVER_COIN_BONUS } from '../director/DirectorConfig.js';

export class GameState {
  constructor({ lanes, columns, colors, world, duration, phaseMan }) {
    // ── Core collections ───────────────────────────────────────────────────
    this.lanes   = lanes;
    this.columns = columns;

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
    this.totalKills = 0;
    this.carryOvers = 0;

    // ── Economy ───────────────────────────────────────────────────────────
    this.coins = 0;

    // ── Game over ─────────────────────────────────────────────────────────
    this.isOver = false;
    this.won    = false;

    // ── Deploy time dilation ───────────────────────────────────────────────
    // All cars slow to DEPLOY_DILATION.speedMultiplier for .duration seconds
    // after every shooter deploy.  GameLoop reads this when advancing cars.
    this.dilationUntil = -Infinity;
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  get phase() {
    return this.phaseMan.getCurrentPhase();
  }

  get timeRemaining() {
    return Math.max(0, this.duration - this.elapsed);
  }

  get speedMultiplier() {
    return this.elapsed < this.dilationUntil
      ? DEPLOY_DILATION.speedMultiplier
      : 1.0;
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

    this.coins += 1 + (isCarryOver ? CARRYOVER_COIN_BONUS : 0);

    return this.combo;
  }

  // Freeze the game and record outcome.
  endGame(won) {
    this.isOver = true;
    this.won    = won;
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

  // ── Director API ─────────────────────────────────────────────────────────

  // Shape expected by ShooterDirector and FairnessArbiter.
  asDirectorState() {
    return {
      lanes:        this.lanes,
      columns:      this.columns,
      colorPalette: this.colors,
      elapsedTime:  this.elapsed,
      phase:        this.phase,
    };
  }
}
