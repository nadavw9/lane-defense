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

// Screen X at the horizontal center of lane laneIdx (bottom-of-road perspective).
export function getLaneScreenX(laneIdx) {
  return (laneIdx + 0.5) * (ROAD_BOTTOM_W / _laneCount);
}

// Three.js world X for lane laneIdx.
export function getLaneWorldX(laneIdx) {
  return laneToX(laneIdx, _laneCount);
}

// Screen X at the horizontal center of shooter column colIdx.
export function getColumnScreenX(colIdx) {
  return (colIdx + 0.5) * (APP_W / _colCount);
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
