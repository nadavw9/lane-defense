// WinScreen — full-screen results overlay shown on level complete.
// Displays star rating (1-3), coins earned, max combo, and a "Next Level" button.
//
// Star rating is based on how close cars got to the endpoint:
//   3 stars — maxCarPosition < 65  (dominant win, no rescue)
//   2 stars — maxCarPosition < 82  (clean win, no rescue)
//   1 star  — rescue used, or cars reached the danger zone
//
// Stars flip in one-at-a-time with 250ms delay between each, overshoot scale animation,
// and sparkle particles spawning at peak scale.
import { Container, Graphics, Text } from 'pixi.js';

const STAR_COLOR_FULL  = 0xffcc00;
const STAR_COLOR_EMPTY = 0x3a3a3a;

export function calcStars(gs) {
  if (gs.rescueUsed)              return 1;
  if (gs.maxCarPosition < 60)     return 3;
  if (gs.maxCarPosition < 80)     return 2;
  return 1;
}

export class WinScreen {
  // onNext — callback for the "Next Level" button
  // onMenu — callback for the "LEVEL SELECT" button
  // audio  — AudioManager (optional; plays star chimes + button taps)
  constructor(stage, appW, appH, gs, onNext, onMenu, audio) {
    this._container = new Container();
    stage.addChild(this._container);
    this._appW = appW;
    this._appH = appH;
    this._starAnims = [];  // { starSprite, phase, t, startDelay, sparkles[] }
    this._particleLayer = new Container();
    this._container.addChild(this._particleLayer);
    this._build(appW, appH, gs, onNext, onMenu, audio);
  }

  destroy() {
    this._container.destroy({ children: true });
  }

  // Called each frame to update star animations and sparkle particles.
  update(dt) {
    // Update star animations
    for (let i = 0; i < this._starAnims.length; i++) {
      const anim = this._starAnims[i];
      anim.t += dt;
      if (anim.t < anim.startDelay) continue;  // Waiting to start

      const elapsed = anim.t - anim.startDelay;
      const progress = Math.min(elapsed / 400, 1);  // 400ms animation duration

      if (progress < 1) {
        // Ease-out cubic + overshoot: scale grows to 1.4 at ~200ms, settles to 1.0
        // Using cubic easing: t^3, then add overshoot factor
        const eased = 1 - Math.pow(1 - progress, 3);  // ease-out cubic
        const scale = 0.2 + eased * 1.2 + (progress < 0.5 ? (0.5 - progress) * 0.4 : 0);  // overshoot peak at 0.5
        anim.starSprite.scale.set(scale);

        // Spawn sparkles at peak scale (~200ms = progress 0.5)
        if (anim.phase === 1 && progress >= 0.49 && progress < 0.51) {
          this._spawnSparkles(anim.starSprite.x, anim.starSprite.y);
          anim.phase = 2;
        }
      } else {
        anim.starSprite.scale.set(1);
        anim.phase = 2;  // Mark as done
      }
    }

    // Update sparkle particles
    for (let i = this._particleLayer.children.length - 1; i >= 0; i--) {
      const spark = this._particleLayer.children[i];
      if (spark._sparkleLife !== undefined) {
        spark._sparkleAge += dt;
        const progress = spark._sparkleAge / 400;
        if (progress >= 1) {
          this._particleLayer.removeChild(spark);
          spark.destroy();
        } else {
          // Fade out alpha
          spark.alpha = 1 - progress;
        }
      }
    }
  }

  _spawnSparkles(cx, cy) {
    const count = 6;
    const radius = 30;
    const duration = 400;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const endX = cx + Math.cos(angle) * radius;
      const endY = cy + Math.sin(angle) * radius;

      const spark = new Graphics();
      spark.circle(0, 0, 3);
      spark.fill({ color: 0xffdd00, alpha: 1.0 });
      spark.x = cx;
      spark.y = cy;
      this._particleLayer.addChild(spark);

      spark._startX = cx;
      spark._startY = cy;
      spark._endX = endX;
      spark._endY = endY;
      spark._sparkleAge = 0;
      spark._duration = duration;

      // Animate in next update calls
      spark._updateSparkle = (dt) => {
        spark._sparkleAge += dt;
        const p = spark._sparkleAge / spark._duration;
        if (p >= 1) return;
        spark.x = spark._startX + (spark._endX - spark._startX) * p;
        spark.y = spark._startY + (spark._endY - spark._startY) * p;
      };
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _build(w, h, gs, onNext, onMenu, audio) {
    // Full-screen dim
    const backdrop = new Graphics();
    backdrop.rect(0, 0, w, h);
    backdrop.fill({ color: 0x000011, alpha: 0.82 });
    backdrop.eventMode = 'static';   // block clicks reaching game layers
    this._container.addChild(backdrop);

    // Centred panel — taller to fit two buttons
    const panelW = 310, panelH = 400;
    const px = (w - panelW) / 2;
    const py = (h - panelH) / 2 - 20;

    const panel = new Graphics();
    panel.roundRect(px, py, panelW, panelH, 18);
    panel.fill({ color: 0x0d1a2e, alpha: 0.97 });
    panel.roundRect(px, py, panelW, panelH, 18);
    panel.stroke({ color: 0x44aaff, width: 2, alpha: 0.45 });
    this._container.addChild(panel);

    const cx = w / 2;
    let y = py + 40;

    this._text('LEVEL COMPLETE', cx, y, { fontSize: 28, fill: 0x44ff88 });
    y += 52;

    const stars = calcStars(gs);
    this._stars(cx, y, stars);
    // Stagger one sparkle chime per earned star.
    for (let i = 0; i < stars; i++) audio?.play('star_earn', { index: i });
    y += 68;

    this._text(`◆ ${gs.coins}`, cx, y, { fontSize: 26, fill: 0xf5c842 });
    y += 8;
    this._text('coins', cx, y + 22, { fontSize: 14, fill: 0x999999, fontWeight: 'normal' });
    y += 52;

    this._text(`×${gs.maxCombo}`, cx, y, { fontSize: 24, fill: 0xffffff });
    this._text('best combo', cx, y + 22, { fontSize: 14, fill: 0x999999, fontWeight: 'normal' });
    y += 58;

    if (onNext) {
      this._button('NEXT LEVEL', cx, y, 0x1a6a3a, 0x55ff99, () => { audio?.play('button_tap'); onNext(); });
      y += 58;
    }
    this._button('LEVEL SELECT', cx, y, 0x1a2a3a, 0x88bbdd, () => { audio?.play('button_tap'); onMenu(); });
  }

  _text(str, x, y, style) {
    const t = new Text({ text: str, style: { fontWeight: 'bold', ...style } });
    t.anchor.set(0.5, 0.5);
    t.x = x;
    t.y = y;
    this._container.addChild(t);
    return t;
  }

  _stars(cx, cy, count) {
    // 3 stars, each 26px radius, 12px gap
    const R = 26, GAP = 12;
    const totalW = 3 * R * 2 + 2 * GAP;
    const x0 = cx - totalW / 2 + R;
    for (let i = 0; i < 3; i++) {
      const filled = i < count;
      const g = new Graphics();
      this._drawStar(g, R, filled ? STAR_COLOR_FULL : STAR_COLOR_EMPTY);
      // Unfilled stars are slightly smaller so the earned stars pop
      if (!filled) g.scale.set(0.82);
      g.x = x0 + i * (R * 2 + GAP);
      g.y = cy;
      this._container.addChild(g);

      // Set up animation for earned stars
      if (filled) {
        this._starAnims.push({
          starSprite: g,
          phase: 1,  // 1=animating, 2=done
          t: 0,
          startDelay: i * 250,  // 250ms delay between each star
          sparkles: [],
        });
        g.scale.set(0);  // Start at scale 0
      }
    }
  }

  _drawStar(g, outerR, color) {
    const pts    = 5;
    const innerR = outerR * 0.42;
    const points = [];
    for (let i = 0; i < pts * 2; i++) {
      const angle  = (Math.PI * i) / pts - Math.PI / 2;
      const radius = (i % 2 === 0) ? outerR : innerR;
      points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    g.poly(points);
    g.fill(color);
  }

  _button(label, cx, y, bgColor, labelColor, onClick) {
    const btnW = 210, btnH = 52;
    const btn  = new Graphics();
    btn.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 12);
    btn.fill(bgColor);
    btn.x = cx;
    btn.y = y;
    btn.eventMode = 'static';
    btn.cursor    = 'pointer';
    btn.on('pointerdown', onClick);
    btn.on('pointerover',  () => { btn.alpha = 0.80; });
    btn.on('pointerout',   () => { btn.alpha = 1.00; });

    const t = new Text({ text: label, style: { fontSize: 22, fontWeight: 'bold', fill: labelColor } });
    t.anchor.set(0.5, 0.5);
    btn.addChild(t);
    this._container.addChild(btn);
  }
}
