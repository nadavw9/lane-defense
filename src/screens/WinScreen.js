// WinScreen — full-screen results overlay shown on level complete.
//
// Enhancements over v1:
//   • Confetti rain system (30-50 colorful pieces fall from top)
//   • Screen flash on 3-star win
//   • Bigger star animations with 300ms stagger
//   • Stat rows: coins (count-up), combo, perfect bonus
//   • "PERFECT DEFENSE!" header on 3-star clean win
//   • 1.5s button lock prevents accidental dismissal during outro animations
//   • NEXT LEVEL button gently pulses once active to invite the tap
import { Container, Graphics, Text, Sprite, Assets } from 'pixi.js';
import { uiIcon } from '../renderer/UIIcon.js';

const _B = import.meta.env.BASE_URL;

const STAR_COLOR_FULL  = 0xffcc00;
const STAR_COLOR_EMPTY = 0x3a3a3a;
const STAR_EMPTY_TINT  = 0x2b2f3a;   // dark tint applied to the glossy star-empty sprite so it recedes

const CONFETTI_COLORS = [0xff4466, 0x44ff88, 0xffcc00, 0x44aaff, 0xff88ff, 0xff8844, 0x88ffff];

// Goal/car palette (matches CLAUDE.md) — used to tint the win confetti by the
// level's goals.
const GOAL_PALETTE = {
  Red: 0xE24B4A, Blue: 0x378ADD, Green: 0x639922,
  Yellow: 0xEF9F27, Purple: 0x7F77DD, Orange: 0xD85A30,
};

// Colours of the level's destroyColor goals (falls back to the festive set).
function goalConfettiColors(gs) {
  const cols = (gs?.goals ?? [])
    .filter(g => g.type === 'destroyColor' && GOAL_PALETTE[g.color])
    .map(g => GOAL_PALETTE[g.color]);
  return cols.length ? cols : CONFETTI_COLORS;
}

// easeOutBack — overshoots past 1 then settles (used for star fly-in + header pop).
const EOB_C1 = 1.70158, EOB_C3 = EOB_C1 + 1;
const easeOutBack = (p) => 1 + EOB_C3 * Math.pow(p - 1, 3) + EOB_C1 * Math.pow(p - 1, 2);

const BUTTON_ENABLE_DELAY = 1.5;  // seconds before buttons become tappable

// ── Web Share helper ──────────────────────────────────────────────────────────
async function _shareWin(levelId, stars, combo) {
  const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  const text = levelId
    ? `${starStr} Just cleared Level ${levelId} with a ×${combo} combo in Traffic Bomb! Can you beat it?`
    : `${starStr} Traffic Bomb — ×${combo} combo!`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Traffic Bomb', text });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    }
  } catch { /* share cancelled — ignore */ }
}

export function calcStars(gs) {
  if (gs.rescueUsed)          return 1;
  if (gs.maxCarPosition < 60) return 3;
  if (gs.maxCarPosition < 80) return 2;
  return 1;
}

// ── Confetti particle system ───────────────────────────────────────────────────
class ConfettiSystem {
  constructor(container, w, h) {
    this._c = container;
    this._w = w;
    this._h = h;
    this._particles = [];
  }

  spawn(count = 35) {
    for (let i = 0; i < count; i++) {
      const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      const g     = new Graphics();
      if (Math.random() < 0.5) { g.rect(-5, -3, 10, 6); }
      else { g.circle(0, 0, 4); }
      g.fill(color);
      g.x        = Math.random() * this._w;
      g.y        = -20 - Math.random() * 60;
      g.rotation = Math.random() * Math.PI * 2;
      this._c.addChild(g);
      this._particles.push({
        g,
        vx: (Math.random() - 0.5) * 120,
        vy: 60 + Math.random() * 100,
        vr: (Math.random() - 0.5) * 5,
        life: 3.5 + Math.random() * 1.5,
      });
    }
  }

  // One-shot upward burst from the bottom: particles shoot up, arc under gravity,
  // and fade over ~1.5s. Tinted by the level's goal colours.
  burstUp(count = 26, colors = CONFETTI_COLORS) {
    for (let i = 0; i < count; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const g     = new Graphics();
      if (Math.random() < 0.5) { g.rect(-5, -3, 10, 6); } else { g.circle(0, 0, 4); }
      g.fill(color);
      g.x        = this._w * (0.15 + Math.random() * 0.70);   // spread across the width
      g.y        = this._h + 12;                              // just below the bottom edge
      g.rotation = Math.random() * Math.PI * 2;
      this._c.addChild(g);
      this._particles.push({
        g,
        vx: (Math.random() - 0.5) * 260,
        vy: -(360 + Math.random() * 240),   // upward
        vr: (Math.random() - 0.5) * 8,
        life: 1.5,
      });
    }
  }

  update(dt) {
    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.life -= dt;
      if (p.life <= 0 || p.g.y > this._h + 20) {
        this._c.removeChild(p.g);
        p.g.destroy();
        this._particles.splice(i, 1);
        continue;
      }
      p.vy        += 180 * dt;
      p.g.x       += p.vx * dt;
      p.g.y       += p.vy * dt;
      p.g.rotation += p.vr * dt * 3;
      p.g.alpha    = Math.min(1, p.life * 1.5);
    }
  }

  destroy() {
    for (const p of this._particles) { this._c.removeChild(p.g); p.g.destroy(); }
    this._particles.length = 0;
  }
}

// ── WinScreen ──────────────────────────────────────────────────────────────────
export class WinScreen {
  /**
   * @param {Array}  improved  — array of strings from ProgressManager.updateBestStats
   *                             (e.g. ['stars', 'combo']); empty = no new records
   * @param {number} levelId   — for the share message (optional)
   */
  constructor(stage, appW, appH, gs, onNext, onMenu, audio, improved = [], levelId = null) {
    this._appW = appW;
    this._appH = appH;

    this._container     = new Container();
    this._confettiLayer = new Container();
    this._particleLayer = new Container();
    stage.addChild(this._container);

    this._starAnims  = [];
    this._confetti   = null;
    this._flashAlpha = 0;
    this._flashG     = null;
    this._burstG     = null;   // 5B: radial celebration burst behind the panel
    this._burstT     = 0;

    // Button interactivity lock (prevents accidental tap during outro anims)
    this._buttonsEnabled    = false;
    this._buttonEnableTimer = 0;
    this._pendingButtons    = [];  // { btn, onClick } — enabled after delay
    this._nextBtn           = null;
    this._nextGlow          = null;
    this._pulseT            = 0;

    // Coin count-up
    this._coinCountTarget  = 0;
    this._coinCountCurrent = 0;
    this._coinValText      = null;

    // City building repair animation (tracks coin count-up progress)
    this._cityBldGfx    = null;   // Graphics object redrawn on state change
    this._cityBldLabel  = null;   // "REPAIRED!" text, shown at state 2
    this._cityBldState  = -1;     // current drawn state
    this._cityBldTarget = 0;      // target state from stars earned

    this._build(appW, appH, gs, onNext, onMenu, audio, improved, levelId);
  }

  destroy() {
    this._confetti?.destroy();
    this._container.destroy({ children: true });
  }

  update(dt) {
    this._confetti?.update(dt);

    // 5B: radial color burst — concentric rings expand from centre and fade (400ms).
    if (this._burstG && this._burstT < 0.4) {
      this._burstT += dt;
      const p   = Math.min(1, this._burstT / 0.4);
      const cx  = this._appW / 2, cy = this._appH / 2 - 36;
      const maxR = Math.max(this._appW, this._appH) * 0.7;
      this._burstG.clear();
      for (let i = 0; i < 3; i++) {
        const rp = Math.min(1, p * 1.0 - i * 0.12);
        if (rp <= 0) continue;
        this._burstG.circle(cx, cy, maxR * rp);
        this._burstG.fill({ color: [0xffd24a, 0xff8844, 0x44ff99][i], alpha: 0.22 * (1 - p) });
      }
      if (p >= 1) { this._burstG.clear(); }
    }

    // Star fly-in: each flies up from below to its slot with an easeOutBack bounce,
    // 120ms each, staggered 150ms. A "ding" + sparkles fire on landing.
    for (const anim of this._starAnims) {
      anim.t += dt;
      if (anim.t < anim.delay) { anim.star.y = anim.startY; continue; }
      const p = Math.min(1, (anim.t - anim.delay) / 0.12);
      anim.star.y = anim.startY + (anim.targetY - anim.startY) * easeOutBack(p);
      if (p >= 1 && !anim.landed) {
        anim.landed   = true;
        anim.star.y   = anim.targetY;
        this._audio?.play('star_earn', { index: anim.idx });
        this._spawnStarSparkles(anim.star.x, anim.star.y);
      }
    }

    // Header pop-in (0.5 → ~1.1 → 1.0, 200ms easeOutBack) then a gentle 1.5s pulse.
    if (this._title) {
      this._titleT += dt;
      const f = this._titleT < 0.20
        ? 0.5 + 0.5 * easeOutBack(this._titleT / 0.20)
        : 1.0 + 0.05 * Math.sin((this._titleT - 0.20) * (2 * Math.PI / 1.5));
      this._title.scale.set(this._titleBaseScale * f);
    }

    // Screen flash fade
    if (this._flashAlpha > 0) {
      this._flashAlpha = Math.max(0, this._flashAlpha - dt * 3.5);
      if (this._flashG) this._flashG.alpha = this._flashAlpha;
    }

    // Sparkle particles
    for (let i = this._particleLayer.children.length - 1; i >= 0; i--) {
      const s = this._particleLayer.children[i];
      if (!s._sp) continue;
      s._sp.t += dt;
      const prog = s._sp.t / 0.45;
      if (prog >= 1) { this._particleLayer.removeChild(s); s.destroy(); continue; }
      s.x    = s._sp.sx + s._sp.vx * prog;
      s.y    = s._sp.sy + s._sp.vy * prog + 60 * prog * prog;
      s.alpha = 1 - prog;
    }

    // Button enable timer — ramps button alpha and then unlocks interaction
    if (!this._buttonsEnabled) {
      this._buttonEnableTimer += dt;
      const progress = Math.min(1, this._buttonEnableTimer / BUTTON_ENABLE_DELAY);
      const alpha    = 0.35 + 0.55 * progress;
      for (const { btn } of this._pendingButtons) {
        if (!this._buttonsEnabled) btn.alpha = alpha;
      }
      if (this._buttonEnableTimer >= BUTTON_ENABLE_DELAY) {
        this._buttonsEnabled = true;
        this._enableButtons();
      }
    }

    // NEXT LEVEL ready-glow: a pulsing halo behind the button (booster-glow pattern),
    // starting 0.5s after the buttons settle to draw the eye.
    if (this._buttonsEnabled && this._nextGlow) {
      this._pulseT += dt;
      if (this._pulseT > 0.5) {
        const ph = 0.5 + 0.5 * Math.sin((this._pulseT - 0.5) * 4.5);
        this._nextGlow.alpha = 0.12 + 0.48 * ph;
        this._nextGlow.scale.set(1 + 0.07 * ph);
      }
    }

    // Coin count-up animation (completes over 0.8s)
    if (this._coinCountCurrent < this._coinCountTarget) {
      const rate = Math.max(1, this._coinCountTarget / 0.8);
      this._coinCountCurrent = Math.min(
        this._coinCountTarget,
        this._coinCountCurrent + rate * dt,
      );
      if (this._coinValText) {
        this._coinValText.text = `+${Math.floor(this._coinCountCurrent)}`;
      }
    }

    // City building repair animation — steps through states as coins count up
    if (this._cityBldTarget > 0 && this._coinCountTarget > 0) {
      const prog = this._coinCountCurrent / this._coinCountTarget;
      const targetNow = prog >= 1.0 ? this._cityBldTarget
        : (prog >= 0.4 && this._cityBldTarget >= 1 ? 1 : 0);
      if (targetNow !== this._cityBldState) {
        this._setCityBldState(targetNow);
      }
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _enableButtons() {
    for (const { btn, onClick } of this._pendingButtons) {
      btn.eventMode = 'static';
      btn.cursor    = 'pointer';
      btn.alpha     = 1;
      btn.on('pointerdown', onClick);
      btn.on('pointerover',  () => { if (this._buttonsEnabled) btn.alpha = 0.75; });
      btn.on('pointerout',   () => { if (this._buttonsEnabled) btn.alpha = 1; });
    }
  }

  _build(w, h, gs, onNext, onMenu, audio, improved = [], levelId = null) {
    const stars    = calcStars(gs);
    const is3Star  = stars === 3;
    this._audio    = audio;

    // Backdrop — catches all touches so gameplay beneath isn't accessible.
    // Strong dim (0.90) so the road / cars / booster bar do not bleed through.
    const backdrop = new Graphics();
    backdrop.rect(0, 0, w, h);
    backdrop.fill({ color: 0x000011, alpha: 0.90 });
    backdrop.eventMode = 'static';
    this._container.addChild(backdrop);

    // 5B: radial celebration burst — a bright disc expands from centre (400ms)
    // behind the confetti/panel, like a "color burst" flash before the results.
    this._burstG = new Graphics();
    this._container.addChild(this._burstG);
    this._burstT = 0;

    // Confetti — one-shot upward burst from the bottom, tinted by the level's goals.
    this._container.addChild(this._confettiLayer);
    this._confetti = new ConfettiSystem(this._confettiLayer, w, h);
    this._confetti.burstUp(is3Star ? 30 : 22, goalConfettiColors(gs));

    // White flash on 3-star
    if (is3Star) {
      this._flashG     = new Graphics();
      this._flashG.rect(0, 0, w, h);
      this._flashG.fill(0xffffff);
      this._flashG.alpha = 0.85;
      this._flashAlpha   = 0.85;
      this._container.addChild(this._flashG);
    }

    // Panel — height sized so the action button always clears the last stat
    // row with a visible gap (see button placement below). Shifted up 36px so
    // the button stays high on screen; the modal backdrop blocks input anyway.
    const panelW = 320;
    const panelH = is3Star ? 430 : 390;
    const px = (w - panelW) / 2;
    const py = (h - panelH) / 2 - 36;
    const cx = w / 2;

    // Celebration burst BEHIND the panel — radial rays + confetti frame the modal
    // (additive art; transparent open centre sits behind the opaque panel).
    const burstTex = Assets.get(`${_B}sprites/ui/win-burst.png`);
    if (burstTex) {
      const burst = new Sprite(burstTex);
      burst.anchor.set(0.5);
      burst.scale.set((panelH + 150) / burstTex.height);
      burst.x = cx; burst.y = py + panelH / 2;
      burst.alpha = 0.92;
      this._container.addChild(burst);
    }

    const panel = new Graphics();
    panel.roundRect(px, py, panelW, panelH, 20);
    panel.fill({ color: 0x0d1a2e, alpha: 0.97 });
    panel.roundRect(px, py, panelW, panelH, 20);
    panel.stroke({ color: is3Star ? 0xffcc00 : 0x44aaff, width: 2, alpha: is3Star ? 0.80 : 0.45 });
    this._container.addChild(panel);

    let y = py + 34;

    // Title
    const title      = is3Star ? 'PERFECT DEFENSE!' : 'LEVEL COMPLETE';
    const titleColor = is3Star ? 0xffcc00 : 0x44ff88;
    const titleSize  = is3Star ? 22 : 26;
    const titleTxt = this._text(title, cx, y, { fontSize: titleSize, fill: titleColor,
      dropShadow: is3Star ? { color: 0xff8800, blur: 18, distance: 0, alpha: 0.8 } : undefined });
    // Clamp so the title keeps a clear gap from the top-right city-repair icon.
    // Icon left edge sits at cx+98 (px+panelW-62); title is centred on cx, so the
    // gap = 98 - titleWidth/2. For a ≥12px gap → titleWidth ≤ 172 = panelW-148.
    // (Nudging the icon right instead would crowd it against the panel border.)
    const titleMaxW = panelW - 148;   // ≈172px → ≥12px gap before the corner icon
    this._titleBaseScale = (titleTxt.width > titleMaxW) ? (titleMaxW / titleTxt.width) : 1;
    this._title  = titleTxt;
    this._titleT = 0;
    titleTxt.scale.set(this._titleBaseScale * 0.5);   // starts small → pops in (see update)
    y += 48;

    // Stars
    this._buildStars(cx, y, stars, audio);
    y += 72;

    // Stat rows — smaller to stay within tighter panel
    const ROW_H = 38, ROW_GAP = 6;
    this._coinCountTarget  = gs.coins;
    this._coinCountCurrent = 0;
    this._coinValText      = this._statRow(px + 14, y, panelW - 28, ROW_H, 'COINS EARNED', '+0', 0xf5c842, { name: 'coin', emoji: '◆' });

    // City building repair mini-animation — top-right corner of panel.
    // §3e: ANY win repairs the level's building (→ repaired), matching the
    // persisted cityState the map reads. The old stars-proxy (scaffold at 1-2
    // stars, repaired only at 3) contradicted the map — a 1-star win showed the
    // corner at scaffold while the map showed the same building repaired.
    this._cityBldTarget = 2;
    this._buildCityAnim(px + panelW - 62, py + 12);
    y += ROW_H + ROW_GAP;
    this._statRow(px + 14, y, panelW - 28, ROW_H, 'BEST MULTI-KILL', `×${gs.maxSingleShotKills}`, 0xff8844, { name: 'lightning', emoji: '⚡' });
    if (is3Star) {
      y += ROW_H + ROW_GAP;
      this._statRow(px + 14, y, panelW - 28, ROW_H, 'PERFECT CLEAR', 'Flawless!', 0xffcc00, { name: 'star-filled', emoji: '★' });
    }
    // Advance past the last stat row to the BUTTON CENTER position.
    // _button() centers the button on this y, so we add the row body (ROW_H),
    // an 18px gap, and the button's half-height (27) → 18px clear gap above it.
    y += ROW_H + 18 + 27;

    // Buttons — registered as pending, enabled after BUTTON_ENABLE_DELAY.
    // Normal levels: only NEXT LEVEL (no LEVEL SELECT on win — matches Royal Match pattern).
    // Daily challenge (onNext=null): LEVEL SELECT is the only exit.
    if (onNext) {
      this._button('NEXT LEVEL ▶', cx, y, 0x1a6a3a, 0x55ff99,
        () => { audio?.play('button_tap'); onNext(); }, true);
    } else {
      this._button('LEVEL SELECT', cx, y, 0x1a2a3a, 0x88bbdd,
        () => { audio?.play('button_tap'); onMenu(); }, false);
    }
    y += 64;

    // Share button (always visible, non-critical) — [share icon] SHARE, centered
    const shareBtn = new Container();
    const shareTxt = new Text({ text: 'SHARE', style: { fontSize: 14, fontWeight: 'bold', fill: 0x66aaff } });
    shareTxt.anchor.set(0, 0.5);
    const shareIco = uiIcon('share', 16, '📤');
    const shTot = 16 + 4 + shareTxt.width;
    shareIco.x = -shTot / 2 + 8;          shareIco.y = 0;
    shareTxt.x = -shTot / 2 + 16 + 4;     shareTxt.y = 0;
    shareBtn.addChild(shareIco); shareBtn.addChild(shareTxt);
    shareBtn.x = cx; shareBtn.y = y;
    shareBtn.eventMode = 'static'; shareBtn.cursor = 'pointer';
    shareBtn.on('pointerdown', () => _shareWin(levelId, stars, gs.maxSingleShotKills));
    shareBtn.on('pointerover',  () => { shareBtn.alpha = 0.70; });
    shareBtn.on('pointerout',   () => { shareBtn.alpha = 1.00; });
    this._container.addChild(shareBtn);

    // Sparkle layer on top
    this._container.addChild(this._particleLayer);
  }

  _buildStars(cx, cy, count, audio) {
    const R = 28, GAP = 14;
    const totalW = 3 * R * 2 + 2 * GAP;
    const x0 = cx - totalW / 2 + R;
    for (let i = 0; i < 3; i++) {
      const filled = i < count;
      // Glossy star SPRITE at the same geometry as the old vector star (Ø = R*2).
      // Wrapped in a Container so the empty-scale (0.78) and the fly-in .y tween act
      // on the wrapper exactly as they did on the Graphics. uiIcon falls back to the
      // ★/☆ glyph if the texture didn't preload (win moment never breaks).
      const g = new Container();
      g.addChild(uiIcon(filled ? 'star-filled' : 'star-empty', R * 2, filled ? '★' : '☆',
        { emojiFill: filled ? STAR_COLOR_FULL : STAR_COLOR_EMPTY,
          // Unearned star recedes: dark tint + low alpha so the gold earned stars
          // dominate and the empty slot reads as a quiet "could earn this".
          tint: filled ? undefined : STAR_EMPTY_TINT }));
      if (!filled) { g.scale.set(0.78); g.alpha = 0.5; }
      g.x = x0 + i * (R * 2 + GAP);
      g.y = cy;
      this._container.addChild(g);
      if (filled) {
        // Fly in from below with an easeOutBack bounce, 120ms each, 150ms stagger.
        const targetY = g.y;
        g.y = this._appH + 80;
        this._starAnims.push({ star: g, idx: i, targetY, startY: g.y, t: 0, delay: i * 0.15, landed: false });
      }
    }
  }

  _spawnStarSparkles(sx, sy) {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const speed = 55 + Math.random() * 40;
      const g     = new Graphics();
      g.circle(0, 0, 3.5);
      g.fill({ color: 0xffdd00, alpha: 1 });
      g.x   = sx; g.y = sy;
      g._sp = { sx, sy, vx: Math.cos(angle) * speed * 0.45, vy: Math.sin(angle) * speed * 0.45, t: 0 };
      this._particleLayer.addChild(g);
    }
  }

  _statRow(x, y, w, h, label, value, color, icon = null) {
    const bg = new Graphics();
    bg.roundRect(x, y, w, h, 8);
    bg.fill({ color: 0x081420, alpha: 0.85 });
    this._container.addChild(bg);

    let lblX = x + 12;
    if (icon) {   // [icon] label — icon keeps natural colors
      const sp = uiIcon(icon.name, 17, icon.emoji, { emojiFill: 0x7799aa });
      sp.x = x + 12 + 9; sp.y = y + h / 2;
      this._container.addChild(sp);
      lblX = x + 12 + 22;
    }
    const lbl = new Text({ text: label, style: { fontSize: 13, fontWeight: 'bold', fill: 0x7799aa } });
    lbl.anchor.set(0, 0.5);
    lbl.x = lblX; lbl.y = y + h / 2;
    this._container.addChild(lbl);

    const val = new Text({ text: value, style: { fontSize: 18, fontWeight: 'bold', fill: color } });
    val.anchor.set(1, 0.5);
    val.x = x + w - 12; val.y = y + h / 2;
    this._container.addChild(val);

    return val;
  }

  _text(str, x, y, style) {
    const t = new Text({ text: str, style: { fontWeight: 'bold', ...style } });
    t.anchor.set(0.5, 0.5);
    t.x = x; t.y = y;
    this._container.addChild(t);
    return t;
  }

  _drawStar(g, outerR, color) {
    const pts = 5, innerR = outerR * 0.42;
    const pts2d = [];
    for (let i = 0; i < pts * 2; i++) {
      const a = (Math.PI * i) / pts - Math.PI / 2;
      const r = (i % 2 === 0) ? outerR : innerR;
      pts2d.push(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.poly(pts2d);
    g.fill(color);
  }

  _buildCityAnim(x, y) {
    // Container for the building icon + label, top-right of win panel
    const grp = new Container();
    grp.x = x;
    grp.y = y;
    this._container.addChild(grp);

    // Background pill
    const pill = new Graphics();
    pill.roundRect(0, 0, 52, 44, 8);
    pill.fill({ color: 0x081420, alpha: 0.75 });
    grp.addChild(pill);

    // The building graphics object (redrawn on state change)
    this._cityBldGfx = new Graphics();
    this._cityBldGfx.x = 6;
    this._cityBldGfx.y = 5;
    grp.addChild(this._cityBldGfx);

    // Draw initial state 0 immediately
    this._setCityBldState(0);
  }

  _setCityBldState(state) {
    if (!this._cityBldGfx || state === this._cityBldState) return;
    this._cityBldState = state;
    const g = this._cityBldGfx;
    g.clear();
    WinScreen._drawBldGraphic(g, 40, 28, state);
  }

  static _drawBldGraphic(g, bw, bh, state) {
    const bx = 0, by = 0;
    if (state === 0) {
      // Damaged — jagged roofline
      g.moveTo(bx,       by + 9);
      g.lineTo(bx + 5,   by + 4);
      g.lineTo(bx + 12,  by + 8);
      g.lineTo(bx + 18,  by);
      g.lineTo(bx + 25,  by + 5);
      g.lineTo(bx + 32,  by + 2);
      g.lineTo(bx + bw,  by + 9);
      g.lineTo(bx + bw,  by + bh);
      g.lineTo(bx,       by + bh);
      g.closePath();
      g.fill({ color: 0x1e2530, alpha: 0.90 });
    } else if (state === 1) {
      // Scaffolding — grey + yellow bars
      g.rect(bx, by, bw, bh);
      g.fill({ color: 0x2e3a48, alpha: 0.92 });
      for (let i = 0; i < 3; i++) {
        g.rect(bx, by + 3 + i * 8, bw, 2.5);
        g.fill({ color: 0xf0a020, alpha: 0.90 });
      }
    } else {
      // Complete — lit facade with warm windows
      g.rect(bx, by, bw, bh);
      g.fill({ color: 0x4a6070, alpha: 0.95 });
      for (let col = 0; col < 3; col++) {
        for (let row = 0; row < 2; row++) {
          g.circle(bx + 7 + col * 12, by + 6 + row * 12, 3);
          g.fill({ color: 0xffe08a, alpha: 1.0 });
        }
      }
    }
  }

  _button(label, cx, y, bgColor, labelColor, onClick, isNext = false) {
    const btnW = 220, btnH = 54;
    if (isNext) {
      // Ready-glow halo behind the NEXT button (added first → renders behind it).
      const glow = new Graphics();
      glow.roundRect(-btnW / 2 - 10, -btnH / 2 - 10, btnW + 20, btnH + 20, 18);
      glow.fill({ color: labelColor, alpha: 0.40 });
      glow.x = cx; glow.y = y; glow.alpha = 0;
      this._container.addChild(glow);
      this._nextGlow = glow;
    }
    const btn  = new Graphics();
    btn.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 14);
    btn.fill(bgColor);
    btn.x         = cx;
    btn.y         = y;
    btn.alpha     = 0.35;   // starts dimmed until BUTTON_ENABLE_DELAY
    btn.eventMode = 'none'; // non-interactive until enabled

    const t = new Text({ text: label, style: { fontSize: 22, fontWeight: 'bold', fill: labelColor } });
    t.anchor.set(0.5, 0.5);
    btn.addChild(t);
    this._container.addChild(btn);

    this._pendingButtons.push({ btn, onClick });
    if (isNext) this._nextBtn = btn;
  }
}
