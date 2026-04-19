// WinScreen — full-screen results overlay shown on level complete.
//
// Enhancements over v1:
//   • Confetti rain system (30-50 colorful pieces fall from top)
//   • Screen flash on 3-star win
//   • Bigger star animations with 300ms stagger
//   • Stat rows: coins, combo, perfect bonus
//   • "PERFECT DEFENSE!" header on 3-star clean win
import { Container, Graphics, Text } from 'pixi.js';

const STAR_COLOR_FULL  = 0xffcc00;
const STAR_COLOR_EMPTY = 0x3a3a3a;

const CONFETTI_COLORS = [0xff4466, 0x44ff88, 0xffcc00, 0x44aaff, 0xff88ff, 0xff8844, 0x88ffff];

// ── Web Share helper ──────────────────────────────────────────────────────────
async function _shareWin(levelId, stars, combo) {
  const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  const text = levelId
    ? `${starStr} Just cleared Level ${levelId} with a ×${combo} combo in Lane Defense! Can you beat it?`
    : `${starStr} Lane Defense — ×${combo} combo! 🎮`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Lane Defense', text });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      // Briefly flash the share button text (handled externally; just copy for now).
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

    this._build(appW, appH, gs, onNext, onMenu, audio, improved, levelId);
  }

  destroy() {
    this._confetti?.destroy();
    this._container.destroy({ children: true });
  }

  update(dt) {
    this._confetti?.update(dt);

    // Star pop-in animations
    for (const anim of this._starAnims) {
      anim.t += dt;
      if (anim.t < anim.delay) continue;
      const elapsed  = (anim.t - anim.delay) * 1000;
      const progress = Math.min(elapsed / 450, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      const overshoot = progress < 0.5 ? (0.5 - progress) * 0.5 : 0;
      anim.star.scale.set(eased * (1 + overshoot) * 0.2 + eased * 0.8);
      if (progress >= 0.48 && progress < 0.52 && !anim.sparkled) {
        anim.sparkled = true;
        this._spawnStarSparkles(anim.star.x, anim.star.y);
      }
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
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _build(w, h, gs, onNext, onMenu, audio, improved = [], levelId = null) {
    const stars    = calcStars(gs);
    const is3Star  = stars === 3;

    // Backdrop
    const backdrop = new Graphics();
    backdrop.rect(0, 0, w, h);
    backdrop.fill({ color: 0x000011, alpha: is3Star ? 0.72 : 0.82 });
    backdrop.eventMode = 'static';
    this._container.addChild(backdrop);

    // Confetti behind panel
    this._container.addChild(this._confettiLayer);
    if (stars >= 2) {
      this._confetti = new ConfettiSystem(this._confettiLayer, w, h);
      this._confetti.spawn(is3Star ? 50 : 25);
    }

    // White flash on 3-star
    if (is3Star) {
      this._flashG     = new Graphics();
      this._flashG.rect(0, 0, w, h);
      this._flashG.fill(0xffffff);
      this._flashG.alpha = 0.85;
      this._flashAlpha   = 0.85;
      this._container.addChild(this._flashG);
    }

    // Panel
    const panelW = 320;
    const panelH = onNext ? (is3Star ? 450 : 410) : (is3Star ? 400 : 360);
    const px = (w - panelW) / 2;
    const py = (h - panelH) / 2 - 20;
    const cx = w / 2;

    const panel = new Graphics();
    panel.roundRect(px, py, panelW, panelH, 20);
    panel.fill({ color: 0x0d1a2e, alpha: 0.97 });
    panel.roundRect(px, py, panelW, panelH, 20);
    panel.stroke({ color: is3Star ? 0xffcc00 : 0x44aaff, width: 2, alpha: is3Star ? 0.80 : 0.45 });
    this._container.addChild(panel);

    let y = py + 42;

    // Title
    const title      = is3Star ? 'PERFECT DEFENSE!' : 'LEVEL COMPLETE';
    const titleColor = is3Star ? 0xffcc00 : 0x44ff88;
    const titleSize  = is3Star ? 26 : 28;
    this._text(title, cx, y, { fontSize: titleSize, fill: titleColor,
      dropShadow: is3Star ? { color: 0xff8800, blur: 18, distance: 0, alpha: 0.8 } : undefined });
    y += 54;

    // Stars
    this._buildStars(cx, y, stars, audio);
    y += 80;

    // Stat rows
    const ROW_H = 42, ROW_GAP = 8;
    this._statRow(px + 14, y, panelW - 28, ROW_H, '◆  COINS EARNED',   `+${gs.coins}`,    0xf5c842);
    y += ROW_H + ROW_GAP;
    this._statRow(px + 14, y, panelW - 28, ROW_H, '⚡  BEST COMBO',    `×${gs.maxCombo}`, 0xff8844);
    if (is3Star) {
      y += ROW_H + ROW_GAP;
      this._statRow(px + 14, y, panelW - 28, ROW_H, '★  PERFECT CLEAR', 'Flawless!',       0xffcc00);
    }
    y += ROW_H + 16;

    // ── Personal best badge ───────────────────────────────────────────────
    if (improved.length > 0) {
      const labels = { stars: '★ New star record!', combo: '⚡ New combo record!', time: '⏱ New speed record!' };
      const msg    = labels[improved[0]] ?? '🏆 New personal best!';
      const badge  = new Text({ text: msg, style: { fontSize: 16, fontWeight: 'bold', fill: 0xffcc00,
        dropShadow: { color: 0x000000, blur: 6, distance: 0, alpha: 0.8 } } });
      badge.anchor.set(0.5, 0.5); badge.x = cx; badge.y = y;
      this._container.addChild(badge);
      y += 28;
    }

    // Buttons
    if (onNext) {
      this._button('NEXT LEVEL ▶', cx, y, 0x1a6a3a, 0x55ff99, () => { audio?.play('button_tap'); onNext(); });
      y += 64;
    }
    this._button('LEVEL SELECT', cx, y, 0x1a2a3a, 0x88bbdd, () => { audio?.play('button_tap'); onMenu(); });
    y += 64;

    // ── Share button (Web Share API) ──────────────────────────────────────
    const shareBtn = new Text({ text: '📤 SHARE', style: { fontSize: 14, fontWeight: 'bold', fill: 0x66aaff } });
    shareBtn.anchor.set(0.5, 0.5); shareBtn.x = cx; shareBtn.y = y;
    shareBtn.eventMode = 'static'; shareBtn.cursor = 'pointer';
    shareBtn.on('pointerdown', () => _shareWin(levelId, stars, gs.maxCombo));
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
      const g = new Graphics();
      this._drawStar(g, R, filled ? STAR_COLOR_FULL : STAR_COLOR_EMPTY);
      if (!filled) g.scale.set(0.78);
      g.x = x0 + i * (R * 2 + GAP);
      g.y = cy;
      this._container.addChild(g);
      if (filled) {
        g.scale.set(0);
        this._starAnims.push({ star: g, t: 0, delay: i * 0.30, sparkled: false });
        setTimeout(() => audio?.play('star_earn', { index: i }), i * 300 + 100);
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

  _statRow(x, y, w, h, label, value, color) {
    const bg = new Graphics();
    bg.roundRect(x, y, w, h, 8);
    bg.fill({ color: 0x081420, alpha: 0.85 });
    this._container.addChild(bg);

    const lbl = new Text({ text: label, style: { fontSize: 13, fontWeight: 'bold', fill: 0x7799aa } });
    lbl.anchor.set(0, 0.5);
    lbl.x = x + 12; lbl.y = y + h / 2;
    this._container.addChild(lbl);

    const val = new Text({ text: value, style: { fontSize: 18, fontWeight: 'bold', fill: color } });
    val.anchor.set(1, 0.5);
    val.x = x + w - 12; val.y = y + h / 2;
    this._container.addChild(val);
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

  _button(label, cx, y, bgColor, labelColor, onClick) {
    const btnW = 220, btnH = 54;
    const btn  = new Graphics();
    btn.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 14);
    btn.fill(bgColor);
    btn.x = cx; btn.y = y;
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
