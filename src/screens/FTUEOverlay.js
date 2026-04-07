// FTUEOverlay — two visual layers for FTUE levels:
//
//   1. Dim mask — dark transparent shapes covering inactive lane columns and
//      shooter columns so the player's attention stays on the active area.
//
//   2. Tutorial hint (shown when levelConfig.hintText is set) —
//        • For L1 (showArrow: true): animated arrow + pulsing ring + text,
//          dismisses on first deploy.
//        • For other levels: a text banner at the bottom that auto-hides after 8 s.
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

const HINT_AUTO_HIDE = 8; // seconds before text banner fades out

export class FTUEOverlay {
  // levelConfig: { laneCount, colCount, showArrow, hintText, ... }
  constructor(stage, appW, appH, levelConfig) {
    this._container = new Container();
    stage.addChild(this._container);

    this._appW        = appW;
    this._elapsed     = 0;
    this._hintVisible = !!levelConfig.hintText;
    this._isArrow     = !!levelConfig.showArrow;
    this._ring        = null;
    this._arrowGroup  = null;
    this._arrowBaseY  = 0;
    this._banner      = null;

    this._buildDimMask(appW, levelConfig);

    if (levelConfig.showArrow && levelConfig.hintText) {
      this._buildArrowHint(appW, levelConfig.hintText);
    } else if (levelConfig.hintText) {
      this._buildBanner(appW, levelConfig.hintText);
    }
  }

  destroy() {
    this._container.destroy({ children: true });
  }

  // Call on the first deploy action to hide the arrow-style tutorial hint.
  onFirstDeploy() {
    if (!this._isArrow || !this._hintVisible) return;
    this._hintVisible = false;
    if (this._arrowGroup) this._arrowGroup.visible = false;
    if (this._ring)       this._ring.visible       = false;
  }

  // Call every render frame.
  update(dt) {
    if (!this._hintVisible) return;
    this._elapsed += dt;

    if (this._isArrow) {
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
    } else {
      // Auto-hide banner after HINT_AUTO_HIDE seconds.
      if (this._elapsed >= HINT_AUTO_HIDE) {
        this._hintVisible = false;
        if (this._banner) this._banner.visible = false;
      } else {
        // Fade out in the last 2 seconds.
        const fadeStart = HINT_AUTO_HIDE - 2;
        if (this._elapsed > fadeStart && this._banner) {
          this._banner.alpha = 1 - (this._elapsed - fadeStart) / 2;
        }
      }
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _buildDimMask(w, cfg) {
    const { laneCount, colCount } = cfg;
    const g = new Graphics();

    // Dim the inactive lane columns — the right portion of the perspective road.
    if (laneCount < TOTAL_LANES) {
      const topLx = ROAD_TOP_X + laneCount * ROAD_TOP_W  / TOTAL_LANES;
      const topRx = ROAD_TOP_X + ROAD_TOP_W;
      const botLx =              laneCount * ROAD_BOTTOM_W / TOTAL_LANES;
      const botRx =              ROAD_BOTTOM_W;
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

  _buildBanner(w, text) {
    // Static-ish text banner near the bottom of the road — auto-fades after 8s.
    const grp = new Container();
    this._container.addChild(grp);
    this._banner = grp;

    // Semi-transparent pill background
    const bg = new Graphics();
    bg.roundRect(20, 0, w - 40, 44, 10);
    bg.fill({ color: 0x000000, alpha: 0.65 });
    bg.roundRect(20, 0, w - 40, 44, 10);
    bg.stroke({ color: 0x44aaff, width: 1.5, alpha: 0.50 });
    grp.addChild(bg);

    const txt = new Text({
      text,
      style: {
        fontSize:      15,
        fontWeight:    'bold',
        fill:          0x88ccff,
        align:         'center',
        wordWrap:      true,
        wordWrapWidth: w - 60,
        dropShadow:    { color: 0x000000, blur: 4, distance: 2, alpha: 0.9 },
      },
    });
    txt.anchor.set(0.5, 0.5);
    txt.x = w / 2;
    txt.y = 22;
    grp.addChild(txt);

    // Position banner just above the shooter area
    grp.y = SHOOTER_AREA_Y - 54;
  }

  _buildArrowHint(w, text) {
    // ── Pulsing ring over column 0's top shooter ─────────────────────────────
    const ring = new Graphics();
    this._ring = ring;
    this._container.addChild(ring);

    // ── Arrow + instruction text ─────────────────────────────────────────────
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
      text,
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
