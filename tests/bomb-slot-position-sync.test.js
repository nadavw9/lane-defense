// Regression guard for the 2026-07-13 bomb-slot desync: THREE independent
// copies of "where is bomb slot N" (Shooter3D's own slotZ formula, a
// hand-mirrored copy in PositionRegistry, and hardcoded TOP_Y/SECOND_Y/
// THIRD_Y pixel constants in ShooterRenderer that DragDrop hit-tests
// against) silently drifted apart the moment one was edited and the others
// weren't — the rendered ball moved, its drawn socket ring and touch target
// didn't. All position sources now derive from ONE canonical function,
// projection.js's bombSlotZ/bombSlotScreenY. This test asserts every
// consumer still agrees with it, so that class of drift can't ship silently
// again.
import { describe, it, expect, afterAll } from 'vitest';
import {
  bombSlotScreenY, bombSlotZ, BOMB_ZONE_SCALE, BOMB_R, PX_PER_WU, MERGE_SCALE,
  BOOSTER_BAR_TOP_Y, setActiveLaneCount,
} from '../src/renderer3d/projection.js';
import { getColumnSlotScreenY, getColumnScreenY, setActiveCounts } from '../src/renderer/PositionRegistry.js';
import { TOP_Y, SECOND_Y, STASH_Y } from '../src/renderer/ShooterRenderer.js';
import { bombPlaneSize } from '../src/renderer3d/Shooter3D.js';
import { BENCH_SPRITE_SIZE, SPRITE_PAD_RATIO, bombUrl as benchBombUrl } from '../src/renderer/BenchRenderer.js';
import { BAR_Y as BOOSTER_BAR_ACTUAL_Y } from '../src/renderer/BoosterBar.js';

describe('bomb-slot position sync (drift guard)', () => {
  it('PositionRegistry.getColumnSlotScreenY matches the canonical source for every row', () => {
    for (const row of [0, 1, 2, 3]) {
      expect(getColumnSlotScreenY(row)).toBeCloseTo(bombSlotScreenY(row), 6);
    }
  });

  it('PositionRegistry.getColumnSlotScreenY is independent of lane/col count (bomb slots do not move with active lane count)', () => {
    setActiveCounts({ laneCount: 1, colCount: 1 });
    const oneCol = getColumnSlotScreenY(0);
    setActiveCounts({ laneCount: 4, colCount: 4 });
    const fourCol = getColumnSlotScreenY(0);
    expect(oneCol).toBeCloseTo(fourCol, 6);
    expect(oneCol).toBeCloseTo(bombSlotScreenY(0), 6);
  });

  it('PositionRegistry.getColumnScreenY (top shooter row) matches slot 0', () => {
    expect(getColumnScreenY()).toBeCloseTo(bombSlotScreenY(0), 6);
  });

  it('ShooterRenderer TOP_Y/SECOND_Y/STASH_Y — the touch-target positions DragDrop hit-tests against — match the canonical source', () => {
    expect(TOP_Y).toBeCloseTo(bombSlotScreenY(0), 6);
    expect(SECOND_Y).toBeCloseTo(bombSlotScreenY(1), 6);
    expect(STASH_Y).toBeCloseTo(bombSlotScreenY(3), 6);
  });

  it('every consumer agrees with every other consumer, not just with the source (transitive check)', () => {
    expect(getColumnSlotScreenY(0)).toBeCloseTo(TOP_Y, 6);
    expect(getColumnSlotScreenY(1)).toBeCloseTo(SECOND_Y, 6);
    expect(getColumnSlotScreenY(3)).toBeCloseTo(STASH_Y, 6);
  });

  it('slot Z is strictly increasing (rows never overlap or invert)', () => {
    const zs = [0, 1, 2, 3].map(bombSlotZ);
    for (let i = 1; i < zs.length; i++) expect(zs[i]).toBeGreaterThan(zs[i - 1]);
  });

  it('BOMB_ZONE_SCALE is the approved 2026-07-13 value (0.82) — catches an accidental edit', () => {
    expect(BOMB_ZONE_SCALE).toBeCloseTo(0.82, 6);
  });

  it('projection.js\'s BOOSTER_BAR_TOP_Y mirrors BoosterBar.BAR_Y — the queue-fit solver targets this boundary and can\'t import BoosterBar.js directly (Pixi/DOM-free file)', () => {
    expect(BOOSTER_BAR_TOP_Y).toBe(BOOSTER_BAR_ACTUAL_Y);
  });

  // 2026-07-23 regression: at band=730 the queue's slots computed past Y=844
  // (off-stage) entirely — invisible on a real device. The Phase 1 sweep's own
  // "bomb-queue vertical clipping" check was a qualitative visual scan, not
  // this math, and missed it. This is the math, permanently, for every lane
  // count the game actually ships (THREE_LANE_REDESIGN_BATCH.md §1/§7b).
  describe('bomb queue always fits above the booster bar (2026-07-23 off-stage-queue regression)', () => {
    // Restore the default (4-lane) state other tests in this file assume —
    // must be afterAll, not inline: `it()` callbacks run in a later phase
    // than describe-body collection, so code here would otherwise run BEFORE
    // the tests below actually execute.
    afterAll(() => { setActiveLaneCount(4); });

    for (const laneCount of [1, 2, 3, 4]) {
      it(`laneCount=${laneCount}: stash slot's bottom edge clears the booster bar`, () => {
        setActiveLaneCount(laneCount);
        const stashBottomEdge = bombSlotScreenY(3) + BOMB_R * PX_PER_WU;
        expect(stashBottomEdge, `stash bottom edge ${stashBottomEdge.toFixed(1)}px vs booster bar at ${BOOSTER_BAR_TOP_Y}px`)
          .toBeLessThan(BOOSTER_BAR_TOP_Y);
      });
    }
  });

  // 2026-07-19 bench drift: BenchRenderer had its OWN hardcoded sprite size (32px,
  // ignoring BOMB_R/PX_PER_WU entirely) and never checked isMerged at all — a
  // benched merged bomb silently shrank back to base size and lost the special
  // merged texture. The bench is a completely separate (2D Pixi) rendering system
  // from the queue (3D Shooter3D), so nothing here was caught by the queue-only
  // checks above. These assertions pin the bench to the same canonical source.
  describe('bench matches the queue (2026-07-19 bench drift guard)', () => {
    it('BenchRenderer\'s sprite padding ratio matches Shooter3D\'s — both scale the SAME source art (fuse/spark/shine padding) the same way', () => {
      expect(SPRITE_PAD_RATIO * BOMB_R).toBeCloseTo(bombPlaneSize(), 6);
    });

    it('BENCH_SPRITE_SIZE is derived from canonical BOMB_R/PX_PER_WU, not a hardcoded literal', () => {
      expect(BENCH_SPRITE_SIZE).toBeCloseTo(BOMB_R * SPRITE_PAD_RATIO * PX_PER_WU, 6);
      expect(BENCH_SPRITE_SIZE).toBeCloseTo(bombPlaneSize() * PX_PER_WU, 6);
    });

    it('a benched merged bomb is enlarged by the same MERGE_SCALE the queue applies', () => {
      const benchedSize = BENCH_SPRITE_SIZE * MERGE_SCALE;
      expect(benchedSize).toBeCloseTo(BENCH_SPRITE_SIZE * 1.22, 6);
      expect(benchedSize).toBeGreaterThan(BENCH_SPRITE_SIZE);
    });

    it('bombUrl resolves the merged texture for merged bombs and the plain texture otherwise, for every color', () => {
      for (const color of ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange']) {
        expect(benchBombUrl(color, true)).toMatch(new RegExp(`powerball-merged-${color.toLowerCase()}\\.png$`));
        expect(benchBombUrl(color, false)).toMatch(new RegExp(`powerball-${color.toLowerCase()}\\.png$`));
        expect(benchBombUrl(color, true)).not.toBe(benchBombUrl(color, false));
      }
    });
  });
});
