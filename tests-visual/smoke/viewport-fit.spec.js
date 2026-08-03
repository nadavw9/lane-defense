// VIEWPORT FIT — the whole 390x844 stage must stay visible at EVERY viewport.
//
// WHY THIS EXISTS: the entire visual-smoke suite ran at exactly 390x844, the
// design size, where a fit bug is invisible by construction — the canvas is the
// viewport, so scale is 1 and nothing can be clipped. Two device/desktop layout
// reports (2026-08-03) landed on surfaces no test covered. Whether or not those
// specific reports were fit bugs, the GAP was real: nothing asserted the stage
// survives a viewport that is wider, shorter, or a different aspect ratio.
//
// The contract: fit is letterbox — scale = min(vw/390, vh/844), centred. The stage
// is never cropped at any edge, and the Pixi and Three canvases always agree
// (they are separate canvases with separate sizing paths; if they diverge, the 3D
// road slides out from under the 2D overlay).
import { test, expect } from '@playwright/test';

const STAGE_W = 390, STAGE_H = 844;

const VIEWPORTS = [
  { w: 390,  h: 844,  label: 'design size' },
  { w: 393,  h: 852,  label: 'iPhone 14 Pro — slightly taller' },
  { w: 360,  h: 640,  label: 'older Android — SHORTER than design ratio' },
  { w: 412,  h: 915,  label: 'Pixel — taller than design ratio' },
  { w: 1440, h: 900,  label: 'laptop 16:10 — much wider' },
  { w: 1920, h: 1080, label: 'desktop 16:9' },
  { w: 1280, h: 720,  label: 'small desktop — short and wide' },
];

for (const { w, h, label } of VIEWPORTS) {
  test(`stage fits fully at ${w}x${h} (${label})`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    // Boot INTO A LEVEL. GameRenderer3D mounts its canvas on level start, so
    // measuring on the title screen compares against an unmounted, unsized
    // Three canvas and reports a false mismatch.
    await page.waitForFunction(() => !!window._nav, null, { timeout: 60000 });
    await page.evaluate(() => window._nav.startLevel(5));
    await page.waitForTimeout(2000);

    const m = await page.evaluate(() => {
      const pixi  = document.querySelector('canvas:not(#three-canvas)');
      const three = document.querySelector('#three-canvas');
      const box = (el) => { if (!el) return null; const b = el.getBoundingClientRect();
        return { x: b.x, y: b.y, w: b.width, h: b.height }; };
      return { pixi: box(pixi), three: box(three),
               vw: window.innerWidth, vh: window.innerHeight,
               scrollH: document.documentElement.scrollHeight };
    });

    expect(m.pixi, 'no Pixi canvas found').not.toBeNull();
    const p = m.pixi;

    // 1. Nothing clipped at any edge. A 1px tolerance absorbs sub-pixel centring.
    expect(p.y, `${w}x${h}: stage clipped at the TOP`).toBeGreaterThan(-1);
    expect(p.x, `${w}x${h}: stage clipped at the LEFT`).toBeGreaterThan(-1);
    expect(p.y + p.h, `${w}x${h}: stage clipped at the BOTTOM`).toBeLessThan(m.vh + 1);
    expect(p.x + p.w, `${w}x${h}: stage clipped at the RIGHT`).toBeLessThan(m.vw + 1);

    // 2. Letterbox, not stretch — aspect ratio preserved.
    expect(p.w / p.h, `${w}x${h}: stage aspect ratio distorted (stretched, not letterboxed)`)
      .toBeCloseTo(STAGE_W / STAGE_H, 2);

    // 3. It fills the constraining axis — a fit that scales to width on a wide
    //    screen would leave the stage tiny and clipped vertically.
    const expectedScale = Math.min(m.vw / STAGE_W, m.vh / STAGE_H);
    expect(p.h, `${w}x${h}: stage not scaled to the constraining axis`)
      .toBeCloseTo(STAGE_H * expectedScale, 0);

    // 4. Both canvases must occupy the SAME box — they are sized independently.
    if (m.three) {
      expect(Math.abs(m.three.w - p.w), `${w}x${h}: Three canvas width differs from Pixi`).toBeLessThan(2);
      expect(Math.abs(m.three.h - p.h), `${w}x${h}: Three canvas height differs from Pixi`).toBeLessThan(2);
      expect(Math.abs(m.three.x - p.x), `${w}x${h}: Three canvas X differs from Pixi`).toBeLessThan(2);
      expect(Math.abs(m.three.y - p.y), `${w}x${h}: Three canvas Y differs from Pixi`).toBeLessThan(2);
    }

    // 5. The page must not scroll — body is overflow:hidden by design, and a
    //    scrollable page means content escaped the viewport.
    expect(m.scrollH, `${w}x${h}: page scrolls — content escaped the viewport`)
      .toBeLessThanOrEqual(m.vh + 1);
  });
}

test('stage re-fits when the viewport SHRINKS after load (mobile URL bar)', async ({ page }) => {
  // A mobile URL bar appearing shrinks the viewport after boot. If the canvas
  // does not re-fit, the bottom — booster row and level badge — falls off screen.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForFunction(() => !!window._nav, null, { timeout: 60000 });
  await page.evaluate(() => window._nav.startLevel(5));
  await page.waitForTimeout(2000);

  for (const h of [740, 640, 844]) {
    await page.setViewportSize({ width: 390, height: h });
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const b = document.querySelector('canvas:not(#three-canvas)').getBoundingClientRect();
      return { y: b.y, h: b.height, vh: window.innerHeight };
    });
    expect(m.y + m.h, `after shrink to height ${h}: stage bottom is off screen`)
      .toBeLessThan(m.vh + 1);
    expect(m.y, `after shrink to height ${h}: stage top is off screen`).toBeGreaterThan(-1);
  }
});
