// WaveIntroCard — "WAVES!" card, shown once ever when the first WAVE 1 crest starts (L10). The
// shape of a level as a picture: a traffic curve along the level (CALM, WAVE 1, LULL, WAVE 2,
// FINAL), cars packed tighter on the crests, and a marker sweeping along it in a loop. Gameplay
// is paused while the card is up (modal queue); GOT IT closes it. Same shell as CarTypeIntroCard.
//
// Usage:
//   const card = new WaveIntroCard(stage, APP_W, APP_H, onDismiss);
//   ticker: if (!card.update(dt)) -> finished and destroyed.

import { Container, Graphics, Sprite, Assets } from 'pixi.js';
import { panel, ribbon, titleText, bodyText, backdrop, button, card as uiCard, GOLD_DEEP } from '../renderer/PremiumUI.js';
import { SUN } from '../renderer/ToyStyle.js';
import { waveHeft, waveTagAt } from '../director/TrafficRules.js';

const BASE_URL = import.meta.env.BASE_URL ?? '';
const CAR_SPRITE = 'sprites/designed/car-red-processed.png';

const CW = 340, CH = 470;
const STRIP = { x: 14, y: 128, w: CW - 28, h: 190 };
const LOOP_T = 4.2;   // seconds for the marker to cross the level

export class WaveIntroCard {
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
    const rb = ribbon('WAVES!', 220, { size: 26 });
    rb.x = CW / 2; rb.y = 2;
    card.addChild(rb);

    const name = titleText('WAVES AHEAD', 34);
    name.x = CW / 2; name.y = 64;
    card.addChild(name);
    const sub = bodyText('TRAFFIC COMES IN WAVES', 15, SUN);
    sub.x = CW / 2; sub.y = 98;
    card.addChild(sub);

    const strip = uiCard(STRIP.w, STRIP.h, { r: 18, rim: GOLD_DEEP, face: 0x2C3148, faceDeep: 0x16182A });
    strip.x = STRIP.x; strip.y = STRIP.y;
    card.addChild(strip);

    // The curve: traffic weight across the level (TrafficRules.waveHeft, two waves).
    const scene = new Container();
    scene.x = STRIP.x; scene.y = STRIP.y;
    card.addChild(scene);
    const L = 22, R = STRIP.w - 22, BASE = STRIP.h - 48, TOP = 34;
    this._geom = { L, R, BASE, TOP };
    const curve = new Graphics();
    const pts = [];
    for (let i = 0; i <= 100; i++) {
      const p = i / 100;
      const h = waveHeft(0.45, p, 2);                        // 0.30 .. 0.80
      pts.push([L + (R - L) * p, BASE - (BASE - TOP) * ((h - 0.25) / 0.6)]);
    }
    curve.moveTo(L, BASE);
    for (const [x, y] of pts) curve.lineTo(x, y);
    curve.lineTo(R, BASE).closePath().fill({ color: 0xFF8A1C, alpha: 0.28 });
    curve.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts) curve.lineTo(x, y);
    curve.stroke({ color: 0xFF8A1C, width: 4 });
    // road baseline
    curve.rect(L - 6, BASE + 6, R - L + 12, 6).fill({ color: 0x4B4E5A });
    scene.addChild(curve);
    this._pts = pts;

    // Cars along the road: packed where the curve is high.
    for (let i = 0; i < 14; i++) {
      const p = (i + 0.5) / 14;
      const h = waveHeft(0.45, p, 2);
      const holder = new Container();
      holder.x = L + (R - L) * p; holder.y = BASE + 9;
      holder.rotation = Math.PI / 2;
      holder.alpha = 0.35 + 0.65 * ((h - 0.3) / 0.5);
      scene.addChild(holder);
      this._load(CAR_SPRITE, holder, 12 + 10 * ((h - 0.3) / 0.5));
    }

    // Labels under the curve, at each segment's centre.
    const labels = [['CALM', 0.10, 0xB8B4E8], ['WAVE 1', 0.30, 0xFF8A1C], ['LULL', 0.47, 0xB8B4E8], ['WAVE 2', 0.67, 0xFF8A1C], ['FINAL', 0.95, 0xFF3D3D]];
    for (const [txt, p, col] of labels) {
      const t = bodyText(txt, 11, col, { outline: false, weight: '900' });
      t.x = L + (R - L) * p; t.y = BASE + 28;
      scene.addChild(t);
    }

    // The marker: a glowing dot riding the curve, with the crest's name above it.
    const marker = new Graphics();
    marker.circle(0, 0, 9).fill({ color: 0xFFFFFF }).stroke({ color: 0xFF8A1C, width: 3 });
    scene.addChild(marker);
    this._marker = marker;
    const tag = bodyText('', 15, 0xFF8A1C, { outline: true, weight: '900' });
    scene.addChild(tag);
    this._tag = tag;

    const cap = bodyText('Keep a FREEZE or a BOMB\nfor the crests!', 17, 0xFFFFFF, { outline: false, weight: '700' });
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
    const p = (this._t % LOOP_T) / LOOP_T;
    const i = Math.min(100, Math.round(p * 100));
    const [x, y] = this._pts[i];
    this._marker.x = x; this._marker.y = y;
    const crest = waveTagAt(p, 2);
    this._marker.scale.set(crest ? 1.25 + 0.15 * Math.sin(this._t * 12) : 1);
    this._tag.text = crest ?? '';
    this._tag.x = Math.max(this._geom.L + 30, Math.min(this._geom.R - 30, x));
    this._tag.y = y - 26;
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
