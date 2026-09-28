// StreakMeter — the Hot Streak HUD (V2, see director/TrafficRules.js).
//
// A toy pill sitting on the breach stripe, right above the bombs the player is
// choosing from: three flame pips that light yellow → orange → red with each
// consecutive kill shot. At three the pill turns hot, reads SUPERCHARGED, and a
// fire ring pulses around every bomb the player could fire next (column tops and
// bench), so the "which bomb gets the power" question answers itself: any.
//
// Pure presentation. GameApp feeds it setState() from GameLoop._onStreak and the
// bomb anchors via setAnchors(); it never reads or writes game state.
import { Container, Graphics, Text } from 'pixi.js';
import { INK, PLUM, WHITE, shade, toyLabel } from './ToyStyle.js';
import { BREACH_LINE_Y, APP_W } from '../renderer3d/projection.js';

const PIP_COLORS = [0xFFD42A, 0xFF8A1C, 0xFF3D3D];
const PILL_W = 118, PILL_H = 24, HOT_W = 176;
const HOT = 0xFF5A1F;

export class StreakMeter {
  constructor(layer) {
    this._root = new Container();
    this._pill = new Graphics();
    this._rings = new Graphics();
    this._label = new Text({ text: 'SUPERCHARGED', style: toyLabel(13) });
    this._label.anchor.set(0.5);
    this._root.addChild(this._rings, this._pill, this._label);
    layer.addChild(this._root);
    this._enabled = false;
    this._streak = 0;
    this._charged = false;
    this._t = 0;
    this._popT = 1;         // 0..1 scale-pop after a pip lights / the charge lands
    this._anchors = () => [];
    this._root.visible = false;
  }

  /** Level has Hot Streak on/off. */
  setEnabled(on) {
    this._enabled = !!on;
    this._root.visible = this._enabled;
    if (!on) { this._streak = 0; this._charged = false; }
  }

  /** fn() → [{x, y, r}] — screen positions of the bombs that can be fired next. */
  setAnchors(fn) { this._anchors = fn ?? (() => []); }

  setState(streak, charged) {
    if (streak > this._streak || (charged && !this._charged)) this._popT = 0;
    this._streak = streak;
    this._charged = charged;
  }

  reset() { this._streak = 0; this._charged = false; this._popT = 1; }

  update(dt) {
    if (!this._enabled) return;
    this._t += dt;
    this._popT = Math.min(1, this._popT + dt / 0.28);
    const pop = 1 + 0.22 * Math.sin(Math.PI * this._popT) * (1 - this._popT * 0.3);
    const cx = APP_W / 2, cy = BREACH_LINE_Y - 7;   // sits on the stripe, clear of the front bomb
    const g = this._pill;
    g.clear();
    this._root.position.set(0, 0);

    if (this._charged) {
      const pulse = 1 + 0.05 * Math.sin(this._t * 8);
      const w = HOT_W * pulse * pop, h = PILL_H * pulse * pop;
      g.roundRect(cx - w / 2, cy - h / 2 + 3, w, h, h / 2).fill(shade(HOT, 0.6));
      g.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2).fill(HOT);
      g.roundRect(cx - w / 2 + 6, cy - h / 2 + 3, w - 12, h * 0.28, h * 0.14).fill({ color: WHITE, alpha: 0.35 });
      g.roundRect(cx - w / 2, cy - h / 2, w, h + 3, h / 2).stroke({ color: INK, width: 3 });
      this._bolt(g, cx - w / 2 + 16, cy, 8);
      this._bolt(g, cx + w / 2 - 16, cy, 8);
      this._label.visible = true;
      this._label.position.set(cx, cy);
      this._label.scale.set(pulse * pop);
      this._drawRings();
    } else {
      this._rings.clear();
      this._label.visible = false;
      const w = PILL_W, h = PILL_H;
      g.roundRect(cx - w / 2, cy - h / 2 + 3, w, h, h / 2).fill(shade(PLUM, 0.6));
      g.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2).fill(PLUM);
      g.roundRect(cx - w / 2, cy - h / 2, w, h + 3, h / 2).stroke({ color: INK, width: 3 });
      for (let i = 0; i < 3; i++) {
        const lit = i < this._streak;
        const px = cx + (i - 1) * 32;
        const s = lit && i === this._streak - 1 ? pop : 1;
        if (!lit) g.circle(px, cy + 1, 10).fill({ color: 0xFFFFFF, alpha: 0.06 });
        this._flame(g, px, cy + 1, 9.5 * s, lit ? PIP_COLORS[i] : 0xB8A28C, lit);
      }
    }
  }

  _drawRings() {
    const r = this._rings;
    r.clear();
    const k = 0.5 + 0.5 * Math.sin(this._t * 9);
    // A tight glowing rim on each charged bomb — never wider than the ball's own
    // cradle, so it can't spill onto the bomb below or the next column.
    for (const a of this._anchors()) {
      const rad = (a.r ?? 16) + 2.5;
      r.circle(a.x, a.y, rad + 2 + 1.5 * k).stroke({ color: 0xFFD42A, width: 2, alpha: 0.35 + 0.35 * k });
      r.circle(a.x, a.y, rad).stroke({ color: HOT, width: 3, alpha: 0.95 });
    }
  }

  // A flame: rounded base with three licking tongues (tallest in the middle),
  // and a hot inner flame when lit. Unlit = the same flame, dim — never a drop.
  _flame(g, x, y, s, color, lit) {
    const tongue = (k) => {                       // k = size factor for the inner flame
      const b = y + s * 1.0 * k, w = s * 1.0 * k;
      g.moveTo(x, b)
        .bezierCurveTo(x - w * 1.1, b, x - w * 1.15, y - s * 0.1 * k, x - w * 0.62, y - s * 0.62 * k)
        .quadraticCurveTo(x - w * 0.5, y - s * 0.12 * k, x - w * 0.22, y - s * 0.28 * k)
        .quadraticCurveTo(x - w * 0.18, y - s * 1.05 * k, x, y - s * 1.45 * k)
        .quadraticCurveTo(x + w * 0.18, y - s * 1.05 * k, x + w * 0.22, y - s * 0.28 * k)
        .quadraticCurveTo(x + w * 0.5, y - s * 0.12 * k, x + w * 0.62, y - s * 0.62 * k)
        .bezierCurveTo(x + w * 1.15, y - s * 0.1 * k, x + w * 1.1, b, x, b);
    };
    tongue(1);
    g.fill(color).stroke({ color: INK, width: 2 });
    if (lit) { tongue(0.55); g.fill({ color: 0xFFF1A8, alpha: 0.95 }); }
  }

  _bolt(g, x, y, s) {
    g.poly([x + 0.2 * s, y - s, x - 0.55 * s, y + 0.1 * s, x - 0.05 * s, y + 0.1 * s,
            x - 0.25 * s, y + s, x + 0.55 * s, y - 0.12 * s, x + 0.05 * s, y - 0.12 * s])
      .fill(0xFFE45A).stroke({ color: INK, width: 1.5 });
  }

  destroy() { this._root.destroy({ children: true }); }
}
