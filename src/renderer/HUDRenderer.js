// HUDRenderer — renders the 44px HUD bar at the top of the screen.
//
// Contents:
//   • Timer bar  — full-width strip along the bottom of the HUD that shrinks
//                  left-to-right as time runs out, interpolating green→yellow→red.
//   • Combo text — centred; hidden when combo < 2.  Pops with a spring-physics
//                  bounce every time the combo increments.
//   • Coins text — top-right; updates whenever coins change.
//   • Mute btn   — top-left speaker icon; toggles AudioManager on click.
import { Graphics, Text } from 'pixi.js';

const HUD_H      = 44;
const BAR_H      = 10;         // height of the timer bar (prominent strip at top)
const BAR_Y      = 0;          // bar sits at the very top of the screen
const HUD_BG     = 0x0d0d1a;
const BAR_BG     = 0x1a1a2e;
// Vertical centre of the text area (below the bar)
const TEXT_MID   = BAR_H + (HUD_H - BAR_H) / 2;

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
  // audioManager is optional — mute button is hidden when not provided.
  constructor(layerManager, gameState, appWidth, audioManager = null) {
    this._gs     = gameState;
    this._appW   = appWidth;
    this._layer  = layerManager.get('hudLayer');
    this._audio  = audioManager;

    // ── Background + timer bar (redrawn each frame) ──────────────────────
    this._bg = new Graphics();
    this._layer.addChild(this._bg);

    // ── Combo text — dark stroke outline for legibility ───────────────────
    this._comboText = new Text({
      text: '',
      style: {
        fontSize:   22,
        fontWeight: 'bold',
        fill:       0xffffff,
        stroke:     { color: 0x000000, width: 3 },
        dropShadow: { color: 0x000000, blur: 6, distance: 0, alpha: 0.70 },
      },
    });
    this._comboText.anchor.set(0.5, 0.5);
    this._comboText.x = appWidth / 2;
    this._comboText.y = TEXT_MID;
    this._layer.addChild(this._comboText);

    // ── Coin icon — yellow circle drawn once to the left of coins text ───
    this._coinIcon = new Graphics();
    this._coinIcon.circle(0, 0, 8);
    this._coinIcon.fill(0xf5c842);
    this._coinIcon.circle(0, 0, 8);
    this._coinIcon.stroke({ color: 0xcc9900, width: 1.5 });
    // Inner shine
    this._coinIcon.circle(-2, -2, 3);
    this._coinIcon.fill({ color: 0xffffff, alpha: 0.30 });
    this._coinIcon.x = appWidth - 86;
    this._coinIcon.y = TEXT_MID;
    this._layer.addChild(this._coinIcon);

    // ── Coins text ────────────────────────────────────────────────────────
    this._coinsText = new Text({
      text: '0',
      style: {
        fontSize:   17,
        fontWeight: 'bold',
        fill:       0xf5c842,
        dropShadow: { color: 0x000000, blur: 3, distance: 1, alpha: 0.7 },
      },
    });
    this._coinsText.anchor.set(1, 0.5);
    this._coinsText.x = appWidth - 10;
    this._coinsText.y = TEXT_MID;
    this._layer.addChild(this._coinsText);

    // ── Mute button (top-left speaker icon) ──────────────────────────────
    this._muteBtn = new Graphics();
    // Place the icon centre at x=20, vertically centred in the text area.
    this._muteBtn.x = 10;
    this._muteBtn.y = Math.round(TEXT_MID) - 10;
    if (audioManager) {
      // Expand the clickable hit area beyond the small icon.
      this._muteBtn.hitArea = {
        contains: (x, y) => x >= -6 && x <= 34 && y >= -6 && y <= 28,
      };
      this._muteBtn.eventMode = 'static';
      this._muteBtn.cursor    = 'pointer';
      this._muteBtn.on('pointerdown', () => {
        const muted = audioManager.toggleMute();
        this._drawSpeaker(muted);
      });
    }
    this._layer.addChild(this._muteBtn);
    this._drawSpeaker(false);

    // ── Level number label (top-left, right of mute btn) ─────────────────
    this._levelText = new Text({
      text: 'L1',
      style: {
        fontSize:   15,
        fontWeight: 'bold',
        fill:       0xaaaaaa,
        dropShadow: { color: 0x000000, blur: 2, distance: 1, alpha: 0.6 },
      },
    });
    this._levelText.anchor.set(0, 0.5);
    this._levelText.x = 42;
    this._levelText.y = TEXT_MID;
    this._layer.addChild(this._levelText);

    // ── Hearts display ─────────────────────────────────────────────────────
    // 5 small heart symbols right of the level label — filled (♥) or empty (♡).
    this._heartTexts = [];
    for (let i = 0; i < 5; i++) {
      const ht = new Text({ text: '♥', style: { fontSize: 11, fill: 0xff4466 } });
      ht.anchor.set(0, 0.5);
      ht.x = 70 + i * 13;
      ht.y = TEXT_MID;
      this._layer.addChild(ht);
      this._heartTexts.push(ht);
    }
    this._lastHearts = -1;

    // ── Spring bounce state ───────────────────────────────────────────────
    this._bounceScale  = 1;
    this._bounceVel    = 0;
    this._lastCoins    = -1;
    this._lastCombo    = 0;
  }

  // Call whenever the level changes so the label stays in sync.
  setLevel(n) {
    this._levelText.text = `L${n}`;
  }

  /** Update the hearts row display. n = current hearts (0-5). */
  setHearts(n) {
    if (n === this._lastHearts) return;
    this._lastHearts = n;
    for (let i = 0; i < 5; i++) {
      const ht = this._heartTexts[i];
      ht.text  = i < n ? '♥' : '♡';
      ht.style = { fontSize: 11, fill: i < n ? 0xff4466 : 0x444455 };
    }
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
    // Kill progress bar — fills left to right as the player scores kills.
    const gs       = this._gs;
    const kills    = gs.totalKills ?? 0;
    const target   = gs.targetKills ?? 10;
    const ratio    = Math.min(1, target > 0 ? kills / target : 0);
    const barW     = Math.max(0, Math.round(this._appW * ratio));
    // Colour: blue → yellow → green as kills approach target
    const color    = ratio >= 1 ? 0x44ff88 : ratio >= 0.6 ? 0x88cc44 : ratio >= 0.3 ? 0xffcc00 : 0x4488ff;
    const R        = BAR_H / 2;

    this._bg.clear();

    // HUD background
    this._bg.rect(0, 0, this._appW, HUD_H);
    this._bg.fill(HUD_BG);

    // Kill progress bar track
    this._bg.roundRect(-1, BAR_Y - 1, this._appW + 2, BAR_H + 2, R + 1);
    this._bg.fill({ color: 0x000000, alpha: 0.70 });
    this._bg.roundRect(0, BAR_Y, this._appW, BAR_H, R);
    this._bg.fill(BAR_BG);

    // Kill progress bar fill — grows left to right
    if (barW >= BAR_H) {
      this._bg.roundRect(0, BAR_Y, barW, BAR_H, R);
      this._bg.fill(color);
    } else if (barW > 0) {
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
      this._coinsText.text = String(coins);
      this._lastCoins      = coins;
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

  // Draw a minimal speaker icon at origin (0,0).
  // Icon fits in a ~22×20 px bounding box.
  _drawSpeaker(muted) {
    const g   = this._muteBtn;
    const col = muted ? 0x444444 : 0xcccccc;
    g.clear();

    // Speaker body (small filled rect)
    g.rect(0, 6, 5, 8);
    g.fill(col);

    // Cone (trapezoid: wide at right, narrow at left — pointing right)
    g.poly([5, 4, 5, 16, 13, 20, 13, 0]);
    g.fill(col);

    if (muted) {
      // Red × — two thin filled polygon bars, no stroke/moveTo (avoids PixiJS v8 phantom-line bug).
      const bar = (x1, y1, x2, y2, hw) => {
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = (-dy / len) * hw, ny = (dx / len) * hw;
        g.poly([x1 + nx, y1 + ny,  x1 - nx, y1 - ny,
                x2 - nx, y2 - ny,  x2 + nx, y2 + ny]);
        g.fill(0xdd2222);
      };
      bar(15, 4, 22, 12, 1.1);
      bar(22, 4, 15, 12, 1.1);
    } else {
      // Sound-wave arcs as filled thick-arc polygons (no arc/stroke, avoids PixiJS v8 bug).
      const arcPoly = (cx, cy, r, a0, a1, hw, steps = 10) => {
        const pts = [];
        for (let i = 0; i <= steps; i++) {
          const a = a0 + (a1 - a0) * (i / steps);
          pts.push(cx + (r + hw) * Math.cos(a), cy + (r + hw) * Math.sin(a));
        }
        for (let i = steps; i >= 0; i--) {
          const a = a0 + (a1 - a0) * (i / steps);
          pts.push(cx + (r - hw) * Math.cos(a), cy + (r - hw) * Math.sin(a));
        }
        return pts;
      };
      g.poly(arcPoly(13, 10, 5, -0.65, 0.65, 0.9));
      g.fill(col);
      g.poly(arcPoly(13, 10, 9, -0.65, 0.65, 0.9));
      g.fill(col);
    }
  }
}
