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
import { Container, Graphics, Text, Sprite, Assets, FillGradient } from 'pixi.js';
import { uiIcon } from '../renderer/UIIcon.js';
import { worldForLevel } from './levelMapLayout.js';
import { panel as premiumPanel, ribbon, button as premiumButton, bodyText, titleText, well } from '../renderer/PremiumUI.js';

const _B = import.meta.env.BASE_URL;

const STAR_COLOR_FULL  = 0xffcc00;
const STAR_COLOR_EMPTY = 0x3a3a3a;
const STAR_EMPTY_TINT  = 0x2b2f3a;   // dark tint applied to the glossy star-empty sprite so it recedes

const CONFETTI_COLORS = [0xff4466, 0x44ff88, 0xffcc00, 0x44aaff, 0xff88ff, 0xff8844, 0x88ffff];

// Goal/car palette (matches CLAUDE.md) — used to tint the win confetti by the
// level's goals.
const GOAL_PALETTE = {
  Red: 0xFF3D3D, Blue: 0x2F8CFF, Green: 0x2FCC55,
  Yellow: 0xFFD42A, Purple: 0xA35CFF, Orange: 0xFF8A1C,
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
    if (this._cityBldTarget > 0) {
      // Paced by the coin count-up; a 0-coin win still repairs, on a timer.
      this._cityT = (this._cityT ?? 0) + dt;
      const prog = this._coinCountTarget > 0
        ? this._coinCountCurrent / this._coinCountTarget
        : Math.max(0, (this._cityT - 0.6) / 1.2);
      const targetNow = prog >= 1.0 ? this._cityBldTarget
        : (prog >= 0.4 && this._cityBldTarget >= 1 ? 1 : 0);
      if (targetNow !== this._cityBldState) {
        this._setCityBldState(targetNow);
      }
    }
    if (this._cityBldPop != null && this._cityBldSprite) {     // repaired: pop
      this._cityBldPop += dt;
      const p = Math.min(1, this._cityBldPop / 0.35);
      const tex = this._cityBldSprite.texture;
      const base = 64 / Math.max(tex.width, tex.height);
      this._cityBldSprite.scale.set(base * (1 + 0.35 * Math.sin(Math.PI * p) * (1 - p * 0.5)));
      if (p >= 1) { this._cityBldSprite.scale.set(base); this._cityBldPop = null; }
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _enableButtons() {
    for (const { btn } of this._pendingButtons) {
      btn.eventMode = 'static';
      btn.cursor    = 'pointer';
      btn.alpha     = 1;
    }
  }

  _build(w, h, gs, onNext, onMenu, audio, improved = [], levelId = null) {
    const stars    = calcStars(gs);
    const is3Star  = stars === 3;
    this._audio    = audio;

    // Backdrop — catches all touches so gameplay beneath isn't accessible.
    // Strong dim (0.90) so the road / cars / booster bar do not bleed through.
    const backdrop = new Graphics();
    // Deep violet celebration field (not black) with a warm glow behind the
    // panel, so the gold burst reads as light rather than cream-on-black.
    backdrop.rect(0, 0, w, h).fill(new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local',
      colorStops: [{ offset: 0, color: 0x2A1F66 }, { offset: 0.5, color: 0x3B2580 }, { offset: 1, color: 0x160F3A }] }));
    backdrop.alpha = 0.96;
    for (let i = 0; i < 10; i++) { const r = 300 - i * 24; backdrop.ellipse(w / 2, h / 2 - 40, r, r * 1.25).fill({ color: 0xFFB84A, alpha: 0.035 }); }
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
    const panelW = 334;
    const panelH = is3Star ? 512 : 462;
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
      burst.tint = 0xFFD470;
      burst.alpha = 0.5;
      burst.blendMode = 'add';
      this._container.addChild(burst);
    }

    const pnl = premiumPanel(panelW, panelH);
    pnl.x = px; pnl.y = py;
    this._container.addChild(pnl);

    // Ribbon title across the top edge (pops in, then pulses — see update()).
    const title = ribbon(is3Star ? 'PERFECT!' : 'LEVEL COMPLETE', is3Star ? 220 : 270, { size: is3Star ? 32 : 26 });
    title.x = cx; title.y = py + 2;
    this._container.addChild(title);
    this._titleBaseScale = 1;
    this._title  = title;
    this._titleT = 0;
    title.scale.set(0.5);

    let y = py + 92;

    // Stars
    this._buildStars(cx, y, stars, audio);
    y += 78;

    // Stat rows — smaller to stay within tighter panel
    const ROW_H = 42, ROW_GAP = 8;
    this._coinCountTarget  = gs.coins;
    this._coinCountCurrent = 0;
    this._coinValText      = this._statRow(px + 22, y, panelW - 44, ROW_H, 'COINS EARNED', '+0', 0xf5c842, { name: 'coin', emoji: '◆' });

    // City building repair mini-animation — top-right corner of panel.
    // §3e: ANY win repairs the level's building (→ repaired), matching the
    // persisted cityState the map reads. The old stars-proxy (scaffold at 1-2
    // stars, repaired only at 3) contradicted the map — a 1-star win showed the
    // corner at scaffold while the map showed the same building repaired.
    this._cityBldTarget = 2;
    y += ROW_H + ROW_GAP;
    // City repair row: the building graphic animates rubble → scaffold → repaired.
    this._statRow(px + 22, y, panelW - 44, ROW_H, 'CITY REPAIRED', '', 0xffcc00, { name: 'trophy', emoji: '🏆' });
    this._cityLevelId = typeof levelId === 'number' ? levelId : (gs.levelId ?? null);
    this._buildCityAnim(px + panelW - 22 - 58, y - 1);
    y += ROW_H + ROW_GAP;
    // A multi-kill of 0 or 1 is not a stat worth celebrating — show shots instead.
    if ((gs.maxSingleShotKills ?? 0) >= 2) {
      this._statRow(px + 22, y, panelW - 44, ROW_H, 'BEST MULTI-KILL', `×${gs.maxSingleShotKills}`, 0xff8844, { name: 'lightning', emoji: '⚡' });
    } else {
      this._statRow(px + 22, y, panelW - 44, ROW_H, 'CARS DESTROYED', String(gs.totalKills ?? 0), 0xff8844, { name: 'explosion', emoji: '💥' });
    }
    if (is3Star) {
      y += ROW_H + ROW_GAP;
      this._statRow(px + 22, y, panelW - 44, ROW_H, 'PERFECT CLEAR', 'Flawless!', 0xffcc00, { name: 'star-filled', emoji: '★' });
    }
    // Advance past the last stat row to the BUTTON CENTER position.
    // _button() centers the button on this y, so we add the row body (ROW_H),
    // an 18px gap, and the button's half-height (27) → 18px clear gap above it.
    y += ROW_H + 22 + 34;

    // Buttons — registered as pending, enabled after BUTTON_ENABLE_DELAY.
    // Normal levels: only NEXT LEVEL (no LEVEL SELECT on win — matches Royal Match pattern).
    // Daily challenge (onNext=null): LEVEL SELECT is the only exit.
    if (onNext) {
      this._button('NEXT LEVEL', cx, y, 0x1a6a3a, 0x55ff99,
        () => { audio?.play('button_tap'); onNext(); }, true);
    } else {
      this._button('LEVEL SELECT', cx, y, 0x1a2a3a, 0x88bbdd,
        () => { audio?.play('button_tap'); onMenu(); }, false);
    }
    y += 58;

    // Share button (always visible, non-critical) — [share icon] SHARE, centered
    const shareBtn = new Container();
    const shareTxt = new Text({ text: 'SHARE', style: { fontSize: 15, fontWeight: '700', fill: 0x9FC8FF } });
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
    const R = 34, GAP = 10;
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
      g.y = cy + (i === 1 ? -12 : 4);
      if (i === 1) g.scale.set(filled ? 1.18 : 0.9);
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
    const bg = well(w, h);
    bg.x = x; bg.y = y;
    this._container.addChild(bg);

    let lblX = x + 12;
    if (icon) {   // [icon] label — icon keeps natural colors
      const sp = uiIcon(icon.name, 24, icon.emoji, { emojiFill: 0x7799aa });
      sp.x = x + 14 + 12; sp.y = y + h / 2;
      this._container.addChild(sp);
      lblX = x + 14 + 30;
    }
    const lbl = new Text({ text: label, style: { fontSize: 15, fontWeight: '700', fill: 0xD6D0F5 } });
    lbl.anchor.set(0, 0.5);
    lbl.x = lblX; lbl.y = y + h / 2;
    this._container.addChild(lbl);

    const val = new Text({ text: value, style: { fontSize: 22, fontWeight: '700', fill: color, stroke: { color: 0x1F1A33, width: 4, join: 'round' } } });
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
    // The level's own baked building (the one the map shows), when it's loaded;
    // the little vector house otherwise.
    const lv = this._cityLevelId;
    const tex = typeof lv === 'number'
      ? Assets.get(`${import.meta.env.BASE_URL}sprites/designed/repair-${worldForLevel(lv).theme}-${state}-${lv % 3}.png`)
      : null;
    if (tex) {
      if (!this._cityBldSprite) {
        this._cityBldSprite = new Sprite(tex);
        this._cityBldSprite.anchor.set(0.5, 0.62);
        this._cityBldSprite.x = 26; this._cityBldSprite.y = 20;
        this._cityBldGfx.parent.addChild(this._cityBldSprite);
      }
      this._cityBldSprite.texture = tex;
      this._cityBldSprite.scale.set(80 / Math.max(tex.width, tex.height));   // pops out of the row a little: it is the reward
      if (state === 2) this._cityBldPop = 0;
      return;
    }
    WinScreen._drawBldGraphic(g, 40, 28, state);
  }

  static _drawBldGraphic(g, bw, bh, state) {
    // A little house: rubble → scaffolding → repaired with a red roof and lit
    // windows. Drawn bright so it reads on the dark stat well.
    const INKC = 0x1F1A33;
    if (state === 0) {
      g.poly([0, bh, 0, 12, 7, 6, 13, 11, 20, 3, 27, 9, 34, 5, bw, 12, bw, bh]).fill(0x7A6A5C).stroke({ color: INKC, width: 2 });
      g.rect(8, bh - 8, 6, 5).fill(0x4E4238); g.rect(24, bh - 11, 8, 4).fill(0x4E4238);
    } else if (state === 1) {
      g.rect(2, 8, bw - 4, bh - 8).fill(0x9AA1AD).stroke({ color: INKC, width: 2 });
      for (let i = 0; i < 3; i++) g.rect(0, 10 + i * 6, bw, 2.5).fill(0xF0A020);
      for (const x of [4, bw / 2 - 1, bw - 6]) g.rect(x, 6, 2, bh - 6).fill(0xF0A020);
    } else {
      g.poly([-2, 11, bw / 2, 0, bw + 2, 11]).fill(0xE0574A).stroke({ color: INKC, width: 2 });
      g.rect(3, 11, bw - 6, bh - 11).fill(0xF6EBD9).stroke({ color: INKC, width: 2 });
      for (const x of [8, bw - 16]) g.roundRect(x, 15, 8, 7, 1.5).fill(0xFFD76A).stroke({ color: INKC, width: 1.2 });
      g.roundRect(bw / 2 - 4, bh - 9, 8, 9, 1.5).fill(0x8A5A3B).stroke({ color: INKC, width: 1.2 });
    }
  }

  _button(label, cx, y, bgColor, labelColor, onClick, isNext = false) {
    const btnW = 240, btnH = 66;
    if (isNext) {
      // Ready-glow halo behind the NEXT button (added first → renders behind it).
      const glow = new Graphics();
      glow.roundRect(-btnW / 2 - 10, -btnH / 2 - 8, btnW + 20, btnH + 18, 30);
      glow.fill({ color: 0x9CFF6A, alpha: 0.45 });
      glow.x = cx; glow.y = y; glow.alpha = 0;
      this._container.addChild(glow);
      this._nextGlow = glow;
    }
    const icon = isNext ? uiIcon('play', 26, '▶') : null;
    const btn = premiumButton(label, { variant: isNext ? 'green' : 'blue', w: btnW, h: btnH, size: 28, icon,
      onTap: () => { if (this._buttonsEnabled) onClick(); } });
    btn.x = cx; btn.y = y;
    btn.alpha = 0.35;       // starts dimmed until BUTTON_ENABLE_DELAY
    btn.eventMode = 'none'; // non-interactive until enabled
    this._container.addChild(btn);
    this._pendingButtons.push({ btn, onClick });
    if (isNext) this._nextBtn = btn;
  }
}
