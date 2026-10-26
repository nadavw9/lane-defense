// Confetti — Play Store celebration particles (Royal Match / Toon Blast class).
//
// Replaces the old square/circle placeholder Graphics with a mix of ribbon
// strips, diamonds, pennants, and accent discs. Used by WinScreen,
// WorldCompleteScreen, and BoosterSpotlight. Visuals only — no game state.
import { Graphics } from 'pixi.js';

export const CONFETTI_COLORS = [
  0xff4466, 0x44ff88, 0xffcc00, 0x44aaff, 0xff88ff, 0xff8844, 0x88ffff, 0xFFC93C,
];

const KINDS = ['ribbon', 'ribbon', 'diamond', 'pennant', 'disc'];

/** Draw one store-bar confetti piece into a fresh Graphics, origin at center. */
export function drawConfettiPiece(color, kind = null, scale = 1) {
  const g = new Graphics();
  const k = kind ?? KINDS[(Math.random() * KINDS.length) | 0];
  const s = scale;

  if (k === 'ribbon') {
    // Long glossy strip — the signature Royal Match flake.
    const w = (9 + Math.random() * 7) * s;
    const h = (2.4 + Math.random() * 1.4) * s;
    g.roundRect(-w / 2, -h / 2, w, h, h * 0.45).fill(color);
    g.roundRect(-w / 2 + 0.6, -h / 2, w * 0.45, h * 0.45, h * 0.2)
      .fill({ color: 0xffffff, alpha: 0.35 });
  } else if (k === 'diamond') {
    const r = (4.5 + Math.random() * 3) * s;
    g.poly([0, -r, r * 0.7, 0, 0, r, -r * 0.7, 0]).fill(color);
    g.poly([0, -r * 0.55, r * 0.28, -r * 0.1, 0, r * 0.15, -r * 0.18, -r * 0.15])
      .fill({ color: 0xffffff, alpha: 0.32 });
  } else if (k === 'pennant') {
    const w = (7 + Math.random() * 5) * s;
    const h = (5 + Math.random() * 3) * s;
    g.poly([-w / 2, -h / 2, w / 2, 0, -w / 2, h / 2]).fill(color);
    g.poly([-w / 2 + 0.5, -h / 2 + 0.8, -w * 0.05, -h * 0.05, -w / 2 + 0.5, h * 0.15])
      .fill({ color: 0xffffff, alpha: 0.28 });
  } else {
    // Soft disc accent (minority of pieces).
    const r = (2.6 + Math.random() * 2.2) * s;
    g.circle(0, 0, r).fill(color);
    g.circle(-r * 0.28, -r * 0.28, r * 0.32).fill({ color: 0xffffff, alpha: 0.4 });
  }

  return g;
}

/**
 * Falling / bursting confetti system.
 * API matches the previous WinScreen.ConfettiSystem so call sites stay put.
 */
export class ConfettiSystem {
  constructor(container, w, h) {
    this._c = container;
    this._w = w;
    this._h = h;
    this._particles = [];
  }

  spawn(count = 35, colors = CONFETTI_COLORS) {
    for (let i = 0; i < count; i++) {
      const color = colors[(Math.random() * colors.length) | 0];
      const g = drawConfettiPiece(color);
      g.x = Math.random() * this._w;
      g.y = -20 - Math.random() * 60;
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

  /** Upward burst from the bottom edge (win / world-complete ceremony). */
  burstUp(count = 26, colors = CONFETTI_COLORS) {
    for (let i = 0; i < count; i++) {
      const color = colors[(Math.random() * colors.length) | 0];
      const g = drawConfettiPiece(color, null, 0.95 + Math.random() * 0.35);
      g.x = this._w * (0.12 + Math.random() * 0.76);
      g.y = this._h + 12;
      g.rotation = Math.random() * Math.PI * 2;
      this._c.addChild(g);
      this._particles.push({
        g,
        vx: (Math.random() - 0.5) * 280,
        vy: -(340 + Math.random() * 260),
        vr: (Math.random() - 0.5) * 9,
        life: 1.55 + Math.random() * 0.35,
      });
    }
  }

  /**
   * Radial burst from a point (booster unlock). Returns nothing; pieces are
   * owned by this system so update()/destroy() keep working.
   */
  burstAt(x, y, count = 30, colors = CONFETTI_COLORS) {
    for (let i = 0; i < count; i++) {
      const color = colors[i % colors.length];
      const ang = Math.random() * Math.PI * 2;
      const spd = 90 + Math.random() * 190;
      const g = drawConfettiPiece(color, null, 0.85 + Math.random() * 0.4);
      g.x = x;
      g.y = y;
      g.rotation = ang;
      this._c.addChild(g);
      this._particles.push({
        g,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 130,
        vr: (Math.random() - 0.5) * 10,
        life: 1.1 + Math.random() * 0.8,
      });
    }
  }

  update(dt) {
    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.life -= dt;
      if (p.life <= 0 || p.g.y > this._h + 24) {
        this._c.removeChild(p.g);
        p.g.destroy();
        this._particles.splice(i, 1);
        continue;
      }
      p.vy += 180 * dt;
      p.g.x += p.vx * dt;
      p.g.y += p.vy * dt;
      p.g.rotation += p.vr * dt * 3;
      p.g.alpha = Math.min(1, p.life * 1.5);
    }
  }

  destroy() {
    for (const p of this._particles) {
      this._c.removeChild(p.g);
      p.g.destroy();
    }
    this._particles.length = 0;
  }
}
