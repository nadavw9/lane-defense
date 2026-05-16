// ParticleSystem — pooled PixiJS VFX: hit sparks, miss puffs, kill explosions,
// bomb blasts, freeze fan, and floating damage numbers.
//
// Renders into 'particleLayer', which sits ABOVE carLayer / laneLayer (the
// Road2D + Car2D layers) in the LayerManager z-order — so every effect draws
// on top of the road. This is the single 2D particle system; the old
// Three.js Particles3D (which rendered behind the PixiJS canvas and was
// invisible during gameplay) has been removed.
//
// All spawn methods take game-space coords (laneIdx + game position 0-100)
// and convert to screen pixels via PositionRegistry (the single source of
// truth for lane X — same mapping Car2D uses, so particles land on the car).
import { Graphics, Text } from 'pixi.js';
import { posToScreenY, ROAD_TOP_Y, ROAD_HEIGHT } from './LaneRenderer.js';
import { getLaneScreenX, getActiveLaneCount } from './PositionRegistry.js';

const APP_W = 390;

// Color palette — matches CLAUDE.md spec.
const COLOR_MAP = {
  Red:    0xE24B4A,
  Blue:   0x378ADD,
  Green:  0x639922,
  Yellow: 0xEF9F27,
  Purple: 0x7F77DD,
  Orange: 0xD85A30,
  Boss:   0xCC44CC,
};

function carCenter(laneIdx, gameX) {
  return { x: getLaneScreenX(laneIdx), y: posToScreenY(gameX) };
}

export class ParticleSystem {
  constructor(layerManager) {
    this._layer     = layerManager.get('particleLayer');
    this._particles = [];  // { gfx, vx, vy, gravity, life, maxLife }
    this._labels    = [];  // { sprite, vy, life, maxLife }
  }

  // Correct-color hit: 4-6 small spark circles burst outward, fade over 0.2s.
  spawnHit(laneIdx, gameX, color) {
    const { x, y } = carCenter(laneIdx, gameX);
    const c = COLOR_MAP[color] ?? 0xffffff;
    const count = 4 + Math.floor(Math.random() * 3);   // 4-6
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
      const speed = 70 + Math.random() * 90;
      const r     = 2.5 + Math.random() * 2;
      const g = new Graphics();
      g.circle(0, 0, r).fill(c);
      g.x = x + (Math.random() - 0.5) * 10;
      g.y = y + (Math.random() - 0.5) * 10;
      this._layer.addChild(g);
      this._particles.push({ gfx: g, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, gravity: 60, life: 0.2, maxLife: 0.2 });
    }
  }

  // Color mismatch: small grey puff — 4 dull circles drifting slowly outward.
  spawnMiss(laneIdx, gameX) {
    const { x, y } = carCenter(laneIdx, gameX);
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI * 2 * i) / 4 + Math.PI / 8;
      const speed = 22 + Math.random() * 22;
      const g = new Graphics();
      g.circle(0, 0, 4).fill(0x888888);
      g.x = x; g.y = y;
      this._layer.addChild(g);
      this._particles.push({ gfx: g, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 10, gravity: 30, life: 0.28, maxLife: 0.28 });
    }
  }

  // Car kill: 8 colored circles burst outward, fade over 0.4s. Streak-shot
  // kills are 25% larger/faster for extra impact.
  spawnExplosion(laneIdx, gameX, color, streak = false) {
    const { x, y } = carCenter(laneIdx, gameX);
    const c     = COLOR_MAP[color] ?? 0xffffff;
    const scale = streak ? 1.25 : 1.0;
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8 + (Math.random() - 0.5) * 0.4;
      const speed = (90 + Math.random() * 110) * scale;
      const r     = (4 + Math.random() * 5) * scale;
      const g = new Graphics();
      g.circle(0, 0, r).fill(c);
      g.circle(0, 0, r * 0.45).fill({ color: 0xffffff, alpha: 0.7 });
      g.x = x + (Math.random() - 0.5) * 8;
      g.y = y + (Math.random() - 0.5) * 8;
      this._layer.addChild(g);
      this._particles.push({ gfx: g, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 30, gravity: 140, life: 0.4, maxLife: 0.4 });
    }
  }

  // Bomb blast: large central burst at the bomb's row (spans all lanes).
  spawnBombExplosion(bombPos) {
    const x = APP_W / 2;
    const y = posToScreenY(bombPos);
    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 * i) / 16 + (Math.random() - 0.5) * 0.3;
      const speed = 140 + Math.random() * 180;
      const r     = 6 + Math.random() * 7;
      const g = new Graphics();
      g.circle(0, 0, r).fill(0xFF8800);
      g.circle(0, 0, r * 0.5).fill({ color: 0xffffff, alpha: 0.85 });
      g.x = x; g.y = y;
      this._layer.addChild(g);
      this._particles.push({ gfx: g, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, gravity: 90, life: 0.5, maxLife: 0.5 });
    }
  }

  // Freeze activation: blue-white particles fan out across all active lanes.
  spawnFreezeActivation() {
    const n = getActiveLaneCount();
    const yMid = ROAD_TOP_Y + ROAD_HEIGHT * 0.45;
    for (let lane = 0; lane < n; lane++) {
      const lx = getLaneScreenX(lane);
      for (let i = 0; i < 6; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
        const speed = 60 + Math.random() * 90;
        const r     = 3 + Math.random() * 3;
        const g = new Graphics();
        const blue = Math.random() < 0.5;
        g.circle(0, 0, r).fill(blue ? 0x88CCFF : 0xFFFFFF);
        g.x = lx + (Math.random() - 0.5) * 30;
        g.y = yMid + (Math.random() - 0.5) * ROAD_HEIGHT * 0.5;
        this._layer.addChild(g);
        this._particles.push({ gfx: g, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, gravity: 20, life: 0.6, maxLife: 0.6 });
      }
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
    this._labels.push({ sprite: t, vy: -60, life: 0.5, maxLife: 0.5 });
  }

  // Call once per render frame.
  update(dt) {
    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.life   -= dt;
      p.gfx.x  += p.vx * dt;
      p.gfx.y  += p.vy * dt;
      p.vy     += p.gravity * dt;
      p.gfx.alpha = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) { p.gfx.destroy(); this._particles.splice(i, 1); }
    }
    for (let i = this._labels.length - 1; i >= 0; i--) {
      const l = this._labels[i];
      l.life        -= dt;
      l.sprite.y    += l.vy * dt;
      l.sprite.alpha = Math.max(0, l.life / l.maxLife);
      if (l.life <= 0) { l.sprite.destroy(); this._labels.splice(i, 1); }
    }
  }
}
