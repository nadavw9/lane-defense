// LaneFlash — brief white flash overlay on a lane column when a shooter is deployed.
// Each lane is a perspective trapezoid; the flash polygon matches that shape.
// Lives on activeShooterLayer so it renders between cars and shooter columns.
import { Graphics } from 'pixi.js';
import {
  ROAD_TOP_Y, ROAD_BOTTOM_Y,
  ROAD_TOP_X, ROAD_TOP_W, ROAD_BOTTOM_W,
  LANE_COUNT,
} from './LaneRenderer.js';

const FLASH_DURATION = 0.18; // seconds
const FLASH_ALPHA    = 0.38;

export class LaneFlash {
  constructor(layerManager) {
    const layer   = layerManager.get('activeShooterLayer');
    this._flashes = [];

    for (let i = 0; i < LANE_COUNT; i++) {
      const g = new Graphics();
      // Trapezoid polygon matching lane i's perspective shape
      const topLx = ROAD_TOP_X + i       * ROAD_TOP_W  / LANE_COUNT;
      const topRx = ROAD_TOP_X + (i + 1) * ROAD_TOP_W  / LANE_COUNT;
      const botLx =              i       * ROAD_BOTTOM_W / LANE_COUNT;
      const botRx =              (i + 1) * ROAD_BOTTOM_W / LANE_COUNT;
      g.poly([topLx, ROAD_TOP_Y, topRx, ROAD_TOP_Y, botRx, ROAD_BOTTOM_Y, botLx, ROAD_BOTTOM_Y]);
      g.fill(0xffffff);
      g.alpha   = 0;
      g.visible = false;
      layer.addChild(g);
      this._flashes.push({ g, life: 0 });
    }
  }

  flash(laneIdx) {
    if (laneIdx < 0 || laneIdx >= this._flashes.length) return;
    const f  = this._flashes[laneIdx];
    f.life   = FLASH_DURATION;
    f.g.visible = true;
    f.g.alpha   = FLASH_ALPHA;
  }

  update(dt) {
    for (const f of this._flashes) {
      if (f.life <= 0) continue;
      f.life -= dt;
      if (f.life <= 0) {
        f.g.visible = false;
        f.g.alpha   = 0;
      } else {
        f.g.alpha = FLASH_ALPHA * (f.life / FLASH_DURATION);
      }
    }
  }
}
