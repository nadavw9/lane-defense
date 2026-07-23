// Layout smoke (bug classes A + C) — lane geometry on 1/2/3/4-lane levels.
//
// History: explosion X, bomb drag offset, and BOMB lane mapping have each broken
// on <4-lane levels because something assumed 4 lanes. These tests boot L1/L2/L3/L5
// and assert (1) geometric invariants of the game's own PositionRegistry output,
// (2) a real rendered car sits at every lane's projected X, and (3) a deploy into
// lane i damages lane i — end to end through the live game.

import { test, expect } from '../fixtures/game.js';

const CASES = [
  { level: 1, lanes: 1 },
  { level: 2, lanes: 2 },
  { level: 3, lanes: 3 },
  // L5: 4→3 lanes, THREE_LANE_REDESIGN_BATCH.md §2 pilot (2026-07-23).
  { level: 5, lanes: 3 },
  // L9 stays the reference 4-lane case now that L5 is part of the pilot.
  { level: 9, lanes: 4 },
];

for (const { level, lanes } of CASES) {
  test(`L${level} (${lanes}-lane): geometry invariants + cars rendered per lane`, async ({ game }) => {
    await game.startLevel(level);

    const gs = await game.gs();
    const pos = await game.positions();
    expect(gs.laneCount).toBe(lanes);
    expect(pos.laneCount).toBe(lanes);
    expect(pos.laneX).toHaveLength(lanes);

    // Geometric invariants — catch any "naive (i+0.5)*W/4" regression instantly.
    for (let i = 0; i < lanes; i++) {
      expect(pos.laneX[i]).toBeGreaterThan(0);
      expect(pos.laneX[i]).toBeLessThan(390);
      const b = pos.laneBounds[i];
      expect(pos.laneX[i]).toBeGreaterThan(b.left);
      expect(pos.laneX[i]).toBeLessThan(b.right);
      if (i > 0) {
        expect(pos.laneX[i]).toBeGreaterThan(pos.laneX[i - 1]);
        // lanes must not overlap
        expect(b.left).toBeGreaterThanOrEqual(pos.laneBounds[i - 1].right - 1);
      }
    }
    // Columns sit under their lanes when counts match.
    if (pos.colCount === lanes) {
      for (let i = 0; i < lanes; i++) expect(Math.abs(pos.colX[i] - pos.laneX[i])).toBeLessThan(2);
    }

    // A real car renders at each lane's projected X. Discriminator: mean-color
    // DISTANCE between the car patch and the empty road below it — robust for
    // any road tint (world roads are warm/concrete/night-blue, not neutral grey).
    for (let i = 0; i < lanes; i++) {
      const lane = gs.lanes[i];
      expect(lane.count, `lane ${i} has no cars after boot`).toBeGreaterThan(0);
      // Sample at the front car's row; avoid rows near the breach stripe.
      const row = Math.min(lane.frontRow ?? 0, gs.gridRows - 4);
      const y = game.rowToStageY(row, gs.gridRows, gs.laneCount);
      // Road sample must clear the car's own rendered footprint. A fixed 55px
      // gap was calibrated for the pre-2026-07-23 band=540 car scale; 3-lane
      // levels now render ~34% bigger (THREE_LANE_REDESIGN_BATCH.md §1, band=730),
      // so a fixed px gap can land back on the car itself. Derive the gap from
      // the live row-to-row spacing (same projection the game renders with)
      // instead of a hardcoded pixel value — 1.5 rows clears any car's height
      // at any band.
      const rowSpacingPx = game.rowToStageY(row + 1, gs.gridRows, gs.laneCount)
                          - game.rowToStageY(row, gs.gridRows, gs.laneCount);
      const roadGap = Math.round(Math.abs(rowSpacingPx) * 1.5);
      const car = await game.sampleRegion(pos.laneX[i], y, 12);
      const road = await game.sampleRegion(pos.laneX[i], y + roadGap, 12);   // empty road below
      const dist = Math.abs(car.r - road.r) + Math.abs(car.g - road.g) + Math.abs(car.b - road.b);
      expect(dist, `no car pixels distinct from road at lane ${i} (x=${pos.laneX[i].toFixed(0)}, y=${y.toFixed(0)})`)
        .toBeGreaterThan(28);
    }
  });
}

test('L5: deploying into lane i damages lane i (not a neighbour)', async ({ game }) => {
  await game.startLevel(5);

  // L5 is 3-lane (THREE_LANE_REDESIGN_BATCH.md §2 pilot, 2026-07-23) — leftmost
  // and rightmost are 0 and 2, not 0 and 3.
  for (const lane of [0, 2]) {   // leftmost and rightmost — where offset bugs bite
    // Make col 0's top bomb a guaranteed match for the target lane's front car,
    // and tag that exact car object (not just "whatever is at cars[0]" — L5's
    // 2026-07-23 pilot retune raised laneTargetCarCount 2→4, so refill after a
    // kill can repopulate the lane fast enough that a NEW car occupies cars[0]
    // again by the time `after` is read, with a coincidentally-matching hp —
    // a hp/count heuristic on array position alone can't tell a masked kill
    // from "nothing happened". Track the tagged car's survival instead.
    const before = await game.page.evaluate((l) => {
      const gs = window._nav.getGs();
      const bomb = gs.columns[0].shooters[0];
      const target = gs.lanes[l].cars[0];
      target.color = bomb.color;   // recolor front car to match
      target.__testTag = 'target';
      return {
        hp: target.hp,
        count: gs.lanes[l].cars.length,
        others: gs.lanes.filter((_, i) => i !== l && i < gs.activeLaneCount)
                        .map((ln) => ln.cars.length),
      };
    }, lane);

    await game.deploy(0, lane);
    // game.deploy()'s internal 650ms wait is occasionally too tight for the
    // shot-travel + damage + advance + refill cycle to fully settle before we
    // read state below (observed as a rare flake reading mid-resolution state,
    // not a logic bug — see the tag-based detection above). A small extra
    // margin here is cheap insurance against CI's slower software-WebGL timing.
    await game.page.waitForTimeout(400);

    const after = await game.page.evaluate((l) => {
      const gs = window._nav.getGs();
      const target = gs.lanes[l].cars.find(c => c.__testTag === 'target');
      return {
        targetGone: !target,
        targetHp: target?.hp ?? null,
        count: gs.lanes[l].cars.length,
      };
    }, lane);

    // Damaged = the tagged car is gone (killed) or its hp dropped. A refill
    // bringing count back up (or even above) the original is expected now and
    // is NOT evidence of "no effect" — it's the retuned density working as intended.
    const damaged = after.targetGone || (after.targetHp != null && after.targetHp < before.hp);
    expect(damaged, `deploy(0, ${lane}) had no effect on lane ${lane}`).toBe(true);
  }
});
