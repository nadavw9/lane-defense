// CarRenderer — renders every live car in the perspective road view.
//
// Cars travel from position 0 (top/far) to 100 (bottom/near).
// Each car's container is positioned via laneCenterX / posToScreenY,
// scaled via posToScale, and z-sorted so nearer cars draw on top.
//
// Reads lane state, never writes it.
import { Graphics, Container, Text } from 'pixi.js';
import {
  laneCenterX,
  posToScreenY,
  posToScale,
} from './LaneRenderer.js';

// Car body dimensions at scale 1.0 (perspective scaling applied via container.scale)
const CAR_W  = 44;
const CAR_H  = 56;
const RADIUS = 8;

// HP bar sits above the car body (negative y relative to container centre)
const HP_BAR_H      = 5;
const HP_BAR_OFFSET = 6;  // px above car top
const HP_BAR_BG     = 0x222222;

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

const HP_TEXT_STYLE = {
  fontSize:   16,
  fontWeight: 'bold',
  fill:       0xffffff,
  dropShadow: { color: 0x000000, blur: 3, distance: 1, alpha: 0.85 },
};

// Death animation: scale to 1.4× and fade over this duration.
const DEATH_DURATION = 0.30; // seconds
const DEATH_SCALE    = 1.40;

export class CarRenderer {
  // lanes: Lane[] — the live Lane objects owned by the game loop
  constructor(layerManager, lanes) {
    this._layer = layerManager.get('carLayer');
    this._layer.sortableChildren = true;  // nearer cars (higher position) draw on top
    this._lanes   = lanes;
    // Map<Car, { container: Container, hpFill: Graphics }>
    this._visuals = new Map();
    // Containers playing the death animation, no longer tied to a Car object.
    this._dying   = [];  // [{ container, startScale, life }]
  }

  // Destroy all car visuals immediately (no animation).
  // Call before gameLoop.restart() so dying list doesn't ghost into the new level.
  clearAll() {
    for (const [, vis] of this._visuals) {
      vis.container.destroy({ children: true });
    }
    this._visuals.clear();

    for (const d of this._dying) {
      d.container.destroy({ children: true });
    }
    this._dying.length = 0;
  }

  // Call once per render frame.  dt (seconds) drives death animations.
  update(dt) {
    // ── Build set of currently live cars ────────────────────────────────────
    const liveCars = new Set();
    for (const lane of this._lanes) {
      for (const car of lane.cars) liveCars.add(car);
    }

    // ── Move removed cars into the dying list ────────────────────────────────
    for (const [car, vis] of this._visuals) {
      if (!liveCars.has(car)) {
        const startScale = vis.container.scale.x;
        this._dying.push({ container: vis.container, startScale, life: DEATH_DURATION });
        this._visuals.delete(car);
      }
    }

    // ── Create / update visuals for live cars ────────────────────────────────
    for (let laneIdx = 0; laneIdx < this._lanes.length; laneIdx++) {
      for (const car of this._lanes[laneIdx].cars) {
        if (!this._visuals.has(car)) {
          this._visuals.set(car, this._createVisual(car));
        }

        const vis = this._visuals.get(car);
        const t   = car.position / 100;
        vis.container.x      = laneCenterX(laneIdx, t);
        vis.container.y      = posToScreenY(car.position);
        vis.container.scale.set(posToScale(car.position));
        vis.container.zIndex = Math.round(car.position);
        this._refreshHpBar(vis.hpFill, car);
        vis.hpText.text = String(car.hp);
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
      d.container.scale.set(d.startScale * (1 + (DEATH_SCALE - 1) * progress));
      d.container.alpha = 1 - progress;
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _createVisual(car) {
    const container = new Container();
    const color     = COLOR_MAP[car.color] ?? 0x888888;

    // Car body — top-down perspective view, front faces the player (bottom of screen).
    // Container is centred at (0,0) so perspective scale anchors to the car centre.
    const body = new Graphics();
    // Main body
    body.roundRect(-CAR_W / 2, -CAR_H / 2, CAR_W, CAR_H, RADIUS);
    body.fill(color);
    // Inner shadow gives the rectangle depth
    body.roundRect(-CAR_W / 2 + 3, -CAR_H / 2 + 3, CAR_W - 6, CAR_H - 6, RADIUS - 2);
    body.fill({ color, alpha: 0.4 });
    // Windshield (dark glass strip) — near the rear/top of the car
    body.roundRect(-CAR_W / 2 + 6, -CAR_H / 2 + 6, CAR_W - 12, 14, 3);
    body.fill({ color: 0x111111, alpha: 0.55 });
    container.addChild(body);

    // Carry-over bait cars (HP 1-2) get a white stripe so players spot them quickly.
    if (car.maxHp <= 2) {
      const stripe = new Graphics();
      stripe.rect(-CAR_W / 2 + 6, -CAR_H / 2 + 22, CAR_W - 12, 4);
      stripe.fill({ color: 0xffffff, alpha: 0.55 });
      container.addChild(stripe);
    }

    // HP bar background — sits above the car body in screen space
    const hpBg = new Graphics();
    hpBg.rect(-CAR_W / 2, -CAR_H / 2 - HP_BAR_OFFSET - HP_BAR_H, CAR_W, HP_BAR_H);
    hpBg.fill(HP_BAR_BG);
    container.addChild(hpBg);

    // HP bar fill — redrawn each frame by _refreshHpBar
    const hpFill = new Graphics();
    container.addChild(hpFill);

    // HP number — centered on the car body, scales with container perspective scale
    const hpText = new Text({ text: String(car.hp), style: HP_TEXT_STYLE });
    hpText.anchor.set(0.5, 0.5);
    hpText.x = 0;
    hpText.y = 0;
    container.addChild(hpText);

    this._layer.addChild(container);
    return { container, hpFill, hpText };
  }

  _refreshHpBar(hpFill, car) {
    const ratio = car.maxHp > 0 ? car.hp / car.maxHp : 0;
    const fillW = Math.max(1, Math.round(ratio * CAR_W));
    const color = ratio > 0.6 ? HP_COLOR_HIGH
                : ratio > 0.25 ? HP_COLOR_MID
                : HP_COLOR_LOW;

    hpFill.clear();
    hpFill.rect(-CAR_W / 2, -CAR_H / 2 - HP_BAR_OFFSET - HP_BAR_H, fillW, HP_BAR_H);
    hpFill.fill(color);
  }
}
