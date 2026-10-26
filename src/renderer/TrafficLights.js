// TrafficLights — the light over a lane on traffic-light levels (TrafficRules.laneHeld).
//
// One signal per light, sitting on the lane's crosswalk just above the breach line, where a
// real traffic light stops cars. It always shows what the lane does on the NEXT traffic move:
//   red   — the lane holds still; a translucent red stop bar spans the lane
//   green — the lane drives
// and a small number: how many moves until it changes. The player can therefore ignore a red
// lane for that many shots and spend them elsewhere.
//
// Housing is a baked Toy Town sprite (public/sprites/designed/traffic-light-{red,green}.png),
// not procedural Pixi Graphics — Play Store prop chrome. Stop bar + moves badge stay live
// overlays (pulse / dynamic number). Visuals only.
import { Container, Graphics, Text, Sprite, Assets } from 'pixi.js';
import { INK, WHITE } from './ToyStyle.js';
import { lightState } from '../director/TrafficRules.js';
import { getLaneScreenX, getLaneScreenBounds } from './PositionRegistry.js';
import { ROAD_BOTTOM_Y } from './LaneRenderer.js';

const _B = import.meta.env.BASE_URL;
const RED = 0xFF3D3D, GREEN = 0x2FCC55;
// Display width — face reads at ~old 62×30 pill; sprite includes soft glow + mount stub.
const HOUSE_W = 76;
// Sprite aspect from bake (247×102). Used until texture metadata is available.
const HOUSE_ASPECT = 102 / 247;
const LIGHT_DY = 44;

function housingUrl(red) {
  return `${_B}sprites/designed/traffic-light-${red ? 'red' : 'green'}.png`;
}

function houseH(tex) {
  if (tex?.width) return Math.round(HOUSE_W * (tex.height / tex.width));
  return Math.round(HOUSE_W * HOUSE_ASPECT);
}

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
      const house = new Sprite();       // baked housing (red-on / green-on)
      house.anchor.set(0.5, 0.42);      // optical center on the lamp face (stub hangs below)
      house.width = HOUSE_W;
      house.height = houseH(null);
      const badge = new Graphics();
      const num = new Text({
        text: '',
        style: {
          fontFamily: '"Lilita One", Fredoka, Arial, sans-serif',
          fontSize: 15,
          fill: WHITE,
          stroke: { color: INK, width: 3 },
        },
      });
      num.anchor.set(0.5);
      c.addChild(bar, house, badge, num);
      this._root.addChild(c);
      this._items.push({ lane: L.lane, c, bar, house, badge, num, key: '', texKey: '' });
    }
  }

  setVisible(v) { this._root.visible = v; }

  /** Screen rect around the first light (guide cards ring it), or null. */
  firstRect() {
    const L = this._lights?.[0];
    if (!L) return null;
    const cx = getLaneScreenX(L.lane), cy = ROAD_BOTTOM_Y - LIGHT_DY;
    const hh = houseH(null);
    return { x: cx - HOUSE_W / 2 - 6, y: cy - hh / 2 - 26, w: HOUSE_W + 12, h: hh + 36 };
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

      // Stop bar: soft red band across the whole lane at the crosswalk (live VFX).
      it.bar.clear();
      if (st.red) {
        it.bar.roundRect(b.left + 4, cy - 9, b.right - b.left - 8, 18, 9)
          .fill({ color: RED, alpha: 0.38 + 0.14 * pulse });
        it.bar.roundRect(b.left + 4, cy - 9, b.right - b.left - 8, 18, 9)
          .stroke({ color: RED, width: 2, alpha: 0.7 });
      }

      // Baked housing sprite — swap texture on state change.
      const texKey = st.red ? 'r' : 'g';
      if (it.texKey !== texKey) {
        it.texKey = texKey;
        const tex = Assets.get(housingUrl(st.red));
        if (tex) {
          it.house.texture = tex;
          it.house.width = HOUSE_W;
          it.house.height = houseH(tex);
        }
      }
      it.house.position.set(cx, cy);
      // Subtle breathe so the live lamp still feels alive next to the stop-bar pulse.
      it.house.alpha = 0.92 + 0.08 * pulse;

      // Moves-until-change badge above the housing (dynamic number — stays live).
      const key = `${st.red ? 'r' : 'g'}${st.movesLeft}`;
      if (it.key !== key) { it.key = key; it.num.text = String(st.movesLeft); }
      const badgeY = cy - (it.house.height * it.house.anchor.y) - 10;
      it.badge.clear();
      it.badge.circle(cx, badgeY, 11).fill(st.red ? RED : GREEN).stroke({ color: INK, width: 2 });
      it.num.position.set(cx, badgeY);
    }
  }
}
