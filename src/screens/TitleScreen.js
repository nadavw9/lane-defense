// TitleScreen — bright, colorful, kids-friendly splash screen.
//
// Design:
//   • Sky-blue gradient background with fluffy cloud shapes
//   • Big chunky "LANE DEFENSE" title in yellow/orange with black stroke
//   • Animated colorful cars zooming across the screen
//   • Large green PLAY button
//   • Secondary buttons in pastel colors
import { Container, Graphics, Text, Sprite, Assets, Rectangle } from 'pixi.js';
import { uiIcon, uiPlate } from '../renderer/UIIcon.js';

const CAR_COLORS  = [0xE24B4A, 0x378ADD, 0x639922, 0xEF9F27, 0x7F77DD, 0xD85A30];
const SKY_TOP     = 0x4FC3F7;   // light sky blue
const SKY_BOTTOM  = 0x81D4FA;   // slightly lighter horizon
const GROUND_COL  = 0x66BB6A;   // fresh green ground
const CLOUD_COL   = 0xFFFFFF;

const BASE_URL = import.meta.env.BASE_URL ?? '';
// Real car sprites (preloaded by GameApp) used for the animated road cars.
const CAR_SPRITE_COLORS = ['red', 'blue', 'green', 'orange', 'purple', 'yellow'];
const CAR_HEX = { red: 0xE24B4A, blue: 0x378ADD, green: 0x639922,
                  orange: 0xD85A30, purple: 0x7F77DD, yellow: 0xEF9F27 };

// Build a car as a real sprite (preloaded), sized to a target on-screen HEIGHT and
// facing rightward (direction of travel — the intro car drives left→right toward the
// bomb). The source art is a top-down car facing DOWN (95×122), so we rotate -90°
// (counter-clockwise) to face EAST; after that rotation the texture WIDTH maps to the
// on-screen height. Falls back to a proportioned rectangle.
const CAR_ASPECT = 122 / 95;   // length / height after the ±90° rotation
function makeCarSprite(color, targetH = 22) {
  // Prefer the cleaner designed/ '-processed' car (glossier, clean cut); fall back
  // to the rough cars/ sprite if that colour's processed variant isn't loaded.
  const tex = Assets.get(`${BASE_URL}sprites/designed/car-${color}-processed.png`)
           ?? Assets.get(`${BASE_URL}sprites/cars/car-${color}.png`);
  if (tex) {
    const spr = new Sprite(tex);
    spr.anchor.set(0.5, 0.5);
    spr.rotation = -Math.PI / 2;          // down-facing art → faces right (travel dir)
    spr.scale.set(targetH / tex.width);   // texture width becomes on-screen height
    return spr;
  }
  const g = new Graphics();
  const L = targetH * CAR_ASPECT, H = targetH;
  g.roundRect(-L / 2, -H / 2, L, H, 4);          g.fill(CAR_HEX[color] ?? 0xE24B4A);
  g.roundRect(L * 0.05, -H / 2 + 2, L * 0.3, H - 4, 2); g.fill({ color: 0xFFFFFF, alpha: 0.32 });
  return g;
}

export class TitleScreen {
  constructor(stage, appW, appH, {
    onPlay, onDaily, hasDailyReward, onDailyChallenge,
    onAchievements, onStats, onSettings, audio,
    loginStreak = 0,
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
    this._build(appW, appH, onPlay, onDaily, hasDailyReward, onDailyChallenge,
                onAchievements, onStats, onSettings, audio, loginStreak);
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
         onAchievements, onStats, onSettings, audio, loginStreak) {

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
      const scale = Math.min(1, 350 / logoTex.width);   // cap to ~350px wide
      const dispW = logoTex.width * scale;
      const dispH = logoTex.height * scale;
      const cx = w / 2, cy = h * 0.24;                  // upper third, centred

      // Dark rounded backdrop behind the logo ONLY (~20px larger on all sides), so
      // the logo stays readable over any part of the busy AI city background.
      const pad = 30, bw = dispW + pad * 2, bh = dispH + pad * 2;
      const backdrop = new Graphics();
      backdrop.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, 24);
      backdrop.fill({ color: 0x000000, alpha: 0.65 });
      this._container.addChild(backdrop);

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
      title.anchor.set(0.5, 0.5); title.x = w / 2; title.y = h * 0.24;
      this._container.addChild(title);
      this._titleRef = title;
    }
    this._shimG = null;   // no shimmer sweep over the image logo

    // ── PLAY button (revealed after the intro bomb-drop) ─────────────────────
    const btnW = 308, btnH = 88;        // +10% larger (was 280×80)
    const btnCX = w / 2, btnCY = h * 0.51;

    // Pulsing golden glow ring behind the button — drawn each frame in
    // _tickPlayGlow (same base+sin "ready glow" pattern as the booster bar).
    const playGlow = new Graphics();
    this._container.addChild(playGlow);
    this._playGlow    = playGlow;
    this._playGlowBox = { cx: btnCX, cy: btnCY + btnH / 2, w: btnW, h: btnH };
    this._playPulse   = 0;

    const btn  = new Graphics();
    // 9-slice green plate (art), with the procedural roundRects as fallback.
    const playPlate = uiPlate('button-primary', btnW, btnH);
    if (playPlate) {
      playPlate.x = -btnW / 2; playPlate.y = 0;
      btn.addChild(playPlate);
      btn.hitArea = new Rectangle(-btnW / 2, 0, btnW, btnH);
    } else {
      btn.roundRect(-btnW / 2 + 3, 3, btnW, btnH, 24);
      btn.fill({ color: 0x1B5E20, alpha: 0.6 });
      btn.roundRect(-btnW / 2, 0, btnW, btnH, 24);
      btn.fill(0x43A047);
      btn.roundRect(-btnW / 2 + 6, 4, btnW - 12, btnH / 2 - 4, 18);
      btn.fill({ color: 0xFFFFFF, alpha: 0.18 });
      btn.roundRect(-btnW / 2, 0, btnW, btnH, 24);
      btn.stroke({ color: 0x81C784, width: 3, alpha: 0.9 });
    }
    btn.x = btnCX; btn.y = btnCY;
    btn.eventMode = 'static'; btn.cursor = 'pointer';
    btn.on('pointerdown', () => { audio?.play('button_tap'); onPlay(); });
    btn.on('pointerover',  () => { btn.scale.set(1.05); });
    btn.on('pointerout',   () => { btn.scale.set(1.00); });
    const btnTxt = new Text({
      text: 'PLAY!',
      style: { fontSize: 34, fontWeight: 'bold', fill: 0xFFFFFF,
        dropShadow: { color: 0x1B5E20, blur: 6, distance: 2, alpha: 0.8 } },
    });
    btnTxt.anchor.set(0.5, 0.5);
    // [play icon]  PLAY! — centered group (was '▶  PLAY!' one glyph run)
    const playIco = uiIcon('play', 34, '▶');
    const grpW = 34 + 10 + btnTxt.width;
    playIco.x = -grpW / 2 + 17;         playIco.y = btnH / 2;
    btnTxt.x  = -grpW / 2 + 34 + 10 + btnTxt.width / 2; btnTxt.y = btnH / 2;
    btn.addChild(playIco);
    btn.addChild(btnTxt);
    this._container.addChild(btn);
    this._playBtn = btn;
    // Hidden until the intro bomb-drop finishes (CHANGE 2).
    btn.visible = false; playGlow.visible = false;

    // ── Secondary row ──────────────────────────────────────────────────────
    // All secondary buttons share one neutral dark color — avoids 4-color chaos.
    const SEC_BG  = 0x1E3A5F;
    const SEC_TXT = 0xE8F0FF;

    let rowY = h * 0.51 + btnH + 12;
    const CX = w / 2;
    const BTN_W2 = 150, GAP = 10;

    if (onDaily) {
      // Daily reward keeps its own accent color — it's the secondary hero CTA.
      this._addPillBtn(CX, rowY, hasDailyReward ? 'DAILY REWARD!' : '📅 Daily Reward',
        hasDailyReward ? 0xF9A825 : SEC_BG, hasDailyReward ? 0xFFF9C4 : SEC_TXT,
        () => { audio?.play('button_tap'); onDaily(); }, 200,
        hasDailyReward ? { name: 'star-filled', emoji: '⭐' } : null);   // 📅 has no Batch-1 icon
      if (loginStreak >= 2) {
        const flame = uiIcon('fire', 18, '🔥');   // icon + number (was one 🔥N glyph run)
        flame.x = CX + 100 + 9; flame.y = rowY;    // centre-anchored, left edge ≈ CX+100
        this._container.addChild(flame);
        const badge = new Text({ text: `${loginStreak}`, style: { fontSize: 14, fontWeight: 'bold', fill: 0xFF6F00 } });
        badge.anchor.set(0, 0.5); badge.x = CX + 100 + 20; badge.y = rowY;
        this._container.addChild(badge);
      }
    }

    rowY += 52;

    // 2×2 grid — Row 1: CHALLENGE | TROPHIES
    if (onDailyChallenge) {
      this._addPillBtn(CX - BTN_W2 / 2 - GAP / 2, rowY, 'CHALLENGE',
        SEC_BG, SEC_TXT, () => { audio?.play('button_tap'); onDailyChallenge(); }, BTN_W2,
        { name: 'lightning', emoji: '⚡' });
    }
    if (onAchievements) {
      this._addPillBtn(CX + BTN_W2 / 2 + GAP / 2, rowY, 'TROPHIES',
        SEC_BG, SEC_TXT, () => { audio?.play('button_tap'); onAchievements(); }, BTN_W2,
        { name: 'star-filled', emoji: '★' });
    }

    rowY += 52;

    // 2×2 grid — Row 2: STATS | ACHIEVEMENTS
    if (onStats) {
      this._addPillBtn(CX - BTN_W2 / 2 - GAP / 2, rowY, 'STATS',
        SEC_BG, SEC_TXT, () => { audio?.play('button_tap'); onStats(); }, BTN_W2,
        { name: 'chart', emoji: '📊' });
    }
    this._addPillBtn(CX + BTN_W2 / 2 + GAP / 2, rowY, 'ACHIEVEMENTS',
      SEC_BG, SEC_TXT, () => { audio?.play('button_tap'); this._showComingSoon(); }, BTN_W2,
      { name: 'trophy', emoji: '🏆' });

    // ── Settings gear (top-right) — 44px hit area for reliable finger tap ───
    if (onSettings) {
      const gearHit = new Graphics();
      gearHit.rect(w - 52, 4, 48, 48);
      gearHit.fill({ color: 0, alpha: 0 });
      gearHit.eventMode = 'static'; gearHit.cursor = 'pointer';
      gearHit.on('pointerdown', onSettings);
      this._container.addChild(gearHit);

      const gear = uiIcon('gear', 30, '⚙️');   // was top-right anchored (1,0) → centre it
      gear.x = w - 10 - 15; gear.y = 10 + 15;
      this._container.addChild(gear);
    }

    // Intro bomb-drop one-shot (reveals the PLAY button when it finishes).
    this._buildIntro(w, h);
  }

  // ── Intro: a bomb drops on a passing car, then the PLAY button appears ──────
  _buildIntro(w, h) {
    const carY = h * 0.455;   // mid-screen, below the title, above the PLAY button

    // The car the bomb will hit — drives in toward the impact point (larger focal car).
    const car = makeCarSprite('blue', 40);
    car.x = w * 0.26; car.y = carY;
    this._container.addChild(car);

    // The powerball bomb — starts above the title, hidden until it drops.
    let bomb;
    const bombTex = Assets.get(`${BASE_URL}sprites/designed/powerball-red.png`);
    if (bombTex) {
      bomb = new Sprite(bombTex);
      bomb.anchor.set(0.5);
      bomb.scale.set(42 / Math.max(bombTex.width, bombTex.height));
    } else {
      bomb = new Graphics();
      bomb.circle(0, 0, 20).fill(0xE24B4A);
      bomb.circle(-6, -6, 7).fill({ color: 0xFFFFFF, alpha: 0.6 });
    }
    bomb.x = w / 2; bomb.y = h * 0.10; bomb.visible = false;
    this._container.addChild(bomb);

    const burst = new Graphics();
    this._container.addChild(burst);

    this._intro = {
      phase: 'wait', t: 0, car, bomb, burst,
      carY, impactX: w / 2, bombStartY: h * 0.10, carX0: car.x, particles: [],
    };
  }

  _tickIntro(dt) {
    const I = this._intro;
    if (!I || I.phase === 'done') return;
    I.t += dt;

    if (I.phase === 'wait') {
      I.car.x += 70 * dt;                 // car drifts toward centre
      if (I.t >= 0.35) { I.phase = 'fall'; I.t = 0; I.carX0 = I.car.x; I.bomb.visible = true; }
      return;
    }

    if (I.phase === 'fall') {
      const DUR = 0.55;
      const p   = Math.min(1, I.t / DUR);
      I.bomb.x  = I.impactX;
      I.bomb.y  = I.bombStartY + (p * p) * (I.carY - I.bombStartY);   // ease-in drop
      I.car.x   = I.carX0 + p * (I.impactX - I.carX0);               // meets the bomb
      if (p >= 1) {
        I.phase = 'burst'; I.t = 0;
        I.bomb.visible = false;
        I.car.vx = 80; I.car.vrot = 11;
        this._spawnIntroParticles(I, I.impactX, I.carY);
      }
      return;
    }

    if (I.phase === 'burst') {
      const DUR = 0.5;
      const p   = Math.min(1, I.t / DUR);
      // Car spins out and fades.
      I.car.rotation += I.car.vrot * dt;
      I.car.x        += I.car.vx * dt;
      I.car.scale.set(I.car.scale.x * (1 - 1.4 * dt));
      I.car.alpha     = Math.max(0, 1 - p);
      this._drawIntroParticles(I, dt);
      if (p >= 1) {
        I.phase = 'reveal'; I.t = 0;
        I.car.visible = false;
        I.burst.clear();
        this._playBtn.visible = true; this._playGlow.visible = true;
        this._playBtn.scale.set(0.2);
      }
      return;
    }

    if (I.phase === 'reveal') {
      const DUR = 0.3;
      const p   = Math.min(1, I.t / DUR);
      const pop = 1 + 0.18 * Math.sin(Math.PI * p);     // slight overshoot
      this._playBtn.scale.set(p * pop);
      if (p >= 1) { this._playBtn.scale.set(1); I.phase = 'done'; }
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
    const g = this._playGlow;
    if (!g || !g.visible) return;
    this._playPulse += dt * 3.2;
    const b    = this._playGlowBox;
    const a    = 0.30 + 0.25 * (0.5 + 0.5 * Math.sin(this._playPulse));
    const grow = 6 + 5 * (0.5 + 0.5 * Math.sin(this._playPulse));
    g.clear();
    g.roundRect(b.cx - b.w / 2 - grow, b.cy - b.h / 2 - grow, b.w + grow * 2, b.h + grow * 2, 28);
    g.stroke({ color: 0xFFD700, width: 6, alpha: a });
    g.roundRect(b.cx - b.w / 2 - grow * 1.8, b.cy - b.h / 2 - grow * 1.8, b.w + grow * 3.6, b.h + grow * 3.6, 34);
    g.stroke({ color: 0xFFD700, width: 3, alpha: a * 0.45 });
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
