// ComboFX — screen-edge vignette flash + floating power text for combo power shots.
// COLOR BOMB: colored edge flash 0.3s + "COLOR BOMB!" text 1.5s.
// FREEZE:     blue edge flash 0.2s + "FROZEN!" text 1.5s.
import { Graphics, Text } from 'pixi.js';

const CAR_COLOR_HEX = {
  Red:    0xE24B4A, Blue:   0x378ADD, Green:  0x639922,
  Yellow: 0xEF9F27, Purple: 0x7F77DD, Orange: 0xD85A30,
};

export class ComboFX {
  constructor(glowLayer, hudLayer, appW, appH) {
    this._W = appW;
    this._H = appH;

    // Screen-edge vignette
    this._vignette  = new Graphics();
    this._vigCol    = 0xffffff;
    this._vigAlpha  = 0;
    this._vigDur    = 0;
    this._vigT      = 0;
    glowLayer.addChild(this._vignette);

    // Floating power text
    this._floatText = new Text({
      text:  '',
      style: {
        fontSize:   34,
        fontWeight: '900',
        fill:       0xffffff,
        dropShadow: { color: 0x000000, blur: 8, distance: 0, alpha: 0.90 },
      },
    });
    this._floatText.anchor.set(0.5, 0.5);
    this._floatText.x     = appW / 2;
    this._floatText.alpha = 0;
    this._floatBaseY      = 0;
    this._floatDur        = 0;
    this._floatT          = 0;
    hudLayer.addChild(this._floatText);
  }

  // Call when a color bomb fires.  color is the car-color string (e.g. 'Red').
  triggerColorBomb(color) {
    this._vigCol   = CAR_COLOR_HEX[color] ?? 0xff8800;
    this._vigAlpha = 0.55;
    this._vigDur   = 0.30;
    this._vigT     = 0;

    this._floatText.text        = 'COLOR BOMB!';
    this._floatText.style.fill  = this._vigCol;
    this._floatBaseY            = this._H * 0.42;
    this._floatText.y           = this._floatBaseY;
    this._floatText.alpha       = 1;
    this._floatT                = 0;
    this._floatDur              = 1.5;
  }

  // Call when a combo freeze fires.
  triggerFreeze() {
    this._vigCol   = 0x44aaff;
    this._vigAlpha = 0.50;
    this._vigDur   = 0.20;
    this._vigT     = 0;

    this._floatText.text        = 'FROZEN!';
    this._floatText.style.fill  = 0x88ddff;
    this._floatBaseY            = this._H * 0.42;
    this._floatText.y           = this._floatBaseY;
    this._floatText.alpha       = 1;
    this._floatT                = 0;
    this._floatDur              = 1.5;
  }

  update(dt) {
    // Vignette — 4 edge strips that fade out
    if (this._vigT < this._vigDur) {
      this._vigT += dt;
      const alpha = this._vigAlpha * Math.max(0, 1 - this._vigT / this._vigDur);
      const W = this._W, H = this._H;
      const ew = W * 0.13;
      const eh = H * 0.09;
      const g  = this._vignette;
      g.clear();
      g.rect(0, 0, W, eh);            g.fill({ color: this._vigCol, alpha });
      g.rect(0, H - eh, W, eh);       g.fill({ color: this._vigCol, alpha });
      g.rect(0, eh, ew, H - eh * 2);  g.fill({ color: this._vigCol, alpha });
      g.rect(W - ew, eh, ew, H - eh * 2); g.fill({ color: this._vigCol, alpha });
    } else {
      this._vignette.clear();
    }

    // Float text — rise and fade out in last 30% of duration
    if (this._floatT < this._floatDur) {
      this._floatT += dt;
      const prog = this._floatT / this._floatDur;
      this._floatText.y     = this._floatBaseY - this._H * 0.09 * prog;
      this._floatText.alpha = prog < 0.70 ? 1 : 1 - (prog - 0.70) / 0.30;
    } else {
      this._floatText.alpha = 0;
    }
  }

  destroy() {
    this._vignette.destroy({ children: true });
    this._floatText.destroy();
  }
}
