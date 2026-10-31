// StepRuler — the step countdown beside the road (2026-10-18, owner request: "it is hard to
// count the steps to the red line").
//
// Redesigned 2026-10-19 (owner: a column of 13 numbers was "crowded and not understandable"):
// one small dot per step on the kerb left of the road, warming from green to red towards the
// line, and ONE glowing marker level with the most advanced car. The marker's NUMBER went on
// 2026-10-31 (owner: "the number at the side is not understood" — testers forward every
// explanation unread, so the board may only say things that need no reading): the marker is now
// a plain dot whose colour, like the dots', says how close the nearest car is. `nearestMovesLeft`
// still drives its colour and position. It sits OUTSIDE the road, so the Pixi layer (which draws
// over the 3D cars) never covers a car. The road carries the matching faint step lines (StepGrid3D).
import { Container, Graphics } from 'pixi.js';
import { INK, WHITE } from './ToyStyle.js';
import { getLaneScreenBounds } from './PositionRegistry.js';
import { posToScreenYProjected } from '../renderer3d/projection.js';

const R = 8.5;
const colorFor = (left) => left <= 2 ? 0xFF3D3D : left <= 4 ? 0xFF8A1C : left <= 8 ? 0xFFC93C : 0x2FCC55;

/**
 * Moves the most advanced visible car has before it crosses the red line, or null when no car
 * is on the visible road (staged cars at row < 1 do not count). Pure: the marker shows this.
 */
export function nearestMovesLeft(lanes, laneCount, maxRow, stepsPerRow) {
  let best = null;
  for (let li = 0; li < laneCount; li++) {
    const car = lanes?.[li]?.cars?.[0];
    if (!car || car.row < 1) continue;
    const left = Math.round((maxRow - car.row) * stepsPerRow) + 1;
    if (best == null || left < best) best = left;
  }
  return best;
}

export class StepRuler {
  constructor(layer) {
    this._root = new Container();
    layer.addChild(this._root);
    this._yFor = new Map();   // moves left -> screen y of that step
    this._t = 0;
    this._cfg = null;
    this._marker = null;
  }

  configure(laneCount, gridRows, stepsPerRow) {
    this._root.removeChildren().forEach(c => c.destroy({ children: true }));
    this._yFor.clear();
    this._cfg = null;
    this._marker = null;
    if (!(gridRows > 1) || !(stepsPerRow > 1)) return;
    const maxRow = gridRows - 1, steps = maxRow * stepsPerRow;
    this._cfg = { maxRow, steps, spr: stepsPerRow };
    const x = getLaneScreenBounds(0).left - 17;
    this._x = x;
    const ys = [];
    for (let k = stepsPerRow; k <= steps; k++) ys.push(posToScreenYProjected((k / steps) * 100));
    // The track, slimmer now that it carries dots rather than numbers.
    const track = new Graphics();
    track.roundRect(x - 6, ys[0] - 8, 12, ys[ys.length - 1] - ys[0] + 16, 6)
      .fill({ color: 0x14112F, alpha: 0.55 }).stroke({ color: INK, width: 1.5, alpha: 0.5 });
    this._root.addChild(track);
    const dots = new Graphics();
    for (let k = stepsPerRow; k <= steps; k++) {
      const left = steps - k + 1;
      const y = posToScreenYProjected((k / steps) * 100);
      this._yFor.set(left, y);
      dots.circle(x, y, left <= 4 ? 3.6 : 3).fill({ color: colorFor(left), alpha: 0.85 });
    }
    this._root.addChild(dots);

    // The marker: a plain glowing dot that rides level with the most advanced car (no number since
    // 2026-10-31, owner: "the number at the side is not understood"; the colour says how close).
    const m = new Container();
    const glow = new Graphics();
    glow.circle(0, 0, R + 5).fill({ color: 0xFFFFFF, alpha: 0.18 });
    glow.circle(0, 0, R + 2).fill({ color: 0xFFFFFF, alpha: 0.22 });
    const badge = new Graphics();
    m.addChild(glow, badge);
    m.x = x; m.visible = false;
    this._root.addChild(m);
    this._marker = { c: m, glow, badge, left: null, y: null };
  }

  setVisible(v) { this._root.visible = v; }

  // Stage rect of the ruler (the L1 tour points at it), or null when this board has none.
  rect() {
    if (!this._cfg) return null;
    const b = this._root.getLocalBounds();
    return b.width > 0 ? { x: b.x - 6, y: b.y - 6, w: b.width + 12, h: b.height + 12 } : null;
  }

  update(dt, gs) {
    this._t += dt;
    const mk = this._marker;
    if (!this._cfg || !gs || !mk) return;
    const left = nearestMovesLeft(gs.lanes, gs.activeLaneCount ?? 0, this._cfg.maxRow, this._cfg.spr);
    const y = left != null ? this._yFor.get(Math.max(1, Math.min(this._cfg.steps - this._cfg.spr + 1, left))) : null;
    if (y == null) { mk.c.visible = false; mk.left = null; return; }
    if (mk.left !== left) {
      mk.left = left;
      const col = colorFor(left);
      mk.badge.clear().circle(0, 0, R - 1).fill(col).stroke({ color: INK, width: 2.5 });
      mk.badge.circle(-2.5, -2.5, 2.2).fill({ color: WHITE, alpha: 0.55 });
      mk.glow.tint = col;
      mk._pop = 0.25;   // a little pop each time the count changes
    }
    // Glide to the step (the car glides too), pulse the glow, pop on change.
    mk.y = mk.y == null || !mk.c.visible ? y : mk.y + (y - mk.y) * Math.min(1, dt * 12);
    mk.c.y = mk.y; mk.c.visible = true;
    mk._pop = Math.max(0, (mk._pop ?? 0) - dt);
    const urgent = left <= 4;
    mk.c.scale.set(1 + (mk._pop > 0 ? 0.3 * (mk._pop / 0.25) : 0) + (urgent ? 0.06 * Math.sin(this._t * 8) : 0));
    mk.glow.alpha = 0.7 + 0.3 * Math.sin(this._t * (urgent ? 8 : 4));
  }
}
