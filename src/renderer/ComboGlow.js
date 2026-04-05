// ComboGlow — screen-edge vignette that escalates with combo count.
//
// combo  3+: subtle yellow border
// combo  8+: pulsing orange border
// combo 12+: red border + particles inward from the edges
import { Graphics } from 'pixi.js';

const GLOW_THICKNESS = 30;

// Tiers: [minCombo, borderColor, baseAlpha]
const TIERS = [
  { min: 3,  color: 0xffdd44, alpha: 0.13 },
  { min: 8,  color: 0xff8800, alpha: 0.20 },
  { min: 12, color: 0xff3333, alpha: 0.28 },
];

export class ComboGlow {
  constructor(layerManager, appW, appH) {
    this._g         = new Graphics();
    this._appW      = appW;
    this._appH      = appH;
    this._pulse     = 0;
    this._particles = [];
    layerManager.get('glowLayer').addChild(this._g);
  }

  // Call once per render frame.
  update(dt, combo) {
    this._pulse += dt * 3.5;
    this._g.clear();

    if (combo < 3) {
      this._particles.length = 0;
      return;
    }

    // Pick highest qualifying tier.
    let tier = TIERS[0];
    for (const t of TIERS) { if (combo >= t.min) tier = t; }

    // At 8+ the alpha pulses; below that it is steady.
    let alpha = tier.alpha;
    if (combo >= 8) alpha *= 0.60 + 0.40 * Math.sin(this._pulse);

    // Three overlapping passes give the illusion of a soft glow falloff.
    for (let pass = 1; pass <= 3; pass++) {
      this._drawBorder(tier.color, alpha * (pass / 3), GLOW_THICKNESS * (pass / 3));
    }

    // Edge particles at 12+.
    if (combo >= 12) {
      if (Math.random() < 0.55) this._spawnParticle(tier.color);
    } else {
      this._particles.length = 0;
    }

    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p  = this._particles[i];
      p.life  -= dt;
      if (p.life <= 0) { this._particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const a = (p.life / p.maxLife) * 0.80;
      const r = p.r * (p.life / p.maxLife);
      this._g.circle(p.x, p.y, r);
      this._g.fill({ color: tier.color, alpha: a });
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _drawBorder(color, alpha, thickness) {
    const w = this._appW, h = this._appH;
    // Top, bottom, left, right edges
    this._g.rect(0,          0,           w,         thickness);  this._g.fill({ color, alpha });
    this._g.rect(0,          h-thickness, w,         thickness);  this._g.fill({ color, alpha });
    this._g.rect(0,          thickness,   thickness, h-thickness*2); this._g.fill({ color, alpha });
    this._g.rect(w-thickness, thickness,  thickness, h-thickness*2); this._g.fill({ color, alpha });
  }

  _spawnParticle(color) {
    const w = this._appW, h = this._appH;
    const edge  = Math.floor(Math.random() * 4);
    const speed = 28 + Math.random() * 52;
    const drift = (Math.random() - 0.5) * 32;
    let x, y, vx, vy;
    switch (edge) {
      case 0: x = Math.random() * w; y = 0; vx = drift; vy = speed;  break;
      case 1: x = Math.random() * w; y = h; vx = drift; vy = -speed; break;
      case 2: x = 0; y = Math.random() * h; vx = speed;  vy = drift; break;
      default: x = w; y = Math.random() * h; vx = -speed; vy = drift; break;
    }
    const life = 0.45 + Math.random() * 0.40;
    this._particles.push({ x, y, vx, vy, r: 2 + Math.random() * 3, life, maxLife: life, color });
  }
}
