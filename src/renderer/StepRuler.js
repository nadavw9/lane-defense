// StepRuler — the step countdown beside the road (2026-10-18, owner request: "it is hard to
// count the steps to the red line").
//
// One numbered pip per step on the kerb left of the road: the number is how many moves a car
// standing level with it has before it crosses the red line. Pips warm from green to red as
// they near the line, and the pip level with the most advanced car pulses, so "how close is
// the nearest car?" is answered without counting. It sits OUTSIDE the road, so the Pixi layer
// (which draws over the 3D cars) never covers a car. The road itself carries the matching
// faint step lines (StepGrid3D, style 'ruler').
import { Container, Graphics, Text } from 'pixi.js';
import { INK, WHITE } from './ToyStyle.js';
import { getLaneScreenBounds } from './PositionRegistry.js';
import { posToScreenYProjected } from '../renderer3d/projection.js';

const R = 8.5;
const colorFor = (left) => left <= 2 ? 0xFF3D3D : left <= 4 ? 0xFF8A1C : left <= 8 ? 0xFFC93C : 0x2FCC55;

export class StepRuler {
  constructor(layer) {
    this._root = new Container();
    layer.addChild(this._root);
    this._pips = [];
    this._t = 0;
    this._hot = null;
    this._cfg = null;
  }

  configure(laneCount, gridRows, stepsPerRow) {
    this._root.removeChildren().forEach(c => c.destroy({ children: true }));
    this._pips = [];
    this._hot = null;
    this._cfg = null;
    if (!(gridRows > 1) || !(stepsPerRow > 1)) return;
    const maxRow = gridRows - 1, steps = maxRow * stepsPerRow;
    this._cfg = { maxRow, steps, spr: stepsPerRow };
    const x = getLaneScreenBounds(0).left - 17;
    const ys = [];
    for (let k = stepsPerRow; k <= steps; k++) ys.push(posToScreenYProjected((k / steps) * 100));
    // the track behind the pips
    const track = new Graphics();
    track.roundRect(x - R - 3, ys[0] - R - 3, (R + 3) * 2, ys[ys.length - 1] - ys[0] + (R + 3) * 2, R + 3)
      .fill({ color: 0x14112F, alpha: 0.62 }).stroke({ color: INK, width: 2, alpha: 0.6 });
    this._root.addChild(track);
    for (let k = stepsPerRow; k <= steps; k++) {
      const left = steps - k + 1;
      const y = posToScreenYProjected((k / steps) * 100);
      const c = new Container();
      c.x = x; c.y = y;
      const g = new Graphics();
      const big = left <= 4;
      g.circle(0, 0, big ? R + 1 : R - 1).fill(colorFor(left)).stroke({ color: INK, width: 2 });
      g.circle(-2.5, -2.5, 2.2).fill({ color: WHITE, alpha: 0.55 });
      c.addChild(g);
      const t = new Text({ text: String(left), style: { fontFamily: '"Lilita One", Fredoka, Arial, sans-serif', fontSize: big ? 13 : 11, fill: WHITE, stroke: { color: INK, width: 3 } } });
      t.anchor.set(0.5); t.y = 0.5;
      c.addChild(t);
      this._root.addChild(c);
      this._pips.push({ c, left });
    }
  }

  setVisible(v) { this._root.visible = v; }

  /** Pulse the pip level with the most advanced car (fewest moves left). */
  update(dt, gs) {
    this._t += dt;
    if (!this._cfg || !gs) return;
    let best = Infinity;
    for (let li = 0; li < (gs.activeLaneCount ?? 0); li++) {
      const car = gs.lanes?.[li]?.cars?.[0];
      if (!car || car.row < 1) continue;
      const left = Math.round((this._cfg.maxRow - car.row) * this._cfg.spr) + 1;
      if (left < best) best = left;
    }
    for (const p of this._pips) {
      const hot = p.left === best;
      p.c.scale.set(hot ? 1.22 + 0.1 * Math.sin(this._t * 7) : 1);
      p.c.alpha = hot || p.left <= 4 ? 1 : 0.85;
    }
  }
}
