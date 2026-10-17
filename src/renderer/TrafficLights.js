// TrafficLights — the light over a lane on traffic-light levels (TrafficRules.laneHeld).
//
// One signal per light, sitting on the lane's crosswalk just above the breach line, where a
// real traffic light stops cars. It always shows what the lane does on the NEXT traffic move:
//   red   — the lane holds still; a translucent red stop bar spans the lane
//   green — the lane drives
// and a small number: how many moves until it changes. The player can therefore ignore a red
// lane for that many shots and spend them elsewhere.
import { Container, Graphics, Text } from 'pixi.js';
import { INK, WHITE } from './ToyStyle.js';
import { lightState } from '../director/TrafficRules.js';
import { getLaneScreenX, getLaneScreenBounds } from './PositionRegistry.js';
import { ROAD_BOTTOM_Y } from './LaneRenderer.js';

const RED = 0xFF3D3D, GREEN = 0x2FCC55, DARK = 0x1A1630;
const HOUSE_W = 62, HOUSE_H = 30;
// Above the crosswalk's lower edge, clear of the streak pips that sit on the breach line (centre lane).
const LIGHT_DY = 44;

export class TrafficLights {
  constructor(layer) {
    this._root = new Container();
    layer.addChild(this._root);
    this._items = [];
    this._lights = null;
    this._t = 0;
  }

  /** Lights for this level ([{ lane, green, red, phase }] or null). */
  setLights(lights) {
    this._lights = lights?.length ? lights : null;
    for (const it of this._items) it.c.destroy({ children: true });
    this._items = [];
    if (!this._lights) return;
    for (const L of this._lights) {
      const c = new Container();
      const bar = new Graphics();       // red stop bar across the lane (shown on red)
      const house = new Graphics();
      const num = new Text({ text: '', style: { fontFamily: '"Lilita One", Fredoka, Arial, sans-serif', fontSize: 15, fill: WHITE, stroke: { color: INK, width: 3 } } });
      num.anchor.set(0.5);
      c.addChild(bar, house, num);
      this._root.addChild(c);
      this._items.push({ lane: L.lane, c, bar, house, num, key: '' });
    }
  }

  setVisible(v) { this._root.visible = v; }

  /** Screen rect around the first light (guide cards ring it), or null. */
  firstRect() {
    const L = this._lights?.[0];
    if (!L) return null;
    const cx = getLaneScreenX(L.lane), cy = ROAD_BOTTOM_Y - LIGHT_DY;
    return { x: cx - HOUSE_W / 2 - 6, y: cy - HOUSE_H / 2 - 22, w: HOUSE_W + 12, h: HOUSE_H + 30 };
  }

  /** Redraw from the number of traffic moves so far. */
  update(dt, trafficMoves) {
    if (!this._lights) return;
    this._t += dt;
    const pulse = 0.5 + 0.5 * Math.sin(this._t * 6);
    for (const it of this._items) {
      const st = lightState(this._lights, it.lane, trafficMoves);
      if (!st) continue;
      const cx = getLaneScreenX(it.lane);
      const b = getLaneScreenBounds(it.lane);
      const cy = ROAD_BOTTOM_Y - LIGHT_DY;
      it.c.position.set(0, 0);

      // Stop bar: a soft red band across the whole lane at the crosswalk.
      it.bar.clear();
      if (st.red) {
        it.bar.roundRect(b.left + 4, cy - 9, b.right - b.left - 8, 18, 9).fill({ color: RED, alpha: 0.38 + 0.14 * pulse });
        it.bar.roundRect(b.left + 4, cy - 9, b.right - b.left - 8, 18, 9).stroke({ color: RED, width: 2, alpha: 0.7 });
      }

      // Housing: dark pill, two lamps (red left, green right), the live one lit with a halo.
      const g = it.house;
      g.clear();
      const x = cx - HOUSE_W / 2, y = cy - HOUSE_H / 2;
      g.roundRect(x, y + 2, HOUSE_W, HOUSE_H, 15).fill({ color: 0x000000, alpha: 0.35 });
      g.roundRect(x, y, HOUSE_W, HOUSE_H, 15).fill(DARK).stroke({ color: INK, width: 2.5 });
      const lamps = [[cx - 15, RED, st.red], [cx + 15, GREEN, !st.red]];
      for (const [lx, col, on] of lamps) {
        if (on) g.circle(lx, cy, 15).fill({ color: col, alpha: 0.22 + 0.18 * pulse });
        g.circle(lx, cy, 10).fill(on ? col : 0x3A3552).stroke({ color: INK, width: 1.5 });
        if (on) g.circle(lx - 3, cy - 3, 3).fill({ color: 0xFFFFFF, alpha: 0.8 });
      }

      // Moves until it changes, on a small badge above the housing.
      const key = `${st.red ? 'r' : 'g'}${st.movesLeft}`;
      if (it.key !== key) { it.key = key; it.num.text = String(st.movesLeft); }
      g.circle(cx, y - 9, 11).fill(st.red ? RED : GREEN).stroke({ color: INK, width: 2 });
      it.num.position.set(cx, y - 9);
    }
  }
}
