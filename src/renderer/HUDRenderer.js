// HUDRenderer — chrome around the play field.
//
// As of the Level Goal System + HUD redesign, the TOP zone belongs entirely to
// GoalCounterUI. This renderer now owns the BOTTOM INFO BAR — a compact strip in
// the gap between the bomb queue (~700px) and the booster bar (752px) — holding:
//   • Volume (mute) button        — bottom-left
//   • Level badge (purple pill)    — bottom-left, next to volume
//   • Coin disc + score           — bottom-right
// (Pause + car-manual buttons are positioned into this same strip from GameApp.)
//
// It also still draws the transient COMBO text/glow (now over the upper road) and
// the FROZEN indicator. The old top kill-progress bar / "N/M" counter is gone —
// win is goal-driven now (see GoalCounterUI).

import { Graphics, Text } from 'pixi.js';

// ── Booster-row flank geometry ──────────────────────────────────────────────────
// Everything lives on ONE row with the booster buttons (BoosterBar draws a
// full-width bg at BAR_Y=752..820; its three 64px cards are centred at x=89..301).
// We flank that: volume + level badge in the LEFT gutter (x<89), coin score + pause
// in the RIGHT gutter (x>301). All vertically centred on the booster card centre.
const ROW_MID = 786;   // booster card centre Y (CARD_Y 754 + CARD_H/2 32)

// Combo celebration sits over the upper road (transient; goals own the very top).
const COMBO_Y        = 150;
const COMBO_PILL_H   = 32;

const SPRING_K       = 380;
const SPRING_D       = 18;

const COMBO_TIERS = [
  { min: 2,  color: 0xffee44, size: 26, glowColor: 0xFFCC00, glowAlpha: 0.30 },
  { min: 4,  color: 0xffee44, size: 26, glowColor: 0xFF8800, glowAlpha: 0.40 },
  { min: 7,  color: 0xff9922, size: 26, glowColor: 0xFF2200, glowAlpha: 0.50 },
  { min: 11, color: 0xff3333, size: 26, glowColor: 0xFF2200, glowAlpha: 0.50 },
];

// Level badge geometry (left gutter, drawn in _drawBg).
const BADGE_X = 30, BADGE_W = 44, BADGE_H = 26, BADGE_R = 8;
const BADGE_Y = ROW_MID - Math.round(BADGE_H / 2);

export class HUDRenderer {
  constructor(layerManager, gameState, appWidth, audioManager = null) {
    this._gs    = gameState;
    this._appW  = appWidth;
    this._layer = layerManager.get('hudLayer');
    this._audio = audioManager;

    this._elapsed       = 0;
    this._lastCoins     = -1;
    this._lastCombo     = 0;
    this._bounceT       = 0;
    this._prevComboTier  = -1;
    this._tierFlashT     = 0;
    this._curTierColor   = 0xffee44;
    this._curTierGlowAlpha = 0.30;

    // ── Level badge (redrawn every frame; sits on the booster bar's bg) ──────
    this._bg = new Graphics();
    this._layer.addChild(this._bg);

    // ── Mute button (left gutter, on the booster row) ───────────────────────
    this._muteBtn = new Graphics();
    this._muteBtn.x = 6;
    this._muteBtn.y = ROW_MID - 10;
    if (audioManager) {
      // ≥44px tap target centred on the speaker glyph.
      this._muteBtn.hitArea = {
        contains: (x, y) => x >= -10 && x <= 34 && y >= -18 && y <= 26,
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

    // ── Level text (over the badge drawn in _bg) ────────────────────────────
    this._levelText = new Text({
      text: 'L1',
      style: {
        fontSize:   14,
        fontWeight: 'bold',
        fill:       0xffffff,
        dropShadow: { color: 0x220055, blur: 3, distance: 1, alpha: 0.9 },
      },
    });
    this._levelText.anchor.set(0.5, 0.5);
    this._levelText.x = BADGE_X + BADGE_W / 2;
    this._levelText.y = ROW_MID;
    this._layer.addChild(this._levelText);

    // ── Combo glow + text (transient, over upper road) ──────────────────────
    this._comboGlowBg = new Graphics();
    this._layer.addChild(this._comboGlowBg);
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
    this._comboText.y = COMBO_Y;
    this._layer.addChild(this._comboText);

    // ── Coin icon + score (right gutter; gold coin icon, WHITE number, no bg) ─
    this._coinDisc = new Graphics();
    this._layer.addChild(this._coinDisc);
    this._drawCoinDisc(appWidth - 82, ROW_MID);   // x=308

    this._coinsText = new Text({
      text: '0',
      style: {
        fontSize:   15,
        fontWeight: 'bold',
        fill:       0xffffff,   // white number (was gold — read as "circle behind score")
        dropShadow: { color: 0x000000, blur: 3, distance: 1, alpha: 0.8 },
      },
    });
    this._coinsText.anchor.set(1, 0.5);
    this._coinsText.x = appWidth - 46;   // right edge sits left of the pause button (x=344)
    this._coinsText.y = ROW_MID;
    this._layer.addChild(this._coinsText);

    // ── Frozen indicator (centred pill over upper road when freeze active) ──
    this._frozenBadgeGfx = new Graphics();
    this._layer.addChild(this._frozenBadgeGfx);
    this._frozenBadgeText = new Text({
      text: '',
      style: {
        fontSize:   13,
        fontWeight: 'bold',
        fill:       0x9fe6ff,
        dropShadow: { color: 0x000000, blur: 3, distance: 0, alpha: 0.85 },
      },
    });
    this._frozenBadgeText.anchor.set(0.5, 0.5);
    this._frozenBadgeText.x = appWidth / 2;
    this._frozenBadgeText.y = COMBO_Y - 36;   // just above the combo line
    this._layer.addChild(this._frozenBadgeText);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  setLevel(n) {
    this._levelText.text = `L${n}`;
  }

  setHearts() {}        // hearts removed; harmless no-op for stray callers

  showObjective() {}    // kill objective removed; goals own the objective now

  // Re-stack the HUD elements above anything added to the layer after construction
  // (e.g. the BoosterBar's full-width background, which would otherwise occlude the
  // flank elements sharing the booster row).
  bringToFront() {
    for (const o of [this._bg, this._muteBtn, this._levelText, this._comboGlowBg,
                     this._comboText, this._coinDisc, this._coinsText,
                     this._frozenBadgeGfx, this._frozenBadgeText]) {
      if (o) this._layer.addChild(o);
    }
  }

  bumpCombo(combo) {
    this._bounceT = 0.2;
    this._updateComboStyle(combo);
  }

  update(dt) {
    this._elapsed += dt;
    if (this._tierFlashT > 0) this._tierFlashT = Math.max(0, this._tierFlashT - dt);

    this._drawBg();
    this._stepSpring(dt);
    this._refreshComboGlow();
    this._refreshComboText();
    this._refreshFrozenBadge();
    this._refreshCoinsText();
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _drawBg() {
    const g    = this._bg;
    g.clear();

    // No separate info bar — these elements sit on the booster bar's own full-width
    // background. Draw just the level badge (purple gradient pill) in the left gutter.
    g.roundRect(BADGE_X + 1, BADGE_Y + 2, BADGE_W, BADGE_H, BADGE_R);
    g.fill({ color: 0x000000, alpha: 0.38 });
    g.roundRect(BADGE_X, BADGE_Y, BADGE_W, BADGE_H, BADGE_R);
    g.fill(0x4a1088);
    g.rect(BADGE_X + BADGE_R * 0.6, BADGE_Y + 1, BADGE_W - BADGE_R * 1.2, BADGE_H * 0.46);
    g.fill({ color: 0xaa55ff, alpha: 0.50 });
    g.roundRect(BADGE_X, BADGE_Y, BADGE_W, BADGE_H, BADGE_R);
    g.stroke({ color: 0xddaa22, width: 1.2, alpha: 0.70 });
  }

  _drawCoinDisc(cx, cy) {
    const g = this._coinDisc;
    const r = 9;
    g.clear();
    g.circle(cx + 1, cy + 2, r);
    g.fill({ color: 0x000000, alpha: 0.30 });
    g.circle(cx, cy, r);
    g.fill(0xc08010);
    g.circle(cx, cy, r * 0.80);
    g.fill(0xf0c030);
    g.circle(cx, cy, r * 0.52);
    g.fill({ color: 0xfff080, alpha: 0.60 });
    g.circle(cx - r * 0.30, cy - r * 0.30, r * 0.22);
    g.fill({ color: 0xffffff, alpha: 0.65 });
    g.circle(cx, cy, r);
    g.stroke({ color: 0xb87800, width: 1.2 });
  }

  _stepSpring(dt) {
    if (this._bounceT <= 0) { this._comboText.scale.set(1); return; }
    this._bounceT = Math.max(0, this._bounceT - dt);
    const frac  = 1 - this._bounceT / 0.2;
    const scale = 1 + 0.25 * Math.sin(Math.PI * frac);
    this._comboText.scale.set(scale);
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

  _refreshComboGlow() {
    const g     = this._comboGlowBg;
    const combo = this._gs.combo;
    g.clear();
    if (combo < 2) return;

    const glowW = 200;
    const glowH = COMBO_PILL_H;
    const cx    = this._appW / 2;
    const cy    = COMBO_Y;

    g.roundRect(cx - glowW / 2, cy - glowH / 2, glowW, glowH, 12);
    g.fill({ color: this._curTierColor, alpha: this._curTierGlowAlpha });

    if (this._tierFlashT > 0) {
      const flashA = (this._tierFlashT / 0.12) * 0.55;
      g.roundRect(cx - glowW / 2, cy - glowH / 2, glowW, glowH, 12);
      g.fill({ color: 0xffffff, alpha: flashA });
    }
  }

  _updateComboStyle(combo) {
    let tierIdx = 0;
    let tier    = COMBO_TIERS[0];
    for (let i = 0; i < COMBO_TIERS.length; i++) {
      if (combo >= COMBO_TIERS[i].min) { tier = COMBO_TIERS[i]; tierIdx = i; }
    }
    if (tierIdx !== this._prevComboTier) {
      this._prevComboTier = tierIdx;
      this._tierFlashT    = 0.12;
    }
    this._curTierColor             = tier.color;
    this._curTierGlowAlpha         = tier.glowAlpha;
    this._comboText.style.fill     = tier.color;
    this._comboText.style.fontSize = tier.size;
  }

  _refreshFrozenBadge() {
    const boosterState  = this._gs?.boosterState;
    const boosterFrozen = boosterState?.isFrozen?.() ?? false;
    const comboFrozen   = (this._gs?.comboFreezeShots ?? 0) > 0;
    const frozen = boosterFrozen || comboFrozen;

    const g = this._frozenBadgeGfx;
    g.clear();
    this._frozenBadgeText.text = '';
    if (!frozen) return;

    const label = comboFrozen
      ? '❄ FROZEN  1 free turn'
      : `❄ FROZEN  ${boosterState.freezeShots ?? 0} shot${(boosterState.freezeShots ?? 0) !== 1 ? 's' : ''}`;
    this._frozenBadgeText.text = label;

    // Pulsing ice-blue pill behind the label.
    const pulse = 0.22 + 0.12 * Math.sin(this._elapsed * 6);
    const w = this._frozenBadgeText.width + 24;
    const h = 24;
    const cx = this._appW / 2, cy = this._frozenBadgeText.y;
    g.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2);
    g.fill({ color: 0x1a4a7a, alpha: 0.85 });
    g.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2);
    g.fill({ color: 0x44aaff, alpha: pulse });
  }

  _drawSpeaker(muted) {
    const g   = this._muteBtn;
    const col = muted ? 0x444444 : 0xcccccc;
    g.clear();

    g.rect(0, 6, 5, 8);
    g.fill(col);
    g.poly([5, 4, 5, 16, 13, 20, 13, 0]);
    g.fill(col);

    if (muted) {
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
