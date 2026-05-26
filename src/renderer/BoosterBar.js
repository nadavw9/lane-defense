// BoosterBar — three 52×52 icon-card booster buttons + bomb kill-progress pips.
//   SWAP • FREEZE • BOMB
import { Graphics, Text } from 'pixi.js';

export const BAR_Y   = 752;
const BAR_H   = 68;

// ── Icon card layout ──────────────────────────────────────────────────────────
const CARD_W    = 52;
const CARD_H    = 52;
const CARD_GAP  = 8;
const CARD_R    = 10;
const NUM_CARDS = 3;
const TOTAL_W   = NUM_CARDS * CARD_W + (NUM_CARDS - 1) * CARD_GAP;
const BAR_XOFF  = Math.round((390 - TOTAL_W) / 2);
const CARD_Y    = BAR_Y + Math.round((BAR_H - CARD_H) / 2);

const CARD_X = Array.from({ length: NUM_CARDS }, (_, i) => BAR_XOFF + i * (CARD_W + CARD_GAP));
// Indices: 0=SWAP, 1=FREEZE, 2=BOMB

const KILLS_PER_BOMB = 10;
const PIP_Y          = BAR_Y + BAR_H - 9;

export class BoosterBar {
  constructor(layerManager, boosterState, gameState, appW, onSwap, onFreeze, onBomb) {
    this._state = boosterState;
    this._gs    = gameState;
    this._layer = layerManager.get('hudLayer');

    // Background strip
    const bg = new Graphics();
    bg.rect(0, BAR_Y, appW, BAR_H);
    bg.fill(0x0a0a18);
    bg.rect(0, BAR_Y, appW, 1);
    bg.fill(0x1a1a3a);
    this._layer.addChild(bg);

    this._swapBtn   = _makeCard(this._layer, CARD_X[0], 0x66aaff, _iconSwap,   'SWAP',   onSwap);
    this._freezeBtn = _makeCard(this._layer, CARD_X[1], 0x44ccff, _iconFreeze, 'FREEZE', onFreeze);
    this._bombBtn   = _makeBombCard(this._layer, CARD_X[2], onBomb);

    this._swapBtn._unlocked   = false;
    this._freezeBtn._unlocked = false;

    this._bombGlow = new Graphics();
    this._layer.addChild(this._bombGlow);

    // Kill-progress pips centred under the bomb card.
    this._pips = [];
    const pipR   = 3.5;
    const pipGap = 5;
    const pipsW  = KILLS_PER_BOMB * (pipR * 2) + (KILLS_PER_BOMB - 1) * pipGap;
    const pipX0  = CARD_X[2] + (CARD_W - pipsW) / 2 + pipR;
    for (let i = 0; i < KILLS_PER_BOMB; i++) {
      const pip = new Graphics();
      pip.circle(0, 0, pipR);
      pip.fill(0x333355);
      pip.x = pipX0 + i * (pipR * 2 + pipGap);
      pip.y = PIP_Y;
      this._layer.addChild(pip);
      this._pips.push(pip);
    }

    this._readyText  = null;
    this._readyTextT = 0;
    this._prevBombs  = 0;
    this._bombPulse  = 0;
    this._bombFlashT = 0;
  }

  setButtonVisibility(swap, freeze) {
    this._swapBtn._unlocked   = swap;
    this._freezeBtn._unlocked = freeze;
  }

  update(dt = 0) {
    const s  = this._state;
    const gs = this._gs;

    // ── Count badge labels (short form — icon identifies the button) ──────────
    const swapLabel   = `×${s.swap}`;
    const freezeLabel = `×${s.freeze}`;
    const bombLabel   = s.bombMode  ? 'CANCEL' : `×${s.bombs}`;

    if (this._swapBtn.label.text   !== swapLabel)   this._swapBtn.label.text   = swapLabel;
    if (this._freezeBtn.label.text !== freezeLabel) this._freezeBtn.label.text = freezeLabel;
    if (this._bombBtn.label.text   !== bombLabel) {
      this._bombBtn.label.text = bombLabel;
      if (this._bombBtn.bombIcon) this._bombBtn.bombIcon.visible = !s.bombMode;
    }

    this._swapBtn.alpha   = !this._swapBtn._unlocked   ? 0.18 : s.swap   <= 0 ? 0.28 : s.swapMode ? 0.55 : 1.0;
    this._freezeBtn.alpha = !this._freezeBtn._unlocked ? 0.18 : (s.freeze <= 0 || s.isFrozen())  ? 0.28 : 1.0;
    this._bombBtn.alpha   = (s.bombs <= 0 && !s.bombMode) ? 0.30 : s.bombMode ? 0.70 : 1.0;

    // ── Bomb card glow / pulse ────────────────────────────────────────────────
    this._bombPulse += dt * 3.5;
    const pulseAlpha = s.bombs > 0 ? (0.30 + 0.20 * Math.sin(this._bombPulse)) : 0.10;
    const glowColor  = s.bombMode ? 0xff3300 : 0xffaa00;

    this._bombGlow.clear();
    this._bombGlow.roundRect(CARD_X[2] - 2, CARD_Y - 2, CARD_W + 4, CARD_H + 4, CARD_R + 2);
    this._bombGlow.stroke({ color: glowColor, width: 2, alpha: pulseAlpha * (s.bombs > 0 ? 1.8 : 1) });

    if (this._bombFlashT > 0) {
      this._bombFlashT = Math.max(0, this._bombFlashT - dt);
      const fl = this._bombFlashT / 0.5;
      this._bombGlow.roundRect(CARD_X[2] - 4, CARD_Y - 4, CARD_W + 8, CARD_H + 8, CARD_R + 4);
      this._bombGlow.stroke({ color: 0xffdd00, width: 4, alpha: fl });
    }

    if (s.bombs > this._prevBombs) {
      this._bombFlashT = 0.5;
      this._spawnReadyText();
    }
    this._prevBombs = s.bombs;

    // ── Kill-progress pips ────────────────────────────────────────────────────
    const filled = gs.killsTowardBomb % KILLS_PER_BOMB;
    for (let i = 0; i < KILLS_PER_BOMB; i++) {
      const pip = this._pips[i];
      pip.clear();
      pip.circle(0, 0, 3.5);
      pip.fill(i < filled ? 0xffaa00 : 0x333355);
    }

    // ── "BOMB READY!" floating text ───────────────────────────────────────────
    if (this._readyText) {
      this._readyTextT       -= dt;
      this._readyText.y      -= dt * 28;
      this._readyText.alpha   = Math.max(0, this._readyTextT / 1.4);
      if (this._readyTextT <= 0) {
        this._readyText.destroy();
        this._readyText = null;
      }
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  _spawnReadyText() {
    if (this._readyText) { this._readyText.destroy(); this._readyText = null; }
    const t = new Text({
      text: 'BOMB READY!',
      style: {
        fontSize:   16,
        fontWeight: 'bold',
        fill:       0xffdd00,
        dropShadow: { color: 0x000000, blur: 6, distance: 2, alpha: 0.9 },
      },
    });
    t.anchor.set(0.5, 1);
    t.x = CARD_X[2] + CARD_W / 2;
    t.y = BAR_Y - 4;
    this._readyTextT = 1.4;
    this._layer.addChild(t);
    this._readyText = t;
  }
}

// ── Card helpers ──────────────────────────────────────────────────────────────

function _cardBase(layer, x, accentColor) {
  const card = new Graphics();

  // Dark base
  card.roundRect(0, 0, CARD_W, CARD_H, CARD_R);
  card.fill({ color: 0x0b0b18 });

  // Lighter top gradient strip (≈45% of height)
  card.roundRect(0, 0, CARD_W, Math.round(CARD_H * 0.45), CARD_R);
  card.fill({ color: 0x181830, alpha: 0.9 });

  // Thin colored accent line at top
  card.rect(CARD_R, 0, CARD_W - CARD_R * 2, 2);
  card.fill({ color: accentColor, alpha: 0.90 });

  // Border
  card.roundRect(0.5, 0.5, CARD_W - 1, CARD_H - 1, CARD_R);
  card.stroke({ color: accentColor, width: 1, alpha: 0.38 });

  card.x = x;
  card.y = CARD_Y;
  layer.addChild(card);
  return card;
}

function _addCountLabel(card, accentColor) {
  const badge = new Graphics();
  badge.roundRect(-13, -9, 26, 18, 9);
  badge.fill({ color: 0x050510, alpha: 0.88 });
  badge.roundRect(-13, -9, 26, 18, 9);
  badge.stroke({ color: accentColor, width: 1, alpha: 0.55 });
  badge.x = CARD_W - 14;
  badge.y = 13;
  card.addChild(badge);

  const tx = new Text({
    text: '×0',
    style: { fontSize: 10, fontWeight: 'bold', fill: 0xffffff,
      dropShadow: { color: 0x000000, blur: 2, distance: 0, alpha: 0.8 } },
  });
  tx.anchor.set(0.5, 0.5);
  tx.x = CARD_W - 14;
  tx.y = 13;
  card.addChild(tx);
  return tx;
}

function _addNameLabel(card, name, accentColor) {
  const tx = new Text({
    text: name,
    style: { fontSize: 11, fontWeight: 'bold', fill: accentColor, alpha: 0.85 },
  });
  tx.anchor.set(0.5, 1);
  tx.x = CARD_W / 2;
  tx.y = CARD_H - 3;
  card.addChild(tx);
}

function _makeCard(layer, x, accentColor, iconFn, name, onClick) {
  const card = _cardBase(layer, x, accentColor);

  iconFn(card, CARD_W / 2, CARD_H / 2 - 5, accentColor);
  _addNameLabel(card, name, accentColor);

  const countTx = _addCountLabel(card, accentColor);
  card.label = countTx;

  card.eventMode = 'static';
  card.cursor    = 'pointer';
  card.on('pointerdown', onClick);
  return card;
}

function _makeBombCard(layer, x, onClick) {
  const c    = 0xffaa00;
  const card = _cardBase(layer, x, c);

  // Bomb icon (separate Graphics so it can be hidden in bomb-mode)
  const icon = new Graphics();
  const bx = CARD_W / 2, by = CARD_H / 2 - 5;
  const R  = 9;
  icon.circle(bx, by + 2, R); icon.fill({ color: 0x1a1006 });
  icon.circle(bx, by + 2, R); icon.stroke({ color: c, width: 1.5, alpha: 0.9 });
  icon.roundRect(bx - 1.5, by + 2 - R - 7, 3, 8, 1.5); icon.fill({ color: 0xffcc44 });
  icon.circle(bx + 3, by + 2 - R - 6, 2.5); icon.fill({ color: 0xffff88 });
  card.addChild(icon);
  card.bombIcon = icon;

  _addNameLabel(card, 'BOMB', c);

  const countTx = _addCountLabel(card, c);
  card.label = countTx;

  card.eventMode = 'static';
  card.cursor    = 'pointer';
  card.on('pointerdown', onClick);
  return card;
}

// ── Icon drawing functions ────────────────────────────────────────────────────

function _iconSwap(g, cx, cy, c) {
  // Two column bars with exchange arrows
  g.rect(cx - 14, cy - 8, 5, 16); g.fill({ color: c, alpha: 0.70 });
  g.rect(cx + 9,  cy - 8, 5, 16); g.fill({ color: c, alpha: 0.70 });
  // Right-pointing arrow (top)
  g.moveTo(cx - 6, cy - 4); g.lineTo(cx + 6, cy - 4); g.lineTo(cx + 3, cy - 8); g.closePath();
  g.fill({ color: 0xffffff, alpha: 0.88 });
  // Left-pointing arrow (bottom)
  g.moveTo(cx + 6, cy + 4); g.lineTo(cx - 6, cy + 4); g.lineTo(cx - 3, cy + 8); g.closePath();
  g.fill({ color: 0xffffff, alpha: 0.88 });
}

function _iconFreeze(g, cx, cy, c) {
  // 4-arm cross (main axes)
  g.rect(cx - 1.5, cy - 10, 3, 20); g.fill({ color: c, alpha: 0.85 });
  g.rect(cx - 10,  cy - 1.5, 20, 3); g.fill({ color: c, alpha: 0.85 });
  // Diagonal arms
  const arm = 7;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a) * arm, cy + Math.sin(a) * arm);
    g.stroke({ color: c, width: 1.8, alpha: 0.65 });
  }
  // Center dot
  g.circle(cx, cy, 2.8); g.fill({ color: 0xffffff, alpha: 0.9 });
}
