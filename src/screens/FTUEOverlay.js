// FTUEOverlay — two visual layers for FTUE levels:
//
//   1. Dim mask — dark transparent rects covering inactive lanes/columns so
//      the player's attention stays on the active area.
//
//   2. Tutorial hint (shown when levelConfig.showArrow is true) —
//        • pulsing highlight ring around the active column's top shooter
//        • upward-pointing animated arrow in the gap between shooter and lane
//        • "Drag the shooter to the lane" instruction text
//      The hint disappears on the first deploy (call onFirstDeploy()).
//
// update(dt) must be called from the render ticker while the overlay is live.
import { Container, Graphics, Text } from 'pixi.js';
import {
  LANE_AREA_Y, LANE_HEIGHT, LANE_COUNT as TOTAL_LANES,
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

    // Dim lanes below the active set.
    if (laneCount < TOTAL_LANES) {
      g.rect(0, LANE_AREA_Y + laneCount * LANE_HEIGHT,
             w, (TOTAL_LANES - laneCount) * LANE_HEIGHT);
      g.fill({ color: 0x000000, alpha: 0.72 });
    }

    // Dim columns to the right of the active set.
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
    // Place the arrow group in the dead-space between the active lane's bottom
    // and the shooter area.  For L1 this falls inside the dim region (lanes 1–3)
    // so it floats visibly above the dark overlay.
    const grp = new Container();
    this._container.addChild(grp);
    this._arrowGroup = grp;

    // Horizontal: centre on the active column strip.
    grp.x = (colCount * COL_W) / 2;

    // Vertical: midpoint between active-lane-bottom and shooter-area-top.
    const midY = (LANE_AREA_Y + laneCount * LANE_HEIGHT + SHOOTER_AREA_Y) / 2;
    this._arrowBaseY = midY;
    grp.y = midY;

    // Upward-pointing arrow (drawn at group-local coords, tip at top).
    // Tip: (0, -80)  Arrowhead base: (±22, -48)  Shaft: 10×48px below base
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
