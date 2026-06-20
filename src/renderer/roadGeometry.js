// roadGeometry — pure road↔screen vertical geometry.
//
// NO Pixi/Three/DOM imports, so it is safe to import from headless tests and
// from director/input code. LaneRenderer re-exports these so existing
// `import { ROAD_TOP_Y, posToScreenY } from './LaneRenderer.js'` callers keep
// working unchanged; the values live here as the single source of truth.

export const ROAD_TOP_Y    = 44;   // px — HUD bottom / road top
export const ROAD_BOTTOM_Y = 510;  // px — road bottom / shooter area boundary
export const ROAD_HEIGHT   = ROAD_BOTTOM_Y - ROAD_TOP_Y;  // 466 px

// Screen Y for game-unit position [0-100].
export function posToScreenY(position) {
  return ROAD_TOP_Y + (position / 100) * ROAD_HEIGHT;
}

// Inverse of posToScreenY for the BOMB booster: tap Y → grid row index.
// The frontmost row (gridRows-1) renders AT ROAD_BOTTOM_Y, so its lower half
// sits below the breach line; clamp to [0, gridRows-1] so those taps map to the
// last row instead of overflowing past the grid.
export function screenYToRow(y, gridRows) {
  const t   = (y - ROAD_TOP_Y) / ROAD_HEIGHT;   // 0 far … 1 breach
  const row = Math.round(t * (gridRows - 1));
  return Math.max(0, Math.min(gridRows - 1, row));
}

// Half a grid-row in px (standard 11-row grid → 10 intervals). A BOMB tap up to
// this far below the breach line still belongs to the frontmost row, whose car
// centre sits ON ROAD_BOTTOM_Y. 23px lands at ~533, above the first bomb-queue
// slot (ShooterRenderer TOP_Y = 544), so it never steals queue taps.
export const FRONT_ROW_TAP_MARGIN = Math.round(ROAD_HEIGHT / 10 / 2);  // ≈ 23 px
