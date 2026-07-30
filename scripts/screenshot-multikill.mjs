// screenshot-multikill.mjs — capture the polished multi-kill popup (3-kill = orange).
// Run: node scripts/screenshot-multikill.mjs

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

// Suppress car-type intro cards so the popup shows on a clean gameplay board.
await page.evaluate(() => {
  try {
    localStorage.setItem('lane_defense_seen_car_types',
      JSON.stringify(['small', 'big', 'jeep', 'van', 'truck', 'bigrig', 'tank', 'boss']));
  } catch {}
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.evaluate(() => window._nav?.startLevel(5));
// Wait out the level-intro hint (a TUTORIAL-priority item that would drop COMBO popups).
await page.waitForTimeout(7000);

async function capture(n, label) {
  await page.evaluate((k) => window._nav?._fx?.multiKill(k), n);
  // catch the scale-pop settling + the held celebration frame
  for (let f = 0; f < 5; f++) {
    await page.waitForTimeout(80);
    await page.screenshot({ path: path.join(OUT, `multikill-${label}-f${f}.png`) });
  }
  await page.waitForTimeout(1800); // let it auto-dismiss before the next
}

await capture(3, '3kill');   // orange tier (the requested screenshot)
await capture(2, '2kill');   // gold tier
await capture(4, '4kill');   // red/pink tier

console.log('done');
await browser.close();
