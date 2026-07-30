// screenshot-stash-retired.mjs — verify stash retirement on L4:
//  • bomb column clean (no dashed rings above the bench tray)
//  • bench still stores a bomb (drag column → bench slot)
// Run: node scripts/screenshot-stash-retired.mjs

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

// Suppress car-type intro cards + the L4 unlock/tutorial for a clean view.
await page.evaluate(() => {
  try {
    localStorage.setItem('lane_defense_seen_car_types',
      JSON.stringify(['small', 'big', 'jeep', 'van', 'truck', 'bigrig', 'tank', 'boss']));
    localStorage.setItem('lane-defense-v1', JSON.stringify({ seenUnlocks: { '4': true, '6': true } }));
  } catch {}
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.evaluate(() => window._nav?.startLevel(4));
await page.waitForTimeout(7000);

const ZONE = { x: 0, y: 640, width: 390, height: 130 }; // stash-band + bench tray

// 1) Clean state — no dashed rings between bombs and tray
await page.screenshot({ path: path.join(OUT, 'stash-retired-full.png') });
await page.screenshot({ path: path.join(OUT, 'stash-retired-zone.png'), clip: ZONE });

// 2) Store a bomb into bench slot 0 to confirm the bench still works.
const colX0 = 73.8, COL_TOP_Y = 544;          // 4-col projected column 0, top row
const slot0 = { x: 0.5 * (390 / 4), y: 703 + 25 };
async function drag(fromX, fromY, toX, toY) {
  await page.mouse.move(fromX, fromY); await page.waitForTimeout(80);
  await page.mouse.down(); await page.waitForTimeout(80);
  for (let i = 1; i <= 16; i++) {
    const t = i / 16;
    await page.mouse.move(fromX + (toX - fromX) * t, fromY + (toY - fromY) * t);
    await page.waitForTimeout(20);
  }
  await page.waitForTimeout(60); await page.mouse.up();
}
await drag(colX0, COL_TOP_Y, slot0.x, slot0.y);
await page.waitForTimeout(700);

await page.screenshot({ path: path.join(OUT, 'stash-retired-stored-full.png') });
await page.screenshot({ path: path.join(OUT, 'stash-retired-stored-zone.png'), clip: ZONE });

console.log('done');
await browser.close();
