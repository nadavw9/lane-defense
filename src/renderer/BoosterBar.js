// BoosterBar — three 64×64 icon-card booster buttons (SWAP • FREEZE • BOMB).
// Icons are PNG sprites (booster-{swap,freeze,bomb}.png); each card shows a
// ×N count badge and an 18px name label. Bomb glow pulses when bombs available.
import { Graphics, Text, Sprite, Assets } from 'pixi.js';

const _B = import.meta.env.BASE_URL;
function boosterUrl(name) { return `${_B}sprites/designed/booster-${name}.png`; }

export const BAR_Y   = 752;
const BAR_H   = 68;

// ── Icon card layout ──────────────────────────────────────────────────────────
// 64px cards: generous tap target and room for a readable 18px label.
const CARD_W    = 64;
const CARD_H    = 64;
const CARD_GAP  = 10;
const CARD_R    = 12;
const NUM_CARDS = 3;
const TOTAL_W   = NUM_CARDS * CARD_W + (NUM_CARDS - 1) * CARD_GAP;
const BAR_XOFF  = Math.round((390 - TOTAL_W) / 2);
const CARD_Y    = BAR_Y + Math.round((BAR_H - CARD_H) / 2);

const ICON_SIZE  = 32;   // sprite icon, centered in the upper card area
const ICON_CY    = 22;   // icon center Y — above the bottom name label
const LABEL_SIZE = 18;   // name label — meets the design-system UI floor

const CARD_X = Array.from({ length: NUM_CARDS }, (_, i) => BAR_XOFF + i * (CARD_W + CARD_GAP));
// Indices: 0=SWAP, 1=FREEZE, 2=BOMB


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
    this._bg = bg;

    this._swapBtn   = _makeCard(this._layer, CARD_X[0], 0x66aaff, 'swap',   'SWAP',   onSwap);
    this._freezeBtn = _makeCard(this._layer, CARD_X[1], 0x44ccff, 'freeze', 'FREEZE', onFreeze);
    this._bombBtn   = _makeBombCard(this._layer, CARD_X[2], onBomb);

    this._swapBtn._unlocked   = false;
    this._freezeBtn._unlocked = false;

    this._bombGlow = new Graphics();
    this._layer.addChild(this._bombGlow);

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

  // Show/hide the entire bar (used to clear it behind end-screen modals).
  // Visibility-only — does not restyle.
  setVisible(v) {
    for (const obj of [this._bg, this._swapBtn, this._freezeBtn, this._bombBtn, this._bombGlow, this._readyText]) {
      if (obj) obj.visible = v;
    }
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
  badge.roundRect(-17, -12, 34, 24, 12);
  badge.fill({ color: 0x050510, alpha: 0.92 });
  badge.roundRect(-17, -12, 34, 24, 12);
  badge.stroke({ color: accentColor, width: 1.5, alpha: 0.70 });
  badge.x = CARD_W - 18;
  badge.y = 13;
  card.addChild(badge);

  const tx = new Text({
    text: '×0',
    style: { fontSize: 16, fontWeight: 'bold', fill: 0xffffff,
      dropShadow: { color: 0x000000, blur: 3, distance: 0, alpha: 0.9 } },
  });
  tx.anchor.set(0.5, 0.5);
  tx.x = CARD_W - 18;
  tx.y = 13;
  card.addChild(tx);
  return tx;
}

function _addNameLabel(card, name, accentColor) {
  const tx = new Text({
    text: name,
    style: { fontSize: LABEL_SIZE, fontWeight: 'bold', fill: accentColor,
      dropShadow: { color: 0x000000, blur: 3, distance: 1, alpha: 0.8 } },
  });
  tx.anchor.set(0.5, 1);
  tx.x = CARD_W / 2;
  tx.y = CARD_H - 3;
  card.addChild(tx);
}

// Icon: PNG sprite when loaded (preferred), else programmatic glyph fallback.
// Returns the display object so the bomb card can hide it in bomb-mode.
function _addIconSprite(card, name, accentColor) {
  const tex = Assets.get(boosterUrl(name));
  if (tex) {
    const sp = new Sprite(tex);
    sp.anchor.set(0.5);
    sp.scale.set(ICON_SIZE / Math.max(tex.width, tex.height));  // fit, no distortion
    sp.x = CARD_W / 2;
    sp.y = ICON_CY;
    card.addChild(sp);
    return sp;
  }
  const g  = new Graphics();
  const fn = name === 'swap' ? _iconSwap : name === 'freeze' ? _iconFreeze : _iconBomb;
  fn(g, CARD_W / 2, ICON_CY, accentColor);
  card.addChild(g);
  return g;
}

function _makeCard(layer, x, accentColor, iconName, name, onClick) {
  const card = _cardBase(layer, x, accentColor);

  _addIconSprite(card, iconName, accentColor);
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

  // Sprite icon (kept on `bombIcon` so it can be hidden in bomb-mode → CANCEL)
  const icon = _addIconSprite(card, 'bomb', c);
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

function _iconBomb(g, cx, cy, c) {
  // Round bomb body + lit fuse (fallback when the PNG sprite isn't loaded)
  const R = 9;
  g.circle(cx, cy + 2, R); g.fill({ color: 0x1a1006 });
  g.circle(cx, cy + 2, R); g.stroke({ color: c, width: 1.5, alpha: 0.9 });
  g.roundRect(cx - 1.5, cy + 2 - R - 7, 3, 8, 1.5); g.fill({ color: 0xffcc44 });
  g.circle(cx + 3, cy + 2 - R - 6, 2.5); g.fill({ color: 0xffff88 });
}
