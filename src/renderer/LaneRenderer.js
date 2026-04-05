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
const ROAD_COLOR    = 0x303030;  // asphalt
const EDGE_COLOR    = 0xdddddd;  // road shoulder / outer edges
const DIVIDER_COLOR = 0x666666;  // inner lane divider lines
const DASH_COLOR    = 0x888888;  // perspective centre-line dashes
const HORIZON_COLOR = 0xaaaaaa;  // thin line at the road top
const BREACH_COLOR  = 0xdd2222;  // red breach line at bottom

// ── Renderer ──────────────────────────────────────────────────────────────────

export class LaneRenderer {
  constructor(layerManager, appWidth) {
    this._layer = layerManager.get('laneLayer');
    this._draw(appWidth);
  }

  _draw(w) {
    const g = new Graphics();

    // ── Dark background behind the road (fills the full road area height) ─────
    g.rect(0, ROAD_TOP_Y, w, ROAD_HEIGHT);
    g.fill(BG_COLOR);

    // ── Road surface trapezoid ────────────────────────────────────────────────
    g.poly([
      ROAD_TOP_X,               ROAD_TOP_Y,
      ROAD_TOP_X + ROAD_TOP_W,  ROAD_TOP_Y,
      ROAD_BOTTOM_W,             ROAD_BOTTOM_Y,
      0,                         ROAD_BOTTOM_Y,
    ]);
    g.fill(ROAD_COLOR);

    // ── Perspective distance lines across the road (gives depth illusion) ─────
    const DIST_LINES = 12;
    for (let d = 1; d < DIST_LINES; d++) {
      const t  = d / DIST_LINES;
      const y  = ROAD_TOP_Y + t * ROAD_HEIGHT;
      const lx = ROAD_TOP_X + (0            - ROAD_TOP_X) * t;
      const rx = ROAD_TOP_X + ROAD_TOP_W + (ROAD_BOTTOM_W - (ROAD_TOP_X + ROAD_TOP_W)) * t;
      g.moveTo(lx, y);
      g.lineTo(rx, y);
      g.stroke({ color: DIVIDER_COLOR, width: 0.5, alpha: 0.25 });
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
        alpha: isEdge ? 0.90 : 0.65,
      });
    }

    // ── Perspective-scaled centre dashes in each lane ─────────────────────────
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      for (let p = 6; p <= 96; p += 11) {
        const t   = p / 100;
        const cx  = laneCenterX(lane, t);
        const cy  = posToScreenY(p);
        const sc  = posToScale(p);
        const dw  = 13 * sc;
        const dh  = 2.4 * sc;
        g.rect(cx - dw / 2, cy - dh / 2, dw, dh);
        g.fill({ color: DASH_COLOR, alpha: 0.50 });
      }
    }

    // ── Horizon line at road top ───────────────────────────────────────────────
    g.moveTo(ROAD_TOP_X, ROAD_TOP_Y);
    g.lineTo(ROAD_TOP_X + ROAD_TOP_W, ROAD_TOP_Y);
    g.stroke({ color: HORIZON_COLOR, width: 1.5, alpha: 0.55 });

    // ── Breach line at road bottom (red) ─────────────────────────────────────
    g.moveTo(0, ROAD_BOTTOM_Y);
    g.lineTo(w, ROAD_BOTTOM_Y);
    g.stroke({ color: BREACH_COLOR, width: 4 });

    this._layer.addChild(g);
  }
}
