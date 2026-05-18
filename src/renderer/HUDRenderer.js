// HUDRenderer — 70px HUD bar at the top of the screen.
//
//   • Pill progress bar with green gradient fill + animated sheen + "kills/target"
//   • Purple gradient level badge (L7 pill)
//   • Heart icons × 5
//   • Combo text (spring bounce) + right-edge vertical gauge
//   • Multiplier badge  ×1.2 / ×1.5 / ×2 / ×3
//   • 3D gold coin disc + coins counter
//   • Lane color dots just above shooter area
//   • Objective banner (3 s auto-fade)
//   • Milestone confetti burst at 25 / 50 / 75 / 100 % completion
//   • Gold flash when kill target is reached

import { Graphics, Text } from 'pixi.js';

const HUD_H    = 70;
const BAR_H    = 14;
const BAR_Y    = 3;
const BAR_X    = 8;
// Vertical centre of the row below the progress bar
const TEXT_MID = Math.round(BAR_Y + BAR_H + (HUD_H - BAR_Y - BAR_H) / 2);  // 44

const HUD_BG = 0x08081a;

const COMBO_TIERS = [
  { min: 2,  color: 0xffee44, size: 24 },
  { min: 4,  color: 0xffee44, size: 28 },
  { min: 7,  color: 0xff9922, size: 33 },
  { min: 11, color: 0xff3333, size: 38 },
];

const MULT_TIERS = [
  { min: 11, label: '×3' },
  { min: 7,  label: '×2' },
  { min: 5,  label: '×1.5' },
  { min: 3,  label: '×1.2' },
];

const CAR_COLOR_MAP = {
  Red:    0xE24B4A, Blue:   0x378ADD, Green:  0x639922,
  Yellow: 0xEF9F27, Purple: 0x7F77DD, Orange: 0xD85A30,
};

const LANE_DOT_Y     = 513;
const SPRING_K       = 380;
const SPRING_D       = 18;
const SHEEN_CYCLE    = 2.8;   // seconds per sweep
const SHEEN_W_FRAC   = 0.28;  // sheen strip width as fraction of bar

const CONFETTI_COLS = [0xff4466, 0x44aaff, 0xffcc22, 0x44ee88, 0xcc88ff, 0xff8844];
const MILESTONES    = [0.25, 0.50, 0.75, 1.00];

// Badge geometry (reused in _drawBg and setLevel)
const BADGE_X = 34, BADGE_W = 40, BADGE_H = 24, BADGE_R = 8;

export class HUDRenderer {
  constructor(layerManager, gameState, appWidth, audioManager = null) {
    this._gs    = gameState;
    this._appW  = appWidth;
    this._layer = layerManager.get('hudLayer');
    this._audio = audioManager;

    this._elapsed      = 0;
    this._lastCoins    = -1;
    this._lastCombo    = 0;
    this._lastHearts   = -1;
    this._lastRatio    = 0;
    this._bounceScale  = 1;
    this._bounceVel    = 0;
    this._flashGold    = 0;
    this._prevAtTarget = false;
    this._objTimer     = 0;
    this._objText      = null;
    this._confetti     = [];
    this._prevComboTier = -1;
    this._tierFlashT    = 0;
    this._curTierColor  = 0xffee44;

    // ── Background + progress bar (redrawn every frame) ─────────────────
    this._bg = new Graphics();
    this._layer.addChild(this._bg);

    // Progress fraction text ("3/10") centred over bar
    this._progressText = new Text({
      text: '',
      style: {
        fontSize:   9,
        fontWeight: 'bold',
        fill:       0xffffff,
        dropShadow: { color: 0x000000, blur: 2, distance: 0, alpha: 0.70 },
      },
    });
    this._progressText.anchor.set(0.5, 0.5);
    this._progressText.x = appWidth / 2;
    this._progressText.y = BAR_Y + BAR_H / 2;
    this._layer.addChild(this._progressText);

    // ── Mute button ──────────────────────────────────────────────────────
    this._muteBtn = new Graphics();
    this._muteBtn.x = 8;
    this._muteBtn.y = TEXT_MID - 10;
    if (audioManager) {
      this._muteBtn.hitArea = {
        contains: (x, y) => x >= -6 && x <= 30 && y >= -6 && y <= 26,
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

    // Level text sits on top of the badge drawn in _bg each frame
    this._levelText = new Text({
      text: 'L1',
      style: {
        fontSize:   13,
        fontWeight: 'bold',
        fill:       0xffffff,
        dropShadow: { color: 0x220055, blur: 3, distance: 1, alpha: 0.9 },
      },
    });
    this._levelText.anchor.set(0.5, 0.5);
    this._levelText.x = BADGE_X + BADGE_W / 2;
    this._levelText.y = TEXT_MID;
    this._layer.addChild(this._levelText);

    // ── Heart icons ──────────────────────────────────────────────────────
    this._heartTexts = [];
    for (let i = 0; i < 5; i++) {
      const ht = new Text({ text: '♥', style: {
        fontSize: 15,
        fill:     0xff3355,
        dropShadow: { color: 0x880022, blur: 3, distance: 1, alpha: 0.7 },
      }});
      ht.anchor.set(0.5, 0.5);
      ht.x = 84 + i * 16;
      ht.y = TEXT_MID;
      this._layer.addChild(ht);
      this._heartTexts.push(ht);
    }

    // ── Combo glow background (drawn behind combo text) ──────────────────
    this._comboGlowBg = new Graphics();
    this._layer.addChild(this._comboGlowBg);

    // ── Combo text ───────────────────────────────────────────────────────
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

    // ── Combo gauge ──────────────────────────────────────────────────────
    this._comboGauge = new Graphics();
    this._layer.addChild(this._comboGauge);

    // ── Multiplier badge ─────────────────────────────────────────────────
    this._multiBadge = new Text({
      text: '',
      style: {
        fontSize:   18,
        fontWeight: 'bold',
        fill:       0xffcc00,
        dropShadow: { color: 0x000000, blur: 3, distance: 1, alpha: 0.8 },
      },
    });
    this._multiBadge.anchor.set(1, 0.5);
    this._multiBadge.x = appWidth - 106;
    this._multiBadge.y = TEXT_MID;
    this._layer.addChild(this._multiBadge);

    // ── 3D coin disc (drawn once, static) ────────────────────────────────
    this._coinDisc = new Graphics();
    this._layer.addChild(this._coinDisc);
    this._drawCoinDisc(appWidth - 84, TEXT_MID);

    // ── Coins text ───────────────────────────────────────────────────────
    this._coinsText = new Text({
      text: '0',
      style: {
        fontSize:   18,
        fontWeight: 'bold',
        fill:       0xf5c842,
        dropShadow: { color: 0x000000, blur: 3, distance: 1, alpha: 0.7 },
      },
    });
    this._coinsText.anchor.set(1, 0.5);
    this._coinsText.x = appWidth - 10;
    this._coinsText.y = TEXT_MID;
    this._layer.addChild(this._coinsText);

    // ── Lane color dots ──────────────────────────────────────────────────
    this._laneDots = [];
    for (let i = 0; i < 4; i++) {
      const dot = new Graphics();
      this._layer.addChild(dot);
      this._laneDots.push(dot);
    }

    // ── Confetti (always on top) ─────────────────────────────────────────
    this._confettiGfx = new Graphics();
    this._layer.addChild(this._confettiGfx);

    // ── Frozen badge (overlaid on progress bar when freeze active) ────────
    this._frozenBadgeGfx = new Graphics();
    this._layer.addChild(this._frozenBadgeGfx);
    this._frozenBadgeText = new Text({
      text: '',
      style: {
        fontSize:   11,
        fontWeight: 'bold',
        fill:       0x44ccff,
        dropShadow: { color: 0x000000, blur: 3, distance: 0, alpha: 0.85 },
      },
    });
    this._frozenBadgeText.anchor.set(0.5, 0.5);
    this._frozenBadgeText.x = appWidth / 2;
    this._frozenBadgeText.y = BAR_Y + BAR_H / 2;
    this._layer.addChild(this._frozenBadgeText);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  setLevel(n) {
    this._levelText.text = `L${n}`;
  }

  setHearts(n) {
    if (n === this._lastHearts) return;
    this._lastHearts = n;
    for (let i = 0; i < 5; i++) {
      const ht = this._heartTexts[i];
      if (i < n) {
        ht.text  = '♥';
        ht.style = { fontSize: 15, fill: 0xff3355,
          dropShadow: { color: 0x880022, blur: 3, distance: 1, alpha: 0.7 } };
      } else {
        ht.text  = '♡';
        ht.style = { fontSize: 15, fill: 0x445566 };
      }
    }
  }

  showObjective(text) {
    if (this._objText) { this._objText.destroy(); this._objText = null; }
    const t = new Text({
      text,
      style: {
        fontSize:   15,
        fontWeight: 'bold',
        fill:       0xeeddaa,
        align:      'center',
        dropShadow: { color: 0x000000, blur: 4, distance: 1, alpha: 0.8 },
      },
    });
    t.anchor.set(0.5, 0.5);
    t.x = this._appW / 2;
    t.y = TEXT_MID;
    this._layer.addChild(t);
    this._objText  = t;
    this._objTimer = 3.0;
  }

  bumpCombo(combo) {
    this._bounceScale = 1.4;
    this._bounceVel   = 0;
    this._updateComboStyle(combo);
  }

  update(dt) {
    this._elapsed += dt;

    const kills  = this._gs.totalKills  ?? 0;
    const target = this._gs.spawnBudget !== null
      ? this._gs._initialSpawnBudget ?? this._gs.targetKills ?? 10
      : (this._gs.targetKills ?? 10);
    const ratio  = target > 0 ? kills / target : 0;

    // Gold flash when target reached
    const atTarget = target > 0 && kills >= target;
    if (atTarget && !this._prevAtTarget) this._flashGold = 0.4;
    this._prevAtTarget = atTarget;
    if (this._flashGold > 0) this._flashGold = Math.max(0, this._flashGold - dt);

    // Confetti at milestones
    for (const m of MILESTONES) {
      if (this._lastRatio < m && ratio >= m) {
        const barFW = this._appW - BAR_X * 2;
        this._spawnConfetti(BAR_X + barFW * m, BAR_Y + BAR_H / 2);
      }
    }
    this._lastRatio = ratio;

    if (this._tierFlashT > 0) this._tierFlashT = Math.max(0, this._tierFlashT - dt);
    this._drawBg(kills, target, ratio);
    this._stepSpring(dt);
    this._refreshComboGlow();
    this._refreshComboText();
    this._refreshFrozenBadge();
    this._refreshCoinsText();
    this._refreshComboGauge();
    this._refreshMultiBadge();
    this._refreshLaneDots();
    this._updateConfetti(dt);

    if (this._objText) {
      this._objTimer -= dt;
      this._objText.alpha = this._objTimer > 0.5 ? 1 : Math.max(0, this._objTimer / 0.5);
      if (this._objTimer <= 0) { this._objText.destroy(); this._objText = null; }
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _drawBg(kills, target, ratio) {
    const g     = this._bg;
    const appW  = this._appW;
    const barFW = appW - BAR_X * 2;
    const fillW = Math.max(0, Math.round(barFW * Math.min(1, ratio)));
    const barR  = BAR_H / 2;
    const col   = ratio >= 1 ? 0x22dd66
                : ratio >= 0.6 ? 0x33cc55
                : ratio >= 0.3 ? 0x44bb44
                :                0x2299ee;

    g.clear();

    // HUD background
    g.rect(0, 0, appW, HUD_H);
    g.fill(HUD_BG);

    // Bottom separator
    g.rect(0, HUD_H - 1, appW, 1);
    g.fill({ color: 0xffffff, alpha: 0.06 });

    // Bar track (pill)
    g.roundRect(BAR_X, BAR_Y, barFW, BAR_H, barR);
    g.fill({ color: 0x000000, alpha: 0.50 });
    g.roundRect(BAR_X, BAR_Y, barFW, BAR_H, barR);
    g.fill({ color: 0x1a2040, alpha: 0.85 });

    // Progress fill
    if (fillW >= BAR_H) {
      g.roundRect(BAR_X, BAR_Y, fillW, BAR_H, barR);
      g.fill(col);
      // Lighter top strip — simulates gradient
      if (fillW > barR * 2) {
        g.rect(BAR_X + barR * 0.6, BAR_Y + 1, fillW - barR * 1.2, BAR_H * 0.45);
        g.fill({ color: 0xffffff, alpha: 0.18 });
      }
    } else if (fillW > 0) {
      g.rect(BAR_X, BAR_Y, fillW, BAR_H);
      g.fill(col);
    }

    // Animated sheen sweep
    if (fillW > BAR_H) {
      const t      = (this._elapsed % SHEEN_CYCLE) / SHEEN_CYCLE;
      const sheenW = barFW * SHEEN_W_FRAC;
      const sheenX = BAR_X - sheenW + (fillW + sheenW) * t;
      const cx0    = Math.max(sheenX, BAR_X);
      const cx1    = Math.min(sheenX + sheenW, BAR_X + fillW);
      if (cx1 > cx0) {
        g.rect(cx0, BAR_Y + 2, cx1 - cx0, BAR_H - 4);
        g.fill({ color: 0xffffff, alpha: 0.22 });
      }
    }

    // Bar border
    g.roundRect(BAR_X, BAR_Y, barFW, BAR_H, barR);
    g.stroke({ color: 0xffffff, width: 0.8, alpha: 0.12 });

    // Gold flash overlay
    if (this._flashGold > 0) {
      g.rect(0, 0, appW, HUD_H);
      g.fill({ color: 0xffcc00, alpha: (this._flashGold / 0.4) * 0.40 });
    }

    // Progress fraction text
    const frac = `${kills}/${target}`;
    if (this._progressText.text !== frac) this._progressText.text = frac;
    this._progressText.alpha = fillW > 24 ? 1 : fillW > 0 ? fillW / 24 : 0;

    // Level badge (purple gradient pill)
    const by = TEXT_MID - BADGE_H / 2;
    // Drop shadow
    g.roundRect(BADGE_X + 1, by + 2, BADGE_W, BADGE_H, BADGE_R);
    g.fill({ color: 0x000000, alpha: 0.38 });
    // Dark purple base
    g.roundRect(BADGE_X, by, BADGE_W, BADGE_H, BADGE_R);
    g.fill(0x4a1088);
    // Top highlight (gradient sim)
    g.rect(BADGE_X + BADGE_R * 0.6, by + 1, BADGE_W - BADGE_R * 1.2, BADGE_H * 0.46);
    g.fill({ color: 0xaa55ff, alpha: 0.50 });
    // Gold border
    g.roundRect(BADGE_X, by, BADGE_W, BADGE_H, BADGE_R);
    g.stroke({ color: 0xddaa22, width: 1.2, alpha: 0.70 });
  }

  _drawCoinDisc(cx, cy) {
    const g = this._coinDisc;
    const r = 11;
    g.clear();
    // Shadow
    g.circle(cx + 1, cy + 2, r);
    g.fill({ color: 0x000000, alpha: 0.30 });
    // Gold outer ring
    g.circle(cx, cy, r);
    g.fill(0xc08010);
    // Inner face
    g.circle(cx, cy, r * 0.80);
    g.fill(0xf0c030);
    // Bright center
    g.circle(cx, cy, r * 0.52);
    g.fill({ color: 0xfff080, alpha: 0.60 });
    // Shine spot
    g.circle(cx - r * 0.30, cy - r * 0.30, r * 0.22);
    g.fill({ color: 0xffffff, alpha: 0.65 });
    // Rim
    g.circle(cx, cy, r);
    g.stroke({ color: 0xb87800, width: 1.2 });
  }

  _spawnConfetti(x, y) {
    for (let i = 0; i < 14; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
      const speed = 80 + Math.random() * 100;
      const life  = 0.7 + Math.random() * 0.5;
      this._confetti.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r:  2 + Math.random() * 2,
        color: CONFETTI_COLS[i % CONFETTI_COLS.length],
        life, maxLife: life,
      });
    }
  }

  _updateConfetti(dt) {
    const g = this._confettiGfx;
    g.clear();
    for (let i = this._confetti.length - 1; i >= 0; i--) {
      const p = this._confetti[i];
      p.life -= dt;
      if (p.life <= 0) { this._confetti.splice(i, 1); continue; }
      p.x  += p.vx * dt;
      p.y  += p.vy * dt;
      p.vy += 220 * dt;
      g.circle(p.x, p.y, p.r);
      g.fill({ color: p.color, alpha: p.life / p.maxLife });
    }
  }

  _stepSpring(dt) {
    if (Math.abs(this._bounceScale - 1) < 0.001 && Math.abs(this._bounceVel) < 0.001) {
      this._bounceScale = 1;
      this._comboText.scale.set(1);
      return;
    }
    this._bounceVel   += (-SPRING_K * (this._bounceScale - 1) - SPRING_D * this._bounceVel) * dt;
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

  _refreshComboGauge() {
    const g      = this._comboGauge;
    const combo  = this._gs.combo;
    const gaugeH = 100;
    const gaugeW = 5;
    const gaugeX = this._appW - gaugeW - 2;
    const gaugeY = HUD_H + 8;

    g.clear();
    g.roundRect(gaugeX, gaugeY, gaugeW, gaugeH, 2.5);
    g.fill({ color: 0x223344, alpha: 0.55 });

    if (combo < 2) return;

    const fill  = Math.min(gaugeH, Math.round((combo / 10) * gaugeH));
    const col   = combo >= 7 ? 0xff3333 : combo >= 5 ? 0xff8800 : 0xffcc00;
    const pulse = combo >= 7 ? (0.55 + 0.45 * Math.sin(this._elapsed * 8)) : 1;

    g.roundRect(gaugeX, gaugeY + gaugeH - fill, gaugeW, fill, 2.5);
    g.fill({ color: col, alpha: 0.40 + 0.55 * pulse });

    g.circle(gaugeX + gaugeW / 2, gaugeY + gaugeH - fill, 4);
    g.fill({ color: col, alpha: 0.60 * pulse });
  }

  _refreshMultiBadge() {
    const combo = this._gs.combo;
    let label = '';
    for (const tier of MULT_TIERS) {
      if (combo >= tier.min) { label = tier.label; break; }
    }
    if (this._multiBadge.text !== label) this._multiBadge.text = label;
    this._multiBadge.alpha = label ? 1 : 0;
  }

  _refreshLaneDots() {
    for (const dot of this._laneDots) dot.clear();
  }

  _refreshComboGlow() {
    const g     = this._comboGlowBg;
    const combo = this._gs.combo;
    g.clear();
    if (combo < 2) return;

    const glowW = 150 + combo * 4;
    const glowH = 34;
    const cx    = this._appW / 2;
    const cy    = TEXT_MID;

    g.roundRect(cx - glowW / 2, cy - glowH / 2, glowW, glowH, 10);
    g.fill({ color: this._curTierColor, alpha: 0.18 });

    if (this._tierFlashT > 0) {
      const flashA = (this._tierFlashT / 0.12) * 0.55;
      g.roundRect(cx - glowW / 2, cy - glowH / 2, glowW, glowH, 10);
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
    this._comboText.style.fill     = tier.color;
    this._comboText.style.fontSize = tier.size;
  }

  _refreshFrozenBadge() {
    const boosterState = this._gs?.boosterState;
    const frozen = boosterState?.isFrozen?.() ?? false;
    const shots  = frozen ? (boosterState.freezeShots ?? 0) : 0;

    const g = this._frozenBadgeGfx;
    g.clear();
    this._frozenBadgeText.text = '';

    if (!frozen) return;

    // Pulsing ice-blue overlay on the kill-progress bar
    const pulse  = 0.20 + 0.12 * Math.sin(this._elapsed * 6);
    const barFW  = this._appW - BAR_X * 2;
    g.roundRect(BAR_X, BAR_Y, barFW, BAR_H, BAR_H / 2);
    g.fill({ color: 0x44aaff, alpha: pulse });

    // "❄ FROZEN  2 shots" text centered on bar
    this._frozenBadgeText.text = `❄ FROZEN  ${shots} shot${shots !== 1 ? 's' : ''}`;
    this._progressText.alpha   = 0;   // hide kill fraction while frozen
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
