// Tests for screenYToRow() — the BOMB booster tap Y → grid row mapping.
// Regression: the frontmost row (gridRows-1) renders AT ROAD_BOTTOM_Y, so a tap
// on its lower half lands below the breach line. It must still map to the last
// row (clamped) and never overflow to an out-of-bounds index.
// Pure module (no Pixi import) so it runs headless.

import { describe, it, expect } from 'vitest';
import {
  screenYToRow, frontRowTapMargin, ROAD_TOP_Y, ROAD_BOTTOM_Y,
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
    expect(screenYToRow(ROAD_BOTTOM_Y + frontRowTapMargin(11), 11)).toBe(10);
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

// 2026-07-25 stale-constant regression (rows-8 pilot): frontRowTapMargin was
// `POS_HEIGHT / 15 / 2`, where the `15` was silently gridRows-1 for a 16-row
// board. On any other depth the margin was wrong — roughly HALF the correct
// size at gridRows 8, so taps in the lower part of the front row's cell missed
// it. It must be derived from the actual board depth.
describe('frontRowTapMargin(gridRows) — scales with board depth', () => {
  it('is half a real row interval at each depth', () => {
    // A row interval is the full front-row cell height; the margin is half of it.
    // Derive the interval empirically from the projection: it is the Y distance
    // between consecutive rows, so margin*2*(gridRows-1) ≈ the whole band.
    for (const rows of [8, 11, 16]) {
      const margin = frontRowTapMargin(rows);
      const bandFromMargin = margin * 2 * (rows - 1);
      const actualBand = ROAD_BOTTOM_Y - ROAD_TOP_Y;
      // Within rounding + the band/POS_HEIGHT distinction (POS_HEIGHT is the
      // car-centre span, slightly inside the chrome band) — generous tolerance,
      // the point is it TRACKS depth rather than being frozen at one value.
      expect(bandFromMargin, `gridRows ${rows}`).toBeGreaterThan(actualBand * 0.5);
      expect(bandFromMargin, `gridRows ${rows}`).toBeLessThan(actualBand * 1.6);
    }
  });

  it('a shallower board yields a LARGER margin (rows are taller)', () => {
    expect(frontRowTapMargin(8)).toBeGreaterThan(frontRowTapMargin(16));
    // ~2x taller rows at half the depth (7 vs 15 intervals)
    expect(frontRowTapMargin(8) / frontRowTapMargin(16)).toBeGreaterThan(1.8);
  });

  it('is unchanged at the 16-row standard (no behaviour drift for un-converted levels)', () => {
    // The old hardcoded formula was POS_HEIGHT/15/2 — identical to the derived
    // value at gridRows 16, which is what makes this fix a no-op there.
    expect(frontRowTapMargin(16)).toBe(frontRowTapMargin());   // default arg
  });

  it('never returns a degenerate margin for tiny/absent gridRows', () => {
    expect(frontRowTapMargin(1)).toBeGreaterThan(0);
    expect(frontRowTapMargin(undefined)).toBeGreaterThan(0);
  });
});
