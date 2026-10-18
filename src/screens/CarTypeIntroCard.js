// CarTypeIntroCard — "NEW VEHICLE!" card, shown once per vehicle at the start of the level
// that first has it (L3 car, L5 van; seen-state in ProgressManager.introducedCarTypes).
//
// 2026-10-18: the card SHOWS the shrink rule instead of stating a number. On a little strip
// of road the new vehicle takes bombs from below, one at a time, and every hit shrinks it a
// size (van -> car -> motorbike -> boom), while a row of hit pips empties. It loops until
// the player taps GOT IT, so a player who does not read still sees how the car works.
// Gameplay is paused while the card is up (modal queue).
//
// Usage:
//   const card = new CarTypeIntroCard(stage, APP_W, APP_H, typeKey, onDismiss, hp);
//   ticker: if (!card.update(dt)) -> finished and destroyed.

import { Container, Graphics, Sprite, Assets } from 'pixi.js';
import { panel, ribbon, titleText, bodyText, backdrop, button, GOLD } from '../renderer/PremiumUI.js';
import { INK, SUN } from '../renderer/ToyStyle.js';
import { CAR_TYPES, LADDER } from '../director/CarTypes.js';

const BASE_URL = import.meta.env.BASE_URL ?? '';

// Rung sprites (red, so the matching bomb reads as "same colour").
const RUNG = {
  small: { name: 'MOTORBIKE', sprite: 'sprites/designed/bike-red.png' },
  big:   { name: 'CAR',       sprite: 'sprites/designed/car-red-processed.png' },
  jeep:  { name: 'VAN',       sprite: 'sprites/designed/van-red.png' },
};
const BOMB_SPRITE = 'sprites/designed/powerball-red.png';
const BOOM_SPRITE = 'sprites/designed/explosion.png';
const PX_PER_SRC = 0.24;   // sprite px -> card px (keeps the real size ratio between rungs)

// Loop timing (s).
const HOLD   = 0.75;   // look at the vehicle before each bomb
const FLY    = 0.32;   // bomb travels up the road
const POP    = 0.22;   // shrink pop after a hit
const BOOM_T = 0.65;   // explosion on the last hit
const REST   = 0.55;   // empty road before the loop restarts

const CW = 330, CH = 520;
const ROAD = { x: 95, y: 70, w: 140, h: 236 };     // the road strip inside the card
const CAR_Y = ROAD.y + 92;                           // where the vehicle sits
const BOMB_Y0 = ROAD.y + ROAD.h - 26;                // bomb start (bottom of the strip)

export function hasIntroCard(typeKey) {
  // Only vehicles that still spawn and are not the baseline motorbike get a card.
  return typeKey === 'big' || typeKey === 'jeep';
}

export class CarTypeIntroCard {
  constructor(stage, appW, appH, typeKey, onDismiss, hp = null) {
    if (!hasIntroCard(typeKey)) { onDismiss?.(); return; }
    this._onDismiss = onDismiss;
    this._dismissed = false;
    this._t = 0;
    this._in = 0;
    const full = hp ?? CAR_TYPES[typeKey].hp;
    this._full = full;
    this._type = typeKey;

    const c = new Container();
    stage.addChild(c);
    this._container = c;
    const dim = backdrop(appW, appH, 0.78);
    dim.eventMode = 'static';
    c.addChild(dim);

    const card = new Container();
    card.pivot.set(CW / 2, CH / 2);
    card.position.set(appW / 2, appH / 2 - 10);
    c.addChild(card);
    this._card = card;
    card.addChild(panel(CW, CH));
    const rb = ribbon('NEW VEHICLE!', 250, { size: 26 });
    rb.x = CW / 2; rb.y = 2;
    card.addChild(rb);

    // ── The road strip ─────────────────────────────────────────────────────
    const road = new Graphics();
    road.roundRect(ROAD.x - 6, ROAD.y - 6, ROAD.w + 12, ROAD.h + 12, 18).fill(0x1A1630);
    road.roundRect(ROAD.x, ROAD.y, ROAD.w, ROAD.h, 14).fill(0x3B3F4A);
    road.rect(ROAD.x + 6, ROAD.y, 4, ROAD.h).fill({ color: 0xFFFFFF, alpha: 0.55 });
    road.rect(ROAD.x + ROAD.w - 10, ROAD.y, 4, ROAD.h).fill({ color: 0xFFFFFF, alpha: 0.55 });
    for (let y = ROAD.y + 10; y < ROAD.y + ROAD.h - 10; y += 28) road.rect(ROAD.x + ROAD.w / 2 - 2, y, 4, 14).fill({ color: 0xFFFFFF, alpha: 0.18 });
    card.addChild(road);
    // the vehicle and the bomb live in a masked layer so nothing spills off the strip
    const stageL = new Container();
    const mask = new Graphics();
    mask.roundRect(ROAD.x, ROAD.y, ROAD.w, ROAD.h, 14).fill(0xffffff);
    stageL.mask = mask;
    card.addChild(mask, stageL);
    this._stage = stageL;

    this._rungs = {};
    for (const k of LADDER) {
      const holder = new Container();
      holder.x = ROAD.x + ROAD.w / 2; holder.y = CAR_Y;
      holder.visible = false;
      stageL.addChild(holder);
      this._rungs[k] = holder;
      this._load(RUNG[k].sprite, holder, PX_PER_SRC);
    }
    this._bomb = new Container();
    this._bomb.x = ROAD.x + ROAD.w / 2;
    this._load(BOMB_SPRITE, this._bomb, null, 42);
    stageL.addChild(this._bomb);
    this._boom = new Container();
    this._boom.x = ROAD.x + ROAD.w / 2; this._boom.y = CAR_Y;
    this._load(BOOM_SPRITE, this._boom, null, 120);
    stageL.addChild(this._boom);
    this._flash = new Graphics();
    stageL.addChild(this._flash);

    // ── Name, hit pips, caption ────────────────────────────────────────────
    const name = titleText(RUNG[typeKey].name, 40);
    name.x = CW / 2; name.y = ROAD.y + ROAD.h + 34;
    card.addChild(name);

    this._pips = new Graphics();
    card.addChild(this._pips);
    this._pipY = ROAD.y + ROAD.h + 72;
    const hits = bodyText(`${full} HITS`, 18, SUN);
    hits.anchor.set(0, 0.5);
    this._hitsLabel = hits;
    card.addChild(hits);

    const cap = bodyText('Every hit shrinks it one size', 16, 0xFFFFFF, { outline: false, weight: '700' });
    cap.x = CW / 2; cap.y = this._pipY + 34;
    card.addChild(cap);

    const ok = button('GOT IT', { variant: 'green', w: 190, h: 58, size: 28, onTap: () => this._dismiss() });
    ok.x = CW / 2; ok.y = CH - 46;
    card.addChild(ok);

    c.alpha = 0;
    card.scale.set(0.7);
    this._reset();
  }

  _load(path, holder, scale, fit = null) {
    const put = (tex) => {
      if (this._dismissed || holder.destroyed) return;
      const s = new Sprite(tex);
      s.anchor.set(0.5);
      s.scale.set(fit ? fit / Math.max(tex.width, tex.height) : scale);
      holder.addChild(s);
    };
    const tex = Assets.get(`${BASE_URL}${path}`);
    if (tex) put(tex); else Assets.load(`${BASE_URL}${path}`).then(put).catch(() => {});
  }

  // Loop state: hp left, phase and its clock.
  _reset() { this._hp = this._full; this._phase = 'hold'; this._pt = 0; this._showRung(); }

  _showRung() {
    const k = this._hp > 0 ? LADDER[this._hp - 1] : null;
    for (const [key, h] of Object.entries(this._rungs)) { h.visible = key === k; h.scale.set(1); }
    this._bomb.visible = false;
    this._boom.visible = false;
    this._drawPips();
  }

  _drawPips() {
    const g = this._pips, n = this._full, r = 9, gap = 26;
    const total = (n - 1) * gap + r * 2 + 10 + this._hitsLabel.width;
    const x0 = CW / 2 - total / 2 + r;
    g.clear();
    for (let i = 0; i < n; i++) {
      const on = i < this._hp;
      g.circle(x0 + i * gap, this._pipY, r).fill(on ? 0xFF3D3D : 0x3A3552).stroke({ color: INK, width: 2.5 });
      if (on) g.circle(x0 + i * gap - 3, this._pipY - 3, 2.6).fill({ color: 0xFFFFFF, alpha: 0.7 });
    }
    this._hitsLabel.x = x0 + (n - 1) * gap + r + 10;
    this._hitsLabel.y = this._pipY;
  }

  // Returns false once the card is finished and destroyed.
  update(dt) {
    if (this._dismissed || !this._container) return false;
    this._t += dt;
    if (this._in < 1) {
      this._in = Math.min(1, this._in + dt / 0.22);
      const e = 1 - Math.pow(1 - this._in, 3);
      this._container.alpha = e;
      this._card.scale.set(0.7 + 0.3 * e + (this._in < 0.6 ? (0.6 - this._in) * 0.12 : 0));
    }
    this._pt += dt;
    const cur = this._hp > 0 ? this._rungs[LADDER[this._hp - 1]] : null;
    if (cur) cur.y = CAR_Y + Math.sin(this._t * 5) * 1.5;   // idling
    this._flash.clear();

    switch (this._phase) {
      case 'hold':
        if (this._pt >= HOLD) { this._phase = 'fly'; this._pt = 0; this._bomb.visible = true; }
        break;
      case 'fly': {
        const p = Math.min(1, this._pt / FLY);
        const e = p * p;
        this._bomb.y = BOMB_Y0 + (CAR_Y + 30 - BOMB_Y0) * e;
        this._bomb.scale.set(1 - 0.15 * p);
        if (p >= 1) {
          this._bomb.visible = false;
          this._hp--;
          this._phase = this._hp > 0 ? 'pop' : 'boom';
          this._pt = 0;
          this._showRung();
          if (this._hp <= 0) this._boom.visible = true;
        }
        break;
      }
      case 'pop': {
        const p = Math.min(1, this._pt / POP);
        if (cur) cur.scale.set(1 + 0.28 * Math.sin(Math.PI * p));
        this._flash.circle(ROAD.x + ROAD.w / 2, CAR_Y, 46 * (1 - p) + 10).fill({ color: 0xFFFFFF, alpha: 0.55 * (1 - p) });
        if (p >= 1) { this._phase = 'hold'; this._pt = 0; }
        break;
      }
      case 'boom': {
        const p = Math.min(1, this._pt / BOOM_T);
        this._boom.scale.set(0.5 + 0.8 * p);
        this._boom.alpha = 1 - p * p;
        if (p >= 1) { this._boom.visible = false; this._phase = 'rest'; this._pt = 0; }
        break;
      }
      case 'rest':
        if (this._pt >= REST) this._reset();
        break;
    }
    return true;
  }

  _dismiss() {
    if (this._dismissed) return;
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
