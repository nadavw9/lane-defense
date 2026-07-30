// screenshot-bench-tray.mjs — verify the bench tray (Fix B) and a real bench store
// (Fix A routing) on L4. Captures: empty tray, then one bomb stored in a slot.
// Run: node scripts/screenshot-bench-tray.mjs

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'docs', 'level-screenshots', 'current');
mkdirSync(OUT, { recursive: true });

const URL = `http://localhost:${process.env.PORT || 5173}/`;
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30_000 });
await page.waitForTimeout(2000);

await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.evaluate(() => window._nav?.startLevel(4));
await page.waitForTimeout(4000);

const BENCH_CLIP = { x: 0, y: 655, width: 390, height: 120 };

// 1) Empty tray
await page.screenshot({ path: path.join(OUT, 'bench-L4-empty-full.png') });
await page.screenshot({ path: path.join(OUT, 'bench-L4-empty-tray.png'), clip: BENCH_CLIP });
console.log('captured empty tray');

// 2) Drag a column bomb into bench slot 0 to store it.
// 4-col projected column-X (matches getColumnScreenX), top row at y=544.
const colX = [73.8, 154.6, 235.4, 316.2];
const COL_TOP_Y = 544;
const slot0 = { x: 0.5 * (390 / 4), y: 703 + 25 }; // bench slot 0 center

async function drag(fromX, fromY, toX, toY) {
  await page.mouse.move(fromX, fromY);
  await page.waitForTimeout(80);
  await page.mouse.down();
  await page.waitForTimeout(80);
  const steps = 16;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await page.mouse.move(fromX + (toX - fromX) * t, fromY + (toY - fromY) * t);
    await page.waitForTimeout(20);
  }
  await page.waitForTimeout(60);
  await page.mouse.up();
}

await drag(colX[0], COL_TOP_Y, slot0.x, slot0.y);
await page.waitForTimeout(700); // fly anim + redraw

await page.screenshot({ path: path.join(OUT, 'bench-L4-stored-full.png') });
await page.screenshot({ path: path.join(OUT, 'bench-L4-stored-tray.png'), clip: BENCH_CLIP });
console.log('captured stored-bomb tray');

await browser.close();
