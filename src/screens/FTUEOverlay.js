// FTUEOverlay — two visual layers for FTUE levels:
//
//   1. Dim mask — dark transparent shapes covering inactive lane columns and
//      shooter columns so the player's attention stays on the active area.
//
//   2. Tutorial hint (shown when levelConfig.showArrow is true) —
//        • pulsing highlight ring around the active column's top shooter
//        • upward-pointing animated arrow in the active lane area
//        • "Drag the shooter to the lane" instruction text
//      The hint disappears on the first deploy (call onFirstDeploy()).
//
// update(dt) must be called from the render ticker while the overlay is live.
import { Container, Graphics, Text } from 'pixi.js';
import {
  ROAD_TOP_Y, ROAD_BOTTOM_Y,
  ROAD_TOP_X, ROAD_TOP_W, ROAD_BOTTOM_W,
  LANE_COUNT as TOTAL_LANES,
} from '../renderer/LaneRenderer.js';
import {
  SHOOTER_AREA_Y, SHOOTER_AREA_H,
  COL_W, COL_COUNT as TOTAL_COLS,
  TOP_Y, TOP_RADIUS,
} from '../renderer/ShooterRenderer.js';

export class FTUEOverlay {
  // levelConfig: { laneCount, colCount, showArrow, ... }
  constructor(stage, appW, appH, levelConfig) {
    this._container = new Container();
    stage.addChild(this._container);

    this._appW        = appW;
    this._elapsed     = 0;
    this._hintVisible = !!levelConfig.showArrow;
    this._ring        = null;
    this._arrowGroup  = null;
    this._arrowBaseY  = 0;

    this._buildDimMask(appW, levelConfig);

    if (levelConfig.showArrow) {
      this._buildHint(appW, levelConfig.laneCount, levelConfig.colCount);
    }
  }

  destroy() {
    this._container.destroy({ children: true });
  }

  // Call on the first deploy action to hide the tutorial hint.
  onFirstDeploy() {
    if (!this._hintVisible) return;
    this._hintVisible = false;
    if (this._arrowGroup) this._arrowGroup.visible = false;
    if (this._ring)       this._ring.visible       = false;
  }

  // Call every render frame.
  update(dt) {
    if (!this._hintVisible) return;
    this._elapsed += dt;

    // Animate the arrow group — gentle bounce + opacity pulse.
    if (this._arrowGroup) {
      this._arrowGroup.y     = this._arrowBaseY + Math.sin(this._elapsed * 2.8) * 8;
      this._arrowGroup.alpha = 0.68 + Math.sin(this._elapsed * 2.1) * 0.28;
    }

    // Animate the highlight ring — radius + opacity pulse.
    if (this._ring) {
      const t      = this._elapsed * 4.2;
      const scale  = 1 + Math.sin(t) * 0.14;
      const alpha  = 0.42 + Math.sin(t) * 0.38;
      const cx = COL_W * 0.5;
      this._ring.clear();
      this._ring.circle(cx, TOP_Y, TOP_RADIUS * 1.45 * scale);
      this._ring.stroke({ color: 0xffee44, width: 3.5, alpha });
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _buildDimMask(w, cfg) {
    const { laneCount, colCount } = cfg;
    const g = new Graphics();

    // Dim the inactive lane columns — the right portion of the perspective road.
    // Each lane is a trapezoid; cover from lane `laneCount` to TOTAL_LANES.
    if (laneCount < TOTAL_LANES) {
      const topLx = ROAD_TOP_X + laneCount * ROAD_TOP_W  / TOTAL_LANES;
      const topRx = ROAD_TOP_X + ROAD_TOP_W;   // right edge of road at top
      const botLx =              laneCount * ROAD_BOTTOM_W / TOTAL_LANES;
      const botRx =              ROAD_BOTTOM_W;  // right edge of road at bottom
      g.poly([topLx, ROAD_TOP_Y, topRx, ROAD_TOP_Y, botRx, ROAD_BOTTOM_Y, botLx, ROAD_BOTTOM_Y]);
      g.fill({ color: 0x000000, alpha: 0.72 });
    }

    // Dim shooter columns to the right of the active set.
    if (colCount < TOTAL_COLS) {
      g.rect(colCount * COL_W, SHOOTER_AREA_Y,
             w - colCount * COL_W, SHOOTER_AREA_H);
      g.fill({ color: 0x000000, alpha: 0.72 });
    }

    this._container.addChild(g);
  }

  _buildHint(w, laneCount, colCount) {
    // ── Pulsing ring over column 0's top shooter ─────────────────────────────
    const ring = new Graphics();
    this._ring = ring;
    this._container.addChild(ring);

    // ── Arrow + instruction text ─────────────────────────────────────────────
    // Arrow sits in the active lane area (lane 0), pointing upward to show the
    // player the direction to drag (shooter at bottom → lane at top).
    const grp = new Container();
    this._container.addChild(grp);
    this._arrowGroup = grp;

    // Centre the arrow group on lane 0's bottom column centre.
    grp.x = COL_W * 0.5;

    // Place it in the lower portion of the road (near where the car would arrive).
    const baseY = ROAD_BOTTOM_Y - 80;
    this._arrowBaseY = baseY;
    grp.y = baseY;

    // Upward-pointing arrow (drawn at group-local coords, tip at top).
    const ag = new Graphics();
    ag.poly([0, -80, -22, -48, 22, -48]);
    ag.fill(0xffee44);
    ag.rect(-5, -48, 10, 48);
    ag.fill(0xffee44);
    grp.addChild(ag);

    // Instruction text centred on the full screen width, offset relative to grp.x.
    const txt = new Text({
      text: 'Drag the shooter to the lane',
      style: {
        fontSize:      17,
        fontWeight:    'bold',
        fill:          0xffffff,
        align:         'center',
        wordWrap:      true,
        wordWrapWidth: w - 60,
        dropShadow:    { color: 0x000000, blur: 4, distance: 2, alpha: 0.9 },
      },
    });
    txt.anchor.set(0.5, 0);
    txt.x = w / 2 - grp.x;   // re-centre relative to group's local origin
    txt.y = 14;               // just below the arrow shaft
    grp.addChild(txt);
  }
}
