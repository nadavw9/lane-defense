// PositionRegistry — single source of truth for lane and column screen positions.
// Call setActiveCounts() at level start so all consumers use the correct geometry.

import { laneToX } from '../renderer3d/Scene3D.js';
import { ROAD_BOTTOM_W, ROAD_TOP_W, ROAD_TOP_X } from './LaneRenderer.js';

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

// Width of one shooter column in screen pixels.
export function getColScreenW() { return APP_W / _colCount; }

// {left, right} screen X bounds of lane laneIdx at the bottom of the road.
export function getLaneScreenBounds(laneIdx) {
  const w = ROAD_BOTTOM_W / _laneCount;
  return { left: laneIdx * w, right: (laneIdx + 1) * w };
}

// {left, right} screen X bounds of lane laneIdx at the top of the road.
export function getTopLaneScreenBounds(laneIdx) {
  const w = ROAD_TOP_W / _laneCount;
  return {
    left:  ROAD_TOP_X + laneIdx * w,
    right: ROAD_TOP_X + (laneIdx + 1) * w,
  };
}

export function getActiveLaneCount() { return _laneCount; }
export function getActiveColCount()  { return _colCount; }
