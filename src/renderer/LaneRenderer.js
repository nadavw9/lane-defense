// LaneRenderer — draws the perspective road surface onto the lane layer.
//
// Layout: a single perspective road stretching from top (far, narrow) to
// bottom (near, wide).  Four lane columns divide it vertically.  Cars travel
// from position 0 (top/far) to position 100 (bottom/near), scaling 0.4 → 1.0.
//
// Perspective geometry:
//   Top of road  (y = ROAD_TOP_Y)    : x = 115 … 275  (ROAD_TOP_W  = 160 px)
//   Bottom of road (y = ROAD_BOTTOM_Y): x = 0   … 390  (ROAD_BOTTOM_W = 390 px)
//
// Exported helper functions (used by CarRenderer, ParticleSystem, DragDrop, etc.)
//   laneCenterX(laneIdx, t)  — screen X for lane centre at normalised position t [0-1]
//   posToScreenY(position)   — screen Y for game position [0-100]
//   posToScale(position)     — visual scale factor [0.4 - 1.0]
import { Graphics } from 'pixi.js';

// ── Layout constants ───────────────────────────────────────────────────────────

export const ROAD_TOP_Y    = 44;   // px — HUD bottom / road top
export const ROAD_BOTTOM_Y = 510;  // px — road bottom / shooter area boundary
export const ROAD_HEIGHT   = ROAD_BOTTOM_Y - ROAD_TOP_Y;  // 466 px

export const ROAD_TOP_X    = 115;  // px — left edge of road at top
export const ROAD_TOP_W    = 160;  // px — road width at top
export const ROAD_BOTTOM_W = 390;  // px — road width at bottom (= APP_W)

export const LANE_COUNT    = 4;

// Car scale range: 0.4× at position 0 (far) → 1.0× at position 100 (near)
export const SCALE_MIN = 0.40;
export const SCALE_MAX = 1.00;

const APP_W = 390;

// ── Geometry helpers ──────────────────────────────────────────────────────────

// Screen X for the visual centre of lane `laneIdx` at normalised position t [0-1].
export function laneCenterX(laneIdx, t) {
  const leftTop  = ROAD_TOP_X + laneIdx       * ROAD_TOP_W  / LANE_COUNT;
  const leftBot  =              laneIdx       * ROAD_BOTTOM_W / LANE_COUNT;
  const rightTop = ROAD_TOP_X + (laneIdx + 1) * ROAD_TOP_W  / LANE_COUNT;
  const rightBot =              (laneIdx + 1) * ROAD_BOTTOM_W / LANE_COUNT;
  const lx = leftTop  + (leftBot  - leftTop)  * t;
  const rx = rightTop + (rightBot - rightTop) * t;
  return (lx + rx) / 2;
}

// Screen Y for game-unit position [0-100].
export function posToScreenY(position) {
  return ROAD_TOP_Y + (position / 100) * ROAD_HEIGHT;
}

// Car scale factor for game-unit position [0-100].
export function posToScale(position) {
  return SCALE_MIN + (SCALE_MAX - SCALE_MIN) * (position / 100);
}

// ── Colors ────────────────────────────────────────────────────────────────────

const BG_COLOR      = 0x141414;  // outside the road
const ROAD_TOP_COL  = 0x282828;  // asphalt at horizon (darker / further away)
const ROAD_BOT_COL  = 0x3c3c3c;  // asphalt near camera (lighter)
const EDGE_COLOR    = 0xffffff;  // road shoulder / outer edges (bright white)
const DIVIDER_COLOR = 0x666666;  // inner lane divider lines
const DASH_COLOR    = 0x999999;  // perspective centre-line dashes
const HORIZON_COLOR = 0xcccccc;  // thin line at the road top
const BREACH_COLOR  = 0xdd2222;  // red breach line at bottom

// ── Renderer ──────────────────────────────────────────────────────────────────

export class LaneRenderer {
  constructor(layerManager, appWidth) {
    this._layer  = layerManager.get('laneLayer');
    this._appW   = appWidth;
    this._draw(appWidth);

    // Separate Graphics for the pulsing breach line so only it gets redrawn.
    this._breachG = new Graphics();
    this._layer.addChild(this._breachG);
    this._drawBreach(1.0);
  }

  // Call every render frame with gs.elapsed for breach-line pulse.
  update(elapsed) {
    const alpha = 0.65 + 0.35 * Math.sin(elapsed * 5.5);
    this._drawBreach(alpha);
  }

  _drawBreach(alpha) {
    this._breachG.clear();
    this._breachG.moveTo(0, ROAD_BOTTOM_Y);
    this._breachG.lineTo(this._appW, ROAD_BOTTOM_Y);
    this._breachG.stroke({ color: BREACH_COLOR, width: 5, alpha });
  }

  _draw(w) {
    const g = new Graphics();

    // ── Dark background behind the road ───────────────────────────────────────
    g.rect(0, ROAD_TOP_Y, w, ROAD_HEIGHT);
    g.fill(BG_COLOR);

    // ── Road surface — simulated top-dark / bottom-light gradient via strips ──
    // Divide road height into 8 bands with linearly interpolated shade.
    const BANDS = 8;
    for (let b = 0; b < BANDS; b++) {
      const t0 = b / BANDS, t1 = (b + 1) / BANDS;
      const shade = ROAD_TOP_COL + Math.round((ROAD_BOT_COL - ROAD_TOP_COL) * (b / (BANDS - 1)));
      const y0  = ROAD_TOP_Y + t0 * ROAD_HEIGHT;
      const y1  = ROAD_TOP_Y + t1 * ROAD_HEIGHT;
      const lx0 = ROAD_TOP_X + (0 - ROAD_TOP_X) * t0;
      const rx0 = ROAD_TOP_X + ROAD_TOP_W + (w - (ROAD_TOP_X + ROAD_TOP_W)) * t0;
      const lx1 = ROAD_TOP_X + (0 - ROAD_TOP_X) * t1;
      const rx1 = ROAD_TOP_X + ROAD_TOP_W + (w - (ROAD_TOP_X + ROAD_TOP_W)) * t1;
      g.poly([lx0, y0, rx0, y0, rx1, y1, lx1, y1]);
      g.fill(shade);
    }

    // ── Faint horizontal texture lines for asphalt feel ───────────────────────
    const TEXTURE_LINES = 20;
    for (let d = 1; d < TEXTURE_LINES; d++) {
      const t  = d / TEXTURE_LINES;
      const y  = ROAD_TOP_Y + t * ROAD_HEIGHT;
      const lx = ROAD_TOP_X + (0 - ROAD_TOP_X) * t;
      const rx = ROAD_TOP_X + ROAD_TOP_W + (w - (ROAD_TOP_X + ROAD_TOP_W)) * t;
      // Alternate slightly brighter and dimmer lines for texture
      const a = (d % 3 === 0) ? 0.20 : 0.10;
      g.moveTo(lx, y);
      g.lineTo(rx, y);
      g.stroke({ color: 0x000000, width: 0.6, alpha: a });
    }

    // ── Lane boundary lines (perspective lines from top corners → bottom) ─────
    for (let i = 0; i <= LANE_COUNT; i++) {
      const topX = ROAD_TOP_X + i * ROAD_TOP_W  / LANE_COUNT;
      const botX =              i * ROAD_BOTTOM_W / LANE_COUNT;
      g.moveTo(topX, ROAD_TOP_Y);
      g.lineTo(botX, ROAD_BOTTOM_Y);
      const isEdge = (i === 0 || i === LANE_COUNT);
      g.stroke({
        color: isEdge ? EDGE_COLOR : DIVIDER_COLOR,
        width: isEdge ? 2.5 : 1.5,
        alpha: isEdge ? 0.90 : 0.60,
      });
    }

    // ── White dashed edge markings along both outer road edges ────────────────
    const EDGE_DASH_COUNT = 14;
    for (let d = 0; d < EDGE_DASH_COUNT; d++) {
      const t0 = (d + 0.1) / EDGE_DASH_COUNT;
      const t1 = (d + 0.6) / EDGE_DASH_COUNT;
      if (t1 > 1) continue;
      // Left edge
      const lx0 = ROAD_TOP_X + (0 - ROAD_TOP_X) * t0;
      const ly0 = ROAD_TOP_Y + t0 * ROAD_HEIGHT;
      const lx1 = ROAD_TOP_X + (0 - ROAD_TOP_X) * t1;
      const ly1 = ROAD_TOP_Y + t1 * ROAD_HEIGHT;
      const thick = 1.2 + 1.8 * t0;   // thicker toward camera
      g.moveTo(lx0 + 3, ly0);
      g.lineTo(lx1 + 3, ly1);
      g.stroke({ color: 0xffffff, width: thick, alpha: 0.55 });
      // Right edge
      const rx0 = ROAD_TOP_X + ROAD_TOP_W + (w - (ROAD_TOP_X + ROAD_TOP_W)) * t0;
      const rx1 = ROAD_TOP_X + ROAD_TOP_W + (w - (ROAD_TOP_X + ROAD_TOP_W)) * t1;
      g.moveTo(rx0 - 3, ly0);
      g.lineTo(rx1 - 3, ly1);
      g.stroke({ color: 0xffffff, width: thick, alpha: 0.55 });
    }

    // ── Perspective-scaled centre dashes in each lane ─────────────────────────
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      for (let p = 6; p <= 96; p += 11) {
        const t   = p / 100;
        const cx  = laneCenterX(lane, t);
        const cy  = posToScreenY(p);
        const sc  = posToScale(p);
        const dw  = 14 * sc;
        const dh  = 2.8 * sc;
        g.rect(cx - dw / 2, cy - dh / 2, dw, dh);
        g.fill({ color: DASH_COLOR, alpha: 0.55 });
      }
    }

    // ── Horizon line at road top ───────────────────────────────────────────────
    g.moveTo(ROAD_TOP_X, ROAD_TOP_Y);
    g.lineTo(ROAD_TOP_X + ROAD_TOP_W, ROAD_TOP_Y);
    g.stroke({ color: HORIZON_COLOR, width: 2, alpha: 0.65 });

    this._layer.addChild(g);
  }
}
