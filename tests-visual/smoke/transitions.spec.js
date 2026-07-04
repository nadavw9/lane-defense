// Level-transition smoke (bug classes F + C) — stale state across level boundaries.
//
// History: a stale merge sequence from the PREVIOUS level could mutate a fresh
// board; a rescue resume skipped the lane refill and left a depleted board.
// These tests drive win → next-level and restart flows through the real app and
// assert the new board is genuinely fresh.

import { test, expect } from '../fixtures/game.js';

test('win L1 → start L2: fresh board, fresh goals, correct lane count', async ({ game }) => {
  await game.startLevel(1);
  expect((await game.gs()).levelId).toBe(1);

  const won = await game.winLevel();
  expect(won, 'winLevel() did not end the level').toBe(true);
  await game.page.waitForTimeout(1200);            // win screen settles

  await game.startLevel(2);
  const gs = await game.gs();
  expect(gs.levelId).toBe(2);
  expect(gs.isOver).toBe(false);
  expect(gs.laneCount).toBe(2);
  // Goals reset to full counts (no carry-over progress).
  expect(gs.goalProgress).toEqual(gs.goals.map((g) => g.count));
  // Board primed: every active lane has cars.
  for (const [i, lane] of gs.lanes.entries()) {
    expect(lane.count, `L2 lane ${i} empty after transition`).toBeGreaterThan(0);
  }
  // Queue primed: every active column has bombs.
  for (const [i, col] of gs.cols.entries()) {
    expect(col.count, `L2 column ${i} empty after transition`).toBeGreaterThan(0);
  }
});

test('play some of L5, restart L5: board re-primed, progress cleared', async ({ game }) => {
  await game.startLevel(5);

  // Play two effective shots (recolor front car to guarantee a hit).
  for (let s = 0; s < 2; s++) {
    await game.page.evaluate(() => {
      const gs = window._nav.getGs();
      gs.lanes[0].cars[0].color = gs.columns[0].shooters[0].color;
    });
    await game.deploy(0, 0);
  }
  const mid = await game.gs();
  const played = mid.goalProgress.reduce((s, r) => s + r, 0)
               < mid.goals.reduce((s, g) => s + g.count, 0);

  await game.startLevel(5);
  const gs = await game.gs();
  expect(gs.levelId).toBe(5);
  expect(gs.isOver).toBe(false);
  expect(gs.goalProgress, 'restart did not reset goal progress')
    .toEqual(gs.goals.map((g) => g.count));
  for (const [i, lane] of gs.lanes.entries()) {
    expect(lane.count, `restarted L5 lane ${i} empty`).toBeGreaterThan(0);
  }
  // Sanity that the pre-restart play actually did something (test is meaningful).
  expect(played, 'setup issue: the two shots before restart never registered').toBe(true);
});

test('rapid level hopping (L5 → L20 → L35) never leaves a dead board', async ({ game }) => {
  for (const level of [5, 20, 35]) {
    await game.startLevel(level);
    const gs = await game.gs();
    expect(gs.levelId).toBe(level);
    expect(gs.isOver).toBe(false);
    expect(gs.lanes.every((l) => l.count > 0), `L${level}: some lane empty`).toBe(true);
    expect(gs.cols.every((c) => c.count > 0), `L${level}: some column empty`).toBe(true);
  }
});
