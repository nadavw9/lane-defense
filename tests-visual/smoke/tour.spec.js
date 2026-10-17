// First-run tour (level 1): a brand-new save gets the centre-screen walkthrough before the
// first move. The card pauses the board, steps with NEXT, and releases it on the last card.
// It is never shown again once finished.
//
// The fixture marks every tutorial as seen so mechanic specs are not disturbed; this spec
// clears that and reloads to get the real first-run experience.

import { test, expect } from '../fixtures/game.js';

async function freshTutorials(game) {
  await game.page.evaluate(() => { try { localStorage.removeItem('ftue_banners'); localStorage.setItem('__qa_fresh_tutorials', '1'); } catch { /* blocked */ } });
  await game.page.reload({ waitUntil: 'domcontentloaded' });
  await game.page.waitForFunction(() => !!window._nav, null, { timeout: 90_000 });
  await game.page.waitForTimeout(1500);
}

const step = (game) => game.page.evaluate(() => window._nav.guideStep());

test('L1 tour: steps through, then releases the board; not shown again', async ({ game }) => {
  await freshTutorials(game);
  await game.page.evaluate(() => window._nav.startLevel(1));

  // The first card appears after the level splash. Wait on the card itself (a state only the
  // tour produces), never on elapsed time.
  await expect.poll(() => step(game), { timeout: 30_000 }).toBe(0);
  expect(await game.page.evaluate(() => window._nav.getGameLoop().paused), 'tour must pause the board').toBe(true);
  expect(await game.page.evaluate(() => window._nav.getDragDrop().inputBlocked), 'tour must block board input').toBe(true);

  // Walk every card with NEXT; each press moves exactly one step, the last one closes the tour.
  let seen = [0];
  for (let guard = 0; guard < 12; guard++) {
    const now = await game.page.evaluate(() => window._nav.guideNext());
    if (now === -1) break;
    seen.push(now);
  }
  expect(seen.length, 'tour should have its three cards').toBeGreaterThanOrEqual(3);
  expect(seen).toEqual(seen.map((_, i) => i));        // 0,1,2,... in order, no skips

  await expect.poll(() => game.page.evaluate(() => window._nav.getGameLoop().paused), { timeout: 10_000 }).toBe(false);
  expect(await step(game)).toBe(-1);

  // Finished once: restarting L1 shows no tour.
  await game.page.evaluate(() => window._nav.startLevel(1));
  await game.page.waitForTimeout(2600);               // past the 1.5 s card delay
  expect(await step(game), 'tour must not repeat').toBe(-1);
});
