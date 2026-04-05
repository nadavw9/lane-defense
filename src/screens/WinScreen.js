// WinScreen — full-screen results overlay shown on level complete.
// Displays star rating (1-3), coins earned, max combo, and a "Next Level" button.
//
// Star rating is based on how close cars got to the endpoint:
//   3 stars — maxCarPosition < 65  (dominant win, no rescue)
//   2 stars — maxCarPosition < 82  (clean win, no rescue)
//   1 star  — rescue used, or cars reached the danger zone
import { Container, Graphics, Text } from 'pixi.js';

const STAR_COLOR_FULL  = 0xffcc00;
const STAR_COLOR_EMPTY = 0x3a3a3a;

function calcStars(gs) {
  if (gs.rescueUsed)              return 1;
  if (gs.maxCarPosition < 60)     return 3;
  if (gs.maxCarPosition < 80)     return 2;
  return 1;
}

export class WinScreen {
  // onNext — callback for the "Next Level" button
  constructor(stage, appW, appH, gs, onNext) {
    this._container = new Container();
    stage.addChild(this._container);
    this._build(appW, appH, gs, onNext);
  }

  destroy() {
    this._container.destroy({ children: true });
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _build(w, h, gs, onNext) {
    // Full-screen dim
    const backdrop = new Graphics();
    backdrop.rect(0, 0, w, h);
    backdrop.fill({ color: 0x000011, alpha: 0.82 });
    backdrop.eventMode = 'static';   // block clicks reaching game layers
    this._container.addChild(backdrop);

    // Centred panel
    const panelW = 310, panelH = 370;
    const px = (w - panelW) / 2;
    const py = (h - panelH) / 2 - 20;

    const panel = new Graphics();
    panel.roundRect(px, py, panelW, panelH, 18);
    panel.fill({ color: 0x0d1a2e, alpha: 0.97 });
    panel.roundRect(px, py, panelW, panelH, 18);
    panel.stroke({ color: 0x44aaff, width: 2, alpha: 0.45 });
    this._container.addChild(panel);

    const cx = w / 2;
    let y = py + 40;

    this._text('LEVEL COMPLETE', cx, y, { fontSize: 28, fill: 0x44ff88 });
    y += 52;

    this._stars(cx, y, calcStars(gs));
    y += 68;

    this._text(`◆ ${gs.coins}`, cx, y, { fontSize: 26, fill: 0xf5c842 });
    y += 8;
    this._text('coins earned', cx, y + 22, { fontSize: 14, fill: 0x999999, fontWeight: 'normal' });
    y += 52;

    this._text(`×${gs.maxCombo}`, cx, y, { fontSize: 24, fill: 0xffffff });
    this._text('best combo', cx, y + 22, { fontSize: 14, fill: 0x999999, fontWeight: 'normal' });
    y += 60;

    this._button('NEXT LEVEL', cx, y, 0x1a6a3a, 0x55ff99, onNext);
  }

  _text(str, x, y, style) {
    const t = new Text({ text: str, style: { fontWeight: 'bold', ...style } });
    t.anchor.set(0.5, 0.5);
    t.x = x;
    t.y = y;
    this._container.addChild(t);
    return t;
  }

  _stars(cx, cy, count) {
    // 3 stars, each 26px radius, 12px gap
    const R = 26, GAP = 12;
    const totalW = 3 * R * 2 + 2 * GAP;
    const x0 = cx - totalW / 2 + R;
    for (let i = 0; i < 3; i++) {
      const filled = i < count;
      const g = new Graphics();
      this._drawStar(g, R, filled ? STAR_COLOR_FULL : STAR_COLOR_EMPTY);
      // Unfilled stars are slightly smaller so the earned stars pop
      if (!filled) g.scale.set(0.82);
      g.x = x0 + i * (R * 2 + GAP);
      g.y = cy;
      this._container.addChild(g);
    }
  }

  _drawStar(g, outerR, color) {
    const pts    = 5;
    const innerR = outerR * 0.42;
    const points = [];
    for (let i = 0; i < pts * 2; i++) {
      const angle  = (Math.PI * i) / pts - Math.PI / 2;
      const radius = (i % 2 === 0) ? outerR : innerR;
      points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    g.poly(points);
    g.fill(color);
  }

  _button(label, cx, y, bgColor, labelColor, onClick) {
    const btnW = 210, btnH = 52;
    const btn  = new Graphics();
    btn.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 12);
    btn.fill(bgColor);
    btn.x = cx;
    btn.y = y;
    btn.eventMode = 'static';
    btn.cursor    = 'pointer';
    btn.on('pointerdown', onClick);
    btn.on('pointerover',  () => { btn.alpha = 0.80; });
    btn.on('pointerout',   () => { btn.alpha = 1.00; });

    const t = new Text({ text: label, style: { fontSize: 22, fontWeight: 'bold', fill: labelColor } });
    t.anchor.set(0.5, 0.5);
    btn.addChild(t);
    this._container.addChild(btn);
  }
}
