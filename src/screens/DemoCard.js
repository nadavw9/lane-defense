// DemoCard — every first-time explanation as a MOVING PICTURE (owner, 2026-10-31: "assume people
// forward every explanation without reading; all notices become demonstrations"). One shell (the
// NEW VEHICLE card's: ribbon, title, strip, caption, GOT IT) around a MINI BOARD — 1-3 lanes, up
// to 3 rows, the real car and bomb sprites at toy scale, a bomb tray under the road — that plays a
// short scripted loop from src/screens/demoScenes.js. Gameplay is paused while the card is up
// (modal queue); GOT IT closes it.
//
// Scene = { lanes, cars: [{ lane, row, color, type?, trait?, armor? }], bombs: ['Red', ...],
//           loop: seconds, steps: [[t, op, ...args], ...], boosters?: ['freeze' | 'swap' | 'bomb'],
//           goal?: { color?: 'Blue', n: 3 }, counter?: 'x0' }
// Ops (all at time t since the loop started):
//   shot bombIdx lane        the hand drags bomb i from the tray to the lane's front car; impact flash
//   bounce bombIdx lane      same drag, wrong colour: the bomb bounces back, a red cross pops
//   shrink lane              the front car steps down a rung (van -> car -> bike)
//   boom lane                the front car explodes and is gone
//   advance                  every car moves one row toward the line (speeders two)
//   bridge laneA laneB [row] the hand drags car A onto car B; a gold beam joins them
//   snap laneA laneB         the beam cracks and falls
//   hit lane                 impact flash on the front car without a drag (for bridged partners)
//   tag text [lane]          floating text over the lane's front car (or the middle)
//   counter text             the small counter pill at the strip's top-right
//   glow bombIdx|'front'     fire ring on a bomb (supercharge) / on all tray bombs
//   unglow                   rings off
//   light lane red|green n   traffic light over a lane with a count
//   freeze on|off            icy tint on the road, crossed arrows
//   boosterTap kind          the hand taps the booster icon under the tray
//   boosterPlus kind         "+1" pops on the booster icon
//   recolor from to          every car of colour `from` turns `to`
//   plate lane off           the car loses its armour plates (plain body)
//   grow lane                mender: the front car steps UP a rung
//   gift lane                a gift icon flies from the lane's front car to the tray
//   surge lanes              the listed lanes lurch one more row
//   goalTick                 the goal plaque counts one down
//   wait                     no-op (readability)
//
// Usage:
//   const card = new DemoCard(stage, APP_W, APP_H, key, onDismiss);   // key in DEMO_SCENES
//   ticker: if (!card.update(dt)) -> finished and destroyed.

import { Container, Graphics, Sprite, Assets, Text } from 'pixi.js';
import { panel, ribbon, titleText, bodyText, backdrop, button, card as uiCard, tag, GOLD_DEEP } from '../renderer/PremiumUI.js';
import { SUN, INK } from '../renderer/ToyStyle.js';
import { uiIcon } from '../renderer/UIIcon.js';
import { drawBeam, drawDots } from '../renderer/BridgeLayer.js';
import { LADDER } from '../director/CarTypes.js';
import { DEMO_SCENES } from './demoScenes.js';

const BASE_URL = import.meta.env.BASE_URL ?? '';
const CW = 340, CH = 478;
const STRIP = { x: 14, y: 124, w: CW - 28, h: 214 };
const ROAD = { x: 18, y: 8, w: STRIP.w - 36, h: 140 };      // inside the strip
const ROW_Y = [30, 72, 114];                                  // row 0 (far) .. row 2 (near the line)
const LINE_Y = 142;
const TRAY_Y = 166;
const BOOST_Y = 196;
const CAR_PX = { small: 30, big: 44, jeep: 52 };
const COLOR_HEX = { Red: 0xFF3D3D, Blue: 0x2F8CFF, Green: 0x2FCC55, Yellow: 0xFFD42A, Purple: 0xA35CFF, Orange: 0xFF8A1C };
const BOOSTER_ICON = { freeze: 'sprites/designed/booster-freeze.png', swap: 'sprites/designed/booster-swap.png', bomb: 'sprites/designed/booster-bomb.png' };
const BOOSTER_LABEL = { freeze: 'FREEZE', swap: 'COLOR', bomb: 'BOMB' };

export function hasDemo(key) { return !!DEMO_SCENES[key]; }

function spriteFor(color, type, trait, armor) {
  const c = (color ?? 'Red').toLowerCase();
  const art = trait === 'plated' ? 'armored' : trait;
  if (art === 'armored' && (armor ?? 0) > 0 && type !== 'small') return `sprites/designed/armored-${type}-${c}.png`;
  if ((art === 'speeder' || art === 'chameleon' || art === 'volatile') && (type !== 'small' || art !== 'volatile')) return `sprites/designed/${art}-${type}-${c}.png`;
  if (art === 'mender' && type !== 'small') return `sprites/designed/mender-${type}-${c}.png`;
  if (type === 'small') return `sprites/designed/bike-${c}.png`;
  if (type === 'jeep') return `sprites/designed/van-${c}.png`;
  return `sprites/designed/car-${c}-processed.png`;
}

export class DemoCard {
  constructor(stage, appW, appH, key, onDismiss) {
    const def = DEMO_SCENES[key];
    if (!def) { onDismiss?.(); return; }
    this._def = def;
    this._onDismiss = onDismiss;
    this._dismissed = false;
    this._t = 0; this._in = 0;
    this._tweens = [];

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
    const rb = ribbon(def.ribbon ?? 'HOW IT WORKS', 230, { size: 24 });
    rb.x = CW / 2; rb.y = 2;
    card.addChild(rb);

    const name = titleText(def.title, def.title.length > 12 ? 30 : 36);
    if (name.width > CW - 40) name.scale.set((CW - 40) / name.width);
    name.x = CW / 2; name.y = 62;
    card.addChild(name);
    if (def.sub) {
      const sub = bodyText(def.sub, 14, SUN);
      sub.x = CW / 2; sub.y = 98;
      card.addChild(sub);
    }

    const strip = uiCard(STRIP.w, STRIP.h, { r: 18, rim: GOLD_DEEP, face: 0x2C3148, faceDeep: 0x16182A });
    strip.x = STRIP.x; strip.y = STRIP.y;
    card.addChild(strip);

    this._scene = new Container();
    this._scene.x = STRIP.x; this._scene.y = STRIP.y;
    card.addChild(this._scene);

    const cap = bodyText(def.caption, 17, 0xFFFFFF, { outline: false, weight: '700', wrap: CW - 40 });
    cap.x = CW / 2; cap.y = STRIP.y + STRIP.h + 34;
    card.addChild(cap);

    const ok = button('GOT IT', { variant: 'green', w: 190, h: 58, size: 28, onTap: () => this._dismiss() });
    ok.x = CW / 2; ok.y = CH - 46;
    card.addChild(ok);

    this._build();
    c.alpha = 0;
    card.scale.set(0.7);
  }

  // ── Scene setup ────────────────────────────────────────────────────────────

  _build() {
    const S = this._def.scene;
    const sc = this._scene;
    sc.removeChildren().forEach(ch => ch.destroy({ children: true }));
    this._tweens.length = 0;
    this._fired = new Set();
    this._loopT = 0;
    const lanes = Math.max(1, S.lanes ?? 2);
    const laneW = Math.min(96, ROAD.w / lanes);
    const x0 = ROAD.x + (ROAD.w - laneW * lanes) / 2;
    this._laneX = Array.from({ length: lanes }, (_, i) => x0 + laneW * (i + 0.5));
    this._laneW = laneW;

    // Road: asphalt, lane dividers, the red line with its stripe.
    const road = new Graphics();
    road.roundRect(x0 - 6, ROAD.y, laneW * lanes + 12, ROAD.h, 10).fill(0x4B4E5A);
    for (let i = 1; i < lanes; i++) {
      const x = x0 + laneW * i;
      for (let y = ROAD.y + 8; y < ROAD.y + ROAD.h - 8; y += 16) road.rect(x - 1, y, 2, 9).fill({ color: 0xFFFFFF, alpha: 0.45 });
    }
    road.rect(x0 - 6, LINE_Y - 3, laneW * lanes + 12, 6).fill(0xFF3D3D);
    for (let x = x0 - 6; x < x0 + laneW * lanes + 6; x += 14) road.rect(x, LINE_Y - 3, 7, 6).fill({ color: 0xFFFFFF, alpha: 0.6 });
    sc.addChild(road);
    this._road = road;
    this._ice = new Graphics();
    this._ice.roundRect(x0 - 6, ROAD.y, laneW * lanes + 12, ROAD.h, 10).fill({ color: 0x9FE7FF, alpha: 0.35 });
    this._ice.visible = false;
    sc.addChild(this._ice);

    // Goal plaque (optional), counter pill (optional), traffic light holder.
    this._goal = null;
    if (S.goal) {
      const g = new Container();
      g.x = x0 + laneW * lanes / 2; g.y = ROAD.y - 2;
      const back = new Graphics().roundRect(-44, -12, 88, 24, 12).fill({ color: 0x14112F, alpha: 0.9 }).stroke({ color: GOLD_DEEP, width: 2 });
      g.addChild(back);
      const icon = new Container(); icon.x = -22;
      g.addChild(icon);
      if (S.goal.color) this._load(`sprites/designed/goal-car-${S.goal.color.toLowerCase()}.png`, icon, 20);
      else this._load('sprites/designed/explosion.png', icon, 18);
      const txt = new Text({ text: `0/${S.goal.n}`, style: { fontFamily: '"Lilita One", Fredoka, Arial, sans-serif', fontSize: 15, fill: 0xFFFFFF, stroke: { color: INK, width: 3 } } });
      txt.anchor.set(0.5); txt.x = 12;
      g.addChild(txt);
      sc.addChild(g);
      this._goal = { c: g, txt, n: S.goal.n, done: 0 };
      g.y = ROAD.y + 2; g.scale.set(0.9);
    }
    this._counter = null;
    if (S.counter != null) {
      const t = tag(String(S.counter), { color: 0x3A3F5C, size: 12 });
      t.x = x0 + laneW * lanes - 4; t.y = ROAD.y + 12;
      sc.addChild(t);
      this._counter = { c: t, text: String(S.counter) };
    }
    this._lights = [];

    // Cars.
    this._cars = [];
    this._beams = new Graphics();
    this._fx = new Graphics();
    sc.addChild(this._beams);
    for (const def of S.cars ?? []) this._addCar(def);
    sc.addChild(this._fx);
    this._bridges = [];   // { a: car, b: car }
    this._hints = new Graphics();
    sc.addChild(this._hints);

    // Bomb tray.
    this._bombs = [];
    const bombs = S.bombs ?? [];
    const bx0 = x0 + laneW * lanes / 2 - (bombs.length - 1) * 19;
    bombs.forEach((col, i) => {
      const h = new Container();
      h.x = bx0 + i * 38; h.y = TRAY_Y;
      const socket = new Graphics().circle(0, 0, 15).fill({ color: 0x14112F, alpha: 0.7 }).stroke({ color: INK, width: 2 });
      h.addChild(socket);
      const ring = new Graphics().circle(0, 0, 17).stroke({ color: 0xFF8A1C, width: 3 });
      ring.visible = false;
      h.addChild(ring);
      const art = new Container();
      h.addChild(art);
      this._load(`sprites/designed/powerball-${col.toLowerCase()}.png`, art, 26);
      sc.addChild(h);
      this._bombs.push({ c: h, art, ring, color: col, home: { x: h.x, y: h.y } });
    });

    // Boosters under the tray.
    this._boosters = {};
    const kinds = S.boosters ?? [];
    kinds.forEach((k, i) => {
      const h = new Container();
      h.x = x0 + laneW * lanes / 2 + (i - (kinds.length - 1) / 2) * 70; h.y = BOOST_Y;
      const back = new Graphics().roundRect(-34, -12, 68, 24, 8).fill({ color: 0x14112F, alpha: 0.85 }).stroke({ color: GOLD_DEEP, width: 2 });
      h.addChild(back);
      const icon = new Container(); icon.x = -21;
      h.addChild(icon);
      this._load(BOOSTER_ICON[k], icon, 20);
      const lbl = bodyText(BOOSTER_LABEL[k], 9, 0xFFFFFF, { outline: false, weight: '900' });
      lbl.x = 9;
      h.addChild(lbl);
      sc.addChild(h);
      this._boosters[k] = { c: h, icon };
    });

    // The hand, on top of everything.
    this._hand = uiIcon('hand', 30, '👆');
    this._hand.visible = false;
    sc.addChild(this._hand);
    this._tags = sc.addChild(new Container());
  }

  _addCar(def) {
    const type = def.type ?? 'big';
    const h = new Container();
    const car = { c: h, art: new Container(), lane: def.lane, row: def.row, color: def.color, type, trait: def.trait ?? null, armor: def.armor ?? (def.trait === 'armored' ? 1 : def.trait === 'plated' ? 2 : 0), alive: true };
    h.addChild(car.art);
    this._paintCar(car);
    h.x = this._laneX[car.lane]; h.y = ROW_Y[Math.min(2, Math.max(0, Math.round(car.row)))];
    this._scene.addChildAt(h, this._scene.getChildIndex(this._beams) + 1);
    this._cars.push(car);
    return car;
  }

  _paintCar(car) {
    car.art.removeChildren().forEach(ch => ch.destroy({ children: true }));
    const px = CAR_PX[car.type] ?? 34;
    this._load(spriteFor(car.color, car.type, car.trait, car.armor), car.art, px);
    if (car.trait === 'speeder') {
      const flames = new Graphics();
      flames.circle(-6, -px / 2 - 2, 3).fill(0xFF8A1C).circle(6, -px / 2 - 2, 3).fill(0xFF8A1C);
      car.art.addChild(flames);
    }
    if (car.trait === 'gift') {
      const bow = new Container(); bow.y = -4;
      bow.addChild(uiIcon('gift', 16, '🎁'));
      car.art.addChild(bow);
    }
  }

  _front(lane) {
    let best = null;
    for (const c of this._cars) if (c.alive && c.lane === lane && (!best || c.row > best.row)) best = c;
    return best;
  }
  _carAt(lane, row) { return this._cars.find(c => c.alive && c.lane === lane && Math.abs(c.row - row) < 0.01) ?? this._front(lane); }
  _rowY(row) { const r = Math.max(0, Math.min(2.6, row)); const i = Math.floor(r); const f = r - i; return i >= 2 ? ROW_Y[2] + (ROW_Y[2] - ROW_Y[1]) * f : ROW_Y[i] + (ROW_Y[i + 1] - ROW_Y[i]) * f; }

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

  // ── Tweens ──────────────────────────────────────────────────────────────────
  _tween(dur, fn, done) { this._tweens.push({ dur, t: 0, fn, done }); }
  _moveHand(from, to, dur, done) {
    this._hand.visible = true;
    this._hand.x = from.x; this._hand.y = from.y;
    this._tween(dur, (k) => { const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; this._hand.x = from.x + (to.x - from.x) * e; this._hand.y = from.y + (to.y - from.y) * e; }, done);
  }
  _flash(x, y, color = 0xFFFFFF, r = 22) {
    this._tween(0.3, (k) => { this._fxList.push({ kind: 'flash', x, y, color, r: r * (0.6 + k), a: 1 - k }); });
  }
  _explode(x, y) {
    const h = new Container(); h.x = x; h.y = y;
    this._scene.addChildAt(h, this._scene.getChildIndex(this._fx));
    this._load('sprites/designed/explosion.png', h, 52);
    this._tween(0.55, (k) => { h.scale.set(0.5 + 0.9 * k); h.alpha = 1 - k * k; }, () => h.destroy({ children: true }));
  }
  _float(text, x, y, color = 0xFFD42A) {
    const t = new Text({ text, style: { fontFamily: '"Lilita One", Fredoka, Arial, sans-serif', fontSize: 18, fill: color, stroke: { color: INK, width: 4 } } });
    t.anchor.set(0.5); t.x = x; t.y = y;
    this._tags.addChild(t);
    this._tween(1.0, (k) => { t.y = y - 28 * k; t.alpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3; t.scale.set(1 + 0.25 * Math.sin(Math.PI * Math.min(1, k * 3))); }, () => t.destroy());
  }

  // ── Ops ─────────────────────────────────────────────────────────────────────
  _run(step) {
    const [, op, ...a] = step;
    const S = this;
    switch (op) {
      case 'shot': case 'bounce': {
        const bomb = S._bombs[a[0]]; const lane = a[1]; const car = S._front(lane);
        if (!bomb) return;
        const to = { x: S._laneX[lane], y: car ? car.c.y : S._rowY(2) };
        const wrong = op === 'bounce';
        S._moveHand({ x: bomb.home.x, y: bomb.home.y + 10 }, { x: to.x, y: to.y + 12 }, 0.6, () => { S._hand.visible = false; });
        S._tween(0.6, (k) => { const e = k * k; bomb.c.x = bomb.home.x + (to.x - bomb.home.x) * e; bomb.c.y = bomb.home.y + (to.y - bomb.home.y) * e; bomb.c.scale.set(1 + 0.2 * Math.sin(Math.PI * k)); }, () => {
          if (wrong) {
            S._flash(to.x, to.y, 0xFF3D3D, 18);
            S._float('✕', to.x, to.y - 10, 0xFF3D3D);
            S._tween(0.35, (k) => { bomb.c.x = to.x + (bomb.home.x - to.x) * k; bomb.c.y = to.y + (bomb.home.y - to.y) * k; }, null);
          } else {
            S._flash(to.x, to.y, COLOR_HEX[bomb.color] ?? 0xFFFFFF, 20);
            bomb.c.x = bomb.home.x; bomb.c.y = bomb.home.y; bomb.c.scale.set(1);
          }
        });
        break;
      }
      case 'hit': { const car = S._front(a[0]); if (car) S._flash(car.c.x, car.c.y, COLOR_HEX[car.color], 20); break; }
      case 'shrink': {
        const car = S._carAt(a[0], a[1] ?? -1); if (!car) return;
        const i = LADDER.indexOf(car.type);
        if (i > 0) { car.type = LADDER[i - 1]; S._paintCar(car); S._tween(0.25, (k) => car.c.scale.set(1.25 - 0.25 * k)); }
        break;
      }
      case 'grow': {
        const car = S._carAt(a[0], a[1] ?? -1); if (!car) return;
        const i = LADDER.indexOf(car.type);
        if (i < LADDER.length - 1) { car.type = LADDER[i + 1]; S._paintCar(car); S._tween(0.3, (k) => car.c.scale.set(0.8 + 0.2 * k)); S._float('+1', car.c.x, car.c.y - 16, 0x2FCC55); }
        break;
      }
      case 'boom': {
        const car = S._carAt(a[0], a[1] ?? -1); if (!car) return;
        car.alive = false; S._explode(car.c.x, car.c.y); car.c.visible = false;
        S._bridges = S._bridges.filter(b => b.a !== car && b.b !== car);
        if (S._goal && a[2] !== 'nogoal') S._goalTick();
        break;
      }
      case 'plate': { const car = S._front(a[0]); if (car) { car.armor = 0; S._paintCar(car); S._flash(car.c.x, car.c.y, 0xFFFFFF, 24); S._float('PLATE OFF', car.c.x, car.c.y - 18, 0xFFFFFF); } break; }
      case 'advance': {
        for (const car of S._cars) {
          if (!car.alive) continue;
          const from = car.row, to = car.row + (car.trait === 'speeder' ? 2 : 1);
          S._tween(0.35, (k) => { car.row = from + (to - from) * k; car.c.y = S._rowY(car.row); });
        }
        break;
      }
      case 'surge': {
        for (const car of S._cars) {
          if (!car.alive || !a[0].includes(car.lane)) continue;
          const from = car.row, to = car.row + 1;
          S._tween(0.25, (k) => { car.row = from + (to - from) * k; car.c.y = S._rowY(car.row); });
          S._float('!', car.c.x, car.c.y - 20, 0xFF8A1C);
        }
        break;
      }
      case 'bridge': {
        const ca = S._carAt(a[0], a[2] ?? -1), cb = S._carAt(a[1], a[2] ?? -1); if (!ca || !cb) return;
        S._dragging = { a: ca, b: cb, k: 0 };
        S._moveHand({ x: ca.c.x, y: ca.c.y + 8 }, { x: cb.c.x, y: cb.c.y + 8 }, 0.7, () => {
          S._hand.visible = false; S._dragging = null;
          S._bridges.push({ a: ca, b: cb, born: 0 });
          S._flash((ca.c.x + cb.c.x) / 2, (ca.c.y + cb.c.y) / 2, 0xFFC93C, 26);
        });
        S._tween(0.7, (k) => { if (S._dragging) S._dragging.k = k; });
        break;
      }
      case 'snap': {
        const ca = S._carAt(a[0], a[2] ?? -1), cb = S._carAt(a[1], a[2] ?? -1);
        const i = S._bridges.findIndex(b => (b.a === ca && b.b === cb) || (b.a === cb && b.b === ca));
        if (i < 0) return;
        const br = S._bridges.splice(i, 1)[0];
        const x1 = br.a.c.x, y1 = br.a.c.y, x2 = br.b.c.x, y2 = br.b.c.y;
        S._tween(0.55, (k) => { S._fxList.push({ kind: 'snap', x1, y1, x2, y2, k }); });
        S._float('SNAP!', (x1 + x2) / 2, (y1 + y2) / 2 - 14, 0xFFFFFF);
        break;
      }
      case 'tag': { const car = a[1] != null ? S._front(a[1]) : null; S._float(a[0], car ? car.c.x : S._laneX[Math.floor(S._laneX.length / 2)] || ROAD.x + ROAD.w / 2, car ? car.c.y - 18 : ROAD.y + 50); break; }
      case 'counter': { if (S._counter) { S._counter.c.destroy({ children: true }); const t = tag(String(a[0]), { color: 0x3A3F5C, size: 12 }); t.x = S._laneX[S._laneX.length - 1] + S._laneW / 2 - 4; t.y = ROAD.y + 12; S._scene.addChild(t); S._counter = { c: t }; S._tween(0.25, (k) => t.scale.set(1.3 - 0.3 * k)); } break; }
      case 'glow': { for (const b of S._bombs) b.ring.visible = a[0] === 'front' ? true : false; if (typeof a[0] === 'number' && S._bombs[a[0]]) S._bombs[a[0]].ring.visible = true; break; }
      case 'unglow': { for (const b of S._bombs) b.ring.visible = false; break; }
      case 'light': {
        const lane = a[0], red = a[1] === 'red';
        let L = S._lights.find(l => l.lane === lane);
        if (!L) {
          const c = new Container(); c.x = S._laneX[lane]; c.y = ROAD.y + 14;   // inside the road, over the lane
          const body = new Graphics().roundRect(-14, -12, 28, 24, 8).fill(0x2C2F3A).stroke({ color: INK, width: 2 });
          const lamp = new Graphics();
          const num = new Text({ text: '', style: { fontFamily: '"Lilita One", Fredoka, Arial, sans-serif', fontSize: 14, fill: 0xFFFFFF, stroke: { color: INK, width: 3 } } });
          num.anchor.set(0.5); num.x = 7;
          c.addChild(body, lamp, num);
          S._scene.addChild(c);
          L = { lane, c, lamp, num };
          S._lights.push(L);
        }
        L.lamp.clear().circle(-6, 0, 6).fill(red ? 0xFF3D3D : 0x2FCC55);
        L.num.text = a[2] != null ? String(a[2]) : '';
        S._tween(0.2, (k) => L.c.scale.set(1.25 - 0.25 * k));
        break;
      }
      case 'freeze': { S._ice.visible = a[0] !== 'off'; if (S._ice.visible) S._float('FROZEN', S._laneX[Math.floor(S._laneX.length / 2)], ROAD.y + 60, 0x9FE7FF); break; }
      case 'boosterTap': {
        const B = S._boosters[a[0]]; if (!B) return;
        S._moveHand({ x: B.c.x + 30, y: B.c.y + 26 }, { x: B.c.x, y: B.c.y + 6 }, 0.45, () => { S._hand.visible = false; S._tween(0.3, (k) => B.c.scale.set(1 + 0.3 * Math.sin(Math.PI * k))); S._flash(B.c.x, B.c.y, 0xFFC93C, 30); });
        break;
      }
      case 'boosterPlus': { const B = S._boosters[a[0]]; if (B) { S._float('+1', B.c.x, B.c.y - 14, 0x2FCC55); S._tween(0.4, (k) => B.c.scale.set(1 + 0.35 * Math.sin(Math.PI * k))); } break; }
      case 'recolor': { for (const car of S._cars) if (car.alive && car.color === a[0]) { car.color = a[1]; S._paintCar(car); S._flash(car.c.x, car.c.y, COLOR_HEX[a[1]], 22); } break; }
      case 'gift': {
        const car = S._front(a[0]); if (!car) return;
        const g = uiIcon('gift', 22, '🎁'); g.x = car.c.x; g.y = car.c.y;
        S._scene.addChild(g);
        const to = Object.values(S._boosters)[0]?.c ?? { x: S._laneX[0], y: TRAY_Y };
        S._tween(0.7, (k) => { g.x = car.c.x + (to.x - car.c.x) * k; g.y = car.c.y + (to.y - car.c.y) * k - 30 * Math.sin(Math.PI * k); }, () => { g.destroy(); S._float('+1', to.x, to.y - 14, 0x2FCC55); });
        break;
      }
      case 'goalTick': S._goalTick(); break;
      default: break;
    }
  }

  _goalTick() {
    const G = this._goal; if (!G) return;
    G.done = Math.min(G.n, G.done + 1);
    G.txt.text = `${G.done}/${G.n}`;
    this._tween(0.3, (k) => G.c.scale.set(0.9 + 0.3 * Math.sin(Math.PI * k)));
  }

  // ── Frame ──────────────────────────────────────────────────────────────────
  update(dt) {
    if (this._dismissed || !this._container) return false;
    this._t += dt;
    if (this._in < 1) {
      this._in = Math.min(1, this._in + dt / 0.22);
      const e = 1 - Math.pow(1 - this._in, 3);
      this._container.alpha = e;
      this._card.scale.set(0.7 + 0.3 * e + (this._in < 0.6 ? (0.6 - this._in) * 0.12 : 0));
    }
    const S = this._def.scene;
    this._loopT += dt;
    if (this._loopT >= (S.loop ?? 4) + 0.6) { this._build(); return true; }
    for (const step of S.steps ?? []) {
      if (this._fired.has(step)) continue;
      if (this._loopT >= step[0]) { this._fired.add(step); this._run(step); }
    }
    this._fxList = [];
    for (let i = this._tweens.length - 1; i >= 0; i--) {
      const tw = this._tweens[i];
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.fn(k);
      if (k >= 1) { this._tweens.splice(i, 1); tw.done?.(); }
    }
    // Beams, hints, drag band, fx.
    this._beams.clear(); this._hints.clear(); this._fx.clear();
    for (const br of this._bridges) {
      if (!br.a.alive || !br.b.alive) continue;
      const ix = (br.b.c.x - br.a.c.x) * 0.2;
      drawBeam(this._beams, br.a.c.x + ix, br.a.c.y, br.b.c.x - ix, br.b.c.y, { alpha: 0.9 + 0.1 * Math.sin(this._t * 5), h: 9 });
    }
    // Hints on every side-by-side same-colour pair that is not bridged (the board's own LINK dots).
    for (const a of this._cars) for (const b of this._cars) {
      if (!a.alive || !b.alive || b.lane !== a.lane + 1 || a.color !== b.color || Math.abs(a.row - b.row) > 0.01) continue;
      if (this._bridges.some(br => (br.a === a && br.b === b) || (br.a === b && br.b === a))) continue;
      if (this._dragging && (this._dragging.a === a || this._dragging.a === b)) continue;
      drawDots(this._hints, a.c.x, a.c.y, b.c.x, b.c.y, this._t);
    }
    if (this._dragging) {
      const d = this._dragging;
      const hx = this._hand.x, hy = this._hand.y - 8;
      this._fx.moveTo(d.a.c.x, d.a.c.y).lineTo(hx, hy).stroke({ color: INK, width: 6, alpha: 0.5 });
      this._fx.moveTo(d.a.c.x, d.a.c.y).lineTo(hx, hy).stroke({ color: d.k > 0.85 ? 0x2FCC55 : 0xFFFFFF, width: 3 });
      this._fx.circle(d.a.c.x, d.a.c.y, 20).stroke({ color: 0xFFC93C, width: 3 });
      if (d.k > 0.85) this._fx.circle(d.b.c.x, d.b.c.y, 22).stroke({ color: 0x2FCC55, width: 3 });
    }
    for (const f of this._fxList) {
      if (f.kind === 'flash') this._fx.circle(f.x, f.y, f.r).stroke({ color: f.color, width: 5 * f.a, alpha: f.a }).circle(f.x, f.y, f.r * 0.5).fill({ color: 0xFFFFFF, alpha: 0.5 * f.a });
      if (f.kind === 'snap') {
        const mx = (f.x1 + f.x2) / 2, my = (f.y1 + f.y2) / 2, drop = 30 * f.k * f.k, al = 1 - f.k;
        drawBeam(this._fx, f.x1 + (mx - f.x1) * 0.2, f.y1 + drop, mx - 4, my + drop + 6 * f.k, { alpha: al, tilt: -0.3 * f.k, h: 9 });
        drawBeam(this._fx, mx + 4, my + drop + 6 * f.k, f.x2 - (f.x2 - mx) * 0.2, f.y2 + drop, { alpha: al, tilt: 0.3 * f.k, h: 9 });
      }
    }
    // Rings on charged bombs pulse.
    for (const b of this._bombs) if (b.ring.visible) b.ring.scale.set(1 + 0.08 * Math.sin(this._t * 8));
    return true;
  }

  _dismiss() { if (!this._dismissed) this._destroy(); }
  _destroy() {
    this._dismissed = true;
    this._container?.destroy({ children: true });
    this._container = null;
    this._onDismiss?.();
    this._onDismiss = null;
  }
}
