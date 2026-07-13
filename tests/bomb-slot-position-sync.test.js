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
import { describe, it, expect } from 'vitest';
import { bombSlotScreenY, bombSlotZ, BOMB_ZONE_SCALE } from '../src/renderer3d/projection.js';
import { getColumnSlotScreenY, getColumnScreenY, setActiveCounts } from '../src/renderer/PositionRegistry.js';
import { TOP_Y, SECOND_Y, STASH_Y } from '../src/renderer/ShooterRenderer.js';

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
});
