// BoosterBar — three booster buttons rendered in the 756–796px booster bar area.
//   • SWAP: tap two columns to exchange their top shooters
//   • PEEK: reveals 4th+5th shooter pips per column for 4 seconds
//   • FREEZE: freezes all cars for 10 seconds
// Button labels show remaining charges and dim when depleted.
// Call setButtonVisibility(swap, peek, freeze) to gate buttons during early levels.
import { Graphics, Text } from 'pixi.js';

const BAR_Y = 756;
const BAR_H = 40;
const BTN_W = 100;
const BTN_H = 30;
const GAP   = 15;

// Three-button centred layout: total = 3*100 + 2*15 = 330; start = (390-330)/2 = 30
const BTN_X = [30, 145, 260];

export class BoosterBar {
  constructor(layerManager, boosterState, gameState, appW, onSwap, onPeek, onFreeze) {
    this._state = boosterState;
    this._gs    = gameState;
    const layer = layerManager.get('hudLayer');

    // Background strip + top divider line
    const bg = new Graphics();
    bg.rect(0, BAR_Y, appW, BAR_H);
    bg.fill(0x0a0a18);
    bg.rect(0, BAR_Y, appW, 1);
    bg.fill(0x1a1a3a);
    layer.addChild(bg);

    const btnY = BAR_Y + (BAR_H - BTN_H) / 2;

    this._swapBtn   = _makeBtn(layer, 'SWAP ×0',   BTN_X[0], btnY, BTN_W, BTN_H, 0x0d2040, 0x66aaff, onSwap);
    this._peekBtn   = _makeBtn(layer, 'PEEK ×0',   BTN_X[1], btnY, BTN_W, BTN_H, 0x0d2040, 0xaaff66, onPeek);
    this._freezeBtn = _makeBtn(layer, 'FREEZE ×0', BTN_X[2], btnY, BTN_W, BTN_H, 0x0a1a2a, 0x44ccff, onFreeze);
  }

  // Show or hide individual buttons (feature gating).
  setButtonVisibility(swap, peek, freeze) {
    this._swapBtn.visible   = swap;
    this._peekBtn.visible   = peek;
    this._freezeBtn.visible = freeze;
  }

  // Call once per render frame to keep labels and opacity current.
  update() {
    const s  = this._state;
    const el = this._gs.elapsed;

    const swapLabel   = `SWAP ×${s.swap}`;
    const peekLabel   = `PEEK ×${s.peek}`;
    const freezeLabel = `FREEZE ×${s.freeze}`;

    if (this._swapBtn.label.text   !== swapLabel)   this._swapBtn.label.text   = swapLabel;
    if (this._peekBtn.label.text   !== peekLabel)   this._peekBtn.label.text   = peekLabel;
    if (this._freezeBtn.label.text !== freezeLabel) this._freezeBtn.label.text = freezeLabel;

    this._swapBtn.alpha   = s.swap   <= 0 ? 0.28 : s.swapMode ? 0.55 : 1.0;
    this._peekBtn.alpha   = (s.peek  <= 0 || s.isPeeking(el)) ? 0.28 : 1.0;
    this._freezeBtn.alpha = (s.freeze <= 0 || s.isFrozen(el)) ? 0.28 : 1.0;
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

  const t = new Text({ text: label, style: { fontSize: 12, fontWeight: 'bold', fill: fgColor } });
  t.anchor.set(0.5, 0.5);
  t.x = w / 2;
  t.y = h / 2;
  btn.addChild(t);

  // Expose label Text so BoosterBar.update() can mutate it.
  btn.label = t;

  layer.addChild(btn);
  return btn;
}
