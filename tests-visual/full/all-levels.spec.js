// Full 40-level sweep (nightly / manual: `npm run test:visual:full`).
//
// Boots EVERY level and asserts the universal invariants: board primed on all
// active lanes/columns, cars actually rendered at lane positions, and (via the
// fixture) zero console errors / zero failed requests. ~6-8 minutes.

import { test, expect } from '../fixtures/game.js';

for (let level = 1; level <= 40; level++) {
  test(`L${level}: boots primed and renders cars`, async ({ game }) => {
    await game.startLevel(level);

    const gs = await game.gs();
    expect(gs.levelId).toBe(level);
    expect(gs.isOver).toBe(false);
    expect(gs.goals.length).toBeGreaterThan(0);

    for (const [i, lane] of gs.lanes.entries()) {
      expect(lane.count, `L${level} lane ${i} empty`).toBeGreaterThan(0);
    }
    for (const [i, col] of gs.cols.entries()) {
      expect(col.count, `L${level} column ${i} empty`).toBeGreaterThan(0);
    }

    // At least one lane shows colored car pixels at its projected position.
    const pos = await game.positions();
    let rendered = 0;
    for (let i = 0; i < gs.laneCount; i++) {
      const row = Math.min(gs.lanes[i].frontRow ?? 0, gs.gridRows - 4);
      const y = game.rowToStageY(row, gs.gridRows);
      const s = await game.sampleRegion(pos.laneX[i], y, 12);
      if (s.colorfulness > 18) rendered++;
    }
    expect(rendered, `L${level}: no colored car pixels found on any lane`).toBeGreaterThan(0);
  });
}
