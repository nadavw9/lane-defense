// LaneFlash — brief white flash overlay on a lane when a shooter is deployed.
// Lives on activeShooterLayer so it renders between cars and shooter columns.
import { Graphics } from 'pixi.js';
import { LANE_AREA_Y, LANE_HEIGHT, ENDPOINT_X, GUTTER } from './LaneRenderer.js';

const FLASH_DURATION = 0.18; // seconds
const FLASH_ALPHA    = 0.38;
const LANE_COUNT     = 4;

export class LaneFlash {
  constructor(layerManager) {
    const layer    = layerManager.get('activeShooterLayer');
    this._flashes  = [];

    for (let i = 0; i < LANE_COUNT; i++) {
      const g     = new Graphics();
      const roadY = LANE_AREA_Y + i * LANE_HEIGHT + GUTTER;
      const roadH = LANE_HEIGHT - GUTTER * 2;
      g.rect(0, roadY, ENDPOINT_X, roadH);
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
