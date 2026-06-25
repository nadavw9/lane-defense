// PositionRegistry — single source of truth for lane and column screen positions.
// Call setActiveCounts() at level start so all consumers use the correct geometry.

import { laneToX, CELL, ROAD_Z_FAR, ROAD_Z_NEAR } from '../renderer3d/Scene3D.js';
import { ROAD_BOTTOM_W, ROAD_TOP_W, ROAD_TOP_X,
         ROAD_TOP_Y, ROAD_BOTTOM_Y } from './LaneRenderer.js';

const APP_W = 390;

// TOP_Y = SHOOTER_AREA_Y(520) + 24 — mirrors ShooterRenderer.TOP_Y without the import
const COLUMN_TOP_Y = 544;

let _laneCount = 4;
let _colCount  = 4;

export function setActiveCounts({ laneCount = 4, colCount = 4 } = {}) {
  _laneCount = laneCount;
  _colCount  = colCount;
}

// FRUSTUM_HALF_X mirrors Scene3D._computeFrustum at 390×844.
const FRUSTUM_HALF_X = 9.651;
const FRUSTUM_DIAM   = 2 * FRUSTUM_HALF_X;

// Screen X at the horizontal center of lane laneIdx — aligned with 3D ortho projection.
export function getLaneScreenX(laneIdx) {
  const worldX = laneToX(laneIdx, _laneCount);
  return (worldX + FRUSTUM_HALF_X) / FRUSTUM_DIAM * APP_W;
}

// Three.js world X for lane laneIdx.
export function getLaneWorldX(laneIdx) {
  return laneToX(laneIdx, _laneCount);
}

// Screen X at the horizontal center of shooter column colIdx.
// Columns sit directly under their lanes, so this MUST use the same 3D ortho
// projection as getLaneScreenX — the bombs render in 3D via laneToX(). The old
// naive even-spacing ((colIdx+0.5)*APP_W/_colCount) was off from the visual bomb
// by up to ~57px on 2-lane levels and ±25px on 4-lane levels. (FIX 2)
export function getColumnScreenX(colIdx) {
  const worldX = laneToX(colIdx, _colCount);
  return (worldX + FRUSTUM_HALF_X) / FRUSTUM_DIAM * APP_W;
}

// Screen Y of the top shooter row (constant).
export function getColumnScreenY() { return COLUMN_TOP_Y; }

// Exact on-screen centre Y of bomb-queue slot rowIdx (0,1,2) — the SAME point the
// 3D bomb projects to. Bombs render in 3D at world Z = slotZ = (rowIdx+0.5)·CELL·0.70
// (mirrors Shooter3D.slotZ); project that Z to screen Y with the identical linear
// ortho mapping the road uses (ROAD_Z_FAR↔ROAD_TOP_Y, ROAD_Z_NEAR↔ROAD_BOTTOM_Y),
// extended past the breach line (z>0). Derived from the bomb's own coordinates — no
// fixed offset — so overlays land exactly concentric with the bomb.
export function getColumnSlotScreenY(rowIdx) {
  const slotZ = (rowIdx + 0.5) * CELL * 0.70;
  const t     = (slotZ - ROAD_Z_FAR) / (ROAD_Z_NEAR - ROAD_Z_FAR);
  return ROAD_TOP_Y + t * (ROAD_BOTTOM_Y - ROAD_TOP_Y);
}

// Width of one shooter column in screen pixels.
export function getColScreenW() { return APP_W / _colCount; }

// Half a lane (CELL=4 world units → 2 units half) projected to screen px. The road
// is top-down orthographic, so lanes are vertical strips of constant width.
const LANE_HALF_PX = (2 / FRUSTUM_DIAM) * APP_W;

// Lane index whose 3D-projected centre is nearest screen x. This is the SAME
// projection the cars/bombs render with (getLaneScreenX), so a tap on a car lands
// on that car's lane — unlike the old naive ROAD_BOTTOM_W/_laneCount split, which
// drifted from the rendered lanes on 1/2/3-lane levels and mis-targeted deploys.
export function getLaneFromScreenX(x) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < _laneCount; i++) {
    const d = Math.abs(x - getLaneScreenX(i));
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

// {left, right} screen X bounds of lane laneIdx — a vertical strip centred on the
// lane's 3D-projected screen X (top-down view: same bounds top and bottom).
export function getLaneScreenBounds(laneIdx) {
  const c = getLaneScreenX(laneIdx);
  return { left: c - LANE_HALF_PX, right: c + LANE_HALF_PX };
}

// Top-of-road bounds — identical to getLaneScreenBounds because the top-down road
// has parallel (non-converging) lanes.
export function getTopLaneScreenBounds(laneIdx) {
  return getLaneScreenBounds(laneIdx);
}

export function getActiveLaneCount() { return _laneCount; }
export function getActiveColCount()  { return _colCount; }

// Invert the ortho projection: a screen point (PixiJS px) → world {x, z} on the
// road plane. Mirrors getLaneScreenX for X and the frustum's linear Z↔Y mapping
// (z=ROAD_Z_FAR ↔ y=ROAD_TOP_Y, z=ROAD_Z_NEAR ↔ y=ROAD_BOTTOM_Y). Used to start a
// bomb's travel at the player's actual release point.
export function screenToWorldXZ(sx, sy) {
  const x = (sx / APP_W) * FRUSTUM_DIAM - FRUSTUM_HALF_X;
  const t = (sy - ROAD_TOP_Y) / (ROAD_BOTTOM_Y - ROAD_TOP_Y);
  const z = ROAD_Z_FAR + t * (ROAD_Z_NEAR - ROAD_Z_FAR);
  return { x, z };
}
