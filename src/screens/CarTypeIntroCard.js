// CarTypeIntroCard — Royal Match "Meet the new blocker!" style intro overlay.
// Shows once per car type EVER (seen-state persisted in
// ProgressManager.introducedCarTypes; GameApp fires cards at level start only).
// Gameplay is paused while the card is on screen. Auto-dismisses after DISPLAY_MS.
//
// Usage:
//   const card = new CarTypeIntroCard(stage, APP_W, APP_H, typeKey, onDismiss);
//   app.ticker.add(ticker => { if (!card.update(ticker.deltaMS / 1000)) { app.ticker.remove(...); } });

import { Container, Graphics, Text, Sprite, Assets } from 'pixi.js';
import { uiIcon } from '../renderer/UIIcon.js';
import { CAR_TYPES } from '../director/CarTypes.js';

const BASE_URL = import.meta.env.BASE_URL ?? '';

// ── Per-type display data ─────────────────────────────────────────────────────
// hp comes from CAR_TYPES (single source of truth) — the card shows base HP;
// live cars scale it by the level's hpMultiplier.
const TYPE_INFO = {
  small:  { name: 'MOTORBIKE', hp: CAR_TYPES.small.hp,  color: 0x44BB99, sprite: 'sprites/designed/bike-red.png'          },
  big:    { name: 'CAR',       hp: CAR_TYPES.big.hp,    color: 0xDD8833, sprite: 'sprites/designed/car-red-processed.png' },
  jeep:   { name: 'VAN',       hp: CAR_TYPES.jeep.hp,   color: 0x378ADD, sprite: 'sprites/designed/van-red.png'           },
  truck:  { name: 'TENDER',    hp: CAR_TYPES.truck.hp,  color: 0x639922, sprite: 'sprites/designed/truck-red.png'         },
  bigrig: { name: 'BIG RIG',   hp: CAR_TYPES.bigrig.hp, color: 0xD85A30, sprite: 'sprites/designed/bigrig-red.png'        },
  tank:   { name: 'TANK',      hp: CAR_TYPES.tank.hp,   color: 0x7F77DD, sprite: 'sprites/designed/tank.png'              },
};

const DISPLAY_MS    = 2500;
const ANIM_IN_MS    = 220;
const ANIM_OUT_MS   = 180;

// Sprite display dimensions
const SPR_W = 88;
const SPR_H = 108;

// ── Helpers ───────────────────────────────────────────────────────────────────

// True if the type has intro display data. Seen-state lives in
// ProgressManager.introducedCarTypes (with a migration from the legacy
// 'lane_defense_seen_car_types' localStorage key this module used to own).
export function hasIntroCard(typeKey) {
  return typeKey in TYPE_INFO;
}

// ── Card class ────────────────────────────────────────────────────────────────

export class CarTypeIntroCard {
  constructor(stage, appW, appH, typeKey, onDismiss) {
    const info = TYPE_INFO[typeKey];
    if (!info) { onDismiss?.(); return; }

    this._onDismiss = onDismiss;
    this._elapsed   = 0;
    this._dismissed = false;

    const W = appW, H = appH;
    const CW = 320, CH = 220;
    const CX = (W - CW) / 2, CY = (H - CH) / 2 - 30;

    // Left sprite zone: CX → CX+110; right text zone: CX+110 → CX+320
    const SPRITE_ZONE_W = 110;
    const TEXT_CENTER_X = CX + SPRITE_ZONE_W + (CW - SPRITE_ZONE_W) / 2;  // ≈ CX+215

    const c = new Container();
    c.eventMode = 'static';
    c.on('pointerdown', () => this._dismiss());
    stage.addChild(c);
    this._container = c;

    // ── Full-screen dim backdrop ─────────────────────────────────────────────
    const bg = new Graphics();
    bg.rect(0, 0, W, H);
    bg.fill({ color: 0x000000, alpha: 0.72 });
    c.addChild(bg);

    // ── Card background ──────────────────────────────────────────────────────
    const card = new Graphics();
    // Outer glow border in accent color
    card.roundRect(CX - 2, CY - 2, CW + 4, CH + 4, 16);
    card.fill({ color: info.color, alpha: 0.55 });
    // Inner dark panel
    card.roundRect(CX, CY, CW, CH, 14);
    card.fill({ color: 0x0e0b1c, alpha: 1.0 });
    // Subtle top-gradient overlay
    card.roundRect(CX, CY, CW, CH * 0.45, 14);
    card.fill({ color: 0x1c1038, alpha: 1.0 });
    c.addChild(card);
    this._card = card;

    // ── Sprite zone — colored placeholder replaced async by actual sprite ────
    const spriteContainer = new Container();
    c.addChild(spriteContainer);
    this._spriteContainer = spriteContainer;

    // Placeholder: colored rounded rect while sprite loads
    const placeholder = new Graphics();
    const ph = info.color;
    placeholder.roundRect(CX + 11, CY + (CH - SPR_H) / 2, SPR_W, SPR_H, 10);
    placeholder.fill({ color: ph, alpha: 0.25 });
    spriteContainer.addChild(placeholder);
    this._placeholder = placeholder;

    // Async sprite load
    const spriteUrl = `${BASE_URL}${info.sprite}`;
    Assets.load(spriteUrl).then(tex => {
      if (this._container?.destroyed || this._dismissed) return;
      const spr = new Sprite(tex);
      // Scale to fit within SPR_W × SPR_H maintaining aspect ratio
      const scale = Math.min(SPR_W / spr.width, SPR_H / spr.height);
      spr.scale.set(scale);
      spr.anchor.set(0.5, 0.5);
      spr.x = CX + SPRITE_ZONE_W / 2;
      spr.y = CY + CH / 2;
      spriteContainer.removeChild(placeholder);
      placeholder.destroy();
      spriteContainer.addChild(spr);
    }).catch(() => { /* keep placeholder on load failure */ });

    // ── "MEET THE" header ────────────────────────────────────────────────────
    const meetTxt = new Text({
      text: 'MEET THE',
      style: {
        fontSize:      11,
        fontWeight:    'bold',
        fill:          0x8899bb,
        letterSpacing: 3,
      },
    });
    meetTxt.anchor.set(0.5, 0);
    meetTxt.x = TEXT_CENTER_X;
    meetTxt.y = CY + 20;
    c.addChild(meetTxt);

    // ── Type name (dominant) ─────────────────────────────────────────────────
    const nameTxt = new Text({
      text: info.name,
      style: {
        fontSize:   46,
        fontWeight: '900',
        fill:       0xffffff,
        dropShadow: { color: info.color, blur: 22, distance: 0, alpha: 0.70 },
      },
    });
    nameTxt.anchor.set(0.5, 0);
    nameTxt.x = TEXT_CENTER_X;
    nameTxt.y = CY + 38;
    // Clamp to right zone width
    const maxNameW = CW - SPRITE_ZONE_W - 16;
    if (nameTxt.width > maxNameW) nameTxt.scale.set(maxNameW / nameTxt.width);
    c.addChild(nameTxt);

    // ── HP badge ─────────────────────────────────────────────────────────────
    const bw = 120, bh = 36;
    const bx = TEXT_CENTER_X - bw / 2;
    const by = CY + 108;
    const hpBadge = new Graphics();
    hpBadge.roundRect(bx, by, bw, bh, bh / 2);
    hpBadge.fill({ color: info.color, alpha: 0.90 });
    hpBadge.roundRect(bx + 2, by + 2, bw - 4, bh * 0.42, bh / 2);
    hpBadge.fill({ color: 0xffffff, alpha: 0.22 });
    c.addChild(hpBadge);

    const hpTxt = new Text({
      text: `${info.hp} HP`,
      style: {
        fontSize:   17,
        fontWeight: 'bold',
        fill:       0xffffff,
        dropShadow: { color: 0x000000, blur: 4, distance: 0, alpha: 0.60 },
      },
    });
    hpTxt.anchor.set(0, 0.5);
    const hpHeart = uiIcon('heart', 18, '❤', { emojiFill: 0xff4466 });
    const hpTot = 18 + 6 + hpTxt.width;
    hpHeart.x = TEXT_CENTER_X - hpTot / 2 + 9;      hpHeart.y = by + bh / 2;
    hpTxt.x   = TEXT_CENTER_X - hpTot / 2 + 18 + 6; hpTxt.y   = by + bh / 2;
    c.addChild(hpHeart);
    c.addChild(hpTxt);

    // ── Timer bar ────────────────────────────────────────────────────────────
    const barY  = CY + CH - 22;
    const barBg = new Graphics();
    barBg.roundRect(CX + 20, barY, CW - 40, 6, 3);
    barBg.fill({ color: 0x223344, alpha: 0.80 });
    c.addChild(barBg);

    const barFill = new Graphics();
    c.addChild(barFill);
    this._barFill  = barFill;
    this._barX     = CX + 20;
    this._barY     = barY;
    this._barMaxW  = CW - 40;
    this._barColor = info.color;

    // ── Initial animation state ───────────────────────────────────────────────
    c.alpha = 0;
    card.scale.set(0.70);
    card.pivot.set(CX + CW / 2, CY + CH / 2);
    card.position.set(CX + CW / 2, CY + CH / 2);
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

    // Timer bar drains over the display window
    const displayElapsed = Math.max(0, this._elapsed - ANIM_IN_MS);
    const fillFrac = Math.max(0, 1 - displayElapsed / DISPLAY_MS);
    if (this._barFill) {
      this._barFill.clear();
      const fw = this._barMaxW * fillFrac;
      if (fw > 2) {
        this._barFill.roundRect(this._barX, this._barY, fw, 6, 3);
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
