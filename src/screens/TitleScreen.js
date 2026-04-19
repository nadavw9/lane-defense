// TitleScreen — full-screen splash with animated cars driving up the road.
//
// v1.1 additions:
//   • Animated mini cars travel up the perspective road lines (scale as they approach)
//   • Streak badge shown next to daily reward button
//   • update(dt) needed for car animation — call from GameApp ticker
import { Container, Graphics, Text } from 'pixi.js';

const CAR_COLORS = [0xE24B4A, 0x378ADD, 0x639922, 0xEF9F27, 0x7F77DD, 0xD85A30];
const ROAD_LINES = 4;

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

    stage.addChild(this._container);
    this._build(appW, appH, onPlay, onDaily, hasDailyReward, onDailyChallenge,
                onAchievements, onStats, onSettings, audio, loginStreak, onSurvival);
  }

  destroy() { this._container.destroy({ children: true }); }

  update(dt) { this._tickCars(dt); }

  // ── Private ────────────────────────────────────────────────────────────────

  _build(w, h, onPlay, onDaily, hasDailyReward, onDailyChallenge,
         onAchievements, onStats, onSettings, audio, loginStreak, onSurvival) {
    const bg = new Graphics();
    bg.rect(0, 0, w, h);
    bg.fill(0x050510);
    bg.eventMode = 'static';
    this._container.addChild(bg);

    this._drawRoadLines(w, h);
    this._container.addChild(this._carLayer);
    this._spawnInitialCars(w, h);

    // Title
    const title = new Text({
      text: 'LANE\nDEFENSE',
      style: { fontSize: 58, fontWeight: 'bold', fill: 0x44ff88, align: 'center',
               letterSpacing: 5, dropShadow: { color: 0x00cc44, blur: 24, distance: 0, alpha: 0.75 } },
    });
    title.anchor.set(0.5, 0.5); title.x = w / 2; title.y = h * 0.30;
    this._container.addChild(title);

    const sub = new Text({
      text: 'Match colors. Survive the timer.',
      style: { fontSize: 15, fill: 0x6688aa, fontWeight: 'normal' },
    });
    sub.anchor.set(0.5, 0.5); sub.x = w / 2; sub.y = h * 0.30 + 100;
    this._container.addChild(sub);

    // PLAY button
    const btnW = 220, btnH = 62;
    const btn  = new Graphics();
    btn.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 16);
    btn.fill(0x1a6a3a);
    btn.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 16);
    btn.stroke({ color: 0x55ff99, width: 2, alpha: 0.65 });
    btn.x = w / 2; btn.y = h * 0.56;
    btn.eventMode = 'static'; btn.cursor = 'pointer';
    btn.on('pointerdown', () => { audio?.play('button_tap'); onPlay(); });
    btn.on('pointerover',  () => { btn.alpha = 0.80; });
    btn.on('pointerout',   () => { btn.alpha = 1.00; });
    const btnTxt = new Text({ text: 'PLAY', style: { fontSize: 30, fontWeight: 'bold', fill: 0x55ff99 } });
    btnTxt.anchor.set(0.5, 0.5); btn.addChild(btnTxt);
    this._container.addChild(btn);

    let rowY = h * 0.56 + 68;

    // Daily reward
    if (onDaily) {
      const dW = 160, dH = 44;
      const daily = new Graphics();
      daily.roundRect(-dW / 2, -dH / 2, dW, dH, 12);
      daily.fill(hasDailyReward ? 0x2a1a00 : 0x111122);
      if (hasDailyReward) { daily.roundRect(-dW / 2, -dH / 2, dW, dH, 12); daily.stroke({ color: 0xf5c842, width: 2, alpha: 0.80 }); }
      daily.x = w / 2; daily.y = rowY;
      daily.eventMode = 'static'; daily.cursor = 'pointer';
      daily.on('pointerdown', () => { audio?.play('button_tap'); onDaily(); });
      daily.on('pointerover',  () => { daily.alpha = 0.78; });
      daily.on('pointerout',   () => { daily.alpha = 1.00; });
      const dlbl = hasDailyReward ? '◆ DAILY REWARD' : 'DAILY REWARD';
      const dcol = hasDailyReward ? 0xf5c842 : 0x556677;
      const dt   = new Text({ text: dlbl, style: { fontSize: 16, fontWeight: 'bold', fill: dcol } });
      dt.anchor.set(0.5, 0.5); daily.addChild(dt);
      this._container.addChild(daily);

      // Streak badge
      if (loginStreak >= 2) {
        const badge = new Text({
          text: `🔥 ${loginStreak}`,
          style: { fontSize: 14, fontWeight: 'bold', fill: 0xff8844,
            dropShadow: { color: 0x000000, blur: 4, distance: 1, alpha: 0.8 } },
        });
        badge.anchor.set(0, 0.5); badge.x = w / 2 + dW / 2 + 10; badge.y = rowY;
        this._container.addChild(badge);
      }
    }

    rowY += 58;

    const BTN_W = 145, BTN_H = 44, BTN_GAP = 10;
    const rcx   = w / 2;

    if (onDailyChallenge) {
      const dc = new Graphics();
      dc.roundRect(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H, 12); dc.fill(0x0a1a28);
      dc.roundRect(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H, 12); dc.stroke({ color: 0x2255aa, width: 1.5, alpha: 0.70 });
      dc.x = rcx - BTN_W / 2 - BTN_GAP / 2; dc.y = rowY;
      dc.eventMode = 'static'; dc.cursor = 'pointer';
      dc.on('pointerdown', () => { audio?.play('button_tap'); onDailyChallenge(); });
      dc.on('pointerover',  () => { dc.alpha = 0.78; }); dc.on('pointerout', () => { dc.alpha = 1.00; });
      const dct = new Text({ text: '⚡ DAILY', style: { fontSize: 16, fontWeight: 'bold', fill: 0x66aaff } });
      dct.anchor.set(0.5, 0.5); dc.addChild(dct); this._container.addChild(dc);
    }

    if (onAchievements) {
      const ab = new Graphics();
      ab.roundRect(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H, 12); ab.fill(0x1a1400);
      ab.roundRect(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H, 12); ab.stroke({ color: 0x7a6a10, width: 1.5, alpha: 0.70 });
      ab.x = rcx + BTN_W / 2 + BTN_GAP / 2; ab.y = rowY;
      ab.eventMode = 'static'; ab.cursor = 'pointer';
      ab.on('pointerdown', () => { audio?.play('button_tap'); onAchievements(); });
      ab.on('pointerover',  () => { ab.alpha = 0.78; }); ab.on('pointerout', () => { ab.alpha = 1.00; });
      const abt = new Text({ text: '★ ACHIEV.', style: { fontSize: 16, fontWeight: 'bold', fill: 0xf5c842 } });
      abt.anchor.set(0.5, 0.5); ab.addChild(abt); this._container.addChild(ab);
    }

    rowY += 58;
    if (onStats) {
      const sb = new Graphics();
      sb.roundRect(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H, 12); sb.fill(0x1a1620);
      sb.roundRect(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H, 12); sb.stroke({ color: 0xaa77dd, width: 1.5, alpha: 0.70 });
      sb.x = rcx; sb.y = rowY;
      sb.eventMode = 'static'; sb.cursor = 'pointer';
      sb.on('pointerdown', () => { audio?.play('button_tap'); onStats(); });
      sb.on('pointerover',  () => { sb.alpha = 0.78; }); sb.on('pointerout', () => { sb.alpha = 1.00; });
      const sbt = new Text({ text: '📊 STATS', style: { fontSize: 16, fontWeight: 'bold', fill: 0xaa77dd } });
      sbt.anchor.set(0.5, 0.5); sb.addChild(sbt); this._container.addChild(sb);
    }

    rowY += 58;
    if (onSurvival) {
      const sv = new Graphics();
      sv.roundRect(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H, 12); sv.fill(0x1a0a00);
      sv.roundRect(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H, 12); sv.stroke({ color: 0xff8844, width: 1.5, alpha: 0.70 });
      sv.x = rcx; sv.y = rowY;
      sv.eventMode = 'static'; sv.cursor = 'pointer';
      sv.on('pointerdown', () => { audio?.play('button_tap'); onSurvival(); });
      sv.on('pointerover',  () => { sv.alpha = 0.78; }); sv.on('pointerout', () => { sv.alpha = 1.00; });
      const svt = new Text({ text: '⚡ SURVIVAL', style: { fontSize: 16, fontWeight: 'bold', fill: 0xff8844 } });
      svt.anchor.set(0.5, 0.5); sv.addChild(svt); this._container.addChild(sv);
    }

    this._drawGear(w - 36, 36, onSettings);
  }

  // ── Car animation ──────────────────────────────────────────────────────────

  _spawnInitialCars(w, h) {
    for (let i = 0; i < 4; i++) setTimeout(() => this._spawnCar(w, h), i * 900);
  }

  _spawnCar(w, h) {
    const lane  = Math.floor(Math.random() * ROAD_LINES);
    const color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
    const g     = new Graphics();
    g.roundRect(-7, -11, 14, 22, 3); g.fill(color);
    g.roundRect(-4, -8, 8, 5, 2);    g.fill({ color: 0xffffff, alpha: 0.25 });
    this._carLayer.addChild(g);
    this._cars.push({ g, lane, progress: Math.random() * 0.2, speed: 0.07 + Math.random() * 0.05 });
    this._positionCar(this._cars[this._cars.length - 1], w, h);
  }

  _positionCar(car, w, h) {
    const horizY   = h * 0.38;
    const screenBotY = h;
    const laneXBot = w * (0.12 + car.lane * 0.25);
    const vanishX  = w / 2;
    const t  = car.progress;
    const y  = horizY + t * (screenBotY - horizY);
    const x  = vanishX + t * (laneXBot - vanishX);
    const sc = 0.15 + t * 0.85;
    car.g.x = x; car.g.y = y;
    car.g.scale.set(sc);
    car.g.alpha = Math.min(1, t * 5);
  }

  _tickCars(dt) {
    const w = this._appW, h = this._appH;
    for (let i = this._cars.length - 1; i >= 0; i--) {
      const car = this._cars[i];
      car.progress += car.speed * dt;
      if (car.progress > 1.05) {
        this._carLayer.removeChild(car.g); car.g.destroy();
        this._cars.splice(i, 1);
        setTimeout(() => this._spawnCar(w, h), Math.random() * 600 + 200);
        continue;
      }
      this._positionCar(car, w, h);
    }
  }

  _drawRoadLines(w, h) {
    const g     = new Graphics();
    const baseY = h * 0.72;
    const cols  = [0x113322, 0x0d2218, 0x09180f];
    for (let i = 0; i < ROAD_LINES; i++) {
      const t  = i / (ROAD_LINES - 1);
      const y  = baseY + t * (h - baseY);
      const lx = w * 0.5 - (w * 0.08 + t * w * 0.46);
      const rx = w * 0.5 + (w * 0.08 + t * w * 0.46);
      g.moveTo(lx, y); g.lineTo(rx, y);
      g.stroke({ color: cols[Math.min(i, 2)], width: 1.5 + t * 2, alpha: 0.4 + t * 0.3 });
    }
    this._container.addChild(g);
  }

  _drawGear(cx, cy, onClick) {
    const g = new Graphics();
    const r = 12, innerR = 6.5, teeth = 8, toothH = 4.5;
    for (let i = 0; i < teeth; i++) {
      const angle = (Math.PI * 2 * i) / teeth;
      const a1 = angle - 0.28, a2 = angle + 0.28;
      g.poly([Math.cos(a1)*r+cx, Math.sin(a1)*r+cy, Math.cos(a1)*(r+toothH)+cx, Math.sin(a1)*(r+toothH)+cy,
              Math.cos(a2)*(r+toothH)+cx, Math.sin(a2)*(r+toothH)+cy, Math.cos(a2)*r+cx, Math.sin(a2)*r+cy]);
      g.fill(0x446677);
    }
    g.circle(cx, cy, r); g.fill(0x446677);
    g.circle(cx, cy, innerR); g.fill(0x050510);
    if (onClick) {
      g.eventMode = 'static'; g.cursor = 'pointer';
      g.hitArea = { contains: (px, py) => Math.hypot(px - cx, py - cy) <= r + toothH + 6 };
      g.on('pointerdown', onClick);
      g.on('pointerover',  () => { g.tint = 0xaaddff; });
      g.on('pointerout',   () => { g.tint = 0xffffff; });
    }
    this._container.addChild(g);
  }
}
