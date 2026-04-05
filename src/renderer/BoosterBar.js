// BoosterBar — two booster buttons rendered in the 760-800px booster bar area.
//   • SWAP: tap two columns to exchange their top shooters (3 charges)
//   • PEEK: reveals the 3rd shooter in each column for 4 seconds (3 charges)
// Button labels show remaining charges and dim when depleted or swap mode active.
import { Graphics, Text } from 'pixi.js';

const BAR_Y = 760;
const BAR_H = 40;
const BTN_W = 100;
const BTN_H = 30;
const GAP   = 20;

export class BoosterBar {
  constructor(layerManager, boosterState, gameState, appW, onSwap, onPeek) {
    this._state = boosterState;
    this._gs    = gameState;
    const layer = layerManager.get('hudLayer');
    const cx    = appW / 2;

    // Background strip + top divider line
    const bg = new Graphics();
    bg.rect(0, BAR_Y, appW, BAR_H);
    bg.fill(0x0a0a18);
    bg.rect(0, BAR_Y, appW, 1);
    bg.fill(0x1a1a3a);
    layer.addChild(bg);

    const btnY = BAR_Y + (BAR_H - BTN_H) / 2;

    this._swapBtn = _makeBtn(
      layer, 'SWAP ×3',
      cx - BTN_W - GAP / 2, btnY, BTN_W, BTN_H,
      0x0d2040, 0x66aaff, onSwap,
    );

    this._peekBtn = _makeBtn(
      layer, 'PEEK ×3',
      cx + GAP / 2, btnY, BTN_W, BTN_H,
      0x0d2040, 0xaaff66, onPeek,
    );
  }

  // Call once per render frame to keep labels and opacity current.
  update() {
    const s  = this._state;
    const el = this._gs.elapsed;

    const swapLabel = `SWAP ×${s.swap}`;
    const peekLabel = `PEEK ×${s.peek}`;

    if (this._swapBtn.label.text !== swapLabel) this._swapBtn.label.text = swapLabel;
    if (this._peekBtn.label.text !== peekLabel) this._peekBtn.label.text = peekLabel;

    // Dim when depleted or during swap selection mode.
    this._swapBtn.alpha = s.swap <= 0 ? 0.28 : s.swapMode ? 0.55 : 1.0;
    this._peekBtn.alpha = (s.peek <= 0 || s.isPeeking(el)) ? 0.28 : 1.0;
  }
}

// ── Module-private helpers ─────────────────────────────────────────────────────

function _makeBtn(layer, label, x, y, w, h, bgColor, fgColor, onClick) {
  const btn = new Graphics();
  btn.roundRect(0, 0, w, h, 7);
  btn.fill(bgColor);
  btn.roundRect(0, 0, w, h, 7);
  btn.stroke({ color: fgColor, width: 1.2, alpha: 0.50 });
  btn.x = x;
  btn.y = y;
  btn.eventMode = 'static';
  btn.cursor    = 'pointer';
  btn.on('pointerdown', onClick);

  const t = new Text({ text: label, style: { fontSize: 13, fontWeight: 'bold', fill: fgColor } });
  t.anchor.set(0.5, 0.5);
  t.x = w / 2;
  t.y = h / 2;
  btn.addChild(t);

  // Expose label Text so BoosterBar.update() can mutate it.
  btn.label = t;

  layer.addChild(btn);
  return btn;
}
