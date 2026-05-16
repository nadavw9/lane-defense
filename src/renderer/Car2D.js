// Car2D — top-down 2D sprite car renderer (replaces the retired 3D Car3D.js).
//
// Each live car is a PIXI.Sprite of its TYPE sprite (sprite-bike.png etc.),
// tinted at runtime to its colour. The game is viewed straight from above, so
// every car is the same apparent distance from the camera — no perspective
// scaling. Position comes from PositionRegistry (lane X, single source of
// truth) and posToScreenY (game position 0-100 → screen Y).
//
// Motion & state effects:
//   • Wobble       — every car continuously sways + micro-rotates (alive feel)
//   • Speed lines  — short streaks spawn behind a car while it advances
//   • Danger aura  — red pulsing GlowFilter within 2 rows of the breach
//   • Freeze       — blue tint while the board is frozen
//   • Power hit    — white→orange flash on a streak (power) shot
//   • Destroy      — scale-up + fade + 8-particle burst
//
// Reads lane state, never writes it.
import { Sprite, Graphics, Container, Texture, Assets } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import { getLaneScreenX } from './PositionRegistry.js';
import { posToScreenY } from './LaneRenderer.js';

// CarTypes key → generated sprite basename (see tools/generate-sprites.js).
const TYPE_SPRITE = {
  small:  'bike',
  big:    'sedan',
  jeep:   'van',
  truck:  'truck',
  bigrig: 'bigrig',
  tank:   'tank',
  boss:   'tank',   // no dedicated boss sprite — tank silhouette, boss tint
};

// Sprite source files are 256x256. Display scale per type (fraction of 256) —
// heavier vehicles read larger. Tank/boss largest, bike smallest.
const TYPE_SCALE = {
  small:  0.30,
  big:    0.34,
  jeep:   0.37,
  truck:  0.39,
  bigrig: 0.42,
  tank:   0.44,
  boss:   0.48,
};

// car.color is capitalised in this codebase ('Red', 'Blue', …). Vivid,
// instantly-readable tints (white sprite × tint = pure colour).
const TINT_MAP = {
  red:    0xFF4444,
  blue:   0x4488FF,
  green:  0x44CC44,
  yellow: 0xFFCC00,
  purple: 0xAA44FF,
  orange: 0xFF8800,
};
const BOSS_TINT   = 0xCC44CC;
const FALLBACK    = 0x888888;
const FREEZE_TINT = 0x88CCFF;

const SPRITE_SIZE = 256;
const _BASE       = import.meta.env.BASE_URL;

function spriteUrl(type) {
  const base = TYPE_SPRITE[type] ?? 'sedan';
  return `${_BASE}sprites/cars/types/sprite-${base}.png`;
}
function carTint(car) {
  if (car.type === 'boss') return BOSS_TINT;
  return TINT_MAP[String(car.color).toLowerCase()] ?? FALLBACK;
}

// ── Tunables ───────────────────────────────────────────────────────────────────
const DANGER_POS      = 75;     // game-position ≥ this ≈ within ~2 rows of breach
const WOBBLE_X_AMP     = 2.5;   // px
const WOBBLE_ROT_AMP   = 0.018; // rad
const SPEED_LINE_LIFE  = 0.30;  // s
const POWER_FLASH_DUR  = 0.25;  // s  white→orange
const DEATH_DURATION   = 0.15;  // s  scale-up + fade
const DEATH_SCALE      = 1.40;
const DEATH_PARTICLES  = 8;
const DEATH_PART_LIFE  = 0.40;  // s

function lerpHex(a, b, t) {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  return ((Math.round(ar + (br - ar) * t) << 16)
       |  (Math.round(ag + (bg - ag) * t) <<  8)
       |   Math.round(ab + (bb - ab) * t));
}

export class Car2D {
  constructor(layerManager, lanes) {
    this._layer = layerManager.get('carLayer');
    this._layer.sortableChildren = true;
    this._lanes  = lanes;
    this._t      = 0;
    this._visuals = new Map();   // Car → visual entry
    this._dying   = [];          // { container, life }
    this._speed   = [];          // { g, life }
    this._parts   = [];          // { g, vx, vy, life }
  }

  clearAll() {
    for (const [, v] of this._visuals) v.container.destroy({ children: true });
    this._visuals.clear();
    for (const d of this._dying) d.container.destroy({ children: true });
    this._dying.length = 0;
    for (const s of this._speed) s.g.destroy();
    this._speed.length = 0;
    for (const p of this._parts) p.g.destroy();
    this._parts.length = 0;
  }

  // Level restart — wipe everything and reset the wobble clock.
  reset() {
    this.clearAll();
    this._t = 0;
  }

  // Streak (power) shot landed on the front car of `laneIdx`.
  // isKill is accepted for API parity with the old Car3D; the burst itself
  // is produced by the normal destroy path when the car is removed.
  triggerPowerHit(laneIdx, isKill) {  // eslint-disable-line no-unused-vars
    const lane = this._lanes[laneIdx];
    if (!lane) return;
    let front = null;
    for (const c of lane.cars) if (!front || c.row > front.row) front = c;
    if (!front) return;
    const v = this._visuals.get(front);
    if (v) { v.powerFlashing = true; v.powerFlashT = 0; }
  }

  update(dt, isFrozen = false) {
    this._t += dt;
    const time = this._t;

    // Track which cars are still alive this frame.
    const liveCars = new Set();
    for (const lane of this._lanes) for (const car of lane.cars) liveCars.add(car);

    // Retire removed cars into the death animation list + spawn burst.
    for (const [car, v] of this._visuals) {
      if (!liveCars.has(car)) {
        this._spawnBurst(v.container.x, v.container.y, v.tint);
        v.sprite.filters = [];   // drop any danger glow before fade
        this._dying.push({ container: v.container, life: DEATH_DURATION, baseScale: v.container.scale.x });
        this._visuals.delete(car);
      }
    }

    // Create / update live cars.
    for (let laneIdx = 0; laneIdx < this._lanes.length; laneIdx++) {
      for (const car of this._lanes[laneIdx].cars) {
        let v = this._visuals.get(car);
        if (!v) { v = this._createVisual(car, laneIdx); this._visuals.set(car, v); }

        // Advance detection → speed lines while the car moves forward.
        if (car.position > v.lastPos + 0.01) {
          this._spawnSpeedLines(v, laneIdx, car.position);
        }
        v.lastPos = car.position;

        const baseX = getLaneScreenX(laneIdx);
        const baseY = posToScreenY(car.position);

        // Continuous wobble — alive even when not advancing.
        const wobX = Math.sin(time * 1.1 + laneIdx * 0.7) * WOBBLE_X_AMP;
        const wobR = Math.sin(time * 0.9 + laneIdx * 1.3) * WOBBLE_ROT_AMP;
        v.container.x = baseX + wobX;
        v.container.y = baseY;
        v.container.rotation = wobR;
        v.container.zIndex = Math.round(car.position);

        // ── Tint resolution: power flash > freeze > base ────────────────────
        let tint = v.tint;
        if (v.powerFlashing) {
          v.powerFlashT += dt;
          const p = Math.min(1, v.powerFlashT / POWER_FLASH_DUR);
          // first 40% pure white, then white→orange
          tint = p < 0.4 ? 0xFFFFFF : lerpHex(0xFFFFFF, 0xFF7722, (p - 0.4) / 0.6);
          if (p >= 1) v.powerFlashing = false;
        } else if (isFrozen) {
          tint = FREEZE_TINT;
        }
        v.sprite.tint = tint;

        // ── Danger aura — red pulsing glow within 2 rows of breach ──────────
        const inDanger = !isFrozen && car.position >= DANGER_POS;
        if (inDanger) {
          if (!v.glow) {
            v.glow = new GlowFilter({ color: 0xff2200, outerStrength: 1, innerStrength: 0, distance: 14, quality: 0.3 });
            v.sprite.filters = [v.glow];
          }
          v.glow.outerStrength = Math.sin(time * 9) * 0.4 + 0.6 + 1.4;  // ~0.6–2.6
        } else if (v.glow) {
          v.sprite.filters = [];
          v.glow = null;
        }
      }
    }

    // Death animations — scale-up + fade over DEATH_DURATION.
    for (let i = this._dying.length - 1; i >= 0; i--) {
      const d = this._dying[i];
      d.life -= dt;
      if (d.life <= 0) { d.container.destroy({ children: true }); this._dying.splice(i, 1); continue; }
      const prog = 1 - d.life / DEATH_DURATION;
      d.container.scale.set(d.baseScale * (1 + (DEATH_SCALE - 1) * prog));
      d.container.alpha = 1 - prog;
    }

    // Speed lines fade.
    for (let i = this._speed.length - 1; i >= 0; i--) {
      const s = this._speed[i];
      s.life -= dt;
      if (s.life <= 0) { s.g.destroy(); this._speed.splice(i, 1); continue; }
      s.g.alpha = 0.4 * (s.life / SPEED_LINE_LIFE);
      s.g.y += s.vy * dt;
    }

    // Death particles.
    for (let i = this._parts.length - 1; i >= 0; i--) {
      const p = this._parts[i];
      p.life -= dt;
      if (p.life <= 0) { p.g.destroy(); this._parts.splice(i, 1); continue; }
      p.g.x += p.vx * dt;
      p.g.y += p.vy * dt;
      p.g.alpha = p.life / DEATH_PART_LIFE;
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  _createVisual(car, laneIdx) {
    const container = new Container();
    const tint = carTint(car);

    let sprite;
    const tex = Assets.get(spriteUrl(car.type));
    if (tex && tex !== Texture.EMPTY) {
      sprite = new Sprite(tex);
      sprite.anchor.set(0.5);
      sprite.scale.set(TYPE_SCALE[car.type] ?? 0.36);
    } else {
      // Fallback: a rounded white body (still tintable + filterable) so the
      // game stays playable if the texture failed to preload.
      sprite = new Graphics();
      sprite.roundRect(-40, -56, 80, 112, 14).fill(0xffffff);
    }
    sprite.tint = tint;
    container.addChild(sprite);

    container.zIndex = Math.round(car.position);
    this._layer.addChild(container);

    return {
      container, sprite, tint,
      lastPos: car.position,
      powerFlashing: false, powerFlashT: 0,
      glow: null,
    };
  }

  _spawnSpeedLines(v, laneIdx, position) {
    const x = getLaneScreenX(laneIdx);
    const y = posToScreenY(position);
    for (let i = 0; i < 3; i++) {
      const len = 15 + Math.random() * 10;          // 15–25 px
      const off = (i - 1) * 11 + (Math.random() - 0.5) * 4;
      const g = new Graphics();
      g.moveTo(0, 0).lineTo(0, len).stroke({ color: v.tint, width: 2, alpha: 0.4 });
      g.x = x + off;
      g.y = y + 22;                                  // behind the car (toward far)
      g.zIndex = Math.round(position) - 1;
      this._layer.addChild(g);
      this._speed.push({ g, life: SPEED_LINE_LIFE, vy: 60 });
    }
  }

  _spawnBurst(x, y, tint) {
    for (let i = 0; i < DEATH_PARTICLES; i++) {
      const a = (i / DEATH_PARTICLES) * Math.PI * 2;
      const sp = 90 + Math.random() * 60;
      const g = new Graphics();
      g.circle(0, 0, 4).fill({ color: tint });
      g.x = x; g.y = y;
      g.zIndex = 9999;
      this._layer.addChild(g);
      this._parts.push({ g, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: DEATH_PART_LIFE });
    }
  }
}
