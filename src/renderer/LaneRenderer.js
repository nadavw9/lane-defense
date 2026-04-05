// LaneRenderer — draws the static lane backgrounds onto the lane layer.
// Each lane is a horizontal strip containing:
//   • a grey road surface
//   • a dashed white center line
//   • a red endpoint marker (the breach line) at x = ENDPOINT_X
//
// Layout is fixed to the spec: HUD takes 44px at top, each lane is 115px tall.
import { Graphics } from 'pixi.js';

export const LANE_AREA_Y  = 44;    // px — top of lane area (below HUD bar)
export const LANE_HEIGHT  = 115;   // px — height of each lane strip
export const LANE_COUNT   = 4;
export const ENDPOINT_X   = 370;   // px — x position of the breach line
export const LANE_LENGTH  = 100;   // game units — must match DirectorConfig
export const PX_PER_UNIT  = ENDPOINT_X / LANE_LENGTH; // 3.7 px per game unit

const ROAD_COLOR     = 0x3a3a3a;
const GUTTER_COLOR   = 0x1e1e1e;
const DIVIDER_COLOR  = 0x2a2a2a;
const DASH_COLOR     = 0x666666;
const ENDPOINT_COLOR = 0xdd2222;

// Dash geometry — short dashes evenly spaced along the center of each lane.
const DASH_W = 22;
const DASH_H = 3;
const DASH_GAP = 18;

// Vertical gutter between the road surface and lane edge.
const GUTTER = 6;

export class LaneRenderer {
  constructor(layerManager, appWidth) {
    this._layer    = layerManager.get('laneLayer');
    this._appWidth = appWidth;
    this._draw();
  }

  _draw() {
    const g = new Graphics();

    for (let i = 0; i < LANE_COUNT; i++) {
      const laneY   = LANE_AREA_Y + i * LANE_HEIGHT;
      const roadY   = laneY + GUTTER;
      const roadH   = LANE_HEIGHT - GUTTER * 2;
      const centerY = laneY + LANE_HEIGHT / 2;

      // Gutter background
      g.rect(0, laneY, this._appWidth, LANE_HEIGHT);
      g.fill(GUTTER_COLOR);

      // Road surface (stops at the endpoint)
      g.rect(0, roadY, ENDPOINT_X, roadH);
      g.fill(ROAD_COLOR);

      // Lane divider line at bottom of each lane (skip the last)
      if (i < LANE_COUNT - 1) {
        g.rect(0, laneY + LANE_HEIGHT - 1, ENDPOINT_X, 1);
        g.fill(DIVIDER_COLOR);
      }

      // Dashed center line
      let dx = 12;
      while (dx + DASH_W < ENDPOINT_X) {
        g.rect(dx, centerY - DASH_H / 2, DASH_W, DASH_H);
        g.fill(DASH_COLOR);
        dx += DASH_W + DASH_GAP;
      }

      // Endpoint / breach marker — 4px red vertical bar
      g.rect(ENDPOINT_X, roadY, 4, roadH);
      g.fill(ENDPOINT_COLOR);
    }

    this._layer.addChild(g);
  }
}
