// BombReticle — lane-targeting overlay shown during bomb placement mode.
//
// Highlights the full lane column the pointer is over (perspective trapezoid).
// Shows the front car HP and label. Disappears when bomb is placed or cancelled.
import { Graphics, Text, Container } from 'pixi.js';
import {
  ROAD_TOP_Y, ROAD_BOTTOM_Y, ROAD_TOP_X, ROAD_TOP_W, ROAD_BOTTOM_W, LANE_COUNT,
} from './LaneRenderer.js';

export class BombReticle {
  constructor(layerManager, appW) {
    this._appW       = appW;
    this._layer      = layerManager.get('hudLayer');
    this._container  = new Container();
    this._container.visible = false;
    this._layer.addChild(this._container);

    this._bg     = new Graphics();
    this._edge   = new Graphics();
    this._label  = new Text({ text: '', style: {
      fontSize: 14, fontWeight: 'bold', fill: 0xffdd00,
      dropShadow: { color: 0x000000, blur: 6, distance: 2, alpha: 0.9 },
    }});
    this._label.anchor.set(0.5, 0.5);

    this._cancelBtn = new Text({ text: '✕ CANCEL', style: {
      fontSize: 15, fontWeight: 'bold', fill: 0xff6644,
      dropShadow: { color: 0x000000, blur: 4, distance: 1, alpha: 0.8 },
    }});
    this._cancelBtn.anchor.set(0.5, 0.5);
    this._cancelBtn.eventMode = 'static';
    this._cancelBtn.cursor    = 'pointer';

    this._container.addChild(this._bg);
    this._container.addChild(this._edge);
    this._container.addChild(this._label);
    this._container.addChild(this._cancelBtn);

    this._animT    = 0;
    this._pointerX = appW / 2;
    this._pointerY = (ROAD_TOP_Y + ROAD_BOTTOM_Y) / 2;
  }

  show() { this._container.visible = true; }
  hide() { this._container.visible = false; }

  setPointerX(x) { this._pointerX = x; }
  setPointerY(y) { this._pointerY = Math.max(ROAD_TOP_Y + 10, Math.min(ROAD_BOTTOM_Y - 10, y)); }

  onCancel(cb) { this._cancelBtn.on('pointerdown', cb); }

  update(dt, lanes) {
    if (!this._container.visible) return;
    this._animT += dt;

    // Which lane is the pointer over? Use bottom-of-road lane widths.
    const laneW   = ROAD_BOTTOM_W / LANE_COUNT;
    const laneIdx = Math.max(0, Math.min(LANE_COUNT - 1, Math.floor(this._pointerX / laneW)));

    // Lane trapezoid edges at top and bottom of road.
    const topLaneW = ROAD_TOP_W / LANE_COUNT;
    const topLx    = ROAD_TOP_X + laneIdx * topLaneW;
    const topRx    = topLx + topLaneW;
    const botLx    = laneIdx * laneW;
    const botRx    = botLx + laneW;

    // Fill — amber trapezoid over the targeted lane.
    this._bg.clear();
    this._bg.poly([topLx, ROAD_TOP_Y, topRx, ROAD_TOP_Y, botRx, ROAD_BOTTOM_Y, botLx, ROAD_BOTTOM_Y]);
    this._bg.fill({ color: 0xff6600, alpha: 0.30 });

    // Pulsing edge outline.
    const sweep = Math.sin(this._animT * 5) * 0.5 + 0.5;
    this._edge.clear();
    this._edge.poly([topLx, ROAD_TOP_Y, topRx, ROAD_TOP_Y, botRx, ROAD_BOTTOM_Y, botLx, ROAD_BOTTOM_Y]);
    this._edge.stroke({ color: 0xffdd00, width: 2.5, alpha: 0.55 + sweep * 0.35 });

    // Find front car in lane (highest row = closest to breach).
    const lane = lanes?.[laneIdx];
    const frontCar = lane?.cars?.reduce((best, c) => (!best || c.row > best.row) ? c : best, null);

    this._label.text = frontCar ? `💣 LANE ${laneIdx + 1}  •  HP ${frontCar.hp}` : `💣 LANE ${laneIdx + 1}  •  EMPTY`;
    this._label.x = (botLx + botRx) / 2;
    this._label.y = ROAD_BOTTOM_Y - 20;

    this._cancelBtn.x = this._appW / 2;
    this._cancelBtn.y = ROAD_BOTTOM_Y + 24;
  }

  destroy() { this._container.destroy({ children: true }); }
}


