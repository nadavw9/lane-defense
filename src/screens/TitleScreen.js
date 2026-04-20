// TitleScreen — bright, colorful, kids-friendly splash screen.
//
// Design:
//   • Sky-blue gradient background with fluffy cloud shapes
//   • Big chunky "LANE DEFENSE" title in yellow/orange with black stroke
//   • Animated colorful cars zooming across the screen
//   • Large green PLAY button
//   • Secondary buttons in pastel colors
import { Container, Graphics, Text } from 'pixi.js';

const CAR_COLORS  = [0xE24B4A, 0x378ADD, 0x639922, 0xEF9F27, 0x7F77DD, 0xD85A30];
const SKY_TOP     = 0x4FC3F7;   // light sky blue
const SKY_BOTTOM  = 0x81D4FA;   // slightly lighter horizon
const GROUND_COL  = 0x66BB6A;   // fresh green ground
const CLOUD_COL   = 0xFFFFFF;

export class TitleScreen {
  constructor(stage, appW, appH, {
    onPlay, onDaily, hasDailyReward, onDailyChallenge,
    onAchievements, onStats, onSettings, audio,
    loginStreak = 0, onSurvival = null,
  }) {
    this._container = new Container();
    this._carLayer  = new Container();
    this._appW      = appW;
    this._appH      = appH;
    this._cars      = [];
    this._clouds    = [];
    this._elapsed   = 0;

    stage.addChild(this._container);
    this._build(appW, appH, onPlay, onDaily, hasDailyReward, onDailyChallenge,
                onAchievements, onStats, onSettings, audio, loginStreak, onSurvival);
  }

  destroy() { this._container.destroy({ children: true }); }

  update(dt) {
    this._elapsed += dt;
    this._tickCars(dt);
    this._tickClouds(dt);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _build(w, h, onPlay, onDaily, hasDailyReward, onDailyChallenge,
         onAchievements, onStats, onSettings, audio, loginStreak, onSurvival) {

    // ── Sky background ─────────────────────────────────────────────────────
    const sky = new Graphics();
    // Sky blue gradient simulation (two overlapping rects)
    sky.rect(0, 0, w, h * 0.72);
    sky.fill(SKY_TOP);
    sky.rect(0, h * 0.40, w, h * 0.32);
    sky.fill(SKY_BOTTOM);
    // Ground strip
    sky.rect(0, h * 0.72, w, h * 0.28);
    sky.fill(GROUND_COL);
    // Ground highlight stripe
    sky.rect(0, h * 0.72, w, 8);
    sky.fill(0x81C784);
    sky.eventMode = 'static';
    this._container.addChild(sky);

    // ── Clouds ─────────────────────────────────────────────────────────────
    this._drawCloud(w * 0.15, h * 0.12, 1.1);
    this._drawCloud(w * 0.72, h * 0.08, 0.85);
    this._drawCloud(w * 0.45, h * 0.20, 0.70);
    // Animated cloud layer
    this._container.addChild(this._carLayer);
    this._spawnInitialClouds(w, h);

    // ── Road strip ─────────────────────────────────────────────────────────
    const road = new Graphics();
    road.rect(0, h * 0.68, w, 60);
    road.fill(0x546E7A);
    // Lane lines
    for (let i = 1; i < 4; i++) {
      road.rect(0, h * 0.68 + 8 + i * 14, w, 4);
      road.fill({ color: 0xFFFFFF, alpha: 0.25 });
    }
    this._container.addChild(road);

    // ── Animated cars on the road ──────────────────────────────────────────
    const carRoadLayer = new Container();
    this._container.addChild(carRoadLayer);
    this._carRoadLayer = carRoadLayer;
    this._spawnRoadCars(w, h);

    // ── Title ──────────────────────────────────────────────────────────────
    // Shadow
    const shadow = new Text({
      text: 'LANE\nDEFENSE',
      style: {
        fontSize:    66,
        fontWeight:  'bold',
        fill:        0x000000,
        align:       'center',
        letterSpacing: 3,
      },
    });
    shadow.anchor.set(0.5, 0.5);
    shadow.x = w / 2 + 4; shadow.y = h * 0.28 + 4;
    shadow.alpha = 0.35;
    this._container.addChild(shadow);

    // Main title
    const title = new Text({
      text: 'LANE\nDEFENSE',
      style: {
        fontSize:    66,
        fontWeight:  'bold',
        fill:        [0xFFD600, 0xFF6F00],   // yellow → deep orange gradient
        fillGradientStops: [0, 1],
        fillGradientType: 0,
        align:       'center',
        letterSpacing: 3,
        stroke:      { color: 0x4A1A00, width: 5 },
        dropShadow:  { color: 0xFF6F00, blur: 18, distance: 0, alpha: 0.5 },
      },
    });
    title.anchor.set(0.5, 0.5);
    title.x = w / 2; title.y = h * 0.28;
    this._container.addChild(title);
    this._titleRef = title;

    // Subtitle
    const sub = new Text({
      text: '🚗  Stop the cars!  🚗',
      style: { fontSize: 17, fill: 0x1A237E, fontWeight: 'bold', align: 'center' },
    });
    sub.anchor.set(0.5, 0.5); sub.x = w / 2; sub.y = h * 0.28 + 104;
    this._container.addChild(sub);

    // ── PLAY button ────────────────────────────────────────────────────────
    const btnW = 240, btnH = 72;
    const btn  = new Graphics();
    // Outer glow/shadow
    btn.roundRect(-btnW / 2 + 3, 3, btnW, btnH, 20);
    btn.fill({ color: 0x1B5E20, alpha: 0.6 });
    // Button body
    btn.roundRect(-btnW / 2, 0, btnW, btnH, 20);
    btn.fill(0x43A047);
    // Highlight stripe
    btn.roundRect(-btnW / 2 + 6, 4, btnW - 12, btnH / 2 - 4, 14);
    btn.fill({ color: 0xFFFFFF, alpha: 0.18 });
    // Border
    btn.roundRect(-btnW / 2, 0, btnW, btnH, 20);
    btn.stroke({ color: 0x81C784, width: 3, alpha: 0.9 });
    btn.x = w / 2; btn.y = h * 0.545;
    btn.eventMode = 'static'; btn.cursor = 'pointer';
    btn.on('pointerdown', () => { audio?.play('button_tap'); onPlay(); });
    btn.on('pointerover',  () => { btn.scale.set(1.05); });
    btn.on('pointerout',   () => { btn.scale.set(1.00); });
    const btnTxt = new Text({
      text: '▶  PLAY!',
      style: { fontSize: 32, fontWeight: 'bold', fill: 0xFFFFFF,
        dropShadow: { color: 0x1B5E20, blur: 6, distance: 2, alpha: 0.8 } },
    });
    btnTxt.anchor.set(0.5, 0.5); btnTxt.y = btnH / 2;
    btn.addChild(btnTxt);
    this._container.addChild(btn);

    // ── Secondary row ──────────────────────────────────────────────────────
    let rowY = h * 0.545 + 84;
    const CX = w / 2;

    if (onDaily) {
      this._addPillBtn(CX, rowY, hasDailyReward ? '⭐ DAILY REWARD!' : '📅 Daily Reward',
        hasDailyReward ? 0xF9A825 : 0x78909C, hasDailyReward ? 0xFFF9C4 : 0xECEFF1,
        () => { audio?.play('button_tap'); onDaily(); });
      if (loginStreak >= 2) {
        const badge = new Text({ text: `🔥${loginStreak}`, style: { fontSize: 14, fontWeight: 'bold', fill: 0xFF6F00 } });
        badge.anchor.set(0, 0.5); badge.x = CX + 100; badge.y = rowY;
        this._container.addChild(badge);
      }
    }

    rowY += 54;
    const BTN_W2 = 150, GAP = 10;

    if (onDailyChallenge) {
      this._addPillBtn(CX - BTN_W2 / 2 - GAP / 2, rowY, '⚡ CHALLENGE',
        0x1565C0, 0xE3F2FD, () => { audio?.play('button_tap'); onDailyChallenge(); }, BTN_W2);
    }
    if (onSurvival) {
      this._addPillBtn(CX + BTN_W2 / 2 + GAP / 2, rowY, '♾ SURVIVAL',
        0xB71C1C, 0xFFEBEE, () => { audio?.play('button_tap'); onSurvival(); }, BTN_W2);
    }

    rowY += 54;
    if (onAchievements) {
      this._addPillBtn(CX - BTN_W2 / 2 - GAP / 2, rowY, '★ TROPHIES',
        0xF57F17, 0xFFF8E1, () => { audio?.play('button_tap'); onAchievements(); }, BTN_W2);
    }
    if (onStats) {
      this._addPillBtn(CX + BTN_W2 / 2 + GAP / 2, rowY, '📊 STATS',
        0x4527A0, 0xEDE7F6, () => { audio?.play('button_tap'); onStats(); }, BTN_W2);
    }

    // ── Settings gear (top-right) ──────────────────────────────────────────
    if (onSettings) {
      const gear = new Text({ text: '⚙️', style: { fontSize: 28 } });
      gear.anchor.set(1, 0);  gear.x = w - 12; gear.y = 10;
      gear.eventMode = 'static'; gear.cursor = 'pointer';
      gear.on('pointerdown', onSettings);
      this._container.addChild(gear);
    }
  }

  // ── Helper: pill-shaped secondary button ──────────────────────────────────

  _addPillBtn(cx, cy, label, bgColor, labelColor, onClick, btnW = 200) {
    const btnH = 40;
    const btn  = new Graphics();
    btn.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 20);
    btn.fill(bgColor);
    btn.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 20);
    btn.stroke({ color: 0xFFFFFF, width: 1.5, alpha: 0.4 });
    btn.x = cx; btn.y = cy;
    btn.eventMode = 'static'; btn.cursor = 'pointer';
    btn.on('pointerdown', onClick);
    btn.on('pointerover',  () => { btn.alpha = 0.80; });
    btn.on('pointerout',   () => { btn.alpha = 1.00; });
    const t = new Text({ text: label, style: { fontSize: 15, fontWeight: 'bold', fill: labelColor } });
    t.anchor.set(0.5, 0.5); btn.addChild(t);
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

  // ── Road car animation ────────────────────────────────────────────────────

  _spawnRoadCars(w, h) {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => this._spawnRoadCar(w, h), i * 700);
    }
  }

  _spawnRoadCar(w, h) {
    const color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
    const lane  = Math.floor(Math.random() * 3);
    const roadY = h * 0.68 + 12 + lane * 14;
    const speed = 90 + Math.random() * 60;
    const g     = new Graphics();
    // Car body
    g.roundRect(-16, -7, 32, 14, 4); g.fill(color);
    // Windshield
    g.roundRect(-8, -5, 12, 10, 2);  g.fill({ color: 0xFFFFFF, alpha: 0.35 });
    // Wheels
    g.circle(-9, 7, 4);  g.fill(0x212121);
    g.circle( 9, 7, 4);  g.fill(0x212121);
    g.circle(-9, -7, 4); g.fill(0x212121);
    g.circle( 9, -7, 4); g.fill(0x212121);
    g.x = -30; g.y = roadY;
    this._carRoadLayer?.addChild(g);
    this._cars.push({ g, speed, maxX: w + 50 });
  }

  _tickCars(dt) {
    const w = this._appW, h = this._appH;
    for (let i = this._cars.length - 1; i >= 0; i--) {
      const car = this._cars[i];
      car.g.x += car.speed * dt;
      if (car.g.x > car.maxX) {
        car.g.parent?.removeChild(car.g); car.g.destroy();
        this._cars.splice(i, 1);
        setTimeout(() => this._spawnRoadCar(w, h), Math.random() * 600 + 200);
      }
    }
  }
}
