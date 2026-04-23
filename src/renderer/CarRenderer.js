// CarRenderer — renders every live car in the perspective road view using sprites.
//
// Cars travel from position 0 (top/far) to 100 (bottom/near).
// Each car's container is positioned via laneCenterX / posToScreenY,
// scaled via posToScale, and z-sorted so nearer cars draw on top.
//
// Textures must be preloaded by GameApp before CarRenderer is instantiated.
// Reads lane state, never writes it.
import { Sprite, Graphics, Container, Text, Assets } from 'pixi.js';
// HP_SCALE_FACTOR — The HP elements (bar + number) are wrapped in a sub-container
// whose scale is set to the inverse of the car container scale every frame.
// This keeps the HP bar the same apparent screen size regardless of perspective distance.
import {
  laneCenterX,
  posToScreenY,
  posToScale,
} from './LaneRenderer.js';
import { spriteFlags } from './SpriteFlags.js';

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

// Programmatic fallback colors (used when sprite loading failed).
const CAR_COLORS = {
  Red:    0xE24B4A,
  Blue:   0x378ADD,
  Green:  0x639922,
  Yellow: 0xEF9F27,
  Purple: 0x7F77DD,
  Orange: 0xD85A30,
};

// Slightly lighter fill and darker border for each base color.
function lightenHex(hex, amt = 0x282828) {
  return (Math.min(255, ((hex >> 16) & 0xff) + ((amt >> 16) & 0xff)) << 16)
       | (Math.min(255, ((hex >>  8) & 0xff) + ((amt >>  8) & 0xff)) <<  8)
       |  Math.min(255, ( hex        & 0xff) + ( amt        & 0xff));
}
function darkenHex(hex, amt = 0x202020) {
  return (Math.max(0, ((hex >> 16) & 0xff) - ((amt >> 16) & 0xff)) << 16)
       | (Math.max(0, ((hex >>  8) & 0xff) - ((amt >>  8) & 0xff)) <<  8)
       |  Math.max(0, ( hex        & 0xff) - ( amt        & 0xff));
}

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
    this._visuals = new Map();   // Car → { container, hpFill, hpText, hpCont }
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
        const s = posToScale(car.position);
        vis.container.scale.set(s);
        vis.container.zIndex = Math.round(car.position);
        // Frozen tint: blue overlay via container tint
        vis.container.tint   = isFrozen ? 0x88aaff : 0xffffff;
        // Counter-scale the HP sub-container so it stays the same screen size at all distances.
        vis.hpCont.scale.set(1 / s);
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

    // ── Body — sprite when loaded, colored rectangle as fallback ────────────
    if (spriteFlags.loaded) {
      const texture = Assets.get(carTextureUrl(car));
      const sprite  = new Sprite(texture);
      sprite.anchor.set(0.5, 0.5);
      const scaleX = CAR_TARGET_W / sprite.texture.width;
      const scaleY = CAR_TARGET_H / sprite.texture.height;
      sprite.scale.set(Math.min(scaleX, scaleY));
      container.addChild(sprite);
    } else {
      const base   = car.type === 'boss' ? 0xcc44cc : (CAR_COLORS[car.color] ?? 0x888888);
      const fill   = lightenHex(base, 0x1c1c1c);
      const border = darkenHex(base, 0x282828);
      const body   = new Graphics();
      const HW = CAR_TARGET_W / 2, HH = CAR_TARGET_H / 2;

      // Drop shadow
      body.ellipse(3, HH + 3, HW - 2, 6);
      body.fill({ color: 0x000000, alpha: 0.28 });

      // Car body — rounded rect with lighter fill + darker border
      body.roundRect(-HW, -HH, CAR_TARGET_W, CAR_TARGET_H, 6);
      body.fill(fill);
      body.roundRect(-HW, -HH, CAR_TARGET_W, CAR_TARGET_H, 6);
      body.stroke({ color: border, width: 2 });

      // Glossy highlight ellipse top-left
      body.ellipse(-HW + 10, -HH + 8, 9, 5);
      body.fill({ color: 0xffffff, alpha: 0.28 });

      container.addChild(body);
    }

    // Carry-over bait cars (HP 1-2) get a white stripe overlay for quick ID.
    if (car.maxHp <= 2) {
      const stripe = new Graphics();
      stripe.rect(-CAR_TARGET_W / 2 + 4, -4, CAR_TARGET_W - 8, 4);
      stripe.fill({ color: 0xffffff, alpha: 0.55 });
      container.addChild(stripe);
    }

    // ── HP bar ───────────────────────────────────────────────────────────────
    // All HP visuals live in hpCont whose scale is inverted in update() so
    // the bar stays the same screen size regardless of perspective distance.
    const hpCont = new Container();
    container.addChild(hpCont);

    const barY = -CAR_TARGET_H / 2 - HP_BAR_OFFSET - HP_BAR_H;

    const hpBg = new Graphics();
    // Dark outline around the HP bar track
    hpBg.rect(-HP_BAR_W / 2 - 1, barY - 1, HP_BAR_W + 2, HP_BAR_H + 2);
    hpBg.fill({ color: 0x000000, alpha: 0.70 });
    hpBg.rect(-HP_BAR_W / 2, barY, HP_BAR_W, HP_BAR_H);
    hpBg.fill(HP_BAR_BG);
    hpCont.addChild(hpBg);

    const hpFill = new Graphics();
    hpCont.addChild(hpFill);

    // ── HP number ────────────────────────────────────────────────────────────
    const hpText = new Text({ text: String(car.hp), style: HP_TEXT_STYLE });
    hpText.anchor.set(0.5, 0.5);
    hpCont.addChild(hpText);

    this._layer.addChild(container);
    return { container, hpFill, hpText, hpCont };
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
