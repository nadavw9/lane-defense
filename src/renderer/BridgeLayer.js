// BridgeLayer — everything the player sees of BRIDGES (src/game/bridges.js), drawn on the Pixi
// particle layer over the 3D road, repositioned every frame from the cars' positions:
//   • LINK hint: a dotted white link with a small LINK pill between every pair that could be
//     bridged right now (the board explaining itself; always on, not only the first times).
//   • The bridge: a gold beam (two rails, rungs) between the two cars, softly pulsing.
//   • The drag: a rubber band from the held car to the finger; solid green on the partner.
//   • Made: a ring of sparks at the middle of a new bridge.
//   • Snap: the beam cracks and its halves fall away (a speeder moved on, a chameleon flipped).
//   • Blast: a white flash along each bridge the hit ran through.
// Car screen positions: lane x from PositionRegistry, y from the car's position (roadGeometry),
// eased per car so the beam rides the 3D glide instead of jumping ahead of it.
import { Container, Graphics } from 'pixi.js';
import { getLaneScreenX } from './PositionRegistry.js';
import { posToScreenY } from './roadGeometry.js';
import { tag } from './PremiumUI.js';
import { eligiblePairs } from '../game/bridges.js';

const GOLD = 0xFFC93C, GOLD_DEEP = 0xB8860B, INK = 0x1B1333, WHITE = 0xFFFFFF, GREEN = 0x2FCC55;
const BEAM_H = 14;
const SNAP_T = 0.5;
const INSET  = 0.2;   // the beam starts inside each car body (fraction of the lane gap), not at its centre
const MADE_T = 0.45;
const BLAST_T = 0.28;
const GLIDE = 12;   // per-second easing toward the car's new row (Car3D glides over ~0.4 s)

export class BridgeLayer {
  constructor(layer) {
    this._root = new Container();
    layer.addChild(this._root);
    this._hints = new Graphics();
    this._beams = new Graphics();
    this._fx = new Graphics();
    this._band = new Graphics();
    this._root.addChild(this._hints, this._beams, this._fx, this._band);
    this._pills = [];          // LINK pills in use this frame
    this._pool = [];
    this._yOf = new Map();     // car -> eased screen y
    this._drag = null;
    this._snaps = [];          // { x1, y1, x2, y2, t }
    this._made = [];           // { x, y, t }
    this._blasts = [];         // { x1, y1, x2, y2, t }
    this._t = 0;
  }

  setVisible(v) { this._root.visible = v; }
  reset() { this._yOf.clear(); this._drag = null; this._snaps.length = 0; this._made.length = 0; this._blasts.length = 0; }

  setDrag(info) { this._drag = info; }

  onMade(laneA, carA, laneB, carB) {
    const a = this._pos(laneA, carA), b = this._pos(laneB, carB);
    this._made.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, t: 0 });
  }

  onSnap(bridges) {
    for (const br of bridges) {
      const a = this._pos(br.a.lane, br.a.car), b = this._pos(br.b.lane, br.b.car);
      this._snaps.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, t: 0 });
    }
  }

  // The hit on the car at (laneIdx, srcPos) ran along the bridges to each of `hits`: flash the way.
  onBlast(hits, laneIdx, srcPos) {
    const from = { x: getLaneScreenX(laneIdx), y: posToScreenY(srcPos) };
    for (const h of hits) {
      const to = this._pos(h.lane, h.car);
      this._blasts.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y, t: 0 });
    }
  }

  // Eased screen position of a car (lane x is exact; y glides toward the car's row).
  _pos(lane, car, dt = 0) {
    const target = posToScreenY(car.position);
    let y = this._yOf.get(car);
    if (y == null) y = target; else if (dt > 0) y += (target - y) * Math.min(1, dt * GLIDE); else y = target;
    this._yOf.set(car, y);
    return { x: getLaneScreenX(lane), y };
  }

  update(dt, gs) {
    this._t += dt;
    const hints = this._hints, beams = this._beams, fx = this._fx, band = this._band;
    hints.clear(); beams.clear(); fx.clear(); band.clear();
    let pillsUsed = 0;
    if (!gs || !gs.bridgesEnabled || gs.isOver) { this._recyclePills(0); return; }

    // Forget cars that left the board.
    const live = new Set();
    for (let l = 0; l < gs.activeLaneCount; l++) for (const c of gs.lanes[l].cars) live.add(c);
    for (const c of this._yOf.keys()) if (!live.has(c)) this._yOf.delete(c);

    // Bridges: gold beams.
    const bridged = new Set();
    for (const br of gs.bridges) {
      const a = this._pos(br.a.lane, br.a.car, dt), b = this._pos(br.b.lane, br.b.car, dt);
      bridged.add(br.a.car); bridged.add(br.b.car);
      const ix = (b.x - a.x) * INSET;
      this._beam(beams, a.x + ix, a.y, b.x - ix, b.y, 0.85 + 0.15 * Math.sin(this._t * 5));
    }

    // Hints: dotted links with a LINK pill, for pairs not yet bridged (and not the pair in hand).
    const dragging = this._drag?.from?.car ?? null;
    for (const p of eligiblePairs(gs.lanes, gs.activeLaneCount)) {
      if (gs.bridges.some(br => (br.a.car === p.a.car && br.b.car === p.b.car))) continue;
      if (dragging && (p.a.car === dragging || p.b.car === dragging)) continue;
      const a = this._pos(p.a.lane, p.a.car, dt), b = this._pos(p.b.lane, p.b.car, dt);
      this._dots(hints, a.x, a.y, b.x, b.y);
      const pl = this._pill(pillsUsed++);
      pl.x = (a.x + b.x) / 2; pl.y = (a.y + b.y) / 2;
      pl.alpha = 0.75 + 0.25 * Math.sin(this._t * 4);
      pl.scale.set(1 + 0.05 * Math.sin(this._t * 4));
    }
    this._recyclePills(pillsUsed);

    // Drag: the rubber band.
    if (this._drag) {
      const { from, to, pointer } = this._drag;
      const a = this._pos(from.lane, from.car, dt);
      const end = to ? this._pos(to.lane, to.car, dt) : pointer;
      band.moveTo(a.x, a.y).lineTo(end.x, end.y).stroke({ color: INK, width: 8, alpha: 0.5 });
      band.moveTo(a.x, a.y).lineTo(end.x, end.y).stroke({ color: to ? GREEN : WHITE, width: 4, alpha: to ? 1 : 0.8 });
      band.circle(a.x, a.y, 14).stroke({ color: GOLD, width: 3 });
      if (to) { band.circle(end.x, end.y, 16 + 2 * Math.sin(this._t * 10)).stroke({ color: GREEN, width: 4 }); }
    }

    // Effects.
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
    for (let i = this._snaps.length - 1; i >= 0; i--) {
      const s = this._snaps[i]; s.t += dt;
      const k = s.t / SNAP_T;
      if (k >= 1) { this._snaps.splice(i, 1); continue; }
      const mx = (s.x1 + s.x2) / 2, my = (s.y1 + s.y2) / 2, drop = 40 * k * k, al = 1 - k;
      this._beam(fx, s.x1, s.y1 + drop, mx - 6, my + drop + 8 * k, al, -0.25 * k);
      this._beam(fx, mx + 6, my + drop + 8 * k, s.x2, s.y2 + drop, al, 0.25 * k);
      fx.moveTo(mx - 4, my - 10).lineTo(mx + 3, my - 2).lineTo(mx - 3, my + 3).lineTo(mx + 4, my + 10).stroke({ color: WHITE, width: 2, alpha: al });
    }
    for (let i = this._blasts.length - 1; i >= 0; i--) {
      const b = this._blasts[i]; b.t += dt;
      const k = b.t / BLAST_T;
      if (k >= 1) { this._blasts.splice(i, 1); continue; }
      fx.moveTo(b.x1, b.y1).lineTo(b.x2, b.y2).stroke({ color: WHITE, width: 10 * (1 - k), alpha: 0.9 * (1 - k) });
    }
  }

  // A gold beam: ink shadow, two rails, three rungs. `tilt` (radians) for the falling halves.
  _beam(g, x1, y1, x2, y2, alpha = 1, tilt = 0) {
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    if (len < 4) return;
    const ux = dx / len, uy = dy / len;                 // along
    const ca = Math.cos(tilt), sa = Math.sin(tilt);
    const ax = ux * ca - uy * sa, ay = ux * sa + uy * ca;   // tilted along
    const nx = -ay, ny = ax;                            // normal
    const h = BEAM_H / 2;
    const P = (t, n) => [x1 + ax * t + nx * n, y1 + ay * t + ny * n];
    const rail = (n, col, w) => { const [sx, sy] = P(0, n), [ex, ey] = P(len, n); g.moveTo(sx, sy).lineTo(ex, ey).stroke({ color: col, width: w, alpha }); };
    rail(0, INK, BEAM_H + 4);
    rail(-h + 1, GOLD, 3.2); rail(h - 1, GOLD_DEEP, 3.2);
    rail(0, 0xFFE9A0, 1.6);
    for (let i = 1; i <= 3; i++) {
      const t = (len * i) / 4;
      const [sx, sy] = P(t, -h), [ex, ey] = P(t, h);
      g.moveTo(sx, sy).lineTo(ex, ey).stroke({ color: INK, width: 3, alpha }).moveTo(sx, sy).lineTo(ex, ey).stroke({ color: GOLD, width: 1.5, alpha });
    }
  }

  // Dotted hint link, dots flowing toward the middle from both ends.
  _dots(g, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    if (len < 4) return;
    const n = Math.max(4, Math.floor(len / 14));
    const flow = (this._t * 0.9) % 1;
    for (let i = 0; i < n; i++) {
      let k = (i + flow) / n;                           // 0..1 along
      k = k < 0.5 ? k : 1 - k;                          // mirror: both ends flow to the middle
      const ends = [k, 1 - k];
      for (const e of ends) {
        g.circle(x1 + dx * e, y1 + dy * e, 2.6).fill({ color: INK, alpha: 0.5 });
        g.circle(x1 + dx * e, y1 + dy * e, 1.8).fill({ color: WHITE, alpha: 0.75 });
      }
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
