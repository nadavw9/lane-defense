// Tests for screenYToRow() — the BOMB booster tap Y → grid row mapping.
// Regression: the frontmost row (gridRows-1) renders AT ROAD_BOTTOM_Y, so a tap
// on its lower half lands below the breach line. It must still map to the last
// row (clamped) and never overflow to an out-of-bounds index.
// Pure module (no Pixi import) so it runs headless.

import { describe, it, expect } from 'vitest';
import {
  screenYToRow, FRONT_ROW_TAP_MARGIN, ROAD_TOP_Y, ROAD_BOTTOM_Y,
} from '../src/renderer/roadGeometry.js';

describe('screenYToRow() — BOMB booster tap Y → grid row', () => {
  it('maps a tap at the road top to row 0', () => {
    expect(screenYToRow(ROAD_TOP_Y, 11)).toBe(0);
  });

  it('maps a tap at the exact breach line to the frontmost row (gridRows-1)', () => {
    expect(screenYToRow(ROAD_BOTTOM_Y, 11)).toBe(10);
  });

  it('maps a tap in the frontmost row lower half (below the breach line) to gridRows-1, not out of bounds', () => {
    // half a row below the breach line — still the frontmost row, clamped
    expect(screenYToRow(ROAD_BOTTOM_Y + FRONT_ROW_TAP_MARGIN, 11)).toBe(10);
    // even far past it never overflows to row 11+
    expect(screenYToRow(ROAD_BOTTOM_Y + 100, 11)).toBe(10);
  });

  it('never returns a row outside [0, gridRows-1] across the whole span', () => {
    for (let y = -50; y <= 700; y += 7) {
      const r = screenYToRow(y, 11);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(10);
    }
  });

  it('honours a non-default gridRows', () => {
    expect(screenYToRow(ROAD_BOTTOM_Y, 6)).toBe(5);            // last row of a 6-row grid
    expect(screenYToRow(ROAD_BOTTOM_Y + 40, 6)).toBe(5);       // below breach → clamped
  });
});
