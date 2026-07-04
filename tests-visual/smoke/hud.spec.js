// HUD layout smoke (bug class G) — containment and overlap of named HUD rects.
//
// History: coin icon rendered behind wide score numbers; CANCEL label overflowed
// its booster card; goal pills overlapped the road. These assert the named rects
// from window._nav.getHudBounds() (the components' real Pixi bounds) stay inside
// the 390×844 stage and don't collide with each other.

import { test, expect } from '../fixtures/game.js';

const STAGE = { w: 390, h: 844 };

function overlap(a, b) {
  if (!a || !b) return 0;
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return x * y;
}

test('L5: all HUD rects on-stage; boosters and goal bar do not collide', async ({ game }) => {
  await game.startLevel(5);
  const hud = await game.hudBounds();

  // Containment — every visible named rect fully inside the stage.
  for (const [name, r] of Object.entries(hud)) {
    if (!r) continue;
    expect(r.x, `${name} off-stage left`).toBeGreaterThanOrEqual(-1);
    expect(r.y, `${name} off-stage top`).toBeGreaterThanOrEqual(-1);
    expect(r.x + r.w, `${name} off-stage right`).toBeLessThanOrEqual(STAGE.w + 1);
    expect(r.y + r.h, `${name} off-stage bottom`).toBeLessThanOrEqual(STAGE.h + 1);
  }

  // The three booster buttons must not overlap each other.
  const boosters = [hud.boosterColor, hud.boosterFreeze, hud.boosterBomb].filter(Boolean);
  expect(boosters.length, 'booster buttons missing from HUD').toBe(3);
  for (let i = 0; i < boosters.length; i++) {
    for (let j = i + 1; j < boosters.length; j++) {
      expect(overlap(boosters[i], boosters[j]), `booster ${i} overlaps booster ${j}`).toBe(0);
    }
  }

  // Goal counter (top band) must not collide with the booster row (bottom band).
  // NOTE: the goal counter's own container includes a full-width opaque band that
  // the flank buttons (hpGuide/howToPlay) intentionally sit ON — so button-vs-band
  // overlap is by design and NOT asserted here.
  if (hud.goalCounter) {
    for (const b of boosters) {
      expect(overlap(hud.goalCounter, b), 'goal counter overlaps booster bar').toBe(0);
    }
  }
});

test('HUD rects stay sane on a 1-lane level too (L1)', async ({ game }) => {
  await game.startLevel(1);
  const hud = await game.hudBounds();
  const present = Object.values(hud).filter(Boolean).length;
  expect(present, 'no HUD rects reported at all').toBeGreaterThanOrEqual(3);
  for (const [name, r] of Object.entries(hud)) {
    if (!r) continue;
    expect(r.x + r.w, `${name} off-stage right`).toBeLessThanOrEqual(STAGE.w + 1);
    expect(r.y + r.h, `${name} off-stage bottom`).toBeLessThanOrEqual(STAGE.h + 1);
  }
});
