// TransitionOverlay — full-screen black fade used between levels.
// Added to stage last so it always sits above every layer, including screens.
// Re-parents itself to the top of stage on each fade so dynamic screens
// (WinScreen, RescueOverlay) added after construction never cover it.
import { Graphics } from 'pixi.js';

export class TransitionOverlay {
  constructor(stage, appW, appH) {
    this._stage = stage;
    this._g = new Graphics();
    this._g.rect(0, 0, appW, appH);
    this._g.fill(0x000000);
    this._g.alpha   = 0;
    this._g.visible = false;
    stage.addChild(this._g);

    this._active   = false;
    this._from     = 0;
    this._to       = 0;
    this._duration = 1;
    this._t        = 0;
    this._cb       = null;
  }

  // Fade from transparent → black, then call cb.
  fadeOut(duration, cb) { this._start(0, 1, duration, cb); }

  // Fade from black → transparent, then call cb.
  fadeIn(duration, cb)  { this._start(1, 0, duration, cb); }

  // Call once per render frame.
  update(dt) {
    if (!this._active) return;
    this._t += dt / this._duration;
    if (this._t >= 1) {
      this._g.alpha   = this._to;
      this._g.visible = this._to > 0;
      this._active    = false;
      this._cb?.();
      return;
    }
    this._g.alpha = this._from + (this._to - this._from) * this._t;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _start(from, to, duration, cb) {
    // Always re-add to top of stage so dynamic screens don't cover us.
    this._stage.addChild(this._g);
    this._from     = from;
    this._to       = to;
    this._duration = duration;
    this._t        = 0;
    this._active   = true;
    this._cb       = cb;
    this._g.alpha   = from;
    this._g.visible = true;
  }
}
