// CarRenderer — renders every live car in the perspective road view using sprites.
//
// Cars travel from position 0 (top/far) to 100 (bottom/near).
// Each car's container is positioned via laneCenterX / posToScreenY,
// scaled via posToScale, and z-sorted so nearer cars draw on top.
//
// Textures must be preloaded by GameApp before CarRenderer is instantiated.
// Reads lane state, never writes it.
import { Sprite, Graphics, Container, Text, Assets } from 'pixi.js';
import {
  laneCenterX,
  posToScreenY,
  posToScale,
} from './LaneRenderer.js';

// Target sprite size at scale 1.0 (perspective scaling via container.scale).
// Cars are portrait-oriented top-down; we fit them to this box keeping aspect ratio.
const CAR_TARGET_W = 44;
const CAR_TARGET_H = 56;

// HP bar sits above the car body
const HP_BAR_H      = 5;
const HP_BAR_OFFSET = 6;  // px above car top edge
const HP_BAR_BG     = 0x222222;
const HP_BAR_W      = CAR_TARGET_W;   // matches the target car width

// HP bar color thresholds
const HP_COLOR_HIGH = 0x55cc55;   // > 60 %
const HP_COLOR_MID  = 0xeecc22;   // 25–60 %
const HP_COLOR_LOW  = 0xee3333;   // < 25 %

const HP_TEXT_STYLE = {
  fontSize:   16,
  fontWeight: 'bold',
  fill:       0xffffff,
  dropShadow: { color: 0x000000, blur: 3, distance: 1, alpha: 0.85 },
};

// Death animation
const DEATH_DURATION = 0.30;
const DEATH_SCALE    = 1.40;

// Map color name → sprite URL
function carTextureUrl(car) {
  if (car.type === 'boss') return '/sprites/cars/car-boss.png';
  return `/sprites/cars/car-${car.color.toLowerCase()}.png`;
}

export class CarRenderer {
  constructor(layerManager, lanes) {
    this._layer = layerManager.get('carLayer');
    this._layer.sortableChildren = true;
    this._lanes   = lanes;
    this._visuals = new Map();   // Car → { container, hpFill, hpText }
    this._dying   = [];          // { container, startScale, life }
  }

  clearAll() {
    for (const [, vis] of this._visuals) vis.container.destroy({ children: true });
    this._visuals.clear();
    for (const d of this._dying) d.container.destroy({ children: true });
    this._dying.length = 0;
  }

  update(dt, isFrozen = false) {
    // ── Track live cars ──────────────────────────────────────────────────────
    const liveCars = new Set();
    for (const lane of this._lanes) for (const car of lane.cars) liveCars.add(car);

    // ── Retire dead cars into dying list ─────────────────────────────────────
    for (const [car, vis] of this._visuals) {
      if (!liveCars.has(car)) {
        this._dying.push({ container: vis.container, startScale: vis.container.scale.x, life: DEATH_DURATION });
        this._visuals.delete(car);
      }
    }

    // ── Create / update live car visuals ─────────────────────────────────────
    for (let laneIdx = 0; laneIdx < this._lanes.length; laneIdx++) {
      for (const car of this._lanes[laneIdx].cars) {
        if (!this._visuals.has(car)) this._visuals.set(car, this._createVisual(car));

        const vis = this._visuals.get(car);
        const t   = car.position / 100;
        vis.container.x      = laneCenterX(laneIdx, t);
        vis.container.y      = posToScreenY(car.position);
        vis.container.scale.set(posToScale(car.position));
        vis.container.zIndex = Math.round(car.position);
        // Frozen tint: blue overlay via container tint
        vis.container.tint   = isFrozen ? 0x88aaff : 0xffffff;
        this._refreshHpBar(vis.hpFill, car);
        vis.hpText.text = String(car.hp);
      }
    }

    // ── Advance death animations ─────────────────────────────────────────────
    for (let i = this._dying.length - 1; i >= 0; i--) {
      const d = this._dying[i];
      d.life -= dt;
      if (d.life <= 0) {
        d.container.destroy({ children: true });
        this._dying.splice(i, 1);
        continue;
      }
      const prog = 1 - d.life / DEATH_DURATION;
      d.container.scale.set(d.startScale * (1 + (DEATH_SCALE - 1) * prog));
      d.container.alpha = 1 - prog;
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  _createVisual(car) {
    const container = new Container();

    // ── Sprite body ──────────────────────────────────────────────────────────
    const texture = Assets.get(carTextureUrl(car));
    const sprite  = new Sprite(texture);
    sprite.anchor.set(0.5, 0.5);

    // Scale to fit within the target bounding box, preserving aspect ratio.
    const scaleX = CAR_TARGET_W / sprite.texture.width;
    const scaleY = CAR_TARGET_H / sprite.texture.height;
    const fit    = Math.min(scaleX, scaleY);
    sprite.scale.set(fit);

    container.addChild(sprite);

    // Carry-over bait cars (HP 1-2) get a white stripe overlay for quick ID.
    if (car.maxHp <= 2) {
      const stripe = new Graphics();
      stripe.rect(-CAR_TARGET_W / 2 + 4, -4, CAR_TARGET_W - 8, 4);
      stripe.fill({ color: 0xffffff, alpha: 0.55 });
      container.addChild(stripe);
    }

    // ── HP bar ───────────────────────────────────────────────────────────────
    const barY = -CAR_TARGET_H / 2 - HP_BAR_OFFSET - HP_BAR_H;

    const hpBg = new Graphics();
    hpBg.rect(-HP_BAR_W / 2, barY, HP_BAR_W, HP_BAR_H);
    hpBg.fill(HP_BAR_BG);
    container.addChild(hpBg);

    const hpFill = new Graphics();
    container.addChild(hpFill);

    // ── HP number ────────────────────────────────────────────────────────────
    const hpText = new Text({ text: String(car.hp), style: HP_TEXT_STYLE });
    hpText.anchor.set(0.5, 0.5);
    container.addChild(hpText);

    this._layer.addChild(container);
    return { container, hpFill, hpText };
  }

  _refreshHpBar(hpFill, car) {
    const ratio = car.maxHp > 0 ? car.hp / car.maxHp : 0;
    const fillW = Math.max(1, Math.round(ratio * HP_BAR_W));
    const color = ratio > 0.6 ? HP_COLOR_HIGH
                : ratio > 0.25 ? HP_COLOR_MID
                : HP_COLOR_LOW;
    const barY  = -CAR_TARGET_H / 2 - HP_BAR_OFFSET - HP_BAR_H;
    hpFill.clear();
    hpFill.rect(-HP_BAR_W / 2, barY, fillW, HP_BAR_H);
    hpFill.fill(color);
  }
}
