// CarTypeIntroCard — Royal Match "Meet the new blocker!" style intro overlay.
// Shows once per car type EVER (seen-state persisted in
// ProgressManager.introducedCarTypes; GameApp fires cards at level start only).
// Gameplay is paused while the card is on screen. Auto-dismisses after DISPLAY_MS.
//
// Usage:
//   const card = new CarTypeIntroCard(stage, APP_W, APP_H, typeKey, onDismiss);
//   app.ticker.add(ticker => { if (!card.update(ticker.deltaMS / 1000)) { app.ticker.remove(...); } });

import { Container, Graphics, Sprite, Assets } from 'pixi.js';
import { panel, ribbon, titleText, bodyText, backdrop, GOLD } from '../renderer/PremiumUI.js';
import { INK, shade } from '../renderer/ToyStyle.js';
import { uiIcon } from '../renderer/UIIcon.js';
import { CAR_TYPES } from '../director/CarTypes.js';

const BASE_URL = import.meta.env.BASE_URL ?? '';

// ── Per-type display data ─────────────────────────────────────────────────────
// hp comes from CAR_TYPES (single source of truth) — the card shows base HP;
// live cars scale it by the level's hpMultiplier.
const TYPE_INFO = {
  small:  { name: 'MOTORBIKE', hp: CAR_TYPES.small.hp,  color: 0x3DBB3A, sprite: 'sprites/designed/bike-red.png'          },
  big:    { name: 'CAR',       hp: CAR_TYPES.big.hp,    color: 0x9CC42A, sprite: 'sprites/designed/car-red-processed.png' },
  jeep:   { name: 'VAN',       hp: CAR_TYPES.jeep.hp,   color: 0xF2B21B, sprite: 'sprites/designed/van-red.png'           },
  truck:  { name: 'TRUCK',     hp: CAR_TYPES.truck.hp,  color: 0xF07A1C, sprite: 'sprites/designed/truck-red.png'         },
  bigrig: { name: 'BIG RIG',   hp: CAR_TYPES.bigrig.hp, color: 0xE8453C, sprite: 'sprites/designed/bigrig-red.png'        },
  tank:   { name: 'TANK',      hp: CAR_TYPES.tank.hp,   color: 0xB02A5A, sprite: 'sprites/designed/tank.png'              },
};

const DISPLAY_MS    = 2500;
const ANIM_IN_MS    = 220;
const ANIM_OUT_MS   = 180;

// Sprite display dimensions
const SPR_W = 130;
const SPR_H = 150;

// ── Helpers ───────────────────────────────────────────────────────────────────

// True if the type has intro display data. Seen-state lives in
// ProgressManager.introducedCarTypes (with a migration from the legacy
// 'lane_defense_seen_car_types' localStorage key this module used to own).
export function hasIntroCard(typeKey) {
  return typeKey in TYPE_INFO;
}

// ── Card class ────────────────────────────────────────────────────────────────

export class CarTypeIntroCard {
  // hp: this level's actual HP for the type (GameApp passes carHpFor(...)); the
  // base value is only a fallback, so the card never disagrees with the board.
  constructor(stage, appW, appH, typeKey, onDismiss, hp = null) {
    const info = TYPE_INFO[typeKey];
    if (!info) { onDismiss?.(); return; }

    this._onDismiss = onDismiss;
    this._elapsed   = 0;
    this._dismissed = false;

    const W = appW, H = appH;
    const CW = 320, CH = 400;

    const c = new Container();
    c.eventMode = 'static';
    c.on('pointerdown', () => this._dismiss());
    stage.addChild(c);
    this._container = c;
    c.addChild(backdrop(W, H, 0.74));

    // Card (pivot at its centre so the pop-in scales from the middle).
    const card = new Container();
    card.pivot.set(CW / 2, CH / 2);
    card.position.set(W / 2, H / 2 - 20);
    c.addChild(card);
    this._card = card;
    card.addChild(panel(CW, CH));
    const rb = ribbon('NEW VEHICLE!', 250, { size: 26 });
    rb.x = CW / 2; rb.y = 2;
    card.addChild(rb);

    // Sunburst behind the vehicle.
    const stageY = 138;
    const glow = new Graphics();
    glow.circle(0, 0, 96).fill({ color: info.color, alpha: 0.22 });
    glow.circle(0, 0, 66).fill({ color: 0xFFFFFF, alpha: 0.10 });
    glow.x = CW / 2; glow.y = stageY;
    card.addChild(glow);
    const rays = new Graphics();
    for (let i = 0; i < 12; i++) {
      const a0 = (i / 12) * Math.PI * 2, a1 = a0 + Math.PI / 12;
      rays.poly([0, 0, Math.cos(a0) * 118, Math.sin(a0) * 118, Math.cos(a1) * 118, Math.sin(a1) * 118]).fill({ color: GOLD, alpha: 0.16 });
    }
    rays.x = CW / 2; rays.y = stageY;
    card.addChild(rays);
    this._rays = rays;

    const spr = new Container();
    spr.x = CW / 2; spr.y = stageY;
    card.addChild(spr);
    this._spr = spr;
    Assets.load(`${BASE_URL}${info.sprite}`).then(tex => {
      if (this._dismissed || spr.destroyed) return;
      const s = new Sprite(tex);
      s.anchor.set(0.5);
      s.scale.set(Math.min(SPR_W / s.width, SPR_H / s.height));
      spr.addChild(s);
    }).catch(() => {});

    const name = titleText(info.name, 44);
    name.x = CW / 2; name.y = 262;
    if (name.width > CW - 40) name.scale.set((CW - 40) / name.width);
    card.addChild(name);

    // HP badge.
    const bw = 132, bh = 38, bx = CW / 2 - bw / 2, by = 294;
    const badge = new Graphics();
    badge.roundRect(bx, by + 3, bw, bh, bh / 2).fill(shade(info.color, 0.55));
    badge.roundRect(bx, by, bw, bh - 2, bh / 2).fill(info.color);
    badge.roundRect(bx + 8, by + 4, bw - 16, bh * 0.3, 6).fill({ color: 0xFFFFFF, alpha: 0.3 });
    badge.roundRect(bx, by, bw, bh, bh / 2).stroke({ color: INK, width: 3 });
    card.addChild(badge);
    const hpTxt = titleText(`${hp ?? info.hp} HP`, 20);
    const heart = uiIcon('heart', 22, '❤', { emojiFill: 0xff4466 });
    const tot = 22 + 8 + hpTxt.width;
    heart.x = CW / 2 - tot / 2 + 11; heart.y = by + bh / 2 - 1;
    hpTxt.x = CW / 2 - tot / 2 + 30 + hpTxt.width / 2; hpTxt.y = by + bh / 2 - 1;
    card.addChild(heart, hpTxt);

    const tap = bodyText('Tap to continue', 13, 0xC9C3F0, { outline: false, weight: '600' });
    tap.x = CW / 2; tap.y = CH - 44;
    card.addChild(tap);

    // Timer bar.
    const barBg = new Graphics();
    barBg.roundRect(30, CH - 26, CW - 60, 8, 4).fill({ color: 0x0C0A26, alpha: 0.8 });
    card.addChild(barBg);
    const barFill = new Graphics();
    card.addChild(barFill);
    this._barFill  = barFill;
    this._barX     = 30;
    this._barY     = CH - 26;
    this._barMaxW  = CW - 60;
    this._barColor = GOLD;

    c.alpha = 0;
    card.scale.set(0.70);
    this._animIn  = true;
    this._animOut = false;
  }

  // Returns false when the card has finished and been destroyed.
  update(dt) {
    if (this._dismissed || !this._container) return false;
    this._elapsed += dt * 1000;

    // Animate in
    if (this._animIn) {
      const prog = Math.min(1, this._elapsed / ANIM_IN_MS);
      const e    = 1 - Math.pow(1 - prog, 3);
      this._container.alpha = e;
      const s = 0.70 + 0.30 * e + (prog < 0.6 ? (0.6 - prog) * 0.12 : 0);
      if (this._card) this._card.scale.set(s);
      if (prog >= 1) this._animIn = false;
    }

    if (this._rays) this._rays.rotation += dt * 0.35;
    if (this._spr) this._spr.y = 138 + Math.sin(this._elapsed / 260) * 4;

    // Timer bar drains over the display window
    const displayElapsed = Math.max(0, this._elapsed - ANIM_IN_MS);
    const fillFrac = Math.max(0, 1 - displayElapsed / DISPLAY_MS);
    if (this._barFill) {
      this._barFill.clear();
      const fw = this._barMaxW * fillFrac;
      if (fw > 2) {
        this._barFill.roundRect(this._barX, this._barY, fw, 8, 4);
        this._barFill.fill({ color: this._barColor, alpha: 0.90 });
      }
    }

    // Animate out
    if (!this._animOut && this._elapsed >= ANIM_IN_MS + DISPLAY_MS) {
      this._animOut = true;
    }
    if (this._animOut) {
      const outProg = Math.min(1, (this._elapsed - ANIM_IN_MS - DISPLAY_MS) / ANIM_OUT_MS);
      this._container.alpha = 1 - outProg;
      if (outProg >= 1) {
        this._destroy();
        return false;
      }
    }

    return true;
  }

  _dismiss() {
    if (this._dismissed) return;
    this._dismissed = true;
    this._destroy();
  }

  _destroy() {
    this._dismissed = true;
    this._container?.destroy({ children: true });
    this._container = null;
    this._onDismiss?.();
    this._onDismiss = null;
  }
}
