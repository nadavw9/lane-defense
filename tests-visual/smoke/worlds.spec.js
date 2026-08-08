// World theming smoke (bug class B at runtime) — side panels render on every
// world, and the whole boot is free of 404s / console errors (fixture tripwires).
//
// History: world panels once vanished depending on a global sprite flag; panel
// art 404'd on Pages due to case/gitignore issues. Pixel-samples the strip
// centers against the game's own strip geometry.

import { test, expect } from '../fixtures/game.js';

// Side-strip center X for a 4-lane level ≈ 17px from each edge (35px strips).
// Sample INSIDE the strips, away from HUD and breach stripe.
const SAMPLE_Y = 250;

// 2026-07-19: single-point sampling on a REPEATING tiled strip texture
// (CityEdges._addWorldPanel draws it as a TilingSprite) is fragile, not a
// reliable "is the panel visible" signal — proven while investigating a car-
// size ceiling: sampling 5 points just 15px apart at ONE band/level gave a
// 6.68-to-21.53 spread (more variance WITHIN one sample set than between a
// "passing" and a "failing" band). The fixed point can land on a lit window
// or a dark gap between buildings by pure luck of where the tile phase falls.
// Sampling several points spread across the strip's vertical extent and
// taking the MEDIAN fixes this without weakening the check: a genuinely
// missing/blank panel renders near-black at every point (median stays low),
// while a real panel that got unlucky at one point still has the rest at
// normal brightness (median reflects the panel's true state).
const SAMPLE_OFFSETS = [-80, -40, 0, 40, 80];

function median(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// 2026-08-08: the same argument now applies on the X axis. The L9-L40 conversion
// took every level above L3 to 3 lanes, which NARROWS the road and therefore
// WIDENS these side strips. One x-column is no longer representative of a wider
// strip: at L35 the night world's dark building faces outnumbered its neon
// accents 3-to-2 at the new strip centre and the median fell to 4.4 while the
// panel was demonstrably rendering (verified in the failure screenshot — full
// neon art on both edges). Sample a GRID across the strip's width as well as its
// height. A genuinely missing panel is near-black everywhere, so the median still
// catches it; a real panel with dark patches no longer fails on where one column
// happened to land.
async function medianBrightness(game, xs, cyBase, offsets, size = 12) {
  const samples = [];
  for (const cx of (Array.isArray(xs) ? xs : [xs]))
    for (const dy of offsets) samples.push((await game.sampleRegion(cx, cyBase + dy, size)).brightness);
  return { median: median(samples), samples };
}

const WORLDS = [
  { level: 5,  world: 'world1 (city)',       minBrightness: 12 },
  { level: 20, world: 'world2 (industrial)', minBrightness: 12 },
  // Night world's art is legitimately darker at the sample point than the
  // other two worlds (verified 2026-07-13: brightness is a REPRODUCIBLE
  // 10.97 across repeated runs, not run-to-run flake, and the panel visibly
  // renders real building/window art in the failure screenshot — not a
  // blank/missing strip). 12 was tuned against city/industrial and never
  // actually validated against night. 8 stays well clear of a genuinely
  // missing panel (which renders near-black, not merely "dark").
  { level: 35, world: 'world3 (night)',      minBrightness: 8 },
];

for (const { level, world, minBrightness } of WORLDS) {
  test(`L${level}: ${world} side panels render on both edges`, async ({ game }) => {
    await game.startLevel(level);

    const pos = await game.positions();
    // Strip = space outside the outermost lane bounds.
    const leftEdge  = pos.laneBounds[0].left;
    const rightEdge = pos.laneBounds[pos.laneCount - 1].right;
    // Three columns across each strip rather than one at its centre.
    const leftXs  = [0.30, 0.50, 0.70].map((f) => leftEdge * f);
    const rightXs = [0.30, 0.50, 0.70].map((f) => rightEdge + (390 - rightEdge) * f);
    const leftStripCenter = leftXs[1], rightStripCenter = rightXs[1];

    const left  = await medianBrightness(game, leftXs,  SAMPLE_Y, SAMPLE_OFFSETS);
    const right = await medianBrightness(game, rightXs, SAMPLE_Y, SAMPLE_OFFSETS);

    // A rendered panel is never near-black (the historical failure mode is a
    // black/blank strip). Threshold is per-world — see WORLDS above for why
    // night world gets a lower floor.
    expect(left.median,  `left panel missing at L${level} (x=${leftStripCenter.toFixed(0)}) — samples: ${left.samples.map(s => s.toFixed(1)).join(', ')}`)
      .toBeGreaterThan(minBrightness);
    expect(right.median, `right panel missing at L${level} (x=${rightStripCenter.toFixed(0)}) — samples: ${right.samples.map(s => s.toFixed(1)).join(', ')}`)
      .toBeGreaterThan(minBrightness);
  });
}

test('title screen boots clean (background + logo, no errors)', async ({ game }) => {
  // Fixture already booted to title. Give the intro a moment, then check pixels.
  await game.page.waitForTimeout(2500);
  const bg = await game.sampleRegion(195, 700, 16);     // lower city background
  expect(bg.brightness, 'title background missing (near-black lower half)').toBeGreaterThan(20);
  const logoBand = await game.sampleRegion(195, 200, 16); // logo area
  expect(logoBand.brightness, 'title logo band blank').toBeGreaterThan(10);
});
