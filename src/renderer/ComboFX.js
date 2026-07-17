// ComboFX — screen-edge vignette flash for power shots (color bomb / freeze).
// The TEXT message ("COLOR BOMB!", "3 MULTI-KILLS!", "FROZEN!") now goes through
// the unified PopupQueue so only ONE notification shows at a time in the safe gap
// and nothing covers the cars. ComboFX keeps only the edge vignette (it sits on
// the screen border, never over gameplay). (FIX 4)
import { Graphics } from 'pixi.js';

const CAR_COLOR_HEX = {
  Red:    0xE24B4A, Blue:   0x378ADD, Green:  0x639922,
  Yellow: 0xEF9F27, Purple: 0x7F77DD, Orange: 0xD85A30,
};

export class ComboFX {
  constructor(glowLayer, _hudLayer, appW, appH) {
    this._W = appW;
    this._H = appH;
    this._vignette = new Graphics();
    this._vigCol   = 0xffffff;
    this._vigAlpha = 0;
    this._vigDur   = 0;
    this._vigT     = 0;
    this._vigThrob = false;
    glowLayer.addChild(this._vignette);
  }

  // Edge flash when a color bomb fires/earns. `color` = car-color string or 'Rainbow'.
  triggerColorBomb(color) {
    this._vigCol   = CAR_COLOR_HEX[color] ?? 0xff8800;
    this._vigAlpha = 0.55;
    this._vigDur   = 0.30;
    this._vigT     = 0;
    this._vigThrob = false;
  }

  // Edge flash when a combo freeze fires.
  triggerFreeze() {
    this._vigCol   = 0x44aaff;
    this._vigAlpha = 0.50;
    this._vigDur   = 0.20;
    this._vigT     = 0;
    this._vigThrob = false;
  }

  // §3d near-miss drama: red edge pulse that THROBS twice (synced to the
  // heartbeat's double-thump) — dread, not the single-decay impact flash.
  triggerNearMiss() {
    this._vigCol   = 0xff2a2a;
    this._vigAlpha = 0.52;
    this._vigDur   = 0.62;
    this._vigT     = 0;
    this._vigThrob = true;   // two-beat envelope instead of linear decay
  }

  update(dt) {
    if (this._vigT < this._vigDur) {
      this._vigT += dt;
      const p = this._vigT / this._vigDur;
      // Throb: two sine humps over the duration (matches the heartbeat thumps),
      // fading out overall. Otherwise a linear decay for the impact flashes.
      const env = this._vigThrob
        ? Math.abs(Math.sin(p * Math.PI * 2)) * (1 - p)
        : Math.max(0, 1 - p);
      const alpha = this._vigAlpha * env;
      const W = this._W, H = this._H;
      const ew = W * 0.13;
      const eh = H * 0.09;
      const g  = this._vignette;
      g.clear();
      g.rect(0, 0, W, eh);                 g.fill({ color: this._vigCol, alpha });
      g.rect(0, H - eh, W, eh);            g.fill({ color: this._vigCol, alpha });
      g.rect(0, eh, ew, H - eh * 2);       g.fill({ color: this._vigCol, alpha });
      g.rect(W - ew, eh, ew, H - eh * 2);  g.fill({ color: this._vigCol, alpha });
    } else {
      this._vignette.clear();
    }
  }

  destroy() {
    this._vignette.destroy({ children: true });
  }
}
