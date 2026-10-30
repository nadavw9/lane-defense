// BarrierIntroCard — "LANE BARRIER!" card, shown once ever, the first time a lane's barrier is
// smashed (owner, 2026-10-30: every new mechanic gets a clear picture the first time, like the
// NEW VEHICLE card). The rule as a loop: a car drives down a lane into the striped road block,
// BOOM, the beam splinters and only the posts stay; a second car then drives through the gap
// and the lane flashes red — "the next one ends the level". Gameplay is paused while the card
// is up (modal queue); GOT IT closes it. Same shell as CarTypeIntroCard.
//
// Usage:
//   const card = new BarrierIntroCard(stage, APP_W, APP_H, onDismiss);
//   ticker: if (!card.update(dt)) -> finished and destroyed.

import { Container, Graphics, Sprite, Assets } from 'pixi.js';
import { panel, ribbon, titleText, bodyText, backdrop, button, card as uiCard, GOLD_DEEP } from '../renderer/PremiumUI.js';
import { SUN } from '../renderer/ToyStyle.js';

const BASE_URL = import.meta.env.BASE_URL ?? '';
const CAR_SPRITE  = 'sprites/designed/car-red-processed.png';
const BOOM_SPRITE = 'sprites/designed/explosion.png';

const CW = 340, CH = 470;
const STRIP = { x: 14, y: 128, w: CW - 28, h: 190 };
const LANE_W = 92;
const INK = 0x1B1B1B;

// Loop timeline (seconds).
const T_DRIVE = 1.1, T_BOOM = 0.45, T_HOLD = 0.7, T_DRIVE2 = 1.0, T_FLASH = 0.9, T_REST = 0.5;
const T_TOTAL = T_DRIVE + T_BOOM + T_HOLD + T_DRIVE2 + T_FLASH + T_REST;

export class BarrierIntroCard {
  constructor(stage, appW, appH, onDismiss) {
    this._onDismiss = onDismiss;
    this._dismissed = false;
    this._t = 0;
    this._in = 0;

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
    const rb = ribbon('LANE BARRIER!', 260, { size: 26 });
    rb.x = CW / 2; rb.y = 2;
    card.addChild(rb);

    const name = titleText('ONE PER LANE', 34);
    name.x = CW / 2; name.y = 64;
    card.addChild(name);
    const sub = bodyText('THE FIRST CAR THROUGH SMASHES IT', 15, SUN);
    sub.x = CW / 2; sub.y = 98;
    card.addChild(sub);

    const strip = uiCard(STRIP.w, STRIP.h, { r: 18, rim: GOLD_DEEP, face: 0x2C3148, faceDeep: 0x16182A });
    strip.x = STRIP.x; strip.y = STRIP.y;
    card.addChild(strip);

    // The lane: asphalt, dashed edges, a hazard stripe at the bottom.
    const scene = new Container();
    scene.x = STRIP.x + STRIP.w / 2; scene.y = STRIP.y;
    card.addChild(scene);
    this._scene = scene;
    // Everything in the scene stays inside the strip (the splintering beam, the cars).
    const mask = new Graphics();
    mask.roundRect(STRIP.x + 6, STRIP.y + 6, STRIP.w - 12, STRIP.h - 12, 14).fill({ color: 0xFFFFFF });
    card.addChild(mask);
    scene.mask = mask;
    const road = new Graphics();
    road.rect(-LANE_W / 2, 10, LANE_W, STRIP.h - 20).fill({ color: 0x4B4E5A });
    for (let y = 14; y < STRIP.h - 24; y += 18) road.rect(-LANE_W / 2 + 4, y, 3, 10).fill({ color: 0xE8E8EE, alpha: 0.8 }).rect(LANE_W / 2 - 7, y, 3, 10).fill({ color: 0xE8E8EE, alpha: 0.8 });
    scene.addChild(road);
    const hazY = STRIP.h - 24;
    const haz = new Graphics();
    haz.rect(-LANE_W / 2, hazY, LANE_W, 8).fill({ color: 0x141414 });
    for (let x = -LANE_W / 2 - 8; x < LANE_W / 2; x += 16) haz.poly([x, hazY, x + 8, hazY, x, hazY + 8, x - 8, hazY + 8]).fill({ color: 0xF2C115 });
    scene.addChild(haz);
    // Red flash over the lane (the second car got through).
    const flash = new Graphics();
    flash.rect(-LANE_W / 2, 10, LANE_W, STRIP.h - 20).fill({ color: 0xFF3D3D });
    flash.alpha = 0;
    scene.addChild(flash);
    this._flash = flash;

    // The barrier: two posts + a striped beam (two halves, so it can split).
    const beamY = hazY - 12;
    const posts = new Graphics();
    for (const px of [-LANE_W / 2 + 6, LANE_W / 2 - 14]) {
      posts.roundRect(px, beamY - 13, 8, 26, 3).fill({ color: 0x4A4A52 }).stroke({ color: INK, width: 2 });
    }
    scene.addChild(posts);
    const halves = [];
    for (const side of [-1, 1]) {
      const h = new Graphics();
      const w = LANE_W / 2 - 8;
      // stripes clipped to a rounded beam (a mask keeps the stripes inside the beam)
      const beam = new Graphics();
      beam.roundRect(side < 0 ? -w : 0, -8, w, 16, 5).fill({ color: 0xFFFFFF });
      h.addChild(beam);
      const stripes = new Graphics();
      for (let x = (side < 0 ? -w : 0) - 16; x < (side < 0 ? 0 : w) + 16; x += 18) {
        stripes.poly([x, -8, x + 9, -8, x + 1, 8, x - 8, 8]).fill({ color: 0xFF3D3D });
      }
      const clip = new Graphics();
      clip.roundRect(side < 0 ? -w : 0, -8, w, 16, 5).fill({ color: 0xFFFFFF });
      h.addChild(clip); stripes.mask = clip;
      h.addChild(stripes);
      const rim = new Graphics();
      rim.roundRect(side < 0 ? -w : 0, -8, w, 16, 5).stroke({ color: INK, width: 2 });
      h.addChild(rim);
      const holder = new Container();
      holder.y = beamY; holder.x = 0;
      holder.addChild(h);
      scene.addChild(holder);
      halves.push(holder);
    }
    this._halves = halves;
    this._beamY = beamY;

    // Cars and the boom.
    const car1 = new Container(); scene.addChild(car1); this._car1 = car1;
    const car2 = new Container(); scene.addChild(car2); this._car2 = car2;
    this._load(CAR_SPRITE, car1, 46);
    this._load(CAR_SPRITE, car2, 46);
    const boom = new Container(); boom.y = beamY; boom.visible = false; scene.addChild(boom); this._boom = boom;
    this._load(BOOM_SPRITE, boom, 90);
    const tag = bodyText('BARRIER DOWN!', 15, 0xFF3D3D, { outline: true, weight: '900' });
    tag.y = beamY - 34; tag.alpha = 0; scene.addChild(tag); this._tag = tag;
    const tag2 = bodyText('LEVEL LOST', 15, 0xFF3D3D, { outline: true, weight: '900' });
    tag2.y = STRIP.h / 2 - 8; tag2.alpha = 0; scene.addChild(tag2); this._tag2 = tag2;

    const cap = bodyText('The next car through that lane\nends the level', 17, 0xFFFFFF, { outline: false, weight: '700' });
    cap.x = CW / 2; cap.y = STRIP.y + STRIP.h + 34;
    card.addChild(cap);

    const ok = button('GOT IT', { variant: 'green', w: 190, h: 58, size: 28, onTap: () => this._dismiss() });
    ok.x = CW / 2; ok.y = CH - 48;
    card.addChild(ok);

    c.alpha = 0;
    card.scale.set(0.7);
  }

  _load(path, holder, fit) {
    const put = (tex) => {
      if (this._dismissed || holder.destroyed) return;
      const s = new Sprite(tex);
      s.anchor.set(0.5);
      s.scale.set(fit / Math.max(tex.width, tex.height));
      holder.addChild(s);
    };
    const tex = Assets.get(`${BASE_URL}${path}`);
    if (tex) put(tex); else Assets.load(`${BASE_URL}${path}`).then(put).catch(() => {});
  }

  update(dt) {
    if (this._dismissed || !this._container) return false;
    this._t += dt;
    if (this._in < 1) {
      this._in = Math.min(1, this._in + dt / 0.22);
      const e = 1 - Math.pow(1 - this._in, 3);
      this._container.alpha = e;
      this._card.scale.set(0.7 + 0.3 * e + (this._in < 0.6 ? (0.6 - this._in) * 0.12 : 0));
    }
    const t = this._t % T_TOTAL;
    const top = 30, beam = this._beamY - 16;
    const ease = (x) => x * x * (3 - 2 * x);
    // Phase 1: car 1 drives into the barrier.
    let p = Math.min(1, t / T_DRIVE);
    this._car1.visible = t < T_DRIVE + T_BOOM * 0.3;
    this._car1.y = top + (beam - top) * ease(p);
    // Phase 2: boom, the beam splits.
    const tb = t - T_DRIVE;
    const inBoom = tb >= 0 && tb < T_BOOM;
    this._boom.visible = inBoom;
    if (inBoom) { const q = tb / T_BOOM; this._boom.scale.set(0.5 + 0.9 * Math.sin(Math.PI * q)); this._boom.alpha = 1 - q * 0.6; }
    const split = tb < 0 ? 0 : Math.min(1, tb / (T_BOOM * 0.9));
    this._halves.forEach((h, i) => {
      const side = i === 0 ? -1 : 1;
      // The halves fly apart sideways (and a little up), fading — they stay inside the strip.
      h.rotation = side * 0.55 * split;
      h.x = side * 26 * split; h.y = this._beamY - 10 * Math.sin(Math.PI * split);
      h.alpha = 1 - 0.9 * split;
      h.visible = t < T_DRIVE + T_BOOM + T_HOLD + T_DRIVE2 + T_FLASH;   // back for the next loop
    });
    this._tag.alpha = tb < 0 ? 0 : Math.max(0, 1 - Math.max(0, tb - T_BOOM - T_HOLD) / 0.3) * Math.min(1, tb / 0.15);
    // Phase 3: car 2 drives through the gap, the lane flashes red.
    const t2 = t - (T_DRIVE + T_BOOM + T_HOLD);
    this._car2.visible = t2 >= 0 && t2 < T_DRIVE2 + T_FLASH;
    if (this._car2.visible) {
      const q = Math.min(1, t2 / T_DRIVE2);
      this._car2.y = top + (this._beamY + 30 - top) * ease(q);
      this._car2.alpha = t2 > T_DRIVE2 ? Math.max(0, 1 - (t2 - T_DRIVE2) / T_FLASH) : 1;
    }
    const tf = t2 - T_DRIVE2;
    this._flash.alpha = tf < 0 ? 0 : 0.55 * Math.max(0, 1 - tf / T_FLASH) * (0.6 + 0.4 * Math.sin(tf * 18));
    this._tag2.alpha = tf < 0 ? 0 : Math.max(0, 1 - tf / T_FLASH);
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
