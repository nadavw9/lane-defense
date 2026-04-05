// ParticleSystem — pooled VFX: hit sparks, miss puffs, death explosions, damage numbers.
//
// All methods accept game-space coordinates (laneIdx + gameX) and convert to
// screen pixels internally, so callers never need to know the pixel layout.
import { Graphics, Text } from 'pixi.js';
import { LANE_AREA_Y, LANE_HEIGHT, PX_PER_UNIT } from './LaneRenderer.js';

// Must mirror CarRenderer dimensions so particles spawn at the car's visual centre.
const CAR_W = 50;
const CAR_H = 68;

// Color palette — matches CLAUDE.md spec.
const COLOR_MAP = {
  Red:    0xE24B4A,
  Blue:   0x378ADD,
  Green:  0x639922,
  Yellow: 0xEF9F27,
  Purple: 0x7F77DD,
  Orange: 0xD85A30,
};

function carCenter(laneIdx, gameX) {
  return {
    x: gameX * PX_PER_UNIT + CAR_W / 2,
    y: LANE_AREA_Y + laneIdx * LANE_HEIGHT + LANE_HEIGHT / 2,
  };
}

export class ParticleSystem {
  constructor(layerManager) {
    this._layer     = layerManager.get('particleLayer');
    this._particles = [];  // { gfx, vx, vy, gravity, life, maxLife }
    this._labels    = [];  // { sprite, vy, life, maxLife }
  }

  // Correct-color hit: 3-5 small spark circles burst outward in the shooter color.
  spawnHit(laneIdx, gameX, color) {
    const { x, y } = carCenter(laneIdx, gameX);
    const c = COLOR_MAP[color] ?? 0xffffff;
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
      const speed = 55 + Math.random() * 75;
      const r     = 2.5 + Math.random() * 2;
      const g = new Graphics();
      g.circle(0, 0, r);
      g.fill(c);
      g.x = x + (Math.random() - 0.5) * 10;
      g.y = y + (Math.random() - 0.5) * 10;
      this._layer.addChild(g);
      this._particles.push({
        gfx: g,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 80,
        life: 0.32,
        maxLife: 0.32,
      });
    }
  }

  // Color mismatch: small grey puff — 4 dull circles drifting slowly outward.
  spawnMiss(laneIdx, gameX) {
    const { x, y } = carCenter(laneIdx, gameX);
    const count = 4;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.PI / count * 0.5;
      const speed = 22 + Math.random() * 22;
      const g = new Graphics();
      g.circle(0, 0, 4);
      g.fill(0x888888);
      g.x = x;
      g.y = y;
      this._layer.addChild(g);
      this._particles.push({
        gfx: g,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 10,
        gravity: 30,
        life: 0.28,
        maxLife: 0.28,
      });
    }
  }

  // Car death: 8-10 larger particles burst in the car's color + bright white core.
  spawnExplosion(laneIdx, gameX, color) {
    const { x, y } = carCenter(laneIdx, gameX);
    const c = COLOR_MAP[color] ?? 0xffffff;
    const count = 8 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const speed = 85 + Math.random() * 115;
      const r     = 4 + Math.random() * 5;
      const g = new Graphics();
      // Outer colored ring
      g.circle(0, 0, r);
      g.fill(c);
      // Bright inner core to sell the impact flash
      g.circle(0, 0, r * 0.45);
      g.fill({ color: 0xffffff, alpha: 0.7 });
      g.x = x + (Math.random() - 0.5) * 8;
      g.y = y + (Math.random() - 0.5) * 8;
      this._layer.addChild(g);
      this._particles.push({
        gfx: g,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        gravity: 140,
        life: 0.52,
        maxLife: 0.52,
      });
    }
  }

  // Floating damage number: rises 30 px and fades over 0.5 s.
  spawnDamageNumber(laneIdx, gameX, damage) {
    const { x, y } = carCenter(laneIdx, gameX);
    const t = new Text({
      text: `-${damage}`,
      style: {
        fontSize:   18,
        fontWeight: 'bold',
        fill:       0xffffff,
        dropShadow: { color: 0x000000, blur: 3, distance: 1, alpha: 0.8 },
      },
    });
    t.anchor.set(0.5, 0.5);
    t.x = x + (Math.random() - 0.5) * 22;
    t.y = y - 10;
    this._layer.addChild(t);
    // vy chosen so it rises exactly 30 px over 0.5 s: 30 / 0.5 = 60 px/s
    this._labels.push({ sprite: t, vy: -60, life: 0.5, maxLife: 0.5 });
  }

  // Call once per render frame.
  update(dt) {
    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.life    -= dt;
      p.gfx.x  += p.vx * dt;
      p.gfx.y  += p.vy * dt;
      p.vy     += p.gravity * dt;
      p.gfx.alpha = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) {
        p.gfx.destroy();
        this._particles.splice(i, 1);
      }
    }

    for (let i = this._labels.length - 1; i >= 0; i--) {
      const l = this._labels[i];
      l.life        -= dt;
      l.sprite.y    += l.vy * dt;
      l.sprite.alpha = Math.max(0, l.life / l.maxLife);
      if (l.life <= 0) {
        l.sprite.destroy();
        this._labels.splice(i, 1);
      }
    }
  }
}
