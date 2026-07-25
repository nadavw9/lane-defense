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
// `export let`, not `const`: since 2026-07-23 (THREE_LANE_REDESIGN_BATCH.md §1)
// the band BREACH_LINE_Y/PROJ_ROAD_* derive from is lane-count-keyed and
// mutable (projection.js's setActiveLaneCount()). These used to be safe to
// compute once at module load because band was a true constant; now they must
// be recomputed per level — see recomputeRoadGeometry() below, called from the
// same per-level choke point as projection.js's own setActiveLaneCount
// (GameApp.js, right after gameRenderer3D.setActiveLaneCount()). ES module
// live bindings mean every existing `import { ROAD_BOTTOM_Y } from ...`
// call site (LaneRenderer.js's re-export chain, CityEdges.js, DragDrop.js,
// GameApp.js, FTUEOverlay.js, LoseScreen.js, TutorialOrchestrator.js,
// LaneFlash.js) sees the update automatically — no call-site changes needed.
export let ROAD_TOP_Y    = HUD_BOTTOM_Y;              // 44 — HUD bottom / side-strip top (band-independent, stays const in practice)
export let ROAD_BOTTOM_Y = Math.round(BREACH_LINE_Y); // ≈ 521 — 3D breach line (stripe anchor)
export let ROAD_HEIGHT   = ROAD_BOTTOM_Y - ROAD_TOP_Y;

// ── Projected car-position band ───────────────────────────────────────────────
let POS_TOP_Y    = PROJ_ROAD_TOP_Y;                    // ≈ 69.4 — position-0 car centre
let POS_BOTTOM_Y = PROJ_ROAD_BOTTOM_Y;                 // ≈ 475.4 — position-100 car centre
let POS_HEIGHT   = POS_BOTTOM_Y - POS_TOP_Y;

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

// Half a grid-row in px, in the PROJECTED band. A BOMB tap up to this far below
// the front car still belongs to the frontmost row.
//
// 2026-07-25 STALE-CONSTANT FIX (rows-8 pilot): this was
// `Math.round(POS_HEIGHT / 15 / 2)` — and that `15` was silently `gridRows - 1`
// for the 16-row board, hardcoded. On an 8-row board the true row interval is
// POS_HEIGHT/7, so the old formula produced a margin ~half the correct size:
// taps in the lower half of the front row's cell missed it. Now derived from
// the level's ACTUAL gridRows.
//
// Function, not a `let`: unlike the other exports here (which depend only on
// the band and are refreshed by recomputeRoadGeometry), this one additionally
// depends on gridRows, which is a per-level GAME config the geometry layer
// isn't handed. Every caller already knows it — see callers in GameApp/DragDrop.
export function frontRowTapMargin(gridRows = 16) {
  const intervals = Math.max(1, (gridRows ?? 16) - 1);
  return Math.round(POS_HEIGHT / intervals / 2);
}

// Call after projection.js's band has been updated for the new level (i.e.
// after setActiveLaneCount() in projection.js has already run).
export function recomputeRoadGeometry() {
  ROAD_TOP_Y    = HUD_BOTTOM_Y;
  ROAD_BOTTOM_Y = Math.round(BREACH_LINE_Y);
  ROAD_HEIGHT   = ROAD_BOTTOM_Y - ROAD_TOP_Y;
  POS_TOP_Y     = PROJ_ROAD_TOP_Y;
  POS_BOTTOM_Y  = PROJ_ROAD_BOTTOM_Y;
  POS_HEIGHT    = POS_BOTTOM_Y - POS_TOP_Y;
}
