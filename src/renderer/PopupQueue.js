// PopupQueue — serialises all in-game banner popups through a single priority
// queue so they never visually stack and the most urgent item always wins.
//
// Priority order (lower = more urgent):
//   CRITICAL    0  — breach warnings, system alerts
//   TUTORIAL    1  — FTUE step hints
//   CAR_TYPE    2  — first-encounter car-type callouts
//   ACHIEVEMENT 3  — achievement unlocked banners
//   COMBO       4  — combo explanation tip
//   AMBIENT     5  — floating reward / crisis labels
//
// Enforcement rules:
//   • Only one popup active per zone at a time.
//   • When TUTORIAL is active, COMBO and AMBIENT items are dropped.
//   • Same-priority items are debounced: next won't show until DEBOUNCE_S
//     seconds after the previous of the same priority was dismissed.
//
// Usage:
//   const pq = new PopupQueue(layer, appWidth);
//   pq.enqueue(PRIORITY.COMBO, (w) => buildMyContainer(w), 3.0);
//   // in render loop:
//   pq.update(dt);
//   pq.setTutorialActive(!!ftueOverlay);

import { Container } from 'pixi.js';

export const PRIORITY = {
  CRITICAL:    0,
  TUTORIAL:    1,
  CAR_TYPE:    2,
  ACHIEVEMENT: 3,
  COMBO:       4,
  AMBIENT:     5,
};

const DEBOUNCE_S = 0.4;

// FIX 4: ALL notifications show ONE AT A TIME in the safe gap between the road
// (breach line ~510) and the bomb zone (~544), so they never stack or cover the
// cars. Priority only decides which queued item shows next.
const SAFE_GAP_Y   = 505;
const MAX_DURATION = 2.0;   // notifications auto-dismiss within 2 seconds

export class PopupQueue {
  constructor(layer, appW) {
    this._layer   = layer;
    this._appW    = appW;

    // The single active notification: null or { container, timer, priority }.
    this._active  = null;
    // Pending items not yet shown: [{ priority, buildFn, duration }]
    this._queue   = [];
    // Last time each priority was dismissed (for debounce).
    this._lastDismissed = {};
    // Elapsed clock — incremented by update(); used for debounce timestamps.
    this._elapsed = 0;
    this._tutorialActive = false;
    this._suppressed = false;
  }

  // Tell the queue whether a TUTORIAL overlay is currently visible.
  // While true, COMBO and AMBIENT items are silently dropped.
  setTutorialActive(v) { this._tutorialActive = v; }

  // Suppress ALL popups while a full-screen modal (win/lose) is up so toasts
  // never render behind the panel. Clears anything already showing/queued.
  // Achievements are still earned/recorded; only the toast is withheld.
  setSuppressed(v) {
    this._suppressed = v;
    if (v) this.clear();
  }

  // Queue a popup.
  //   priority — one of PRIORITY.*
  //   buildFn  — function(appWidth) returning a PixiJS Container
  //   duration — seconds before auto-dismiss (fade begins 0.8s before end)
  enqueue(priority, buildFn, duration = 3.0) {
    if (this._suppressed) return;
    if (this._tutorialActive && (priority === PRIORITY.COMBO || priority === PRIORITY.AMBIENT)) return;

    // Debounce: ignore if same priority was dismissed too recently.
    const last = this._lastDismissed[priority] ?? -Infinity;
    if (this._elapsed - last < DEBOUNCE_S) return;

    // If a slot for this priority is already active, queue it for later.
    this._queue.push({ priority, buildFn, duration });
    // Keep queue sorted by priority (most urgent first).
    this._queue.sort((a, b) => a.priority - b.priority);
  }

  // Call once per frame from the render loop.
  update(dt) {
    this._elapsed += dt;
    if (this._suppressed) return;

    // Tick the single active notification.
    if (this._active) {
      this._active.timer -= dt;
      if (this._active.timer < 0.8) {
        this._active.container.alpha = Math.max(0, this._active.timer / 0.8);
      }
      if (this._active.timer <= 0) {
        this._active.container.destroy({ children: true });
        this._lastDismissed[this._active.priority] = this._elapsed;
        this._active = null;
      }
    }

    // Promote the most-urgent eligible pending item into the single slot.
    if (!this._active && this._queue.length > 0) {
      for (let i = 0; i < this._queue.length; i++) {
        const item = this._queue[i];
        if (this._tutorialActive && (item.priority === PRIORITY.COMBO || item.priority === PRIORITY.AMBIENT)) {
          this._queue.splice(i, 1); i--; continue;
        }
        const last = this._lastDismissed[item.priority] ?? -Infinity;
        if (this._elapsed - last < DEBOUNCE_S) continue;   // still debouncing this priority
        this._queue.splice(i, 1);
        this._showItem(item);
        break;
      }
    }
  }

  // True when a notification is currently visible — used to suppress drag hover tints.
  hasActive() {
    return !!this._active;
  }

  // Remove the active and all pending popups (call on level reset).
  clear() {
    if (this._active) this._active.container.destroy({ children: true });
    this._active  = null;
    this._queue   = [];
    this._lastDismissed = {};
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _showItem({ priority, buildFn, duration }) {
    const container = buildFn(this._appW);
    container.y     = SAFE_GAP_Y;
    container.alpha = 1;
    this._layer.addChild(container);
    this._active = { container, timer: Math.min(duration, MAX_DURATION), priority };
  }
}
