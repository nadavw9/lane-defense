// ColorPicker — COLOR CHANGE booster, step 2. After the player taps a car, this
// shows a row of colored dots (the level's active colors). Tapping a dot recolors
// every on-screen car of the tapped car's original color to the chosen color.
//
// Sits between the road and the booster bar. A dim backdrop catches outside taps
// (= cancel). The picker has no animation loop; the caller destroys it on pick/cancel.
import { Container, Graphics, Text } from 'pixi.js';

const HEX = {
  Red: 0xE24B4A, Blue: 0x378ADD, Green: 0x639922,
  Yellow: 0xEF9F27, Purple: 0x7F77DD, Orange: 0xD85A30,
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
    const DOT = 46, GAP = 14, PAD = 20;
    const panelW = Math.max(220, picks.length * DOT + (picks.length - 1) * GAP + PAD * 2);
    const panelH = 108;
    const px = (w - panelW) / 2;
    const py = h - 232;   // above the booster bar (BAR_Y 752), below the road

    const panel = new Graphics();
    panel.roundRect(px, py, panelW, panelH, 18);
    panel.fill({ color: 0x12122a, alpha: 0.98 });
    panel.roundRect(px, py, panelW, panelH, 18);
    panel.stroke({ color: 0xCC66FF, width: 2, alpha: 0.75 });
    panel.eventMode = 'static';   // swallow taps on the panel (don't fall through to cancel)
    this._container.addChild(panel);

    const title = new Text({
      text: 'TAP A NEW COLOR',
      style: { fontSize: 14, fontWeight: 'bold', fill: 0xffffff,
        dropShadow: { color: 0x000000, blur: 4, distance: 1, alpha: 0.8 } },
    });
    title.anchor.set(0.5, 0);
    title.x = w / 2; title.y = py + 12;
    this._container.addChild(title);

    const dotY  = py + 66;
    const rowW  = picks.length * DOT + (picks.length - 1) * GAP;
    const startX = (w - rowW) / 2 + DOT / 2;
    picks.forEach((color, i) => {
      const x      = startX + i * (DOT + GAP);
      const isFrom = color === fromColor;
      const dot = new Graphics();
      dot.circle(0, 0, DOT / 2);
      dot.fill({ color: HEX[color] ?? 0x888888, alpha: isFrom ? 0.4 : 1 });
      dot.circle(0, 0, DOT / 2);
      dot.stroke({ color: 0xffffff, width: isFrom ? 1 : 3, alpha: isFrom ? 0.3 : 0.9 });
      dot.x = x; dot.y = dotY;
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
