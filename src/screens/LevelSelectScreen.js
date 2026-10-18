// LevelSelectScreen — the world map (premium pass, 2026-09-28).
//
// One page per game world (15 / 15 / 10 levels, levelMapLayout.js). Each page is
// a baked 3D diorama (scripts/render-3d-sprites.mjs map) with the road running
// through the level nodes; the city-repair building for every level stands on
// its plot beside the road — rubble until the level is beaten, repaired after
// (VISION: City Repair meta loop, persisted in ProgressManager cityState).
//
// Tapping an unlocked node calls onSelectLevel(levelId) — the level card
// (PreLevelScreen) is the one popup; the old in-map popup is gone.
import { Container, Graphics, Sprite, Assets, FillGradient } from 'pixi.js';
import { uiIcon } from '../renderer/UIIcon.js';
import { ribbon, roundButton, titleText, bodyText, GOLD, GOLD_DEEP } from '../renderer/PremiumUI.js';
import { INK, WHITE, shade, tint } from '../renderer/ToyStyle.js';
import { MAP_WORLDS, mapNodes, mapRoadPath, worldForLevel } from './levelMapLayout.js';
import { LEVEL_COUNT, levelDifficulty } from '../game/LevelManager.js';

const _B = import.meta.env.BASE_URL;
const NODE_R = 27;
const CAR_SPRITE = 'sprites/designed/car-orange-processed.png';   // "your car" on the map
const CAR_LEN = 42;          // px, nose to tail
const PARK_UP = NODE_R + 30; // the car waits ABOVE its node, nose down at it (where the arrow was)
const DRIVE_SPEED = 230;     // px/s along the road
const DRIVE_DELAY = 0.55;    // s: let the repaired building pop first
const HOP = 0.22;            // s to hop down onto the road / back up above the new node
const ARRIVE_HOLD = 0.35;    // s on the new node before its level card opens

// Walk a polyline: total length, and the point + heading at distance d.
function polyLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
function polyAt(pts, d) {
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const seg = Math.hypot(x1 - x0, y1 - y0);
    if (d <= seg || i === pts.length - 1) {
      const t = seg > 0 ? Math.min(1, Math.max(0, d / seg)) : 0;
      return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, a: Math.atan2(y1 - y0, x1 - x0) };
    }
    d -= seg;
  }
  const [x, y] = pts[pts.length - 1];
  return { x, y, a: 0 };
}
// Index of the road point nearest a node (nodes sit exactly on the baked road).
function nearestIdx(pts, x, y) {
  let best = 0, bd = Infinity;
  pts.forEach(([px, py], i) => { const d = (px - x) ** 2 + (py - y) ** 2; if (d < bd) { bd = d; best = i; } });
  return best;
}
// The road from the start of the page up to a node.
function roadTo(page, levelId) {
  const pts = mapRoadPath(page), n = mapNodes(page).find(k => k.levelId === levelId);
  if (!n) return null;
  return pts.slice(0, nearestIdx(pts, n.x, n.y) + 1);
}
const ACCENT = { world1: 0x2F7FE0, world2: 0xF08A24, world3: 0x8B4FE0,
  world4: 0xE0A02F, world5: 0x3FB6D8, world6: 0xE0584F, world7: 0x5A5AE0 };

const _faceGrads = new Map();
function faceGrad(color) {
  let g = _faceGrads.get(color);
  if (!g) {
    g = new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local',
      colorStops: [{ offset: 0, color: tint(color, 0.35) }, { offset: 0.6, color }, { offset: 1, color: shade(color, 0.75) }] });
    _faceGrads.set(color, g);
  }
  return g;
}

function sprite(path, w = null) {
  const tex = Assets.get(`${_B}${path}`);
  if (!tex) return null;
  const s = new Sprite(tex);
  s.anchor.set(0.5);
  if (w) s.scale.set(w / tex.width);
  return s;
}

export class LevelSelectScreen {
  constructor(stage, appW, appH, progress,
    { onSelectLevel, onBack, onShop, onAchievements, audio, weeklyLevels = [], cityAnim = null, drive = null, onArrive = null }) {
    this._container = new Container();
    stage.addChild(this._container);
    this._appW = appW;
    this._appH = appH;
    this._progress = progress;
    this._weeklyLevels = weeklyLevels;
    this._callbacks = { onSelectLevel, onBack, onShop, onAchievements, audio };
    this._cityAnim = cityAnim;
    this._t = 0;
    this._current = null;       // { node, marker } of the next level to play
    this._repairAnims = [];
    const unlocked = progress.unlockedLevel ?? 1;
    // A drive starts on the page of the level just won (its building repairs there too).
    const focus = drive ? drive.from
      : (cityAnim && typeof cityAnim.building === 'number') ? cityAnim.building : Math.min(LEVEL_COUNT, unlocked);
    this._page = worldForLevel(focus).page;
    this._drive = null;
    this._onArrive = onArrive;
    if (drive && drive.to <= LEVEL_COUNT) this._planDrive(drive.from, drive.to);
    this._build();
  }

  // ── Your car ────────────────────────────────────────────────────────────────

  // Legs of the drive, one per map page: [{ page, pts }]. Same page: node to node along
  // the road. Next world: out along this page's road, then in along the next page's.
  _planDrive(from, to) {
    const pf = worldForLevel(from).page, pt = worldForLevel(to).page;
    const legs = [];
    const a = mapNodes(pf).find(n => n.levelId === from), b = mapNodes(pt).find(n => n.levelId === to);
    if (pf === pt) {
      const pts = mapRoadPath(pf);
      const ia = nearestIdx(pts, a.x, a.y), ib = nearestIdx(pts, b.x, b.y);
      legs.push({ page: pf, pts: pts.slice(ia, ib + 1) });
    } else {
      // Out along this world's road, then in along the next world's from its lead-in.
      const outPts = mapRoadPath(pf);
      legs.push({ page: pf, pts: outPts.slice(nearestIdx(outPts, a.x, a.y)) });
      legs.push({ page: pt, pts: roadTo(pt, to) });
    }
    for (const l of legs) l.len = polyLen(l.pts);
    this._drive = {
      legs, leg: 0, d: 0, t: 0, done: false, hold: 0, to,
      startUp: { x: a.x, y: a.y - PARK_UP }, endUp: { x: b.x, y: b.y - PARK_UP },
    };
  }

  _makeCar() {
    const c = new Container();
    const sh = new Graphics();
    sh.ellipse(2, 4, CAR_LEN * 0.36, CAR_LEN * 0.52).fill({ color: 0x000000, alpha: 0.3 });
    c.addChild(sh);
    const tex = Assets.get(`${_B}${CAR_SPRITE}`);
    if (tex) {
      const s = new Sprite(tex);
      s.anchor.set(0.5);
      s.scale.set(CAR_LEN / tex.height);
      c.addChild(s);
    } else {
      Assets.load(`${_B}${CAR_SPRITE}`).then(t => {
        if (c.destroyed) return;
        const s = new Sprite(t); s.anchor.set(0.5); s.scale.set(CAR_LEN / t.height); c.addChild(s);
      }).catch(() => {});
    }
    this._container.addChild(c);
    return c;
  }

  // Sprite noses point down the screen (+y), so heading a -> rotation a - 90deg.
  _placeCar(p) { if (!this._car || this._car.destroyed) return; this._car.x = p.x; this._car.y = p.y; this._car.rotation = p.a - Math.PI / 2; }
  // Parked above a node, nose down at it (rotation 0), with the old arrow's bob.
  _parkCar(x, y) { if (!this._car || this._car.destroyed) return; this._car.x = x; this._car.y = y - 6 * Math.abs(Math.sin(this._t * 3.2)); this._car.rotation = 0; }

  /** Finish the drive at once (a tap on the map while it plays). */
  _skipDrive() {
    const D = this._drive;
    if (!D || D.done) return;
    const last = D.legs[D.legs.length - 1];
    if (this._page !== last.page) { D.leg = D.legs.length - 1; this._switch(last.page, true); }
    D.leg = D.legs.length - 1; D.d = last.len; D.t = DRIVE_DELAY + HOP; D.upT = HOP;
  }

  _updateDrive(dt) {
    const D = this._drive;
    if (!D || D.done || !this._car || this._car.destroyed) return;
    D.t += dt;
    if (D.t < DRIVE_DELAY) { this._parkCar(D.startUp.x, D.startUp.y); return; }
    const leg = D.legs[D.leg];
    if (D.leg === 0 && D.t < DRIVE_DELAY + HOP) {       // hop down from above the node onto the road
      const k = (D.t - DRIVE_DELAY) / HOP, e = k * k * (3 - 2 * k);
      const p = polyAt(leg.pts, 0);
      this._car.x = D.startUp.x + (p.x - D.startUp.x) * e;
      this._car.y = D.startUp.y + (p.y - D.startUp.y) * e - Math.sin(Math.PI * k) * 10;
      this._car.rotation = (p.a - Math.PI / 2) * e;
      return;
    }
    if (D.d < leg.len) {
      D.d = Math.min(leg.len, D.d + DRIVE_SPEED * dt);
      const p = polyAt(leg.pts, D.d);
      this._placeCar(p);
      if (this._car) this._car.scale.set(1 + 0.04 * Math.sin(this._t * 22));   // a little engine wobble
      return;
    }
    if (D.leg < D.legs.length - 1) {          // next world: switch page, drive in from its lead-in
      D.leg++;
      D.d = 0;
      this._switch(D.legs[D.leg].page, true);
      return;
    }
    this._car.scale.set(1);
    // hop back up above the new node, nose down at it
    D.upT = Math.min(HOP, (D.upT ?? 0) + dt);
    {
      const k = D.upT / HOP, e = k * k * (3 - 2 * k), p = polyAt(leg.pts, leg.len);
      this._car.x = p.x + (D.endUp.x - p.x) * e;
      this._car.y = p.y + (D.endUp.y - p.y) * e - Math.sin(Math.PI * k) * 10;
      this._car.rotation = (p.a - Math.PI / 2) * (1 - e);
      if (k < 1) return;
    }
    D.hold += dt;
    this._parkCar(D.endUp.x, D.endUp.y);
    if (!D.arrived) {                         // the next node lights up as the car pulls in
      D.arrived = true;
      this._callbacks.audio?.play('button_tap');
      if (this._pendingNext) { this._showCurrent(this._pendingNext); this._pendingNext = null; }
    }
    if (D.hold >= ARRIVE_HOLD) {
      D.done = true;
      this._parked = { ...D.endUp };
      const cb = this._onArrive; this._onArrive = null;
      cb?.();
    }
  }

  destroy() { this._container.destroy({ children: true }); }

  update(dt) {
    if (this._container.destroyed) return;
    this._t += dt;
    this._updateDrive(dt);
    if (this._container.destroyed) return;   // the arrival callback may have closed the map
    if (this._parked && (!this._drive || this._drive.done)) this._parkCar(this._parked.x, this._parked.y);
    if (this._current) {
      const k = 0.5 + 0.5 * Math.sin(this._t * 4);
      this._current.node.scale.set(1 + 0.06 * k);
      this._current.ring.alpha = 0.35 + 0.5 * k;
      this._current.ring.scale.set(1 + 0.12 * k);
      this._current.marker.y = this._current.baseY - 6 * Math.abs(Math.sin(this._t * 3.2));
    }
    for (let i = this._repairAnims.length - 1; i >= 0; i--) {
      const a = this._repairAnims[i];
      a.t = Math.min(1, a.t + dt / 0.75);
      a.prior.alpha = Math.max(0, 1 - a.t / 0.4);
      const e = 1 - Math.pow(1 - a.t, 3);
      const ov = a.t < 0.7 ? Math.sin(a.t / 0.7 * Math.PI) * 0.22 : 0;
      a.next.scale.set(a.base * e * (1 + ov));
      a.next.alpha = Math.min(1, a.t * 3);
      if (a.t >= 1) { a.prior.destroy(); a.next.scale.set(a.base); this._repairAnims.splice(i, 1); }
    }
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  _build() {
    const w = this._appW, h = this._appH, p = this._progress;
    const world = MAP_WORLDS[this._page - 1];
    const unlocked = p.unlockedLevel ?? 1;
    const accent = ACCENT[world.theme];

    const bg = sprite(`sprites/designed/map-${world.theme}.png`);
    if (bg) { bg.anchor.set(0); bg.width = w; bg.height = h; this._container.addChild(bg); }
    else { const g = new Graphics(); g.rect(0, 0, w, h).fill(0x3A6B3A); this._container.addChild(g); }
    // Catch taps that miss a node (so nothing underneath reacts).
    bg && (bg.eventMode = 'static');

    const nodes = mapNodes(this._page);
    const city = p.getCityState();
    const anim = this._cityAnim;
    this._cityAnim = null;

    // Buildings first (behind nodes), in back-to-front order for overlap.
    for (const n of [...nodes].sort((a, b) => a.plotY - b.plotY)) {
      const bId = p.buildingForLevel(n.levelId);
      const state = city[String(bId)] ?? 0;
      const variant = n.levelId % 3;
      if (anim && anim.building === bId && anim.prior !== 2) {
        const prior = this._building(world.theme, anim.prior, variant, n);
        const next = this._building(world.theme, 2, variant, n);
        const base = next.scale.x;
        next.scale.set(0); next.alpha = 0;
        this._repairAnims.push({ prior, next, base, t: 0 });
        this._callbacks.audio?.play('coin_collect');
      } else {
        this._building(world.theme, state, variant, n);
      }
    }

    for (const n of nodes) {
      const stars = p.getStars(n.levelId);
      const open = n.levelId <= unlocked;
      const isNext = n.levelId === unlocked && stars === 0;
      this._node(n, { stars, open, isNext, accent, tier: levelDifficulty(n.levelId), weekly: this._weeklyLevels.includes(n.levelId) });
    }

    // Your car: driving (after a win), or parked above the level to play next — it is the
    // "play me" marker (it replaced the gold arrow).
    this._car = null;
    this._parked = null;
    const D = this._drive;
    if (D && !D.done) {
      this._car = this._makeCar();
      if (D.t < DRIVE_DELAY && D.leg === 0) this._parkCar(D.startUp.x, D.startUp.y);
      else this._placeCar(polyAt(D.legs[D.leg].pts, D.d));
      // The next node's "play me" ring waits for the car.
      if (this._current) { this._pendingNext = this._current; this._hideCurrent(this._current); this._current = null; }
      if (bg) bg.on('pointerdown', () => this._skipDrive());
    } else {
      const parkAt = Math.min(LEVEL_COUNT, unlocked);
      const n = nodes.find(k => k.levelId === parkAt);
      if (n) { this._car = this._makeCar(); this._parked = { x: n.x, y: n.y - PARK_UP }; this._parkCar(n.x, this._parked.y); }
    }

    this._header(world, accent);
  }

  _hideCurrent(cur) { cur.ring.visible = false; cur.marker.visible = false; }
  _showCurrent(cur) {
    cur.ring.visible = true; cur.marker.visible = true;
    this._current = cur;
    cur.node.scale.set(1.25);
  }

  _building(theme, state, variant, n) {
    const s = sprite(`sprites/designed/repair-${theme}-${state}-${variant}.png`, 150);
    if (!s) return new Container();
    s.x = n.plotX; s.y = n.plotY + 1;
    this._container.addChild(s);
    return s;
  }

  /** Screen position of a level's node on the current page (QA / dev hooks). */
  nodePosition(levelId) { return this._nodePos?.[levelId] ?? null; }

  _node(n, { stars, open, isNext, accent, tier, weekly }) {
    const hard = tier === 'hard', superhard = tier === 'superhard';
    (this._nodePos ??= {})[n.levelId] = { x: n.x, y: n.y };
    const node = new Container();
    node.x = n.x; node.y = n.y;
    const g = new Graphics();
    // Played = the world's accent, the one to play next = PLAY green (it pulses,
    // with the arrow), HARD = red, SUPER HARD = purple, locked = grey.
    const face = !open ? 0x77738F : superhard ? 0x8A3CE0 : hard ? 0xE8453C : stars > 0 ? accent : 0x3DBB3A;
    g.circle(2, 6, NODE_R + 4).fill({ color: 0x000000, alpha: 0.35 });
    g.circle(0, 3, NODE_R + 4).fill(open ? GOLD_DEEP : 0x4A475E);
    g.circle(0, 0, NODE_R + 4).fill(open ? faceGrad(GOLD) : faceGrad(0x9A97AE));
    g.circle(0, 0, NODE_R + 4).stroke({ color: INK, width: 3 });
    g.circle(0, 0, NODE_R - 1).fill(faceGrad(face));
    g.circle(0, 0, NODE_R - 1).stroke({ color: shade(face, 0.55), width: 2 });
    g.ellipse(0, -NODE_R * 0.45, NODE_R * 0.62, NODE_R * 0.3).fill({ color: WHITE, alpha: 0.3 });
    node.addChild(g);

    if (open) {
      const num = titleText(String(n.levelId), n.levelId >= 10 ? 22 : 24);
      num.y = 1;
      node.addChild(num);
    } else {
      const lock = new Graphics();
      lock.roundRect(-9, -3, 18, 14, 3).fill(0xE9E6F2).stroke({ color: INK, width: 2 });
      lock.moveTo(-6, -3).arc(0, -3, 6, Math.PI, 0).stroke({ color: INK, width: 5 });
      lock.moveTo(-6, -3).arc(0, -3, 6, Math.PI, 0).stroke({ color: 0xE9E6F2, width: 2.5 });
      node.addChild(lock);
    }

    // Corner badge on its own disc, so it reads as a badge rather than a sprite
    // colliding with the node ring.
    const badge = superhard ? ['skull', 18, '💀', 0x3A1060] : hard ? ['fire', 18, '🔥', 0x5A1010]
      : (weekly && open) ? ['star-filled', 17, '⭐', 0x2B2760] : null;
    if (badge) {
      const bx = NODE_R + 1, by = -NODE_R + 2;
      const bd = new Graphics();
      bd.circle(bx + 1, by + 2, 13).fill({ color: 0x000000, alpha: 0.3 });
      bd.circle(bx, by, 13).fill(badge[3]).stroke({ color: GOLD, width: 2.5 });
      node.addChild(bd);
      const ic = uiIcon(badge[0], badge[1], badge[2]);
      ic.x = bx; ic.y = by;
      node.addChild(ic);
    }

    // Stars plaque under completed levels.
    if (open && stars > 0) {
      const pl = new Graphics();
      pl.roundRect(-30, NODE_R - 2, 60, 20, 10).fill(0x1F1A33).stroke({ color: GOLD_DEEP, width: 2 });
      node.addChild(pl);
      for (let i = 0; i < 3; i++) {
        const st = uiIcon(i < stars ? 'star-filled' : 'star-empty', 17, i < stars ? '★' : '☆', i < stars ? {} : { tint: 0x4A4660 });
        st.x = -18 + i * 18; st.y = NODE_R + 8;
        node.addChild(st);
      }
    }

    if (open) {
      node.eventMode = 'static';
      node.cursor = 'pointer';
      node.hitArea = { contains: (x, y) => x * x + y * y <= (NODE_R + 10) * (NODE_R + 10) };
      node.on('pointerdown', () => node.scale.set(0.92));
      node.on('pointerupoutside', () => node.scale.set(1));
      node.on('pointerup', () => {
        node.scale.set(1);
        // Mid-drive, a tap just lands the car (its arrival opens the next level's card).
        if (this._drive && !this._drive.done) { this._skipDrive(); return; }
        this._callbacks.audio?.play('button_tap');
        this._callbacks.onSelectLevel?.(n.levelId);
      });
    }

    if (isNext) {
      const ring = new Graphics();
      ring.circle(0, 0, NODE_R + 12).stroke({ color: WHITE, width: 4 });
      ring.x = n.x; ring.y = n.y;
      this._container.addChild(ring);
      // "Play me": your car parks above the node (see _build); this marker is only the bob anchor.
      const marker = new Container();
      marker.x = n.x; marker.y = n.y - NODE_R - 30;
      this._container.addChild(node);
      this._container.addChild(marker);
      this._current = { node, ring, marker, baseY: marker.y };
    } else {
      this._container.addChild(node);
    }
  }

  _header(world, accent) {
    const w = this._appW;
    const band = new Graphics();
    band.rect(0, 0, w, 96).fill(new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local',
      colorStops: [{ offset: 0, color: 0x17143A }, { offset: 1, color: 0x2B2760 }] }));
    band.rect(0, 94, w, 4).fill(GOLD_DEEP);
    band.rect(0, 98, w, 3).fill({ color: 0x000000, alpha: 0.25 });
    this._container.addChild(band);

    const rb = ribbon(world.name.toUpperCase(), 240, { size: 22, color: accent === ACCENT.world1 ? 0xE8453C : shade(accent, 0.95) });
    rb.x = w / 2; rb.y = 34;
    rb.scale.set(0.92);
    this._container.addChild(rb);

    const cb = this._callbacks;
    const back = roundButton(uiIcon('back', 20, '←'), { r: 20, color: 0x2F7FE0, onTap: () => { cb.audio?.play('button_tap'); cb.onBack?.(); } });
    back.x = 28; back.y = 34;
    this._container.addChild(back);
    const shop = roundButton(uiIcon('coin', 26, '◆'), { r: 20, color: 0xF0A020, onTap: () => { cb.audio?.play('button_tap'); cb.onShop?.(); } });
    shop.x = w - 28; shop.y = 34;
    this._container.addChild(shop);

    // Row 2: coins · world dots / arrows · trophies.
    const pill = new Graphics();
    pill.roundRect(12, 62, 86, 26, 13).fill(0x14112F).stroke({ color: GOLD_DEEP, width: 2 });
    this._container.addChild(pill);
    const coin = uiIcon('coin', 22, '◆'); coin.x = 26; coin.y = 75;
    this._container.addChild(coin);
    const coins = bodyText(String(this._progress.coins ?? 0), 15, 0xFFE08A);
    coins.anchor.set(0, 0.5); coins.x = 42; coins.y = 75;
    this._container.addChild(coins);

    // Page counter centred between the arrows ("8 / 14"). A dot per world stopped fitting:
    // seven dots already ran under the next arrow, fourteen ran off the screen.
    const cx = w / 2;
    const counter = new Graphics();
    counter.roundRect(cx - 34, 62, 68, 26, 13).fill(0x14112F).stroke({ color: GOLD_DEEP, width: 2 });
    this._container.addChild(counter);
    const pageText = bodyText(`${this._page} / ${MAP_WORLDS.length}`, 15, 0xFFE08A);
    pageText.anchor.set(0.5); pageText.x = cx; pageText.y = 75;
    this._container.addChild(pageText);
    if (this._page > 1) {
      const prev = roundButton(uiIcon('back', 16, '◀'), { r: 14, color: 0x3A3662, onTap: () => this._switch(this._page - 1) });
      prev.x = cx - 58; prev.y = 75;
      this._container.addChild(prev);
    }
    if (this._page < MAP_WORLDS.length) {
      const next = roundButton(uiIcon('back', 16, '▶', { flipX: true }), { r: 14, color: 0x3A3662, onTap: () => this._switch(this._page + 1) });
      next.x = cx + 58; next.y = 75;
      this._container.addChild(next);
    }
    if (cb.onAchievements) {
      const tr = roundButton(uiIcon('trophy', 20, '🏆'), { r: 15, color: 0x8B4FE0, onTap: () => { cb.audio?.play('button_tap'); cb.onAchievements(); } });
      tr.x = w - 28; tr.y = 75;
      this._container.addChild(tr);
    }
  }

  _switch(page, quiet = false) {
    if (!quiet) this._callbacks.audio?.play('button_tap');
    // Paging by hand mid-drive just lands the car.
    if (!quiet && this._drive && !this._drive.done) this._skipDrive();
    this._page = page;
    this._pendingNext = null;
    this._container.removeChildren().forEach(c => c.destroy({ children: true }));
    this._current = null;
    this._repairAnims = [];
    this._build();
  }
}
