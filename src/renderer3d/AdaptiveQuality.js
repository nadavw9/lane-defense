// AdaptiveQuality — steps the 3D render scale down on slow devices and back up
// when there is headroom. Pure (no Three, no DOM) so it is unit-testable.
//
// Frame times are averaged over a window; a slow window steps DOWN at once, a
// fast window must repeat before stepping UP, so a device on the edge settles
// instead of oscillating. Hitches (tab switch, level load) are ignored.

export const QUALITY_STEPS = [1, 0.8, 0.65, 0.5];   // multiplier on the full render ratio

const WINDOW_FRAMES = 90;
const SLOW_MS = 26;        // average above this (< ~38 fps) → drop a step
const FAST_MS = 18;        // average below this (> ~55 fps) → candidate to climb
const FAST_WINDOWS = 3;    // consecutive fast windows needed to climb
const HITCH_MS = 250;      // single frames longer than this are not samples

export class AdaptiveQuality {
  constructor() { this.step = 0; this._sum = 0; this._n = 0; this._fast = 0; }

  get factor() { return QUALITY_STEPS[this.step]; }

  /** Feed one frame interval (ms). Returns true when the step changed. */
  record(ms) {
    if (!(ms > 0) || ms > HITCH_MS) return false;
    this._sum += ms; this._n++;
    if (this._n < WINDOW_FRAMES) return false;
    const avg = this._sum / this._n;
    this._sum = 0; this._n = 0;
    if (avg > SLOW_MS && this.step < QUALITY_STEPS.length - 1) { this.step++; this._fast = 0; return true; }
    if (avg < FAST_MS) {
      if (++this._fast >= FAST_WINDOWS && this.step > 0) { this.step--; this._fast = 0; return true; }
    } else this._fast = 0;
    return false;
  }
}
