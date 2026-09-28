// BoosterBar — three 64×64 icon-card booster buttons (COLOR • FREEZE • BOMB).
// Icons are PNG sprites (booster-{colorchange,freeze,bomb}.png); each card shows a
// ×N count badge and an 18px name label. Bomb glow pulses when bombs available.
import { Graphics, Text, Sprite, Assets } from 'pixi.js';
import { INK, PLUM_DEEP, SUN, toyPanel, toyLabel } from './ToyStyle.js';

const _B = import.meta.env.BASE_URL;
function boosterUrl(name) { return `${_B}sprites/designed/booster-${name}.png`; }

// 2026-08-02 BOTTOM-CHROME RECLAIM: 752 -> 776. BAR_Y + BAR_H = 844 = APP_H
// exactly, so the booster row sits FLUSH to the bottom edge and the 24px dead
// strip below it is reclaimed. Mirrored by projection.BOOSTER_BAR_TOP_Y (guard:
// tests/bomb-slot-position-sync.test.js) and consumed by CityEdges and
// HUDRenderer, which derive from it.
//
// 2026-08-07: 776 -> 768, with BAR_H 68 -> 76 so the bar still ENDS at 844. The
// reclaim is what makes the bar flush, and flush is correct for the bar's
// background — but it left the 64px cards only 2px above the stage bottom and
// their name labels 5px, which on a desktop window (stage scale ~0.7) is 1.4 and
// 3.5 CSS px. Nothing was clipped, but it reads as cut off, which is what the
// device report described. Giving the 8px back to the bar rather than to a dead
// strip keeps the flush edge and roughly triples the label clearance (5 -> 9px).
// Cost, accepted by the owner: 8px less vertical room above for the bomb queue,
// so the solved ball radius drops slightly from the reclaim's peak.
export const BAR_Y = 768;
export const BAR_H = 76;

// ── Icon card layout ──────────────────────────────────────────────────────────
// 64px cards: generous tap target and room for a readable 18px label.
const CARD_W    = 64;
const CARD_H    = 64;
const CARD_GAP  = 10;
const CARD_R    = 14;
const CARD_LIP  = 4;     // toy-button lip, inside CARD_H (face = CARD_H - CARD_LIP)
const NUM_CARDS = 3;
const TOTAL_W   = NUM_CARDS * CARD_W + (NUM_CARDS - 1) * CARD_GAP;
const BAR_XOFF  = Math.round((390 - TOTAL_W) / 2);
const CARD_Y    = BAR_Y + Math.round((BAR_H - CARD_H) / 2);

const ICON_SIZE  = 32;   // sprite icon, centered in the upper card area
const ICON_CY    = 22;   // icon center Y — above the bottom name label
const LABEL_SIZE = 15;   // name label — fits INSIDE the 64px card with its ink outline
                         // (at 18 the words overhung the card edges); the icon carries identity

// ── Press animation (SWAP / FREEZE only — BOMB has its own glow feedback) ───────
// On tap: scale down to 0.88 over 60ms (ease-in), spring back to 1.0 over 80ms.
const PRESS_DOWN_S  = 0.06;
const PRESS_UP_S    = 0.08;
const PRESS_MIN     = 0.88;

const CARD_X = Array.from({ length: NUM_CARDS }, (_, i) => BAR_XOFF + i * (CARD_W + CARD_GAP));
// Indices: 0=COLOR CHANGE, 1=FREEZE, 2=BOMB
// Toy Town card faces — each booster owns one saturated colour (palette-aligned).
const COLOR_CHANGE_ACCENT = 0xA35CFF;   // purple  (palette Purple)
const FREEZE_ACCENT       = 0x2FB4FF;   // ice cyan
const BOMB_ACCENT         = 0xFF8A1C;   // orange  (palette Orange)


export class BoosterBar {
  constructor(layerManager, boosterState, gameState, appW, onColorChange, onFreeze, onBomb) {
    this._state = boosterState;
    this._gs    = gameState;
    this._layer = layerManager.get('hudLayer');

    // Background strip
    const bg = new Graphics();
    bg.rect(0, BAR_Y, appW, BAR_H);
    bg.fill(PLUM_DEEP);
    bg.rect(0, BAR_Y, appW, 3);
    bg.fill(INK);
    this._layer.addChild(bg);
    this._bg = bg;

    this._colorChangeBtn = _makeCard(this._layer, CARD_X[0], COLOR_CHANGE_ACCENT, 'colorchange', 'COLOR', onColorChange);
    this._freezeBtn = _makeCard(this._layer, CARD_X[1], FREEZE_ACCENT, 'freeze', 'FREEZE', onFreeze);
    this._bombBtn   = _makeBombCard(this._layer, CARD_X[2], onBomb);

    this._colorChangeBtn._unlocked = false;
    this._freezeBtn._unlocked      = false;

    this._bombGlow = new Graphics();
    this._layer.addChild(this._bombGlow);

    // 4D: idle "ready" glow for SWAP/FREEZE when they have charges available.
    this._readyGlow  = new Graphics();
    this._layer.addChild(this._readyGlow);
    this._readyPulse = 0;

    // 4C: color-bomb charge pips (3 multi-kills → a Color Bomb).
    this._pips = new Graphics();
    this._layer.addChild(this._pips);
    this._prevPipFill = 0;

    this._readyText  = null;
    this._readyTextT = 0;
    this._prevBombs  = 0;
    this._bombPulse  = 0;
    this._bombFlashT = 0;
  }

  setButtonVisibility(colorChange, freeze) {
    this._colorChangeBtn._unlocked = colorChange;
    this._freezeBtn._unlocked      = freeze;
  }

  // Show/hide the entire bar (used to clear it behind end-screen modals).
  // Visibility-only — does not restyle.
  setVisible(v) {
    for (const obj of [this._bg, this._colorChangeBtn, this._freezeBtn, this._bombBtn, this._bombGlow, this._readyText]) {
      if (obj) obj.visible = v;
    }
  }

  update(dt = 0) {
    const s  = this._state;
    const gs = this._gs;

    // Tap-press animation for COLOR CHANGE and FREEZE (BOMB keeps its own glow feedback).
    _animatePress(this._colorChangeBtn, dt);
    _animatePress(this._freezeBtn, dt);

    // ── Count badge labels (short form — icon identifies the button) ──────────
    // Empty boosters show "+" (get more) rather than a dead "0".
    const colorLabel  = s.colorChangeMode ? 'CANCEL' : (s.colorChange > 0 ? `${s.colorChange}` : '+');
    const freezeLabel = s.freeze > 0 ? `${s.freeze}` : '+';
    const bombLabel   = s.bombMode  ? 'CANCEL' : (s.bombs > 0 ? `${s.bombs}` : '+');

    if (this._colorChangeBtn.label.text !== colorLabel) {
      this._colorChangeBtn.label.text = colorLabel;
      _positionLabel(this._colorChangeBtn, colorLabel);
    }
    if (this._freezeBtn.label.text !== freezeLabel) this._freezeBtn.label.text = freezeLabel;
    if (this._bombBtn.label.text   !== bombLabel) {
      this._bombBtn.label.text = bombLabel;
      _positionLabel(this._bombBtn, bombLabel);
      if (this._bombBtn.bombIcon) this._bombBtn.bombIcon.visible = !s.bombMode;
    }

    // Empty / locked cards stay solid enough to read as buttons (toy style has no
    // ghost UI) — the dimmer step still separates "none left" from "ready".
    this._colorChangeBtn.alpha = !this._colorChangeBtn._unlocked ? 0.35 : s.colorChange <= 0 ? 0.55 : s.colorChangeMode ? 0.75 : 1.0;
    this._freezeBtn.alpha = !this._freezeBtn._unlocked ? 0.35 : (s.freeze <= 0 || s.isFrozen())  ? 0.55 : 1.0;
    this._bombBtn.alpha   = (s.bombs <= 0 && !s.bombMode) ? 0.55 : s.bombMode ? 0.75 : 1.0;

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

    // ── 4D: SWAP/FREEZE ready-glow — a soft pulse while a charge is available ──
    this._readyPulse += dt * 3.0;
    const rp = 0.28 + 0.32 * (0.5 + 0.5 * Math.sin(this._readyPulse));
    this._readyGlow.clear();
    if (this._colorChangeBtn._unlocked && s.colorChange > 0 && !s.colorChangeMode) {
      this._readyGlow.roundRect(CARD_X[0] - 2, CARD_Y - 2, CARD_W + 4, CARD_H + 4, CARD_R + 2);
      this._readyGlow.stroke({ color: COLOR_CHANGE_ACCENT, width: 2, alpha: rp });
    }
    if (this._freezeBtn._unlocked && s.freeze > 0 && !s.isFrozen()) {
      this._readyGlow.roundRect(CARD_X[1] - 2, CARD_Y - 2, CARD_W + 4, CARD_H + 4, CARD_R + 2);
      this._readyGlow.stroke({ color: FREEZE_ACCENT, width: 2, alpha: rp });
    }

    // ── 4C: color-bomb charge pips (3 multi-kills earn a Color Bomb) ──────────
    const NEED   = 3;
    const filled = Math.min(NEED, this._gs?.multiKillCount ?? 0);
    const PCX = 203, PY = BAR_Y - 9, PR = 4, PGAP = 13;
    this._pips.clear();
    // Label: a small rainbow bomb disc — three multi-kills earn one.
    {
      const rx = PCX - ((NEED - 1) * PGAP) / 2 - 17, R = 6.5;
      const cols = [0xFF3D3D, 0xFF8A1C, 0xFFD42A, 0x2FCC55, 0x2F8CFF, 0xA35CFF];
      cols.forEach((c, k) => {
        const a0 = (k / 6) * Math.PI * 2 - Math.PI / 2, a1 = ((k + 1) / 6) * Math.PI * 2 - Math.PI / 2;
        this._pips.moveTo(rx, PY).arc(rx, PY, R, a0, a1).lineTo(rx, PY).fill(c);
      });
      this._pips.circle(rx, PY, R).stroke({ color: INK, width: 1.5 });
      this._pips.circle(rx - 2, PY - 2, 1.6).fill({ color: 0xFFFFFF, alpha: 0.8 });
    }
    for (let i = 0; i < NEED; i++) {
      const x = PCX - ((NEED - 1) * PGAP) / 2 + i * PGAP;
      const on = i < filled;
      // last-filled pip pulses so progress is felt
      const pulse = (on && i === filled - 1) ? 0.7 + 0.3 * Math.sin(this._readyPulse * 1.6) : 1;
      this._pips.circle(x, PY, on ? PR + 0.5 : PR);
      this._pips.fill({ color: on ? SUN : 0x4A4466, alpha: (on ? 1 : 0.8) * pulse });
      this._pips.circle(x, PY, on ? PR + 0.5 : PR);
      this._pips.stroke({ color: INK, width: 1.5 });
      if (on) { this._pips.circle(x, PY, PR + 2.5); this._pips.stroke({ color: 0xff8844, width: 1, alpha: 0.5 * pulse }); }
    }
    this._prevPipFill = filled;

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
  toyPanel(card, 0, 0, CARD_W, CARD_H - CARD_LIP, CARD_R, accentColor, { lip: CARD_LIP, stroke: 3 });
  card.x = x;
  card.y = CARD_Y;
  layer.addChild(card);
  return card;
}

function _addCountLabel(card, accentColor) {
  // Yellow count coin with an ink number, overlapping the card's top-right corner.
  const badge = new Graphics();
  badge.circle(0, 0, 11).fill(SUN);
  badge.circle(0, 0, 11).stroke({ color: INK, width: 2.5 });
  badge.x = CARD_W - 6;
  badge.y = 2;
  card.addChild(badge);
  card.labelBadge = badge;   // hidden when the label shows the centered CANCEL action

  const tx = new Text({
    text: '0',
    style: { fontSize: 14, fontWeight: '900', fill: INK },
  });
  tx.anchor.set(0.5, 0.5);
  tx.x = CARD_W - 6;
  tx.y = 2;
  card.addChild(tx);
  return tx;
}

// The count badge ("×N") sits in the top-right corner; the CANCEL action label is
// centered on the card (matching the bottom name label) with no corner badge.
function _positionLabel(card, text) {
  const isCancel = text === 'CANCEL';
  card.label.x = isCancel ? CARD_W / 2 : CARD_W - 6;
  card.label.y = isCancel ? (CARD_H - CARD_LIP) / 2 : 2;
  card.label.style.fill = isCancel ? 0xffffff : INK;
  if (card.labelBadge) card.labelBadge.visible = !isCancel;
}

function _addNameLabel(card, name, accentColor) {
  const tx = new Text({ text: name, style: toyLabel(LABEL_SIZE) });
  tx.anchor.set(0.5, 1);
  tx.x = CARD_W / 2;
  tx.y = CARD_H - CARD_LIP - 3;
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
  const fn = name === 'colorchange' ? _iconColorChange
           : name === 'freeze'      ? _iconFreeze
           : _iconBomb;
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

  // Physical press feedback (advanced by BoosterBar.update via _animatePress).
  card._baseX  = x;
  card._pressT = -1;   // -1 = idle

  card.eventMode = 'static';
  card.cursor    = 'pointer';
  card.on('pointerdown', () => { card._pressT = 0; });   // start press animation
  card.on('pointerdown', onClick);
  return card;
}

// Advance a card's tap-press animation, scaling about its centre so the card
// presses in place. Idle when _pressT < 0.
function _animatePress(card, dt) {
  if (!card || card._pressT < 0) return;
  card._pressT += dt;
  let s;
  if (card._pressT < PRESS_DOWN_S) {
    const p = card._pressT / PRESS_DOWN_S;                 // ease-in (accelerate down)
    s = 1 - (1 - PRESS_MIN) * (p * p);
  } else if (card._pressT < PRESS_DOWN_S + PRESS_UP_S) {
    const p     = (card._pressT - PRESS_DOWN_S) / PRESS_UP_S;
    const eased = 1 - Math.pow(1 - p, 3);                  // ease-out
    const spring = 1 + 0.06 * Math.sin(p * Math.PI);       // slight overshoot
    s = (PRESS_MIN + (1 - PRESS_MIN) * eased) * spring;
  } else {
    s = 1;
    card._pressT = -1;   // animation complete → idle
  }
  card.scale.set(s);
  card.x = card._baseX + (CARD_W * (1 - s)) / 2;   // keep visual centre fixed
  card.y = CARD_Y      + (CARD_H * (1 - s)) / 2;
}

function _makeBombCard(layer, x, onClick) {
  const c    = BOMB_ACCENT;
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

// Placeholder COLOR CHANGE glyph: a 6-wedge rainbow wheel (the game palette) with a
// white "paintbrush" stroke across it. Replaced later by booster-colorchange.png.
function _iconColorChange(g, cx, cy, _c) {
  const wedges = [0xFF3D3D, 0xFFD42A, 0x2FCC55, 0x2F8CFF, 0xA35CFF, 0xFF8A1C];
  const R = 11;
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / 6) * Math.PI * 2 - Math.PI / 2;
    g.moveTo(cx, cy);
    g.arc(cx, cy, R, a0, a1);
    g.closePath();
    g.fill({ color: wedges[i], alpha: 0.95 });
  }
  // Paintbrush stroke (diagonal handle + tip) over the wheel.
  g.moveTo(cx - 9, cy + 9); g.lineTo(cx + 7, cy - 7);
  g.stroke({ color: 0xffffff, width: 3, alpha: 0.95 });
  g.circle(cx + 8, cy - 8, 3); g.fill({ color: 0xffffff, alpha: 0.95 });
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
