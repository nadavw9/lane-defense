// HUDRenderer — renders the 44px HUD bar at the top of the screen.
//
// Contents:
//   • Timer bar  — full-width strip along the bottom of the HUD that shrinks
//                  left-to-right as time runs out, interpolating green→yellow→red.
//   • Combo text — centred; hidden when combo < 2.  Pops with a spring-physics
//                  bounce every time the combo increments.
//   • Coins text — top-right; updates whenever coins change.
import { Graphics, Text } from 'pixi.js';

const HUD_H      = 44;
const BAR_H      = 7;          // height of the timer bar
const BAR_Y      = HUD_H - BAR_H;
const HUD_BG     = 0x0d0d1a;
const BAR_BG     = 0x1a1a2e;

// Timer bar colour breakpoints
const COLOR_GREEN  = 0x44cc44;
const COLOR_YELLOW = 0xeecc22;
const COLOR_RED    = 0xee3333;

// Combo text colour tiers
const COMBO_TIERS = [
  { min: 2,  color: 0xffffff, size: 22 },
  { min: 4,  color: 0xffee44, size: 25 },
  { min: 7,  color: 0xff9922, size: 28 },
  { min: 11, color: 0xff3333, size: 31 },
];

// Spring constants for the combo bounce animation
const SPRING_K = 380;
const SPRING_D = 18;

function lerpColor(a, b, t) {
  const r = (((a >> 16) & 0xff) + t * (((b >> 16) & 0xff) - ((a >> 16) & 0xff))) | 0;
  const g = (((a >>  8) & 0xff) + t * (((b >>  8) & 0xff) - ((a >>  8) & 0xff))) | 0;
  const bl = ((a       & 0xff) + t * ((b        & 0xff) - (a        & 0xff))) | 0;
  return (r << 16) | (g << 8) | bl;
}

function timerColor(ratio) {
  if (ratio > 0.5) return lerpColor(COLOR_GREEN,  COLOR_YELLOW, (1 - ratio) * 2);
  return               lerpColor(COLOR_YELLOW, COLOR_RED,    (0.5 - ratio) * 2);
}

export class HUDRenderer {
  constructor(layerManager, gameState, appWidth) {
    this._gs     = gameState;
    this._appW   = appWidth;
    this._layer  = layerManager.get('hudLayer');

    // ── Background + timer bar (redrawn each frame) ──────────────────────
    this._bg = new Graphics();
    this._layer.addChild(this._bg);

    // ── Combo text ────────────────────────────────────────────────────────
    this._comboText = new Text({
      text: '',
      style: {
        fontSize:   22,
        fontWeight: 'bold',
        fill:       0xffffff,
        dropShadow: { color: 0x000000, blur: 4, distance: 2, alpha: 0.85 },
      },
    });
    this._comboText.anchor.set(0.5, 0.5);
    this._comboText.x = appWidth / 2;
    this._comboText.y = HUD_H / 2 - BAR_H / 2;  // centred in the non-bar area
    this._layer.addChild(this._comboText);

    // ── Coins text ────────────────────────────────────────────────────────
    this._coinsText = new Text({
      text: '◆ 0',
      style: {
        fontSize:   17,
        fontWeight: 'bold',
        fill:       0xf5c842,
        dropShadow: { color: 0x000000, blur: 3, distance: 1, alpha: 0.7 },
      },
    });
    this._coinsText.anchor.set(1, 0.5);
    this._coinsText.x = appWidth - 10;
    this._coinsText.y = HUD_H / 2 - BAR_H / 2;
    this._layer.addChild(this._coinsText);

    // ── Spring bounce state ───────────────────────────────────────────────
    this._bounceScale = 1;
    this._bounceVel   = 0;
    this._lastCoins   = -1;
    this._lastCombo   = 0;
  }

  // Call when the combo increments so the text pops with a spring bounce.
  bumpCombo(combo) {
    this._bounceScale = 1.5;
    this._bounceVel   = 0;
    this._updateComboStyle(combo);
  }

  // Call once per render frame.
  update(dt) {
    this._drawBg();
    this._stepSpring(dt);
    this._refreshComboText();
    this._refreshCoinsText();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _drawBg() {
    const gs    = this._gs;
    const ratio = gs.timeRemaining / gs.duration;
    const barW  = Math.max(0, Math.round(this._appW * ratio));
    const color = timerColor(Math.max(0, ratio));

    this._bg.clear();

    // HUD background
    this._bg.rect(0, 0, this._appW, HUD_H);
    this._bg.fill(HUD_BG);

    // Timer bar track
    this._bg.rect(0, BAR_Y, this._appW, BAR_H);
    this._bg.fill(BAR_BG);

    // Timer bar fill — shrinks from right to left
    if (barW > 0) {
      this._bg.rect(0, BAR_Y, barW, BAR_H);
      this._bg.fill(color);
    }
  }

  _stepSpring(dt) {
    if (Math.abs(this._bounceScale - 1) < 0.001 && Math.abs(this._bounceVel) < 0.001) {
      this._bounceScale = 1;
      this._comboText.scale.set(1);
      return;
    }
    // Damped spring: F = -k*(x-1) - d*v
    this._bounceVel  += (-SPRING_K * (this._bounceScale - 1) - SPRING_D * this._bounceVel) * dt;
    this._bounceScale += this._bounceVel * dt;
    this._comboText.scale.set(this._bounceScale);
  }

  _refreshComboText() {
    const combo = this._gs.combo;
    if (combo < 2) {
      this._comboText.text  = '';
      this._comboText.alpha = 0;
      this._lastCombo = combo;
      return;
    }
    if (combo !== this._lastCombo) {
      this._updateComboStyle(combo);
      this._lastCombo = combo;
    }
    this._comboText.alpha = 1;
    this._comboText.text  = `×${combo} COMBO`;
  }

  _refreshCoinsText() {
    const coins = this._gs.coins;
    if (coins !== this._lastCoins) {
      this._coinsText.text  = `◆ ${coins}`;
      this._lastCoins       = coins;
    }
  }

  _updateComboStyle(combo) {
    // Pick the highest tier the combo qualifies for.
    let tier = COMBO_TIERS[0];
    for (const t of COMBO_TIERS) {
      if (combo >= t.min) tier = t;
    }
    this._comboText.style.fill     = tier.color;
    this._comboText.style.fontSize = tier.size;
  }
}
