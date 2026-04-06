// TitleScreen — full-screen splash shown on app start.
//
// Layout:
//   • "LANE DEFENSE" title with green glow
//   • Tagline
//   • Big PLAY button
//   • Gear icon (settings placeholder) top-right
import { Container, Graphics, Text } from 'pixi.js';

export class TitleScreen {
  // callbacks: { onPlay, onDaily, hasDailyReward }
  // hasDailyReward — true if a daily reward is ready to claim (shows glow badge)
  constructor(stage, appW, appH, { onPlay, onDaily, hasDailyReward, onSettings, audio }) {
    this._container = new Container();
    stage.addChild(this._container);
    this._build(appW, appH, onPlay, onDaily, hasDailyReward, onSettings, audio);
  }

  destroy() {
    this._container.destroy({ children: true });
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _build(w, h, onPlay, onDaily, hasDailyReward, onSettings, audio) {
    // Full-screen background — also absorbs pointer events so game layers stay inert.
    const bg = new Graphics();
    bg.rect(0, 0, w, h);
    bg.fill(0x050510);
    bg.eventMode = 'static';
    this._container.addChild(bg);

    // ── Decorative road lines (perspective hint at bottom) ────────────────────
    this._drawRoadLines(w, h);

    // ── Title ─────────────────────────────────────────────────────────────────
    const title = new Text({
      text: 'LANE\nDEFENSE',
      style: {
        fontSize:      58,
        fontWeight:    'bold',
        fill:          0x44ff88,
        align:         'center',
        letterSpacing: 5,
        dropShadow:    { color: 0x00cc44, blur: 22, distance: 0, alpha: 0.75 },
      },
    });
    title.anchor.set(0.5, 0.5);
    title.x = w / 2;
    title.y = h * 0.30;
    this._container.addChild(title);

    // ── Tagline ───────────────────────────────────────────────────────────────
    const sub = new Text({
      text: 'Match colors. Survive the timer.',
      style: { fontSize: 15, fill: 0x6688aa, fontWeight: 'normal' },
    });
    sub.anchor.set(0.5, 0.5);
    sub.x = w / 2;
    sub.y = h * 0.30 + 100;
    this._container.addChild(sub);

    // ── PLAY button ───────────────────────────────────────────────────────────
    const btnW = 220, btnH = 62;
    const btn  = new Graphics();
    btn.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 16);
    btn.fill(0x1a6a3a);
    btn.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 16);
    btn.stroke({ color: 0x55ff99, width: 2, alpha: 0.65 });
    btn.x = w / 2;
    btn.y = h * 0.56;
    btn.eventMode = 'static';
    btn.cursor    = 'pointer';
    btn.on('pointerdown', () => { audio?.play('button_tap'); onPlay(); });
    btn.on('pointerover',  () => { btn.alpha = 0.80; });
    btn.on('pointerout',   () => { btn.alpha = 1.00; });

    const btnText = new Text({
      text: 'PLAY',
      style: { fontSize: 30, fontWeight: 'bold', fill: 0x55ff99 },
    });
    btnText.anchor.set(0.5, 0.5);
    btn.addChild(btnText);
    this._container.addChild(btn);

    // ── DAILY REWARD button ───────────────────────────────────────────────────
    if (onDaily) {
      const dailyW = 160, dailyH = 44;
      const daily  = new Graphics();
      daily.roundRect(-dailyW / 2, -dailyH / 2, dailyW, dailyH, 12);
      daily.fill(hasDailyReward ? 0x2a1a00 : 0x111122);
      if (hasDailyReward) {
        daily.roundRect(-dailyW / 2, -dailyH / 2, dailyW, dailyH, 12);
        daily.stroke({ color: 0xf5c842, width: 2, alpha: 0.80 });
      }
      daily.x = w / 2;
      daily.y = h * 0.56 + 68;
      daily.eventMode = 'static';
      daily.cursor    = 'pointer';
      daily.on('pointerdown', () => { audio?.play('button_tap'); onDaily(); });
      daily.on('pointerover',  () => { daily.alpha = 0.78; });
      daily.on('pointerout',   () => { daily.alpha = 1.00; });

      const dailyLabel = hasDailyReward ? '◆ DAILY REWARD' : 'DAILY REWARD';
      const dailyColor = hasDailyReward ? 0xf5c842 : 0x556677;
      const dt = new Text({ text: dailyLabel, style: { fontSize: 16, fontWeight: 'bold', fill: dailyColor } });
      dt.anchor.set(0.5, 0.5);
      daily.addChild(dt);
      this._container.addChild(daily);
    }

    // ── Settings gear (top-right) ─────────────────────────────────────────────
    this._drawGear(w - 36, 36, onSettings);
  }

  _drawRoadLines(w, h) {
    // Simple perspective lines hinting at the road below the title.
    const g   = new Graphics();
    const baseY = h * 0.72;
    const colors = [0x113322, 0x0d2218, 0x09180f];
    for (let i = 0; i < 4; i++) {
      const t   = i / 3;
      const y   = baseY + t * (h - baseY);
      const lx  = w * 0.5 - (w * 0.08 + t * w * 0.46);
      const rx  = w * 0.5 + (w * 0.08 + t * w * 0.46);
      g.moveTo(lx, y);
      g.lineTo(rx, y);
      g.stroke({ color: colors[Math.min(i, 2)], width: 1.5 + t * 2, alpha: 0.4 + t * 0.3 });
    }
    this._container.addChild(g);
  }

  _drawGear(cx, cy, onClick) {
    const g     = new Graphics();
    const r     = 12, innerR = 6.5, teeth = 8, toothH = 4.5;

    // Gear teeth
    for (let i = 0; i < teeth; i++) {
      const angle = (Math.PI * 2 * i) / teeth;
      const a1    = angle - 0.28;
      const a2    = angle + 0.28;
      g.poly([
        Math.cos(a1) * r      + cx,  Math.sin(a1) * r      + cy,
        Math.cos(a1) * (r + toothH) + cx,  Math.sin(a1) * (r + toothH) + cy,
        Math.cos(a2) * (r + toothH) + cx,  Math.sin(a2) * (r + toothH) + cy,
        Math.cos(a2) * r      + cx,  Math.sin(a2) * r      + cy,
      ]);
      g.fill(0x446677);
    }
    // Main disc
    g.circle(cx, cy, r);
    g.fill(0x446677);
    // Center hole
    g.circle(cx, cy, innerR);
    g.fill(0x050510);

    // Make gear tappable if a callback was provided.
    if (onClick) {
      // Hit-area slightly larger than the visual for easy tapping.
      g.eventMode = 'static';
      g.cursor    = 'pointer';
      g.hitArea   = { contains: (px, py) => Math.hypot(px - cx, py - cy) <= r + toothH + 6 };
      g.on('pointerdown', onClick);
      g.on('pointerover',  () => { g.tint = 0xaaddff; });
      g.on('pointerout',   () => { g.tint = 0xffffff; });
    }

    this._container.addChild(g);
  }
}
