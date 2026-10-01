// ColorPicker — COLOR CHANGE booster, step 2. After the player taps a car, this
// shows a row of colored dots (the level's active colors). Tapping a dot recolors
// every on-screen car of the tapped car's original color to the chosen color.
//
// Sits between the road and the booster bar. A dim backdrop catches outside taps
// (= cancel). The picker has no animation loop; the caller destroys it on pick/cancel.
import { Container, Graphics, Text, FillGradient } from 'pixi.js';
import { shapeFor } from '../game/ColorblindMode.js';

const HEX = {
  Red: 0xFF3D3D, Blue: 0x2F8CFF, Green: 0x2FCC55,
  Yellow: 0xFFD42A, Purple: 0xA35CFF, Orange: 0xFF8A1C,
};

export class ColorPicker {
  // colors:    string[] active colors in the level
  // fromColor: the tapped car's color (shown dimmed — recoloring to itself is a no-op)
  // callbacks: { onPick(color), onCancel() }
  constructor(stage, appW, appH, colors, fromColor, { onPick, onCancel }) {
    this._container = new Container();
    stage.addChild(this._container);
    this._onPick   = onPick;
    this._onCancel = onCancel;
    this._build(appW, appH, colors, fromColor);
  }

  destroy() { this._container.destroy({ children: true }); }

  _build(w, h, colors, fromColor) {
    // Dim catch-all backdrop — a tap outside the panel cancels.
    const bg = new Graphics();
    bg.rect(0, 0, w, h);
    bg.fill({ color: 0x000000, alpha: 0.45 });
    bg.eventMode = 'static';
    bg.on('pointerdown', () => this._onCancel?.());
    this._container.addChild(bg);

    const picks  = colors.filter(Boolean);
    const DOT = 54, GAP = 16, PAD = 24;
    const panelW = Math.max(240, picks.length * DOT + (picks.length - 1) * GAP + PAD * 2);
    const panelH = 124;
    const px = (w - panelW) / 2;
    const py = h - 248;   // above the booster bar (BAR_Y 752), below the road

    // Premium card: indigo gradient, gold rim, inner highlight (matches the HUD).
    const panel = new Graphics();
    panel.roundRect(px + 2, py + 6, panelW, panelH, 22).fill({ color: 0x000000, alpha: 0.35 });
    panel.roundRect(px, py, panelW, panelH, 22).fill(new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local',
      colorStops: [{ offset: 0, color: 0x3A3580 }, { offset: 1, color: 0x221F58 }] }));
    panel.roundRect(px, py, panelW, panelH, 22).stroke({ color: 0xB9771C, width: 3 });
    panel.roundRect(px + 3, py + 3, panelW - 6, panelH - 6, 19).stroke({ color: 0xFFFFFF, width: 1, alpha: 0.14 });
    panel.eventMode = 'static';   // swallow taps on the panel (don't fall through to cancel)
    this._container.addChild(panel);

    const title = new Text({
      text: 'PICK A NEW COLOUR',
      style: { fontFamily: '"Lilita One", Fredoka, Arial, sans-serif', fontSize: 19, fill: 0xFFC93C, letterSpacing: 1,
        stroke: { color: 0x1F1A33, width: 4, join: 'round' } },
    });
    title.anchor.set(0.5, 0);
    title.x = w / 2; title.y = py + 10;
    this._container.addChild(title);

    const dotY  = py + 76;
    const rowW  = picks.length * DOT + (picks.length - 1) * GAP;
    const startX = (w - rowW) / 2 + DOT / 2;
    picks.forEach((color, i) => {
      const x      = startX + i * (DOT + GAP);
      const isFrom = color === fromColor;
      const r = DOT / 2, hex = HEX[color] ?? 0x888888;
      // Glossy paint drop with an ink outline; the current colour is greyed and crossed.
      const dot = new Graphics();
      dot.circle(1, 4, r).fill({ color: 0x000000, alpha: 0.35 });
      dot.circle(0, 0, r).fill({ color: hex, alpha: isFrom ? 0.35 : 1 });
      dot.circle(0, r * 0.18, r * 0.82).fill({ color: 0x000000, alpha: isFrom ? 0 : 0.12 });
      dot.ellipse(-r * 0.2, -r * 0.42, r * 0.5, r * 0.26).fill({ color: 0xFFFFFF, alpha: isFrom ? 0.15 : 0.55 });
      dot.circle(0, 0, r).stroke({ color: 0x1F1A33, width: 3.5 });
      if (isFrom) {
        dot.moveTo(-r * 0.45, -r * 0.45).lineTo(r * 0.45, r * 0.45).moveTo(r * 0.45, -r * 0.45).lineTo(-r * 0.45, r * 0.45)
          .stroke({ color: 0xFFFFFF, width: 4, alpha: 0.7 });
      }
      const sym = shapeFor(color);
      if (sym) {   // colourblind mode: every swatch also carries its shape
        const st = new Text({ text: sym, style: { fontSize: Math.round(r * 1.1), fontWeight: '900', fill: 0xFFFFFF, stroke: { color: 0x1F1A33, width: 3 } } });
        st.anchor.set(0.5); st.alpha = isFrom ? 0.4 : 1;
        dot.addChild(st);
      }
      dot.x = x; dot.y = dotY;
      (this.swatches ??= []).push({ color, x, y: dotY, enabled: !isFrom });   // QA hooks
      if (!isFrom) {
        dot.eventMode = 'static';
        dot.cursor    = 'pointer';
        dot.on('pointerdown', (e) => { e.stopPropagation?.(); this._onPick?.(color); });
        dot.on('pointerover', () => dot.scale.set(1.12));
        dot.on('pointerout',  () => dot.scale.set(1));
      }
      this._container.addChild(dot);
    });
  }
}
