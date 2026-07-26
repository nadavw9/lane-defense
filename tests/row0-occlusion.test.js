// Row-0 occlusion contract (option E, 2026-07-26).
//
// Row 0 is a STAGING row: fully hidden behind the goal counter's opaque band on
// every shipped level, with cars emerging whole at row 1. That was accidental
// (the band happened to be taller than a 16-row car) and became a visible defect
// when the rows-8 pilot doubled the row pitch: the same band left ~23% of a
// row-0 car protruding, which reads as cars sliced in half at level start.
//
// The fix sizes the band as max(cardsHeight, row0CoverY(gridRows)). These tests
// pin the two things that make that safe:
//   1. it is a GUARANTEED no-op on every shipped 16-row board, and
//   2. it never grows far enough to occlude row 1, at any depth or lane count.
import { describe, it, expect } from 'vitest';
import {
  row0CoverY, row1TopY, MAX_CAR_FIT, setActiveLaneCount,
} from '../src/renderer3d/projection.js';

// Mirrors GoalCounterUI's card-sizing constants.
const PANEL_TOP_Y = 12, CARD_H = 70, CARD_GAP = 12;
const cardsH = (rows = 1) => PANEL_TOP_Y * 2 + rows * CARD_H + (rows - 1) * CARD_GAP;
const bandH  = (gridRows, rows = 1) => Math.max(cardsH(rows), row0CoverY(gridRows));

const LANE_COUNTS = [1, 2, 3, 4];

describe('row-0 occlusion — the band fully hides row 0 without touching row 1', () => {
  it('MAX_CAR_FIT matches the longest entry in Car3D\'s FIT table', async () => {
    // projection.js mirrors this value instead of importing it (Car3D imports
    // projection, so the reverse would be a cycle). If Car3D's FIT changes and
    // this is not updated, the band silently stops covering the longest car.
    const src = (await import('fs')).readFileSync('src/renderer3d/Car3D.js', 'utf8');
    const line = src.match(/const FIT = \{([^}]*)\}/);
    expect(line, 'could not find Car3D\'s FIT table').not.toBeNull();
    const values = [...line[1].matchAll(/:\s*([0-9.]+)/g)].map((m) => Number(m[1]));
    expect(values.length).toBeGreaterThan(0);
    expect(MAX_CAR_FIT).toBe(Math.max(...values));
  });

  it('is an EXACT no-op on every shipped 16-row board, at every lane count', () => {
    for (const lanes of LANE_COUNTS) {
      setActiveLaneCount(lanes);
      expect(bandH(16), `${lanes}-lane @16 rows must equal the historical card-sized band`)
        .toBe(cardsH(1));
      expect(bandH(16, 2), `${lanes}-lane @16 rows, 2 card rows`).toBe(cardsH(2));
    }
  });

  it('fully covers row 0 on the rows-8 pilot (the case it exists for)', () => {
    setActiveLaneCount(3);
    expect(bandH(8)).toBeGreaterThanOrEqual(row0CoverY(8));
    expect(bandH(8), 'rows-8 must actually GROW the band, else the defect remains')
      .toBeGreaterThan(cardsH(1));
  });

  // THE ACTUAL CONTRACT. An absolute "band never reaches row 1" assertion is
  // NOT satisfiable — and never has been: at gridRows 16 the card-sized band is
  // 94px while row 1's longest car (bigrig) starts at y 91.6 on 1/2/4-lane
  // boards, so the SHIPPED band already clips ~2.4px (11%) off its nose. That
  // is pre-existing and unreported, documented in the test below.
  //
  // What this change must guarantee is that it never makes that worse: wherever
  // the band GROWS beyond the historical card height, it must stay clear of
  // row 1. At depths where it does not grow, the band is byte-identical to
  // today and cannot introduce anything new.
  it('wherever the band GROWS, it stays clear of row 1', () => {
    for (const lanes of LANE_COUNTS) {
      setActiveLaneCount(lanes);
      for (const gridRows of [8, 9, 10, 11, 12, 14, 16]) {
        const grown = bandH(gridRows) > cardsH(1);
        if (!grown) {
          expect(bandH(gridRows), `${lanes}-lane @${gridRows}: unchanged band must equal today's`)
            .toBe(cardsH(1));
          continue;
        }
        expect(bandH(gridRows), `${lanes}-lane @${gridRows} rows: grown band reaches row 1`)
          .toBeLessThan(row1TopY(gridRows));
      }
    }
  });

  // Pins the PRE-EXISTING clip so it is tracked rather than silently inherited,
  // and so anyone re-tuning CARD_H or the band sees the interaction. If a future
  // change makes this worse, this test fails and the decision becomes explicit.
  it('documents the pre-existing 16-row row-1 clip (not introduced here)', () => {
    for (const lanes of [1, 2, 4]) {
      setActiveLaneCount(lanes);
      const overlap = cardsH(1) - row1TopY(16);
      expect(overlap, `${lanes}-lane @16 rows: historical clip changed size`)
        .toBeCloseTo(2.4, 0);
      // It is the CARD height causing it, not the row-0 floor — row0CoverY is
      // well below the card height at this depth, so this change is not a factor.
      expect(row0CoverY(16)).toBeLessThan(cardsH(1));
    }
  });

  it('row 0 is fully covered at every depth the band is applied to', () => {
    for (const lanes of LANE_COUNTS) {
      setActiveLaneCount(lanes);
      for (const gridRows of [8, 9, 10, 11, 12, 14, 16]) {
        expect(bandH(gridRows), `${lanes}-lane @${gridRows} rows: row 0 protrudes`)
          .toBeGreaterThanOrEqual(row0CoverY(gridRows));
      }
    }
  });

  it('GameApp sets board depth on the goal counter BEFORE its goals', async () => {
    const src = (await import('fs')).readFileSync('src/renderer/GameApp.js', 'utf8');
    const depth = src.indexOf('goalCounterUI.setGridRows(');
    const goals = src.indexOf('goalCounterUI.setGoals(');
    expect(depth, 'goalCounterUI.setGridRows(...) is never called').toBeGreaterThan(-1);
    expect(depth, 'depth must be set before setGoals — setGoals is what lays the band out')
      .toBeLessThan(goals);
  });

  // The failure this test exists for shipped past the unit tests above and was
  // only caught by looking at a screenshot: row0CoverY() reads projection.js,
  // whose scale is LANE-COUNT-KEYED, so laying the band out before
  // setActiveLaneCount() sizes it against the previous level's band. The maths
  // tests all passed because they call setActiveLaneCount themselves.
  it('GameApp sizes the goal band AFTER the lane count reconfigures the projection', async () => {
    const src = (await import('fs')).readFileSync('src/renderer/GameApp.js', 'utf8');
    const lanes = src.indexOf('gameRenderer3D.setActiveLaneCount(');
    const band  = src.indexOf('goalCounterUI.setGoals(');
    expect(lanes, 'setActiveLaneCount(...) is never called').toBeGreaterThan(-1);
    expect(band, 'the goal band must be laid out after the projection is reconfigured')
      .toBeGreaterThan(lanes);
  });
});
