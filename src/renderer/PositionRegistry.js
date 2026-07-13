// PositionRegistry — single source of truth for lane and column screen positions.
// Call setActiveCounts() at level start so all consumers use the correct geometry.
//
// All math is DERIVED from renderer3d/projection.js (the same formula the live
// ortho camera uses), never hardcoded — a hardcoded FRUSTUM_HALF_X mirror went
// stale here once (9.650 from the ROAD_Z_FAR=-22 era vs the real 11.237) and
// shifted every 2D overlay/tap anchor ~17px at the outer lanes.

import {
  laneToXPure, CELL, worldXToScreenX, screenXToWorldX, zToScreenY, screenYToZ,
  bombSlotScreenY,
} from '../renderer3d/projection.js';

const APP_W = 390;

let _laneCount = 4;
let _colCount  = 4;

export function setActiveCounts({ laneCount = 4, colCount = 4 } = {}) {
  _laneCount = laneCount;
  _colCount  = colCount;
}

// Screen X at the horizontal center of lane laneIdx — the projection of the same
// laneToX() world X the 3D renderer positions cars at.
export function getLaneScreenX(laneIdx) {
  return worldXToScreenX(laneToXPure(laneIdx, _laneCount));
}

// Three.js world X for lane laneIdx.
export function getLaneWorldX(laneIdx) {
  return laneToXPure(laneIdx, _laneCount);
}

// Screen X at the horizontal center of shooter column colIdx.
// Columns sit directly under their lanes, so this MUST use the same projection
// as getLaneScreenX — the bombs render in 3D via laneToX(). (FIX 2)
export function getColumnScreenX(colIdx) {
  return worldXToScreenX(laneToXPure(colIdx, _colCount));
}

// Screen Y of the top shooter row.
export function getColumnScreenY() { return bombSlotScreenY(0); }

// Exact on-screen centre Y of bomb-queue slot rowIdx (0,1,2,3=stash) — the
// SAME canonical function Shooter3D's 3D ball and ShooterRenderer's touch
// targets use (projection.js bombSlotZ). Do not re-derive this locally —
// see that function's comment.
export function getColumnSlotScreenY(rowIdx) {
  return bombSlotScreenY(rowIdx);
}

// Width of one shooter column in screen pixels.
export function getColScreenW() { return APP_W / _colCount; }

// Half a lane (CELL world units wide) projected to screen px. Top-down ortho, so
// lanes are vertical strips of constant width.
const LANE_HALF_PX = worldXToScreenX(CELL / 2) - worldXToScreenX(0);

// Lane index whose projected centre is nearest screen x — the SAME projection
// the cars/bombs render with, so a tap on a car lands on that car's lane.
export function getLaneFromScreenX(x) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < _laneCount; i++) {
    const d = Math.abs(x - getLaneScreenX(i));
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

// {left, right} screen X bounds of lane laneIdx — a vertical strip centred on the
// lane's projected screen X (top-down view: same bounds top and bottom).
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
// road plane. Used to start a bomb's travel at the player's actual release point.
export function screenToWorldXZ(sx, sy) {
  return { x: screenXToWorldX(sx), z: screenYToZ(sy) };
}
