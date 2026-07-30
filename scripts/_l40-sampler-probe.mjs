// _l40-sampler-probe.mjs — measure the all-levels sampler's per-lane color
// distance on L40 (thin bikes, night road), comparing the current 12px MEAN
// metric against a max-pixel metric, to quantify the CI margin.
// Run: node scripts/_l40-sampler-probe.mjs

import { chromium } from 'playwright';
import sharp from 'sharp';
import { posToScreenYProjected } from '../src/renderer3d/projection.js';

const URL = `http://localhost:${process.env.PORT || 5173}/`;
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30_000 });
await page.waitForTimeout(2000);
await page.evaluate((lv) => window._nav?.startLevel(lv), 40);
await page.waitForTimeout(2500);
for (let i = 0; i < 6; i++) {
  await page.evaluate(() => {
    const c = document.querySelector('canvas:not(#three-canvas)');
    const r = c.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
      clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    c.dispatchEvent(new PointerEvent('pointerdown', o));
    c.dispatchEvent(new PointerEvent('pointerup', o));
  });
  await page.waitForTimeout(180);
}
await page.waitForTimeout(400);

const gs  = await page.evaluate(() => {
  const g = window._nav.getGs();
  return { gridRows: g.gridRows, laneCount: g.activeLaneCount,
           frontRows: g.lanes.slice(0, g.activeLaneCount).map(l => l.cars[0]?.row ?? 0) };
});
const pos = await page.evaluate(() => window._nav.getPositions());

async function region(cx, cy, size) {
  const half = size / 2;
  const buf = await page.screenshot({ clip: { x: Math.max(0, cx - half), y: Math.max(0, cy - half), width: size, height: size } });
  return sharp(buf).raw().toBuffer({ resolveWithObject: true });
}

for (let i = 0; i < gs.laneCount; i++) {
  const row = Math.min(gs.frontRows[i], gs.gridRows - 4);
  const y = posToScreenYProjected((row / (gs.gridRows - 1)) * 100);
  const s = await region(pos.laneX[i], y, 12);
  const road = await region(pos.laneX[i], y + 55, 12);
  const mean = (d, info) => {
    let r = 0, g = 0, b = 0; const n = info.width * info.height;
    for (let k = 0; k < n; k++) { r += d[k*info.channels]; g += d[k*info.channels+1]; b += d[k*info.channels+2]; }
    return [r/n, g/n, b/n];
  };
  const [rr, rg, rb] = mean(road.data, road.info);
  const [sr, sg, sb] = mean(s.data, s.info);
  const meanDist = Math.abs(sr-rr) + Math.abs(sg-rg) + Math.abs(sb-rb);
  // max single-pixel distance from road mean
  let maxDist = 0;
  const n = s.info.width * s.info.height;
  for (let k = 0; k < n; k++) {
    const d = Math.abs(s.data[k*s.info.channels]-rr) + Math.abs(s.data[k*s.info.channels+1]-rg) + Math.abs(s.data[k*s.info.channels+2]-rb);
    if (d > maxDist) maxDist = d;
  }
  console.log(`lane ${i} row ${gs.frontRows[i]} y=${y.toFixed(0)}: meanDist=${meanDist.toFixed(1)} (threshold 28) maxPixelDist=${maxDist.toFixed(1)}`);
}
await browser.close();
// (extended below — strong-pixel counts appended by a second pass)
