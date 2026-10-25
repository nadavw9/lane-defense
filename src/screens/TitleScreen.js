// TitleScreen — the first screen.
//
//   • The town background art and the TRAFFIC BOMB logo
//   • The hero: the app icon's car flung out of a BOOM (app-hero.png, baked by
//     scripts/render-app-icons.mjs), popped in on the first visit, then bobbing
//   • PLAY (opens the next level) with a LEVEL N pill
//   • MAP, then DAILY / TROPHIES / CHALLENGE / STATS as the player reaches TITLE_UNLOCK
import { Container, Graphics, Text, Sprite, Assets, Rectangle } from 'pixi.js';
import { uiIcon, uiPlate } from '../renderer/UIIcon.js';
import { button as premiumButton, roundButton, bodyText } from '../renderer/PremiumUI.js';

const SKY_TOP     = 0x4FC3F7;   // light sky blue
const SKY_BOTTOM  = 0x81D4FA;   // slightly lighter horizon
const GROUND_COL  = 0x66BB6A;   // fresh green ground
const CLOUD_COL   = 0xFFFFFF;

const BASE_URL = import.meta.env.BASE_URL ?? '';

let _introPlayed = false;   // the hero pop-in intro plays on the first title visit only

// Level the player must have reached before each secondary title button shows.
export const TITLE_UNLOCK = { daily: 8, trophies: 15, challenge: 20, stats: 25 };
const SEEN_KEY = 'title_buttons_seen';
function readSeen() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]')); } catch { return new Set(); }
}
function markSeen(key) {
  try { const s = readSeen(); s.add(key); localStorage.setItem(SEEN_KEY, JSON.stringify([...s])); } catch { /* storage blocked */ }
}

export class TitleScreen {
  constructor(stage, appW, appH, {
    onPlay, onDaily, hasDailyReward, onDailyChallenge,
    onAchievements, onStats, onSettings, audio,
    loginStreak = 0, dailyChallengeDone = false,
    onMap = null, nextLevel = null,
  }) {
    this._container = new Container();
    this._carLayer  = new Container();
    this._appW      = appW;
    this._appH      = appH;
    this._cars      = [];
    this._clouds    = [];
    this._toasts    = [];
    this._elapsed   = 0;

    stage.addChild(this._container);
    this._onMap = onMap;
    this._nextLevel = nextLevel;
    this._build(appW, appH, onPlay, onDaily, hasDailyReward, onDailyChallenge,
                onAchievements, onStats, onSettings, audio, loginStreak, dailyChallengeDone);
  }

  destroy() { this._container.destroy({ children: true }); }

  update(dt) {
    this._elapsed += dt;
    this._tickToasts(dt);
    this._tickIntro(dt);
    this._tickPlayGlow(dt);
  }

  _tickShimmer() {
    if (!this._shimG) return;
    const PERIOD  = 3.0;   // seconds between each sweep
    const SWEEP   = 0.55;  // fraction of period during which bar is visible
    const phase   = (this._elapsed % PERIOD) / PERIOD;
    this._shimG.clear();
    if (phase >= SWEEP) return;
    const t      = phase / SWEEP;                 // 0→1 during visible window
    const alpha  = Math.sin(t * Math.PI) * 0.20; // fade in/out
    const x      = this._shimBaseX - 30 + (260 + 60) * t;
    const slant  = 38;
    const sy     = this._shimY;
    const sh     = this._shimH;
    this._shimG.poly([x, sy, x + 28, sy, x + 28 + slant, sy + sh, x + slant, sy + sh]);
    this._shimG.fill({ color: 0xffffff, alpha });
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _build(w, h, onPlay, onDaily, hasDailyReward, onDailyChallenge,
         onAchievements, onStats, onSettings, audio, loginStreak, dailyChallengeDone = false) {

    // ── Background: full-screen AI-generated city image ─────────────────────
    // Replaces the old sky-blue gradient + programmatic clouds/ground.
    const bgTex = Assets.get(`${BASE_URL}sprites/designed/title-background.png`);
    if (bgTex) {
      const bg = new Sprite(bgTex);
      bg.width = w; bg.height = h;
      bg.eventMode = 'static';
      this._container.addChild(bg);
    } else {
      // Fallback to the original sky gradient if the image failed to preload.
      const sky = new Graphics();
      sky.rect(0, 0, w, h * 0.72);       sky.fill(SKY_TOP);
      sky.rect(0, h * 0.40, w, h * 0.32); sky.fill(SKY_BOTTOM);
      sky.rect(0, h * 0.72, w, h * 0.28); sky.fill(GROUND_COL);
      sky.eventMode = 'static';
      this._container.addChild(sky);
    }
    // The AI background already includes a built-in road, so the title no longer
    // draws its own bottom road band or ambient driving cars.

    // ── Logo (AI-generated) — replaces the programmatic gradient title text ──
    const logoTex = Assets.get(`${BASE_URL}sprites/designed/title-logo.png`);
    if (logoTex) {
      const scale = Math.min(1, 320 / logoTex.width);   // cap to ~320px wide
      const dispW = logoTex.width * scale;
      const dispH = logoTex.height * scale;
      const cx = w / 2, cy = h * 0.17;                  // top, above the hero

      // Soft vignette behind the logo (a radial falloff, not a box) so it reads
      // over the busy city without a hard-edged panel.
      const vg = new Graphics();
      for (let i = 14; i >= 1; i--) {
        const f = i / 14;
        vg.ellipse(cx, cy, dispW * 0.62 * (0.55 + 0.45 * f) + 40, dispH * 0.62 * (0.55 + 0.45 * f) + 36).fill({ color: 0x0B0A1E, alpha: 0.06 });
      }
      this._container.addChild(vg);

      const logo = new Sprite(logoTex);
      logo.anchor.set(0.5, 0.5);
      logo.scale.set(scale);
      logo.x = cx; logo.y = cy;
      this._container.addChild(logo);
      this._titleRef = logo;
    } else {
      const title = new Text({
        text: 'TRAFFIC\nBOMB',
        style: { fontSize: 60, fontWeight: 'bold', fill: [0xFFD600, 0xFF6F00],
          fillGradientStops: [0, 1], align: 'center', letterSpacing: 3,
          stroke: { color: 0x4A1A00, width: 5 } },
      });
      title.anchor.set(0.5, 0.5); title.x = w / 2; title.y = h * 0.17;
      this._container.addChild(title);
      this._titleRef = title;
    }
    this._shimG = null;   // no shimmer sweep over the image logo

    // ── Hero: the app icon's picture (car flung out of a BOOM by a red bomb), so the store
    // icon, the splash and the title read as one game (owner, 2026-10-18). It sits on the
    // road band of the background and bobs gently once the intro has popped it in.
    const heroTex = Assets.get(`${BASE_URL}sprites/designed/app-hero.png`);
    if (heroTex) {
      const hero = new Sprite(heroTex);
      hero.anchor.set(0.5);
      this._heroScale = 190 / heroTex.width;
      hero.scale.set(this._heroScale);
      hero.x = w / 2; hero.y = h * 0.405;
      this._heroY = hero.y;
      this._container.addChild(hero);
      this._hero = hero;
    }

    // ── PLAY button (revealed after the intro bomb-drop) ─────────────────────
    const btnW = 308, btnH = 88;        // +10% larger (was 280×80)
    const btnCX = w / 2, btnCY = h * 0.535;

    // Pulsing golden glow ring behind the button — drawn each frame in
    // _tickPlayGlow (same base+sin "ready glow" pattern as the booster bar).
    const playGlow = new Graphics();
    this._container.addChild(playGlow);
    this._playGlow    = playGlow;
    this._playGlowBox = { cx: btnCX, cy: btnCY + btnH / 2, w: btnW, h: btnH };
    this._playPulse   = 0;

    const btn = premiumButton('PLAY', { variant: 'green', w: btnW, h: btnH, size: 42,
      icon: uiIcon('play', 36, '▶'), onTap: () => { audio?.play('button_tap'); onPlay(); } });
    btn.x = btnCX; btn.y = btnCY + btnH / 2;
    this._container.addChild(btn);
    this._playBtn = btn;
    // PLAY goes straight to the next level; the pill under it says which one.
    const nextLevel = this._nextLevel, onMap = this._onMap;
    if (nextLevel != null) {
      const lt = bodyText(`LEVEL ${nextLevel}`, 16, 0xFFE08A);
      const pw = lt.width + 28;
      const pill = new Graphics();
      pill.roundRect(-pw / 2, -13, pw, 26, 13).fill({ color: 0x17143A, alpha: 0.85 }).stroke({ color: 0xC9962A, width: 2 });
      pill.addChild(lt);
      pill.x = btnCX; pill.y = btnCY + btnH + 18;
      this._container.addChild(pill);
      this._levelPill = pill;
      pill.visible = false;
    }
    // Hidden until the intro bomb-drop finishes (CHANGE 2).
    btn.visible = false; playGlow.visible = false;

    // ── Secondary: a row of round icon buttons with captions ───────────────
    // A new player sees PLAY and MAP; the rest open one at a time (TITLE_UNLOCK), each with a
    // NEW tag until first tapped (research 2026-10-18: leaders show ~one meta action before L20).
    const reached = this._nextLevel ?? Infinity;
    const open = (k) => reached >= TITLE_UNLOCK[k];
    const items = [];
    if (onMap) items.push({ glyph: mapGlyph, label: 'MAP', color: 0x3DBB3A, fn: onMap });
    if (onDaily && open('daily')) items.push({ key: 'daily', icon: hasDailyReward ? 'gift' : 'calendar', emoji: hasDailyReward ? '🎁' : '📅', label: hasDailyReward ? 'DAILY!' : 'DAILY', color: hasDailyReward ? 0xF0A020 : 0x2F7FE0, fn: onDaily, badge: hasDailyReward });
    if (onAchievements && open('trophies')) items.push({ key: 'trophies', icon: 'trophy', emoji: '🏆', label: 'TROPHIES', color: 0x2F7FE0, fn: onAchievements });
    if (onDailyChallenge && open('challenge')) items.push({ key: 'challenge', icon: 'lightning', emoji: '⚡', label: 'CHALLENGE', color: 0x8B4FE0, fn: onDailyChallenge, done: dailyChallengeDone });
    if (onStats && open('stats')) items.push({ key: 'stats', icon: 'chart', emoji: '📊', label: 'STATS', color: 0x2F7FE0, fn: onStats });
    const seen = readSeen();
    for (const it of items) if (it.key && reached !== Infinity && !seen.has(it.key)) it.isNew = true;
    const rowY = btnCY + btnH + 82, gapX = items.length > 4 ? 76 : 84;
    items.forEach((it, i) => {
      const x = w / 2 + (i - (items.length - 1) / 2) * gapX;
      const rbtn = roundButton(it.glyph ? it.glyph() : uiIcon(it.icon, 34, it.emoji), { r: 30, color: it.color, onTap: () => { audio?.play('button_tap'); if (it.isNew) markSeen(it.key); it.fn(); } });
      rbtn.x = x; rbtn.y = rowY;
      this._container.addChild(rbtn);
      const cap = bodyText(it.label, items.length > 4 ? 11 : 13, 0xFFFFFF);
      cap.x = x; cap.y = rowY + 44;
      // Dark pill behind each caption so it reads on the busy town art.
      const capBg = new Graphics();
      capBg.roundRect(x - cap.width / 2 - 8, rowY + 34, cap.width + 16, 21, 10.5)
        .fill({ color: 0x17143A, alpha: 0.78 }).stroke({ color: 0x000000, width: 1.5, alpha: 0.35 });
      this._container.addChild(capBg, cap);
      if (it.isNew) {   // just unlocked: a small NEW tag until the first tap
        const tag = new Graphics();
        tag.roundRect(x - 2, rowY - 38, 40, 18, 9).fill(0xE8453C).stroke({ color: 0x1F1A33, width: 2 });
        const tt = bodyText('NEW', 11, 0xFFFFFF, { outline: false, weight: '900' });
        tt.x = x + 18; tt.y = rowY - 29;
        this._container.addChild(tag, tt);
      } else if (it.badge) {
        const dot = new Graphics();
        dot.circle(x + 22, rowY - 22, 8).fill(0xE8453C).stroke({ color: 0x1F1A33, width: 2 });
        this._container.addChild(dot);
      }
      if (it.done) {   // today's challenge already cleared: a green tick, still replayable
        const tick = new Graphics();
        tick.circle(x + 22, rowY - 22, 10).fill(0x2FCC55).stroke({ color: 0x1F1A33, width: 2 });
        tick.moveTo(x + 17, rowY - 22).lineTo(x + 21, rowY - 18).lineTo(x + 28, rowY - 27)
          .stroke({ color: 0xFFFFFF, width: 3, cap: 'round', join: 'round' });
        this._container.addChild(tick);
      }
    });
    if (onDaily && loginStreak >= 2) {
      const flame = uiIcon('fire', 18, '🔥');
      const x0 = w / 2 + (0 - (items.length - 1) / 2) * gapX;
      flame.x = x0 - 18; flame.y = rowY + 64;
      this._container.addChild(flame);
      const badge = bodyText(`${loginStreak} day streak`, 13, 0xFFB35A);
      badge.anchor.set(0, 0.5); badge.x = x0 - 8; badge.y = rowY + 64;
      this._container.addChild(badge);
    }

    // ── Settings (top-right) ────────────────────────────────────────────────
    if (onSettings) {
      const gear = roundButton(uiIcon('gear', 26, '⚙'), { r: 22, color: 0x3A3662, onTap: () => { audio?.play('button_tap'); onSettings(); } });
      gear.x = w - 32; gear.y = 34;
      this._container.addChild(gear);
    }

    // Intro bomb-drop one-shot (reveals the PLAY button when it finishes) —
    // once per session; coming back to the title shows PLAY immediately.
    if (_introPlayed) {
      btn.visible = true; playGlow.visible = true;
      if (this._levelPill) this._levelPill.visible = true;
      this._intro = null;
    } else {
      _introPlayed = true;
      this._buildIntro(w, h);
    }
  }

  // ── Intro: the hero pops in with a burst, then the PLAY button appears ───────
  _buildIntro(w, h) {
    const burst = new Graphics();
    this._container.addChild(burst);
    if (this._hero) this._hero.scale.set(0);
    this._intro = { phase: 'wait', t: 0, burst, particles: [] };
  }

  _tickIntro(dt) {
    // Idle bob of the hero once the intro is over (or when it never ran this session).
    if (this._hero && (!this._intro || this._intro.phase === 'done')) {
      this._hero.y = this._heroY + Math.sin(this._elapsed * 2.2) * 4;
      this._hero.rotation = Math.sin(this._elapsed * 1.6) * 0.035;
    }
    const I = this._intro;
    if (!I || I.phase === 'done') return;
    I.t += dt;

    if (I.phase === 'wait') {
      if (I.t >= 0.3) {
        I.phase = 'pop'; I.t = 0;
        this._spawnIntroParticles(I, this._appW / 2, this._heroY ?? this._appH * 0.405);
      }
      return;
    }

    if (I.phase === 'pop') {
      const DUR = 0.45;
      const p = Math.min(1, I.t / DUR);
      const e = 1 - Math.pow(1 - p, 3);
      if (this._hero) this._hero.scale.set(this._heroScale * (e + 0.22 * Math.sin(Math.PI * p)));
      this._drawIntroParticles(I, dt);
      if (p >= 1) {
        I.phase = 'reveal'; I.t = 0;
        if (this._hero) this._hero.scale.set(this._heroScale);
        this._playBtn.visible = true; this._playGlow.visible = true; if (this._levelPill) this._levelPill.visible = true;
        this._playBtn.scale.set(0.2);
      }
      return;
    }

    if (I.phase === 'reveal') {
      this._drawIntroParticles(I, dt);
      const DUR = 0.3;
      const p   = Math.min(1, I.t / DUR);
      const pop = 1 + 0.18 * Math.sin(Math.PI * p);     // slight overshoot
      this._playBtn.scale.set(p * pop);
      if (p >= 1) { this._playBtn.scale.set(1); I.burst.clear(); I.phase = 'done'; }
    }
  }

  _spawnIntroParticles(I, x, y) {
    const COLORS = [0xFFD54A, 0xFF8C00, 0xFFFFFF, 0xFF6F00];
    for (let i = 0; i < 14; i++) {
      const ang = (Math.PI * 2 * i) / 14 + Math.random() * 0.4;
      const spd = 90 + Math.random() * 140;
      I.particles.push({
        x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 40,
        life: 0.4 + Math.random() * 0.2, maxLife: 0.6,
        r: 3 + Math.random() * 4, color: COLORS[i % COLORS.length],
      });
    }
  }

  _drawIntroParticles(I, dt) {
    const g = I.burst; g.clear();
    for (let i = I.particles.length - 1; i >= 0; i--) {
      const p = I.particles[i];
      p.life -= dt;
      if (p.life <= 0) { I.particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 320 * dt;   // gravity
      g.circle(p.x, p.y, p.r).fill({ color: p.color, alpha: Math.max(0, p.life / p.maxLife) });
    }
  }

  _tickPlayGlow(dt) {
    // One soft golden halo (stacked translucent fills, same corner radius as the
    // button) plus a gentle breathe on the button — no hard outline rings.
    const g = this._playGlow;
    if (!g || !g.visible) return;
    this._playPulse += dt * 3.2;
    const b = this._playGlowBox;
    const k = 0.5 + 0.5 * Math.sin(this._playPulse);
    g.clear();
    for (let i = 0; i < 6; i++) {
      const pad = 4 + i * 4 + k * 4;
      g.roundRect(b.cx - b.w / 2 - pad, b.cy - b.h / 2 - pad + 3, b.w + pad * 2, b.h + pad * 2, b.h / 2.6 + pad)
        .fill({ color: 0xFFD54A, alpha: (0.07 + 0.05 * k) * (1 - i / 7) });
    }
    // Breathe only once the intro's pop-in has finished (it animates the scale).
    if (this._playBtn && (!this._intro || this._intro.phase === 'done')) this._playBtn.scale.set(1 + 0.025 * k);
  }

  // ── Helper: pill-shaped secondary button ──────────────────────────────────

  // icon (optional): { name, emoji } → renders a sprite left of the label, the
  // whole [icon] [text] group centered in the pill (icons keep natural colors,
  // no tint). Omit for a plain text label (or an emoji still baked into `label`).
  _addPillBtn(cx, cy, label, bgColor, labelColor, onClick, btnW = 200, icon = null) {
    const btnH = 40;
    const btn  = new Graphics();
    // 9-slice slate plate (art); Graphics roundRect is the fallback.
    const plate = uiPlate('button-secondary', btnW, btnH);
    if (plate) {
      plate.x = -btnW / 2; plate.y = -btnH / 2;
      btn.addChild(plate);
      btn.hitArea = new Rectangle(-btnW / 2, -btnH / 2, btnW, btnH);
    } else {
      btn.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 20);
      btn.fill(bgColor);
      btn.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 20);
      btn.stroke({ color: 0xFFFFFF, width: 1.5, alpha: 0.4 });
    }
    btn.x = cx; btn.y = cy;
    btn.eventMode = 'static'; btn.cursor = 'pointer';
    btn.on('pointerdown', onClick);
    btn.on('pointerover',  () => { btn.alpha = 0.80; });
    btn.on('pointerout',   () => { btn.alpha = 1.00; });
    const t = new Text({ text: label, style: { fontSize: 15, fontWeight: 'bold', fill: labelColor } });
    t.anchor.set(0.5, 0.5);
    if (icon) {
      const ICON = 18, GAP = 4;
      const sp = uiIcon(icon.name, ICON, icon.emoji);
      const total = ICON + GAP + t.width;
      sp.x = -total / 2 + ICON / 2;
      t.x  = -total / 2 + ICON + GAP + t.width / 2;
      btn.addChild(sp);
    }
    btn.addChild(t);
    this._container.addChild(btn);
  }

  // ── Cloud drawing ──────────────────────────────────────────────────────────

  _drawCloud(cx, cy, scale) {
    const g = new Graphics();
    const s = scale;
    g.circle(cx,         cy,      32 * s); g.fill({ color: CLOUD_COL, alpha: 0.90 });
    g.circle(cx + 28*s,  cy + 5*s, 24*s);  g.fill({ color: CLOUD_COL, alpha: 0.90 });
    g.circle(cx - 22*s,  cy + 8*s, 20*s);  g.fill({ color: CLOUD_COL, alpha: 0.90 });
    g.circle(cx + 8*s,   cy + 14*s, 28*s); g.fill({ color: CLOUD_COL, alpha: 0.90 });
    this._container.addChild(g);
  }

  _spawnInitialClouds(w, h) {
    for (let i = 0; i < 2; i++) {
      setTimeout(() => this._spawnCloud(w, h), i * 3000);
    }
  }

  _spawnCloud(w, h) {
    const y  = h * 0.04 + Math.random() * h * 0.20;
    const sc = 0.5 + Math.random() * 0.6;
    const g  = new Graphics();
    const cx = 0, cy = 0;
    g.circle(cx,      cy,     32*sc); g.fill({ color: CLOUD_COL, alpha: 0.80 });
    g.circle(cx+28*sc, cy+5*sc, 24*sc); g.fill({ color: CLOUD_COL, alpha: 0.80 });
    g.circle(cx-22*sc, cy+8*sc, 20*sc); g.fill({ color: CLOUD_COL, alpha: 0.80 });
    g.circle(cx+8*sc,  cy+14*sc, 28*sc); g.fill({ color: CLOUD_COL, alpha: 0.80 });
    g.x = -80; g.y = y;
    this._container.addChild(g);
    this._clouds.push({ g, speed: 18 + Math.random() * 12, maxX: w + 100 });
  }

  _tickClouds(dt) {
    const w = this._appW, h = this._appH;
    for (let i = this._clouds.length - 1; i >= 0; i--) {
      const c = this._clouds[i];
      c.g.x += c.speed * dt;
      if (c.g.x > c.maxX) {
        this._container.removeChild(c.g); c.g.destroy();
        this._clouds.splice(i, 1);
        setTimeout(() => this._spawnCloud(w, h), Math.random() * 2000 + 500);
      }
    }
  }

  _showComingSoon() {
    const toast = new Text({
      text: '🚧  Coming Soon!',
      style: {
        fontSize:   20,
        fontWeight: 'bold',
        fill:       0xFFFFFF,
        dropShadow: { color: 0x000000, blur: 6, distance: 0, alpha: 0.9 },
      },
    });
    toast.anchor.set(0.5, 0.5);
    toast.x = this._appW / 2;
    toast.y = this._appH * 0.82;
    this._container.addChild(toast);
    this._toasts.push({ g: toast, life: 1.8 });
  }

  _tickToasts(dt) {
    for (let i = this._toasts.length - 1; i >= 0; i--) {
      const t = this._toasts[i];
      t.life -= dt;
      t.g.alpha = Math.max(0, t.life / 0.6);
      if (t.life <= 0) {
        this._container.removeChild(t.g);
        t.g.destroy();
        this._toasts.splice(i, 1);
      }
    }
  }

}

// Folded map glyph for the MAP button (no map sprite in the UI set): three panels, a road
// and a red pin, in the toy ink style.
function mapGlyph() {
  const g = new Graphics();
  const P = [[-15, -11], [-5, -14], [5, -11], [15, -14], [15, 12], [5, 15], [-5, 12], [-15, 15]];
  g.poly([P[0][0], P[0][1], P[1][0], P[1][1], P[6][0], P[6][1], P[7][0], P[7][1]]).fill(0xF4E3B5);
  g.poly([P[1][0], P[1][1], P[2][0], P[2][1], P[5][0], P[5][1], P[6][0], P[6][1]]).fill(0xE2CC8F);
  g.poly([P[2][0], P[2][1], P[3][0], P[3][1], P[4][0], P[4][1], P[5][0], P[5][1]]).fill(0xF4E3B5);
  g.moveTo(-12, 10).bezierCurveTo(-4, 2, 2, 8, 12, -6).stroke({ color: 0x8A7A5A, width: 2.5 });
  g.poly(P.flat()).stroke({ color: 0x1F1A33, width: 2.5, join: 'round' });
  g.circle(6, -5, 4.5).fill(0xE8453C).stroke({ color: 0x1F1A33, width: 2 });
  g.circle(5, -6, 1.4).fill(0xFFFFFF);
  return g;
}
