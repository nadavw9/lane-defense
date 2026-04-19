// LivesManager — 5-heart lives system with 30-minute timer-based regeneration.
//
// Candy Crush-style: failing a level costs 1 heart.  Hearts regenerate one at
// a time on a 30-minute timer.  At full hearts (5) the timer pauses.
// Stored in ProgressManager so it survives page reloads.

export const MAX_HEARTS  = 5;
export const REGEN_MS    = 30 * 60 * 1000;   // 30 minutes

export class LivesManager {
  /** @param {import('./ProgressManager').ProgressManager} progress */
  constructor(progress) {
    this._p = progress;
  }

  // ── Public ───────────────────────────────────────────────────────────────

  get hearts() { return this._p.hearts; }
  get max()    { return MAX_HEARTS; }

  hasHearts() { return this._p.hearts > 0; }
  isFull()    { return this._p.hearts >= MAX_HEARTS; }

  /**
   * Deduct one heart on level failure.
   * Starts the regen timer if this was the first deduction.
   */
  loseHeart() {
    if (this._p.hearts <= 0) return;
    const newHearts = this._p.hearts - 1;
    // Only set the timer anchor on the first deduction from full.
    const anchor = (newHearts === MAX_HEARTS - 1 || !this._p.heartsLastDepleted)
      ? Date.now()
      : this._p.heartsLastDepleted;
    this._p.setHearts(newHearts, anchor);
  }

  /**
   * Check elapsed time and credit any hearts that have regenerated.
   * Call this on app resume and when showing the level-select screen.
   */
  tick() {
    if (this.isFull()) return;
    const anchor = this._p.heartsLastDepleted;
    if (!anchor) return;

    const elapsed      = Date.now() - anchor;
    const heartsEarned = Math.floor(elapsed / REGEN_MS);
    if (heartsEarned <= 0) return;

    const newHearts = Math.min(MAX_HEARTS, this._p.hearts + heartsEarned);
    // Advance the anchor by the hearts we just consumed.
    const newAnchor = newHearts >= MAX_HEARTS
      ? null
      : anchor + heartsEarned * REGEN_MS;
    this._p.setHearts(newHearts, newAnchor);
  }

  /** Milliseconds until the next heart finishes regenerating. */
  msUntilNext() {
    if (this.isFull()) return 0;
    const anchor = this._p.heartsLastDepleted;
    if (!anchor) return 0;
    const elapsed  = Date.now() - anchor;
    const remainder = REGEN_MS - (elapsed % REGEN_MS);
    return remainder;
  }

  /** Human-readable "M:SS" string for the next heart timer. */
  formatTimeUntilNext() {
    const ms = this.msUntilNext();
    if (ms <= 0) return '0:00';
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  /** Immediately refill all hearts (e.g. after watching an ad or IAP). */
  refill() {
    this._p.setHearts(MAX_HEARTS, null);
  }
}
