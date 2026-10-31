// BridgeLayer — everything the player sees of BRIDGES (src/game/bridges.js), drawn on the Pixi
// particle layer over the 3D road and re-laid EVERY FRAME from where the cars are actually drawn
// (`posOf(lane, car)` reads the 3D group's glide position; see GameRenderer3D.carScreenPos), so a
// bridge is one plank lying across the two roofs that moves with them (owner, 2026-10-31: "a
// single bridge that connects the two cars and moves with them").
//   • LINK hint: a dotted link with a small LINK pill between every pair that could be bridged
//     right now (the board explaining itself; always on, not only the first times).
//   • The bridge: one gold plank from roof to roof with rungs, ink outline, soft pulse.
//   • The drag: a rubber band from the held car to the finger; solid green on the partner.
//   • Made: a ring of sparks at the middle of the new plank.
//   • Snap: the plank cracks in the middle; each half stays on its own car and swings down off
//     the roof, fading (a speeder moved on, a chameleon flipped, a car crashed).
//   • Blast: a white flash along the plank the hit ran through.
import { Container, Graphics } from 'pixi.js';
import { getLaneScreenX } from './PositionRegistry.js';
import { posToScreenY } from './roadGeometry.js';
import { tag } from './PremiumUI.js';
import { eligiblePairs } from '../game/bridges.js';

const GOLD = 0xFFC93C, GOLD_DEEP = 0xB8860B, GOLD_LIGHT = 0xFFE9A0, INK = 0x1B1333, WHITE = 0xFFFFFF, GREEN = 0x2FCC55;
const BEAM_H = 16;
const SNAP_T = 0.55;
const MADE_T = 0.45;
const BLAST_T = 0.28;

export class BridgeLayer {
  constructor(layer, { posOf = null } = {}) {
    this._root = new Container();
    layer.addChild(this._root);
    this._hints = new Graphics();
    this._beams = new Graphics();
    this._fx = new Graphics();
    this._band = new Graphics();
    this._root.addChild(this._hints, this._beams, this._fx, this._band);
    this._posOf = posOf;
    this._pills = [];
    this._last = new Map();    // car -> last known {x, y} (for a car that just left the board)
    this._drag = null;
    this._snaps = [];          // { a: {lane, car}, b: {lane, car}, t }
    this._made = [];           // { x, y, t }
    this._blasts = [];         // { x1, y1, x2, y2, t }
    this._t = 0;
  }

  setVisible(v) { this._root.visible = v; }
  reset() { this._last.clear(); this._drag = null; this._snaps.length = 0; this._made.length = 0; this._blasts.length = 0; }
  setDrag(info) { this._drag = info; }

  onMade(laneA, carA, laneB, carB) {
    const a = this._pos(laneA, carA), b = this._pos(laneB, carB);
    this._made.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, t: 0 });
  }

  onSnap(bridges) {
    for (const br of bridges) this._snaps.push({ a: br.a, b: br.b, t: 0 });
  }

  // The hit on the car at (laneIdx, srcPos) ran along the bridges to each of `hits`: flash the way.
  onBlast(hits, laneIdx, srcPos) {
    const from = { x: getLaneScreenX(laneIdx), y: posToScreenY(srcPos) };
    for (const h of hits) {
      const to = this._pos(h.lane, h.car);
      this._blasts.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y, t: 0 });
    }
  }

  // Where the car is drawn now (3D glide included); falls back to its logical row, then to the
  // last place it was seen (a car that just left the board, mid-snap).
  _pos(lane, car) {
    let p = this._posOf?.(lane, car) ?? null;
    if (!p && car && Number.isFinite(car.position)) p = { x: getLaneScreenX(lane), y: posToScreenY(car.position) };
    if (p) { this._last.set(car, p); return p; }
    return this._last.get(car) ?? { x: getLaneScreenX(lane), y: posToScreenY(50) };
  }

  update(dt, gs) {
    this._t += dt;
    const hints = this._hints, beams = this._beams, fx = this._fx, band = this._band;
    hints.clear(); beams.clear(); fx.clear(); band.clear();
    let pillsUsed = 0;
    if (!gs || !gs.bridgesEnabled || gs.isOver) { this._recyclePills(0); return; }

    // Bridges: one plank per bridge, roof to roof.
    for (const br of gs.bridges) {
      const a = this._pos(br.a.lane, br.a.car), b = this._pos(br.b.lane, br.b.car);
      drawBeam(beams, a.x, a.y, b.x, b.y, { alpha: 0.92 + 0.08 * Math.sin(this._t * 5), h: BEAM_H });
    }

    // Hints: dotted links with a LINK pill, for pairs not yet bridged (and not the pair in hand).
    const dragging = this._drag?.from?.car ?? null;
    for (const p of eligiblePairs(gs.lanes, gs.activeLaneCount)) {
      if (gs.bridges.some(br => br.a.car === p.a.car && br.b.car === p.b.car)) continue;
      if (dragging && (p.a.car === dragging || p.b.car === dragging)) continue;
      const a = this._pos(p.a.lane, p.a.car), b = this._pos(p.b.lane, p.b.car);
      drawDots(hints, a.x, a.y, b.x, b.y, this._t);
      const pl = this._pill(pillsUsed++);
      pl.x = (a.x + b.x) / 2; pl.y = (a.y + b.y) / 2;
      pl.alpha = 0.75 + 0.25 * Math.sin(this._t * 4);
      pl.scale.set(1 + 0.05 * Math.sin(this._t * 4));
    }
    this._recyclePills(pillsUsed);

    // Drag: the rubber band.
    if (this._drag) {
      const { from, to, pointer } = this._drag;
      const a = this._pos(from.lane, from.car);
      const end = to ? this._pos(to.lane, to.car) : pointer;
      band.moveTo(a.x, a.y).lineTo(end.x, end.y).stroke({ color: INK, width: 10, alpha: 0.5 });
      band.moveTo(a.x, a.y).lineTo(end.x, end.y).stroke({ color: to ? GREEN : WHITE, width: 5, alpha: to ? 1 : 0.85 });
      band.circle(a.x, a.y, 16).stroke({ color: GOLD, width: 3 });
      if (to) band.circle(end.x, end.y, 18 + 2 * Math.sin(this._t * 10)).stroke({ color: GREEN, width: 4 });
    }

    // Made: a ring of sparks.
    for (let i = this._made.length - 1; i >= 0; i--) {
      const m = this._made[i]; m.t += dt;
      const k = m.t / MADE_T;
      if (k >= 1) { this._made.splice(i, 1); continue; }
      fx.circle(m.x, m.y, 8 + 34 * k).stroke({ color: GOLD, width: 4 * (1 - k), alpha: 1 - k });
      for (let s = 0; s < 8; s++) {
        const ang = s * Math.PI / 4 + k * 2;
        fx.circle(m.x + Math.cos(ang) * (10 + 30 * k), m.y + Math.sin(ang) * (10 + 30 * k), 3 * (1 - k)).fill({ color: WHITE, alpha: 1 - k });
      }
    }
    // Snap: the plank cracks; each half stays on its car and swings down off the roof.
    for (let i = this._snaps.length - 1; i >= 0; i--) {
      const s = this._snaps[i]; s.t += dt;
      const k = s.t / SNAP_T;
      if (k >= 1) { this._snaps.splice(i, 1); continue; }
      const a = this._pos(s.a.lane, s.a.car), b = this._pos(s.b.lane, s.b.car);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const swing = 1.1 * k * k, al = 1 - k * k;
      drawBeam(fx, a.x, a.y, mx, my, { alpha: al, h: BEAM_H, hinge: 'start', tilt: swing });
      drawBeam(fx, b.x, b.y, mx, my, { alpha: al, h: BEAM_H, hinge: 'start', tilt: -swing });
      if (k < 0.3) {
        const c = 1 - k / 0.3;
        fx.moveTo(mx - 5, my - 14).lineTo(mx + 4, my - 3).lineTo(mx - 4, my + 3).lineTo(mx + 5, my + 14).stroke({ color: WHITE, width: 3, alpha: c });
      }
    }
    // Blast: a flash along the plank.
    for (let i = this._blasts.length - 1; i >= 0; i--) {
      const b = this._blasts[i]; b.t += dt;
      const k = b.t / BLAST_T;
      if (k >= 1) { this._blasts.splice(i, 1); continue; }
      fx.moveTo(b.x1, b.y1).lineTo(b.x2, b.y2).stroke({ color: WHITE, width: 14 * (1 - k), alpha: 0.9 * (1 - k) });
    }
  }

  _pill(i) {
    let c = this._pills[i];
    if (!c) {
      c = tag('LINK', { color: 0x3A3F5C, size: 10 });   // PremiumUI capsule (CLAUDE.md: no hand-drawn pills)
      this._root.addChild(c);
      this._pills[i] = c;
    }
    c.visible = true;
    return c;
  }

  _recyclePills(used) {
    for (let i = used; i < this._pills.length; i++) this._pills[i].visible = false;
  }
}

// ── Shared drawing (the DemoCard scenes and the HowToPlay slide draw the same plank) ───────────

/**
 * One gold plank from (x1,y1) to (x2,y2): ink outline, two rails, three rungs, rounded ends that
 * sit on the roofs. `tilt` rotates it (radians) about its start when `hinge: 'start'`, else about
 * its middle; `alpha` fades it.
 */
export function drawBeam(g, x1, y1, x2, y2, { alpha = 1, tilt = 0, h: beamH = BEAM_H, hinge = 'middle' } = {}) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  if (len < 4) return;
  const ang = Math.atan2(dy, dx) + tilt;
  const ax = Math.cos(ang), ay = Math.sin(ang);          // along, after the tilt
  const nx = -ay, ny = ax;                                // normal
  // Where the plank starts after the tilt: hinged at its start, or rotated about its middle.
  let sx = x1, sy = y1;
  if (hinge !== 'start') { const mx = x1 + dx / 2, my = y1 + dy / 2; sx = mx - ax * len / 2; sy = my - ay * len / 2; }
  const h = beamH / 2;
  const P = (t, n) => [sx + ax * t + nx * n, sy + ay * t + ny * n];
  const line = (t0, t1, n, col, w) => { const [a, b] = P(t0, n), [c, d] = P(t1, n); g.moveTo(a, b).lineTo(c, d).stroke({ color: col, width: w, alpha, cap: 'round' }); };
  line(0, len, 0, INK, beamH + 5);                                   // outline
  line(0, len, 0, GOLD_DEEP, beamH);                                 // body
  line(2, len - 2, -h + 2.5, GOLD, Math.max(2.5, beamH * 0.3));      // top rail
  line(2, len - 2, h - 2.5, 0x9A6E05, Math.max(2.5, beamH * 0.3));   // bottom rail (shade)
  line(2, len - 2, 0, GOLD_LIGHT, Math.max(1.2, beamH * 0.12));      // highlight
  for (let i = 1; i <= 3; i++) {
    const t = (len * i) / 4;
    const [a, b] = P(t, -h + 1), [c, d] = P(t, h - 1);
    g.moveTo(a, b).lineTo(c, d).stroke({ color: INK, width: 3.5, alpha }).moveTo(a, b).lineTo(c, d).stroke({ color: GOLD_LIGHT, width: 1.5, alpha });
  }
}

/** Dotted hint link, dots flowing toward the middle from both ends (`time` drives the flow). */
export function drawDots(g, x1, y1, x2, y2, time = 0) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  if (len < 4) return;
  const n = Math.max(4, Math.floor(len / 14));
  const flow = (time * 0.9) % 1;
  for (let i = 0; i < n; i++) {
    let k = (i + flow) / n;                           // 0..1 along
    k = k < 0.5 ? k : 1 - k;                          // mirror: both ends flow to the middle
    for (const e of [k, 1 - k]) {
      g.circle(x1 + dx * e, y1 + dy * e, 2.6).fill({ color: INK, alpha: 0.5 });
      g.circle(x1 + dx * e, y1 + dy * e, 1.8).fill({ color: WHITE, alpha: 0.75 });
    }
  }
}
