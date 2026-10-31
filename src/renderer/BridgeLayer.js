// BridgeLayer — the 2D moments of BRIDGES (src/game/bridges.js), drawn on the Pixi particle layer
// over the 3D road and re-laid EVERY FRAME from where the cars are actually drawn (`posOf(lane,
// car)` reads the 3D group's glide position; see GameRenderer3D.carScreenPos). The bridge ITSELF is
// not drawn here: Car3D.setPairs draws a bridged pair as ONE baked vehicle (the two cars coupled by
// a yellow clamp, pair-*.png). Owner, 2026-10-31: no marker sits on two cars before they are linked
// ("it should just be two cars"); nothing is layered over the cars. This layer adds only moments:
//   • Aligned: a pair just BECAME linkable (a speeder caught up with its neighbour, a refill landed
//     beside its twin, a hit cleared the armour): one short pulse on both cars, then nothing.
//   • The drag: a rubber band from the held car to the finger; green over the partner, which gets a
//     pulsing ring (the only time a partner is marked).
//   • Dropped: a small gold ring on each car as the drag lands (the cars start sliding together).
//   • Joined: a ring of sparks at the seam the moment the two cars become the pair sprite.
//   • Snap: a white crack at the seam while the cars slide apart (a speeder moved on, a chameleon
//     flipped, a car crashed).
//   • Blast: a white flash across the pair the hit ran through.
import { Container, Graphics } from 'pixi.js';
import { getLaneScreenX } from './PositionRegistry.js';
import { posToScreenY } from './roadGeometry.js';
import { eligiblePairs } from '../game/bridges.js';

const GOLD = 0xFFC93C, INK = 0x1B1333, WHITE = 0xFFFFFF, GREEN = 0x2FCC55;
const ALIGN_T = 0.6;
const ALIGN_GRACE = 0.6;   // seconds after a reset during which new pairs are the opening board, not news
const DROP_T = 0.3;
const JOIN_T = 0.45;
const SNAP_T = 0.5;
const BLAST_T = 0.28;

export class BridgeLayer {
  constructor(layer, { posOf = null } = {}) {
    this._root = new Container();
    layer.addChild(this._root);
    this._fx = new Graphics();
    this._band = new Graphics();
    this._root.addChild(this._fx, this._band);
    this._posOf = posOf;
    this._last = new Map();    // car -> last known {x, y} (for a car that just left the board)
    this._drag = null;
    this._known = new Set();   // left cars of the pairs that were eligible last frame
    this._since = 0;           // seconds since reset (ALIGN_GRACE)
    this._aligns = [];         // { a, b, t }
    this._drops = [];          // { a, b, t }
    this._joins = [];          // { a, b, t }
    this._snaps = [];          // { a, b, t }
    this._blasts = [];         // { x1, y1, x2, y2, t }
    this._t = 0;
  }

  setVisible(v) { this._root.visible = v; }
  reset() {
    this._last.clear(); this._drag = null; this._known.clear(); this._since = 0;
    this._aligns.length = 0; this._drops.length = 0; this._joins.length = 0; this._snaps.length = 0; this._blasts.length = 0;
  }
  setDrag(info) { this._drag = info; }

  /** The drag landed (GameLoop.addBridge said yes); the cars start sliding together. */
  onMade(laneA, carA, laneB, carB) { this._drops.push({ a: { lane: laneA, car: carA }, b: { lane: laneB, car: carB }, t: 0 }); }
  /** The two cars just became the pair sprite (Car3D.onPairJoined). */
  onJoined(laneA, carA, laneB, carB) { this._joins.push({ a: { lane: laneA, car: carA }, b: { lane: laneB, car: carB }, t: 0 }); }
  onSnap(bridges) { for (const br of bridges) this._snaps.push({ a: br.a, b: br.b, t: 0 }); }

  // The hit on the car at (laneIdx, srcPos) ran along the bridge to each of `hits`: flash the way.
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

  // The seam of a pair: the lane line between the two lanes, at the cars' drawn height.
  _seam(a, b) {
    const pa = this._pos(a.lane, a.car), pb = this._pos(b.lane, b.car);
    return { x: (getLaneScreenX(a.lane) + getLaneScreenX(b.lane)) / 2, y: (pa.y + pb.y) / 2 };
  }

  update(dt, gs) {
    this._t += dt; this._since += dt;
    const fx = this._fx, band = this._band;
    fx.clear(); band.clear();
    if (!gs || !gs.bridgesEnabled || gs.isOver) { this._known.clear(); return; }

    // Aligned: a pair that was not linkable last frame and is now. The opening board is not news.
    const now = new Set();
    for (const p of eligiblePairs(gs.lanes, gs.activeLaneCount, gs.bridges)) {
      now.add(p.a.car);
      if (!this._known.has(p.a.car) && this._since > ALIGN_GRACE) this._aligns.push({ a: p.a, b: p.b, t: 0 });
    }
    this._known = now;
    for (let i = this._aligns.length - 1; i >= 0; i--) {
      const al = this._aligns[i]; al.t += dt;
      const k = al.t / ALIGN_T;
      if (k >= 1) { this._aligns.splice(i, 1); continue; }
      const a = this._pos(al.a.lane, al.a.car), b = this._pos(al.b.lane, al.b.car);
      const r = 14 + 26 * k, w = 4 * (1 - k), alpha = 0.9 * (1 - k);
      for (const p of [a, b]) fx.circle(p.x, p.y, r).stroke({ color: WHITE, width: w, alpha });
      if (k < 0.5) fx.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: WHITE, width: 3, alpha: 0.7 * (1 - k * 2) });
    }

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

    // Dropped: a gold ring on each car as they start to slide together.
    for (let i = this._drops.length - 1; i >= 0; i--) {
      const d = this._drops[i]; d.t += dt;
      const k = d.t / DROP_T;
      if (k >= 1) { this._drops.splice(i, 1); continue; }
      for (const q of [d.a, d.b]) { const p = this._pos(q.lane, q.car); fx.circle(p.x, p.y, 16 + 10 * k).stroke({ color: GOLD, width: 3 * (1 - k), alpha: 1 - k }); }
    }
    // Joined: a ring of sparks at the seam.
    for (let i = this._joins.length - 1; i >= 0; i--) {
      const m = this._joins[i]; m.t += dt;
      const k = m.t / JOIN_T;
      if (k >= 1) { this._joins.splice(i, 1); continue; }
      const s = this._seam(m.a, m.b);
      fx.circle(s.x, s.y, 8 + 34 * k).stroke({ color: GOLD, width: 4 * (1 - k), alpha: 1 - k });
      for (let j = 0; j < 8; j++) {
        const ang = j * Math.PI / 4 + k * 2;
        fx.circle(s.x + Math.cos(ang) * (10 + 30 * k), s.y + Math.sin(ang) * (10 + 30 * k), 3 * (1 - k)).fill({ color: WHITE, alpha: 1 - k });
      }
    }
    // Snap: a crack at the seam while the cars slide apart.
    for (let i = this._snaps.length - 1; i >= 0; i--) {
      const s = this._snaps[i]; s.t += dt;
      const k = s.t / SNAP_T;
      if (k >= 1) { this._snaps.splice(i, 1); continue; }
      const m = this._seam(s.a, s.b);
      const c = 1 - k;
      fx.moveTo(m.x - 6, m.y - 18).lineTo(m.x + 5, m.y - 4).lineTo(m.x - 5, m.y + 4).lineTo(m.x + 6, m.y + 18).stroke({ color: WHITE, width: 4 * c + 1, alpha: c });
      for (let j = 0; j < 6; j++) {
        const ang = -Math.PI / 2 + (j - 2.5) * 0.5, r = 10 + 26 * k;
        fx.circle(m.x + Math.cos(ang) * r, m.y + Math.sin(ang) * r * 0.6, 2.5 * c).fill({ color: WHITE, alpha: c });
      }
    }
    // Blast: a flash across the pair.
    for (let i = this._blasts.length - 1; i >= 0; i--) {
      const b = this._blasts[i]; b.t += dt;
      const k = b.t / BLAST_T;
      if (k >= 1) { this._blasts.splice(i, 1); continue; }
      fx.moveTo(b.x1, b.y1).lineTo(b.x2, b.y2).stroke({ color: WHITE, width: 14 * (1 - k), alpha: 0.9 * (1 - k) });
    }
  }
}
