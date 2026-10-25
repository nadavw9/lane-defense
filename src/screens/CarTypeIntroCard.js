// CarTypeIntroCard — "NEW VEHICLE!" card, shown once per vehicle at the start of the level
// that first has it (L3 car, L5 van; seen-state in ProgressManager.introducedCarTypes).
//
// The shrink rule as a picture (owner, 2026-10-18): the whole ladder from the new vehicle
// down, side by side, with a bomb between each pair — VAN -> bomb -> CAR -> bomb ->
// MOTORBIKE -> bomb -> BOOM. Every size the vehicle goes through is on screen at once, and
// the steps light up one after another in a loop, so a player who does not read still sees
// that every hit shrinks it a size. A future, bigger vehicle just makes the row longer.
// Gameplay is paused while the card is up (modal queue); GOT IT closes it.
//
// Usage:
//   const card = new CarTypeIntroCard(stage, APP_W, APP_H, typeKey, onDismiss, hp);
//   ticker: if (!card.update(dt)) -> finished and destroyed.

import { Container, Graphics, Sprite, Assets } from 'pixi.js';
import { panel, ribbon, titleText, bodyText, backdrop, button, card as uiCard, GOLD_DEEP } from '../renderer/PremiumUI.js';
import { SUN } from '../renderer/ToyStyle.js';
import { CAR_TYPES, LADDER } from '../director/CarTypes.js';

const BASE_URL = import.meta.env.BASE_URL ?? '';

// Rung sprites (red, so the red bombs between them read as "the matching colour").
// srcW = the sprite's pixel width, so the row lays out the same whether or not the texture
// has loaded yet (layout must not depend on load order).
const RUNG = {
  small: { name: 'MOTORBIKE', sprite: 'sprites/designed/bike-red.png',          srcW: 159 },
  big:   { name: 'CAR',       sprite: 'sprites/designed/car-red-processed.png', srcW: 339 },
  jeep:  { name: 'VAN',       sprite: 'sprites/designed/van-red.png',           srcW: 338 },
};
const BOMB_SPRITE = 'sprites/designed/powerball-red.png';
const BOOM_SPRITE = 'sprites/designed/explosion.png';

const CW = 340, CH = 450;
const ROW_Y = 206;            // centre line of the ladder row
const STRIP = { x: 14, y: 132, w: CW - 28, h: 164 };
const PX_PER_SRC = 0.17;      // sprite px -> card px, one scale for every rung (true size ratio)
const STEP_T = 0.75;          // s each step stays lit
const CONNECTOR_W = 34;

export function hasIntroCard(typeKey) {
  // Vehicles that shrink and still spawn; the motorbike is the baseline (no card).
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

    // Name + hits.
    const name = titleText(RUNG[typeKey].name, 40);
    name.x = CW / 2; name.y = 64;
    card.addChild(name);
    const hits = bodyText(`${full} HITS TO DESTROY`, 17, SUN);
    hits.x = CW / 2; hits.y = 100;
    card.addChild(hits);

    // Ladder strip — PremiumUI.card (gold rim + deep slate face). Same well language
    // as HowToPlay illustration stage; retires flat 0x2C2F3A Graphics that read below
    // the outer gold-bevel panel. Face stays cool/dark so vehicles still sit on "road".
    const strip = uiCard(STRIP.w, STRIP.h, {
      r: 18,
      rim: GOLD_DEEP,
      face: 0x2C3148,
      faceDeep: 0x16182A,
    });
    strip.x = STRIP.x; strip.y = STRIP.y;
    card.addChild(strip);

    // Items: the vehicle and every smaller rung below it, then the boom.
    const rungs = [];
    for (let h = full; h >= 1; h--) rungs.push(LADDER[h - 1]);
    const items = rungs.map(k => ({ kind: 'car', key: k })).concat([{ kind: 'boom' }]);
    // Width of each item from its sprite (true relative size), then lay the row out centred.
    const widthOf = (it) => it.kind === 'boom' ? 58 : RUNG[it.key].srcW * PX_PER_SRC;
    const widths = items.map(widthOf);
    const total = widths.reduce((a, b) => a + b, 0) + CONNECTOR_W * (items.length - 1);
    // Fill the strip: a short ladder (car) draws bigger, a long one (van) fits.
    const scaleDown = Math.min(1.3, (STRIP.w - 20) / total);
    let x = CW / 2 - (total * scaleDown) / 2;
    this._items = [];
    this._connectors = [];
    items.forEach((it, i) => {
      const w = widths[i] * scaleDown;
      const holder = new Container();
      holder.x = x + w / 2; holder.y = ROW_Y;
      card.addChild(holder);
      const glow = new Graphics();
      glow.circle(0, 0, 34 * scaleDown).fill({ color: SUN, alpha: 0.28 });
      glow.visible = false;
      holder.addChild(glow);
      const art = new Container();
      holder.addChild(art);
      const pulse = [glow, art];   // what grows when lit (not the label)
      if (it.kind === 'boom') this._load(BOOM_SPRITE, art, null, 70 * scaleDown);
      else this._load(RUNG[it.key].sprite, art, PX_PER_SRC * scaleDown);
      // label under each picture
      const lbl = bodyText(it.kind === 'boom' ? 'BOOM!' : RUNG[it.key].name, 11, it.kind === 'boom' ? 0xFF9A3C : 0xD8D3FF, { outline: false, weight: '800' });
      lbl.y = 42 * scaleDown + 18;
      holder.addChild(lbl);
      this._items.push({ holder, glow, art, pulse });
      x += w;
      if (i < items.length - 1) {
        // connector: a red bomb over a small arrow
        const con = new Container();
        con.x = x + (CONNECTOR_W * scaleDown) / 2; con.y = ROW_Y - 4;
        const arrow = new Graphics();
        arrow.moveTo(-9, 16).lineTo(7, 16).stroke({ color: 0xFFFFFF, width: 3, alpha: 0.75 });
        arrow.poly([7, 11, 13, 16, 7, 21]).fill({ color: 0xFFFFFF, alpha: 0.75 });
        con.addChild(arrow);
        const bomb = new Container();
        bomb.y = -6;
        this._load(BOMB_SPRITE, bomb, null, 24 * scaleDown + 4);
        con.addChild(bomb);
        card.addChild(con);
        this._connectors.push({ con, bomb });
        x += CONNECTOR_W * scaleDown;
      }
    });

    const cap = bodyText('Every hit shrinks it one size', 17, 0xFFFFFF, { outline: false, weight: '700' });
    cap.x = CW / 2; cap.y = STRIP.y + STRIP.h + 30;
    card.addChild(cap);

    const ok = button('GOT IT', { variant: 'green', w: 190, h: 58, size: 28, onTap: () => this._dismiss() });
    ok.x = CW / 2; ok.y = CH - 48;
    card.addChild(ok);

    c.alpha = 0;
    card.scale.set(0.7);
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
    // Light the steps one after another: item 0, bomb 0, item 1, bomb 1, ... then a pause.
    const n = this._items.length, slots = n * 2;              // n items + (n-1) bombs + 1 rest
    const k = Math.floor(this._t / (STEP_T * 0.5)) % slots;   // half-steps
    const p = (this._t / (STEP_T * 0.5)) % 1;
    this._items.forEach((it, i) => {
      const on = k === i * 2;
      it.glow.visible = on;
      const sc = on ? 1 + 0.12 * Math.sin(Math.PI * p) : 1;
      for (const o of it.pulse) o.scale.set(sc);
      it.art.alpha = k === slots - 1 || on || k > i * 2 ? 1 : 0.55;   // later rungs wait dimmed until reached
    });
    this._connectors.forEach((cn, i) => {
      const on = k === i * 2 + 1;
      cn.bomb.y = -6 + (on ? -10 * Math.sin(Math.PI * p) : 0);
      cn.bomb.x = on ? 6 * p : 0;
      cn.con.alpha = on ? 1 : 0.8;
    });
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
