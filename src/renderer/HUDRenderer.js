// HUDRenderer — renders the 52px HUD bar at the top of the screen.
//
// Contents:
//   • Kill progress bar — top strip, grows left-to-right, shows "kills/target"
//   • Combo text       — centred; hidden when combo < 2. Spring-bounce on bump.
//   • Combo gauge      — right-edge vertical fill bar; color-coded at 3/5/7
//   • Multiplier badge — "×1.2" etc, left of coins, shown when combo >= 3
//   • Coins text       — top-right; updates whenever coins change.
//   • Mute btn         — top-left speaker icon; toggles AudioManager on click.
//   • Level text       — left of mute area; shows current level number.
//   • Hearts           — right of level text; 5 filled/empty symbols.
//   • Lane color dots  — row just above shooter area; shows front car color
//   • Objective banner — "Defeat X cars" shown for 3s at level start (Q2)
//   • Gold flash       — HUD flashes gold when kills reach target (Q10)
import { Graphics, Text } from 'pixi.js';

const HUD_H      = 52;
const BAR_H      = 10;         // height of the kill-progress bar at top
const BAR_Y      = 0;
const HUD_BG     = 0x0d0d1a;
const BAR_BG     = 0x1a1a2e;
const TEXT_MID   = BAR_H + (HUD_H - BAR_H) / 2;   // ≈ 31

// Timer bar colour breakpoints (kept for API compat, unused now)
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

// Q4: multiplier badge text per combo threshold
const MULT_TIERS = [
  { min: 11, label: '×3' },
  { min: 7,  label: '×2' },
  { min: 5,  label: '×1.5' },
  { min: 3,  label: '×1.2' },
];

// Q6: shooter color → hex for lane indicator dots
const CAR_COLOR_MAP = {
  Red:    0xE24B4A, Blue:   0x378ADD, Green:  0x639922,
  Yellow: 0xEF9F27, Purple: 0x7F77DD, Orange: 0xD85A30,
};

// Q6: Y position for lane color dots (just above SHOOTER_AREA_Y=520)
const LANE_DOT_Y = 513;

// Spring constants for the combo bounce animation
const SPRING_K = 380;
const SPRING_D = 18;

function lerpColor(a, b, t) {
  const r = (((a >> 16) & 0xff) + t * (((b >> 16) & 0xff) - ((a >> 16) & 0xff))) | 0;
  const g = (((a >>  8) & 0xff) + t * (((b >>  8) & 0xff) - ((a >>  8) & 0xff))) | 0;
  const bl = ((a       & 0xff) + t * ((b        & 0xff) - (a        & 0xff))) | 0;
  return (r << 16) | (g << 8) | bl;
}

export class HUDRenderer {
  // audioManager is optional — mute button is hidden when not provided.
  constructor(layerManager, gameState, appWidth, audioManager = null) {
    this._gs     = gameState;
    this._appW   = appWidth;
    this._layer  = layerManager.get('hudLayer');
    this._audio  = audioManager;

    // Accumulated time for gauge pulse animation.
    this._elapsed = 0;

    // ── Background + progress bar (redrawn each frame) ───────────────────
    this._bg = new Graphics();
    this._layer.addChild(this._bg);

    // ── Kill progress fraction text ("3/7") — overlaid on the bar ────────
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

    // ── Q3: Vertical combo gauge on right edge ────────────────────────────
    this._comboGauge = new Graphics();
    this._layer.addChild(this._comboGauge);

    // ── Q4: Multiplier badge ("×1.5") left of coins ───────────────────────
    this._multiBadge = new Text({
      text: '',
      style: {
        fontSize:   12,
        fontWeight: 'bold',
        fill:       0xffcc00,
        dropShadow: { color: 0x000000, blur: 3, distance: 1, alpha: 0.8 },
      },
    });
    this._multiBadge.anchor.set(1, 0.5);
    this._multiBadge.x = appWidth - 100;
    this._multiBadge.y = TEXT_MID;
    this._layer.addChild(this._multiBadge);

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
    this._muteBtn.x = 10;
    this._muteBtn.y = Math.round(TEXT_MID) - 10;
    if (audioManager) {
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

    // ── Q6: Lane color indicator dots (above shooter area) ───────────────
    this._laneDots = [];
    for (let i = 0; i < 4; i++) {
      const dot = new Graphics();
      this._layer.addChild(dot);
      this._laneDots.push(dot);
    }

    // ── Q2: Objective banner state ────────────────────────────────────────
    this._objText  = null;
    this._objTimer = 0;

    // ── Q10: Gold flash state ─────────────────────────────────────────────
    this._flashGold     = 0;
    this._prevAtTarget  = false;

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

  // Q2: Display an objective banner for 3 seconds then fade it out.
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

  // Call when the combo increments so the text pops with a spring bounce.
  bumpCombo(combo) {
    this._bounceScale = 1.5;
    this._bounceVel   = 0;
    this._updateComboStyle(combo);
  }

  // Call once per render frame.
  update(dt) {
    this._elapsed += dt;

    // Q10: detect when kills reach target → trigger gold flash
    const kills  = this._gs.totalKills  ?? 0;
    const target = this._gs.targetKills ?? 10;
    const atTarget = target > 0 && kills >= target;
    if (atTarget && !this._prevAtTarget) this._flashGold = 0.4;
    this._prevAtTarget = atTarget;
    if (this._flashGold > 0) this._flashGold = Math.max(0, this._flashGold - dt);

    this._drawBg();
    this._stepSpring(dt);
    this._refreshComboText();
    this._refreshCoinsText();
    this._refreshComboGauge();
    this._refreshMultiBadge();
    this._refreshLaneDots();

    // Q2: tick objective banner
    if (this._objText) {
      this._objTimer -= dt;
      this._objText.alpha = this._objTimer > 0.5 ? 1 : Math.max(0, this._objTimer / 0.5);
      if (this._objTimer <= 0) { this._objText.destroy(); this._objText = null; }
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _drawBg() {
    const gs     = this._gs;
    const kills  = gs.totalKills  ?? 0;
    const target = gs.targetKills ?? 10;
    const ratio  = Math.min(1, target > 0 ? kills / target : 0);
    const barW   = Math.max(0, Math.round(this._appW * ratio));
    const color  = ratio >= 1 ? 0x44ff88 : ratio >= 0.6 ? 0x88cc44 : ratio >= 0.3 ? 0xffcc00 : 0x4488ff;
    const R      = BAR_H / 2;

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

    // Q10: gold flash overlay
    if (this._flashGold > 0) {
      const flashAlpha = (this._flashGold / 0.4) * 0.40;
      this._bg.rect(0, 0, this._appW, HUD_H);
      this._bg.fill({ color: 0xffcc00, alpha: flashAlpha });
    }

    // Q1: progress fraction text — keep in sync with bar data
    const fracStr = `${kills}/${target}`;
    if (this._progressText.text !== fracStr) this._progressText.text = fracStr;
    this._progressText.alpha = barW > 24 ? 1.0 : barW > 0 ? barW / 24 : 0;
  }

  _stepSpring(dt) {
    if (Math.abs(this._bounceScale - 1) < 0.001 && Math.abs(this._bounceVel) < 0.001) {
      this._bounceScale = 1;
      this._comboText.scale.set(1);
      return;
    }
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

  // Q3: vertical combo fill gauge on the right edge of the screen.
  _refreshComboGauge() {
    const g      = this._comboGauge;
    const combo  = this._gs.combo;
    const gaugeH = 100;
    const gaugeW = 5;
    const gaugeX = this._appW - gaugeW - 2;
    const gaugeY = HUD_H + 8;

    g.clear();

    // Track
    g.roundRect(gaugeX, gaugeY, gaugeW, gaugeH, 2.5);
    g.fill({ color: 0x223344, alpha: 0.55 });

    if (combo < 2) return;

    const fill  = Math.min(gaugeH, Math.round((combo / 10) * gaugeH));
    const col   = combo >= 7 ? 0xff3333 : combo >= 5 ? 0xff8800 : 0xffcc00;
    const pulse = combo >= 7 ? (0.55 + 0.45 * Math.sin(this._elapsed * 8)) : 1;

    g.roundRect(gaugeX, gaugeY + gaugeH - fill, gaugeW, fill, 2.5);
    g.fill({ color: col, alpha: 0.40 + 0.55 * pulse });

    // Glow ring at top of fill
    g.circle(gaugeX + gaugeW / 2, gaugeY + gaugeH - fill, 4);
    g.fill({ color: col, alpha: 0.60 * pulse });
  }

  // Q4: score multiplier badge next to coins when combo >= 3.
  _refreshMultiBadge() {
    const combo = this._gs.combo;
    let label = '';
    for (const tier of MULT_TIERS) {
      if (combo >= tier.min) { label = tier.label; break; }
    }
    if (this._multiBadge.text !== label) this._multiBadge.text = label;
    this._multiBadge.alpha = label ? 1 : 0;
  }

  // Q6: small colored dot above each active lane showing front car color.
  _refreshLaneDots() {
    const activeLanes = this._gs.activeLaneCount ?? 4;
    const colW        = this._appW / 4;

    for (let i = 0; i < 4; i++) {
      const dot = this._laneDots[i];
      dot.clear();
      if (i >= activeLanes) continue;

      const lane     = this._gs.lanes?.[i];
      const frontCar = lane?.cars?.find(c => c.hp > 0);
      if (!frontCar) continue;

      const hex = CAR_COLOR_MAP[frontCar.color];
      if (!hex) continue;

      const cx = (i + 0.5) * colW;
      dot.circle(cx, LANE_DOT_Y, 5);
      dot.fill({ color: hex, alpha: 0.85 });
      dot.circle(cx, LANE_DOT_Y, 5);
      dot.stroke({ color: 0xffffff, width: 0.8, alpha: 0.35 });
    }
  }

  _updateComboStyle(combo) {
    let tier = COMBO_TIERS[0];
    for (const t of COMBO_TIERS) {
      if (combo >= t.min) tier = t;
    }
    this._comboText.style.fill     = tier.color;
    this._comboText.style.fontSize = tier.size;
  }

  // Draw a minimal speaker icon at origin (0,0).
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
