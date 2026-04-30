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

// Y position (top-left of the popup group) for each priority zone.
const ZONE_Y = {
  [PRIORITY.CRITICAL]:    320,
  [PRIORITY.TUTORIAL]:     56,
  [PRIORITY.CAR_TYPE]:    220,
  [PRIORITY.ACHIEVEMENT]:  56,
  [PRIORITY.COMBO]:       144,
  [PRIORITY.AMBIENT]:     640,
};

export class PopupQueue {
  constructor(layer, appW) {
    this._layer   = layer;
    this._appW    = appW;

    // Active slot per priority zone: null or { container, timer, fadeStart }
    this._active  = {};
    // Pending items not yet shown: [{ priority, buildFn, duration }]
    this._queue   = [];
    // Last time each priority was dismissed (for debounce).
    this._lastDismissed = {};
    // Elapsed clock — incremented by update(); used for debounce timestamps.
    this._elapsed = 0;
    this._tutorialActive = false;
  }

  // Tell the queue whether a TUTORIAL overlay is currently visible.
  // While true, COMBO and AMBIENT items are silently dropped.
  setTutorialActive(v) { this._tutorialActive = v; }

  // Queue a popup.
  //   priority — one of PRIORITY.*
  //   buildFn  — function(appWidth) returning a PixiJS Container
  //   duration — seconds before auto-dismiss (fade begins 0.8s before end)
  enqueue(priority, buildFn, duration = 3.0) {
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

    // Tick active slots.
    for (const [pri, slot] of Object.entries(this._active)) {
      if (!slot) continue;
      slot.timer -= dt;

      // Fade out during last 0.8 s.
      if (slot.timer < 0.8) {
        slot.container.alpha = Math.max(0, slot.timer / 0.8);
      }

      if (slot.timer <= 0) {
        slot.container.destroy({ children: true });
        this._active[pri] = null;
        this._lastDismissed[Number(pri)] = this._elapsed;
      }
    }

    // Promote pending items into free slots.
    for (let i = this._queue.length - 1; i >= 0; i--) {
      const item = this._queue[i];

      if (this._tutorialActive && (item.priority === PRIORITY.COMBO || item.priority === PRIORITY.AMBIENT)) {
        this._queue.splice(i, 1);
        continue;
      }

      if (this._active[item.priority]) continue;  // zone occupied

      // Debounce check again at display time.
      const last = this._lastDismissed[item.priority] ?? -Infinity;
      if (this._elapsed - last < DEBOUNCE_S) continue;

      this._queue.splice(i, 1);
      this._showItem(item);
    }
  }

  // True when any popup is currently visible — used to suppress drag hover tints.
  hasActive() {
    return Object.values(this._active).some(s => !!s);
  }

  // Remove all active and pending popups (call on level reset).
  clear() {
    for (const slot of Object.values(this._active)) {
      if (slot) slot.container.destroy({ children: true });
    }
    this._active  = {};
    this._queue   = [];
    this._lastDismissed = {};
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _showItem({ priority, buildFn, duration }) {
    const container = buildFn(this._appW);
    container.y     = ZONE_Y[priority] ?? 100;
    container.alpha = 1;
    this._layer.addChild(container);
    this._active[priority] = { container, timer: duration };
  }
}
