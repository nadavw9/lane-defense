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

async function medianBrightness(game, cx, cyBase, offsets, size = 12) {
  const samples = [];
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
    const leftStripCenter  = pos.laneBounds[0].left / 2;
    const rightStripCenter = (pos.laneBounds[pos.laneCount - 1].right + 390) / 2;

    const left  = await medianBrightness(game, leftStripCenter,  SAMPLE_Y, SAMPLE_OFFSETS);
    const right = await medianBrightness(game, rightStripCenter, SAMPLE_Y, SAMPLE_OFFSETS);

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
