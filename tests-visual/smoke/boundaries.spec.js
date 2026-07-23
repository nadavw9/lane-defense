// Hit-test boundary smoke (bug class D) — real pointer drags through DragDrop.
//
// History: taps on the frontmost row were clamped out of bounds and dropped;
// drag offsets were hardcoded for 4 lanes and missed on 2-lane levels. These
// tests perform REAL pointer drags from the queue to a lane (the full DragDrop
// path, not the _nav.deploy shortcut) on both a 2-lane and a 4-lane level.

import { test, expect } from '../fixtures/game.js';

async function dragDeploy(game, colIdx, laneIdx) {
  // Guarantee the drop is a valid color match, then drag bomb → lane center.
  // Tag the exact target car object rather than relying on cars[0] staying the
  // same object after the drag: on levels with a high laneTargetCarCount (e.g.
  // L5's 3-lane pilot retune, 2→4, THREE_LANE_REDESIGN_BATCH.md §2), refill
  // after a kill can repopulate the lane fast enough that a NEW car occupies
  // cars[0] again before `after` is read, with a coincidentally-matching hp —
  // an hp/count heuristic on array position alone can't tell a masked kill
  // from "nothing happened".
  const before = await game.page.evaluate(([c, l]) => {
    const gs = window._nav.getGs();
    const bomb = gs.columns[c].shooters[0];
    const target = gs.lanes[l].cars[0];
    target.color = bomb.color;
    target.__testTag = 'target';
    return {
      queueCount: gs.columns[c].shooters.length,
      frontHp: target.hp,
      laneCars: gs.lanes[l].cars.length,
    };
  }, [colIdx, laneIdx]);

  // Pickup Y comes from the SAME canonical bomb-slot source the live game
  // hit-tests against (projection.js bombSlotZ, via PositionRegistry) — a
  // hardcoded local constant here went stale by 33px after the board
  // re-layout (B=0.82 + DESIGN_ROAD_BOTTOM_Y change moved the true slot-0
  // center from 544 to ~585), eating most of the hit-test's safety margin
  // and making this test newly flake-prone under CI load (2026-07-13).
  const pos = await game.positions();
  await game.dragStage(pos.colX[colIdx], pos.slotY[0], pos.laneX[laneIdx], 300);
  await game.page.waitForTimeout(900);   // travel + resolve + advance

  const after = await game.page.evaluate(([c, l]) => {
    const gs = window._nav.getGs();
    const target = gs.lanes[l].cars.find(car => car.__testTag === 'target');
    return {
      queueCount: gs.columns[c].shooters.length,
      targetGone: !target,
      targetHp: target?.hp ?? null,
      laneCars: gs.lanes[l].cars.length,
    };
  }, [colIdx, laneIdx]);

  return { before, after };
}

test('L2 (2-lane): drag from queue deploys into the intended lane', async ({ game }) => {
  await game.startLevel(2);
  for (const lane of [0, 1]) {
    // FTUE hint cards can intercept the pickup after a first successful drag
    // (by design, DragDrop shows contextual hints) — clear them between drags.
    await game.dismissOverlays(3);
    const { before, after } = await dragDeploy(game, lane, lane);
    const hit = after.targetGone || (after.targetHp != null && after.targetHp < before.frontHp);
    expect(hit, `2-lane drag deploy into lane ${lane} did not land (offset bug?)`).toBe(true);
  }
});

// L5: 4→3 lanes, THREE_LANE_REDESIGN_BATCH.md §2 pilot (2026-07-23) — outermost
// lanes are 0 and 2, not 0 and 3.
test('L5 (3-lane): drag deploys land on outermost lanes (0 and 2)', async ({ game }) => {
  await game.startLevel(5);
  for (const lane of [0, 2]) {
    await game.dismissOverlays(3);
    const { before, after } = await dragDeploy(game, lane, lane);
    const hit = after.targetGone || (after.targetHp != null && after.targetHp < before.frontHp);
    expect(hit, `3-lane drag deploy into lane ${lane} did not land`).toBe(true);
  }
});

test('L5: lane bounds tile the road with no gaps (tap-mapping invariant)', async ({ game }) => {
  await game.startLevel(5);
  const pos = await game.positions();
  // Adjacent lane bounds must be contiguous: a tap anywhere on the road maps to
  // exactly one lane, with no dead zones between lanes.
  for (let i = 1; i < pos.laneCount; i++) {
    const gap = pos.laneBounds[i].left - pos.laneBounds[i - 1].right;
    expect(Math.abs(gap), `dead zone between lanes ${i - 1} and ${i}`).toBeLessThanOrEqual(1);
  }
});
