// CarRenderer — renders every live car as a colored rounded rectangle
// with an HP bar above it.  Each frame it reconciles the visual pool
// against the current lane state: new cars get graphics, dead/breached
// cars have their graphics destroyed.
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

export class CarRenderer {
  // lanes: Lane[] — the live Lane objects owned by the game loop
  constructor(layerManager, lanes) {
    this._layer  = layerManager.get('carLayer');
    this._lanes  = lanes;
    // Map<Car, { container: Container, hpFill: Graphics }>
    this._visuals = new Map();
  }

  // Call once per render frame.  Syncs visuals to current lane state.
  update() {
    // Build a set of all cars currently alive in any lane.
    const liveCars = new Set();
    for (const lane of this._lanes) {
      for (const car of lane.cars) liveCars.add(car);
    }

    // Destroy visuals for cars that have left the simulation.
    for (const [car, vis] of this._visuals) {
      if (!liveCars.has(car)) {
        vis.container.destroy({ children: true });
        this._visuals.delete(car);
      }
    }

    // Create or update visuals for every live car.
    for (let laneIdx = 0; laneIdx < this._lanes.length; laneIdx++) {
      const lane  = this._lanes[laneIdx];
      const roadY = LANE_AREA_Y + laneIdx * LANE_HEIGHT + GUTTER;
      const roadH = LANE_HEIGHT - GUTTER * 2;
      // Center the car vertically in the road strip.
      const carY  = roadY + (roadH - CAR_H) / 2;

      for (const car of lane.cars) {
        if (!this._visuals.has(car)) {
          this._visuals.set(car, this._createVisual(car));
        }

        const vis     = this._visuals.get(car);
        // Align car's left edge to its game-unit position.
        vis.container.x = car.position * PX_PER_UNIT;
        vis.container.y = carY;

        this._refreshHpBar(vis.hpFill, car);
      }
    }
  }

  // ─── Private ───────────────────────────────────────────────────────────────

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
    const ratio  = car.maxHp > 0 ? car.hp / car.maxHp : 0;
    const fillW  = Math.max(1, Math.round(ratio * CAR_W));
    const color  = ratio > 0.6 ? HP_COLOR_HIGH
                 : ratio > 0.25 ? HP_COLOR_MID
                 : HP_COLOR_LOW;

    hpFill.clear();
    hpFill.rect(0, -(HP_BAR_OFFSET + HP_BAR_H), fillW, HP_BAR_H);
    hpFill.fill(color);
  }
}
