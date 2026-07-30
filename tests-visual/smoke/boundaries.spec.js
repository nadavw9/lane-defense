// Hit-test boundary smoke (bug class D) — real pointer drags through DragDrop.
//
// History: taps on the frontmost row were clamped out of bounds and dropped;
// drag offsets were hardcoded for 4 lanes and missed on 2-lane levels. These
// tests perform REAL pointer drags from the queue to a lane (the full DragDrop
// path, not the _nav.deploy shortcut) on both a 2-lane and a 4-lane level.

import { test, expect } from '../fixtures/game.js';

/**
 * Assert the drag landed in the INTENDED lane.
 *
 * This is what these tests exist to check — the name says "deploys land on
 * outermost lanes", and the historical bugs were drag offsets hardcoded for 4
 * lanes missing on 2-lane levels. Damage was only ever a PROXY for that, and it
 * is the proxy that races: with merges gated, a merge can swap the queue's top
 * bomb mid-drag, so a different-coloured bomb launches and correctly deals no
 * damage. `landedLane` is read straight from the game's firingSlots at launch —
 * colour-independent, and impossible to race.
 *
 * NOT weaker than the old assertion. A drag that lands in the wrong lane fails
 * here and would have failed before; a drag that lands in the right lane with a
 * colour-matched bomb and still does nothing also fails, via the damage check
 * below. What is removed is the false failure where the bomb legitimately
 * mismatched.
 */
function assertLandedInLane({ landedLane, damage }, lane, tag) {
  // 1. TARGETING — the fact this file exists to check. Read from firingSlots at
  //    launch, so it is colour-independent and cannot be raced.
  if (landedLane !== -1) {
    expect(landedLane, `${tag} drag deploy went to lane ${landedLane}, not lane ${lane} — REAL targeting failure (offset bug?)`)
      .toBe(lane);
  }
  // 2. DAMAGE — as a LANE-LEVEL fact, not the survival of one pre-chosen car.
  //    A cohort car died, or the surviving cohort's total hp fell. Both hold no
  //    matter which car ended up front at impact, and refill cannot mask them
  //    because new cars are not in the cohort.
  expect(damage.died || damage.hpDropped,
    `${tag} drag deploy landed in lane ${lane} but the lane took NO damage — REAL combat failure `
    + `(cohort hp ${damage.before} -> ${damage.after}, ${damage.lost} cars lost)`).toBe(true);
}

async function dragDeploy(game, colIdx, laneIdx) {
  // Guarantee the drop is a valid color match, then drag bomb → lane center.
  // Tag the exact target car object rather than relying on cars[0] staying the
  // same object after the drag: on levels with a high laneTargetCarCount (e.g.
  // L5's 3-lane pilot retune, 2→4, THREE_LANE_REDESIGN_BATCH.md §2), refill
  // after a kill can repopulate the lane fast enough that a NEW car occupies
  // cars[0] again before `after` is read, with a coincidentally-matching hp —
  // an hp/count heuristic on array position alone can't tell a masked kill
  // from "nothing happened".
  // Same precondition as layout.spec: a shot in flight anywhere makes the
  // deploy a no-op, and lets the queue advance between the recolor and the drag.
  await game.waitForIdle();
  // Cohort snapshot BEFORE the shot — see GamePage.snapshotLane for why a cohort
  // rather than one tagged car.
  const cohort = await game.snapshotLane(laneIdx);
  const before = await game.page.evaluate(([c, l]) => {
    const gs = window._nav.getGs();
    const bomb = gs.columns[c].shooters[0];
    // Recolour EVERY car in the lane, not just cars[0]. The shot hits whichever
    // car is front AT IMPACT, and the board advances between setup and landing —
    // so matching one car leaves a legitimate colour mismatch (and correctly zero
    // damage) whenever a different car ends up front. This removes the last
    // identity assumption from setup: any front car matches.
    for (const car of gs.lanes[l].cars) car.color = bomb.color;
    const target = gs.lanes[l].cars[0];
    target.__testTag = 'target';
    // Tag the bomb OBJECT too. The queue refills the moment a bomb is consumed,
    // so shooters.length is not a usable "did it launch?" signal — but a
    // consumed bomb object never comes back.
    bomb.__testTag = 'bomb';
    return {
      queueCount: gs.columns[c].shooters.length,
      frontHp: target.hp,
      frontColor: target.color,
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

  // Perform the drag, and CONFIRM THE PICKUP ACTUALLY TOOK before waiting on the
  // result. A launch is observable: firingSlots[lane] goes non-null while the
  // bomb is in flight.
  //
  // Why this matters (2026-07-25, rows-8 pilot): a drag whose pickup is
  // swallowed by an overlay is indistinguishable, at the old wait below, from a
  // drag that landed — firingSlots[lane] is null in BOTH cases, so the wait
  // returned instantly and the test read an unchanged board and reported "did
  // not land". That is a SETUP failure being reported as a product failure.
  // The pilot's shallow opening deals a jeep at row 0 on L5, which fires the
  // "MEET THE CAR" intro card; dismissOverlays() taps a fixed number of times
  // without verifying, so under CI's slower software-WebGL the card was still
  // up at drag time. Passed 9/9 locally, failed 2/2 in CI.
  //
  // This retries the SETUP only. The hit assertion below is unchanged and just
  // as strict — a bomb that launches and misses still fails the test.
  // The signal is THE TAGGED BOMB leaving the queue — a durable change. Two
  // signals that look right and are not: firingSlots[lane] going non-null is a
  // transient in-flight window a poll can miss entirely (retrying a drag that
  // already succeeded, firing a second bomb), and shooters.length dropping is
  // erased by the queue's immediate refill.
  let launched = false;
  for (let attempt = 0; attempt < 3 && !launched; attempt++) {
    if (attempt > 0) await game.dismissOverlays(4);
    await game.dragStage(pos.colX[colIdx], pos.slotY[0], pos.laneX[laneIdx], 300);
    try {
      await game.page.waitForFunction(
        (c) => !window._nav.getGs().columns[c].shooters.some((b) => b.__testTag === 'bomb'),
        colIdx,
        { timeout: 2000 },
      );
      launched = true;
    } catch { /* pickup was intercepted — clear overlays and drag again */ }
  }
  // WHICH LANE ACTUALLY RECEIVED THE SHOT — the fact this test exists to check.
  // Captured at launch, from the game's own firingSlots, rather than inferred
  // later from damage. Damage was only ever a PROXY for targeting, and it is the
  // proxy that races: a gated merge can swap the queue's top bomb mid-drag, so a
  // different-coloured bomb launches and correctly deals no damage. Reading the
  // assigned lane is colour-independent and cannot be raced.
  const landedLane = await game.page.evaluate(() => {
    const fs = window._nav.getGs().firingSlots;
    for (const k in fs) if (fs[k] != null) return Number(k);
    return -1;                      // already resolved — fall back to the damage check
  });
  // The launched bomb's colour, for deciding whether damage is even expected.
  const firedColor = await game.page.evaluate((l) => {
    const s = window._nav.getGs().firingSlots[l];
    return s?.shooter?.color ?? s?.color ?? null;
  }, laneIdx);
  expect(launched, `bomb never left the queue for lane ${laneIdx} — the drag was REJECTED or the pickup was intercepted (blocked by: ${await game.deployBlockedReason(colIdx, laneIdx) ?? 'overlay/pickup'}); NOT a deploy-targeting failure`).toBe(true);

  // Then wait for the actual event (firingSlots[laneIdx] clears once combat/
  // advance/refill resolve) instead of a fixed wall-clock sleep — a fixed 900ms
  // proved too tight under CI's slower software-WebGL rendering combined with
  // L4-L8's higher laneTargetCarCount (THREE_LANE_REDESIGN_BATCH.md §2 pilot,
  // 2026-07-23), causing real, reproducible CI failures reading state before
  // resolution finished.
  // BUDGET, measured — not guessed (2026-07-27). Under SwiftShader (the software
  // renderer CI uses; see CLAUDE.md §6) the game loop advances ~0.10s of game
  // time per ~3.9s of wall clock on the FIRST shot of a level, versus ~0.31s for
  // later shots — the first shot pays one-time GPU work (impact VFX materials
  // compiling) spread across its frames. Measured resolution times on L5:
  //   first shot 4597-4802ms, later shots 658-914ms.
  // The old 5000ms budget sat at ~95% of the first-shot cost, so any CI runner
  // marginally slower than a dev box blew it. That is why this test failed in CI
  // on LANE 0 — always the first shot, never lane 2 — including on a docs-only
  // commit that changed no code at all.
  // DO NOT LOWER THIS. It looks like a 4x-oversized budget and it is not.
  // The first-shot cost is paid ONCE PER SESSION, not once per level — measured
  // 2026-07-27 on a real GPU: L5 shot#1 1699ms, shot#2 267ms; then L13 shot#1
  // 188ms and L5 re-entered shot#1 274ms. Playwright gives every test a FRESH
  // PAGE, so every test's first drag is a session-first shot and pays the full
  // cost. That is structural, not a one-off, and it is why this test failed in
  // CI on lane 0 (first shot) and never lane 2.
  // The budget stays until session-init is actually fixed — see the open item in
  // GEOMETRY_MECHANICS_BATCH.md §0c.
  const RESOLVE_TIMEOUT_MS = 20000;
  let resolved = true;
  try {
    await game.page.waitForFunction(
      (l) => window._nav.getGs().firingSlots[l] === null,
      laneIdx,
      { timeout: RESOLVE_TIMEOUT_MS },
    );
  } catch { resolved = false; }

  // Do NOT fall through on timeout. A shot that never resolved leaves the board
  // unchanged, and the hit assertion below would then report "drag deploy did
  // not land" — a targeting failure that never happened. Third instance of the
  // wait-condition antipattern on this test; the fix is to name the real one.
  expect(resolved, `shot into lane ${laneIdx} was accepted but never resolved within ${RESOLVE_TIMEOUT_MS}ms — the game loop stalled; this is NOT a deploy-targeting failure`).toBe(true);

  await game.page.waitForTimeout(150);   // let the resolved state settle one more tick

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

  const damage = await game.laneCohortDamaged(cohort, laneIdx);
  return { before, after, landedLane, firedColor, damage };
}

test('L2 (2-lane): drag from queue deploys into the intended lane', async ({ game }) => {
  await game.startLevel(2);
  for (const lane of [0, 1]) {
    // FTUE hint cards can intercept the pickup after a first successful drag
    // (by design, DragDrop shows contextual hints) — clear them between drags.
    await game.dismissOverlays(3);
    const r = await dragDeploy(game, lane, lane);
    assertLandedInLane(r, lane, '2-lane');
  }
});

// L5: 4→3 lanes, THREE_LANE_REDESIGN_BATCH.md §2 pilot (2026-07-23) — outermost
// lanes are 0 and 2, not 0 and 3.
test('L5 (3-lane): drag deploys land on outermost lanes (0 and 2)', async ({ game }) => {
  await game.startLevel(5);
  for (const lane of [0, 2]) {
    await game.dismissOverlays(3);
    const r = await dragDeploy(game, lane, lane);
    assertLandedInLane(r, lane, '3-lane');
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
