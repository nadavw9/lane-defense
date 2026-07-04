// roadGeometry — pure road↔screen vertical geometry.
//
// NO Pixi/Three/DOM imports, so it is safe to import from headless tests and
// from director/input code. LaneRenderer re-exports these so existing
// `import { ROAD_TOP_Y, posToScreenY } from './LaneRenderer.js'` callers keep
// working unchanged.
//
// TWO distinct kinds of Y values live here — do not mix them up:
//  - LAYOUT anchors (ROAD_TOP_Y / ROAD_BOTTOM_Y): where 2D chrome sits — the
//    band below the HUD and the visual breach line the stripe is drawn at.
//  - PROJECTED mapping (posToScreenY / screenYToRow): where a car at game
//    position [0-100] ACTUALLY renders, derived from the live 3D camera math in
//    renderer3d/projection.js. These used to be a hardcoded 44..510 linear map
//    from the ROAD_Z_FAR=-22 era and were ~25px off after the road extension —
//    caught by the visual harness (bug class C).

import {
  posToScreenYProjected, PROJ_ROAD_TOP_Y, PROJ_ROAD_BOTTOM_Y,
  BREACH_LINE_Y, HUD_BOTTOM_Y,
} from '../renderer3d/projection.js';

// ── Layout anchors (2D chrome) ────────────────────────────────────────────────
export const ROAD_TOP_Y    = HUD_BOTTOM_Y;              // 44 — HUD bottom / side-strip top
export const ROAD_BOTTOM_Y = Math.round(BREACH_LINE_Y); // ≈ 521 — 3D breach line (stripe anchor)
export const ROAD_HEIGHT   = ROAD_BOTTOM_Y - ROAD_TOP_Y;

// ── Projected car-position band ───────────────────────────────────────────────
const POS_TOP_Y    = PROJ_ROAD_TOP_Y;                    // ≈ 69.4 — position-0 car centre
const POS_BOTTOM_Y = PROJ_ROAD_BOTTOM_Y;                 // ≈ 475.4 — position-100 car centre
const POS_HEIGHT   = POS_BOTTOM_Y - POS_TOP_Y;

// Screen Y for game-unit position [0-100] — where the car at that position
// actually renders (same projection as the 3D camera).
export function posToScreenY(position) {
  return posToScreenYProjected(position);
}

// Inverse of posToScreenY for the BOMB booster: tap Y → grid row index.
// Rows are clamped to [0, gridRows-1] so taps above the far row / below the
// front row map to the nearest real row instead of overflowing the grid.
export function screenYToRow(y, gridRows) {
  const t   = (y - POS_TOP_Y) / POS_HEIGHT;   // 0 far … 1 front
  const row = Math.round(t * (gridRows - 1));
  return Math.max(0, Math.min(gridRows - 1, row));
}

// Half a grid-row in px (16-row grid → 15 intervals) in the PROJECTED band.
// A BOMB tap up to this far below the front car still belongs to the frontmost
// row. Stays well above the first bomb-queue slot (ShooterRenderer TOP_Y = 544).
export const FRONT_ROW_TAP_MARGIN = Math.round(POS_HEIGHT / 15 / 2);   // ≈ 14 px
