// CarRenderer — renders every live car as a colored rounded rectangle
// with an HP bar above it.  Each frame it reconciles the visual pool
// against the current lane state: new cars get graphics, killed cars
// play a scale-up + fade-out death animation before being destroyed.
//
// Reads lane state, never writes it.
import { Graphics, Container } from 'pixi.js';
import {
  LANE_AREA_Y,
  LANE_HEIGHT,
  PX_PER_UNIT,
  ENDPOINT_X,
  GUTTER,
} from './LaneRenderer.js';

// Car body dimensions
const CAR_W  = 50;
const CAR_H  = 68;
const RADIUS = 9;

// HP bar sits just above the car body
const HP_BAR_H       = 5;
const HP_BAR_OFFSET  = 8;  // px above car top
const HP_BAR_BG      = 0x222222;

// Color palette — matches CLAUDE.md spec exactly
const COLOR_MAP = {
  Red:    0xE24B4A,
  Blue:   0x378ADD,
  Green:  0x639922,
  Yellow: 0xEF9F27,
  Purple: 0x7F77DD,
  Orange: 0xD85A30,
};

// HP bar color thresholds
const HP_COLOR_HIGH = 0x55cc55;  // > 60%
const HP_COLOR_MID  = 0xeecc22;  // 25-60%
const HP_COLOR_LOW  = 0xee3333;  // < 25%

// Death animation: scale to 1.4x and fade to 0 over this duration.
const DEATH_DURATION = 0.30; // seconds
const DEATH_SCALE    = 1.40;

// Cars within this pixel distance of the endpoint are treated as breachers,
// not deaths — no death animation plays for them.
const BREACH_THRESHOLD_PX = ENDPOINT_X * 0.94;

export class CarRenderer {
  // lanes: Lane[] — the live Lane objects owned by the game loop
  constructor(layerManager, lanes) {
    this._layer   = layerManager.get('carLayer');
    this._lanes   = lanes;
    // Map<Car, { container: Container, hpFill: Graphics }>
    this._visuals = new Map();
    // Containers playing the death animation, no longer tied to a Car object.
    this._dying   = [];  // [{ container, life }]
  }

  // Call once per render frame.  dt (seconds) drives death animations.
  update(dt) {
    // ── Build set of currently live cars ────────────────────────────────────
    const liveCars = new Set();
    for (const lane of this._lanes) {
      for (const car of lane.cars) liveCars.add(car);
    }

    // ── Move removed cars into the dying list or destroy breachers ───────────
    for (const [car, vis] of this._visuals) {
      if (!liveCars.has(car)) {
        // Cars near the endpoint breached — skip death animation.
        if (vis.container.x >= BREACH_THRESHOLD_PX) {
          vis.container.destroy({ children: true });
        } else {
          this._dying.push({ container: vis.container, life: DEATH_DURATION });
        }
        this._visuals.delete(car);
      }
    }

    // ── Create / update visuals for live cars ────────────────────────────────
    for (let laneIdx = 0; laneIdx < this._lanes.length; laneIdx++) {
      const lane  = this._lanes[laneIdx];
      const roadY = LANE_AREA_Y + laneIdx * LANE_HEIGHT + GUTTER;
      const roadH = LANE_HEIGHT - GUTTER * 2;
      const carY  = roadY + (roadH - CAR_H) / 2;

      for (const car of lane.cars) {
        if (!this._visuals.has(car)) {
          this._visuals.set(car, this._createVisual(car));
        }

        const vis      = this._visuals.get(car);
        vis.container.x = car.position * PX_PER_UNIT;
        vis.container.y = carY;
        this._refreshHpBar(vis.hpFill, car);
      }
    }

    // ── Advance death animations ─────────────────────────────────────────────
    for (let i = this._dying.length - 1; i >= 0; i--) {
      const d  = this._dying[i];
      d.life  -= dt;
      if (d.life <= 0) {
        d.container.destroy({ children: true });
        this._dying.splice(i, 1);
        continue;
      }
      const progress = 1 - (d.life / DEATH_DURATION); // 0 → 1
      d.container.scale.set(1 + (DEATH_SCALE - 1) * progress);
      d.container.alpha = 1 - progress;
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _createVisual(car) {
    const container = new Container();
    const color     = COLOR_MAP[car.color] ?? 0x888888;

    // Car body — rounded rectangle in the car's color.
    const body = new Graphics();
    body.roundRect(0, 0, CAR_W, CAR_H, RADIUS);
    body.fill(color);
    // Subtle dark inner shadow to give the rectangle some depth.
    body.roundRect(3, 3, CAR_W - 6, CAR_H - 6, RADIUS - 3);
    body.fill({ color, alpha: 0.4 });
    container.addChild(body);

    // Carry-over bait cars (HP 1-2) get a visual "fragile" marker: a
    // small white stripe across the top so the player can spot them quickly.
    if (car.maxHp <= 2) {
      const stripe = new Graphics();
      stripe.rect(6, 6, CAR_W - 12, 4);
      stripe.fill({ color: 0xffffff, alpha: 0.5 });
      container.addChild(stripe);
    }

    // HP bar background
    const hpBg = new Graphics();
    hpBg.rect(0, -(HP_BAR_OFFSET + HP_BAR_H), CAR_W, HP_BAR_H);
    hpBg.fill(HP_BAR_BG);
    container.addChild(hpBg);

    // HP bar fill — redrawn each frame by _refreshHpBar
    const hpFill = new Graphics();
    container.addChild(hpFill);

    this._layer.addChild(container);
    return { container, hpFill };
  }

  _refreshHpBar(hpFill, car) {
    const ratio = car.maxHp > 0 ? car.hp / car.maxHp : 0;
    const fillW = Math.max(1, Math.round(ratio * CAR_W));
    const color = ratio > 0.6 ? HP_COLOR_HIGH
                : ratio > 0.25 ? HP_COLOR_MID
                : HP_COLOR_LOW;

    hpFill.clear();
    hpFill.rect(0, -(HP_BAR_OFFSET + HP_BAR_H), fillW, HP_BAR_H);
    hpFill.fill(color);
  }
}
