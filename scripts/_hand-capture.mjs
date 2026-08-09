// Catch the L1 FTUE hand mid-demo, after clearing the car-intro card.
// argv[2] = 'BEFORE' | 'AFTER'.
import { chromium } from 'playwright';
import sharp from 'sharp';

const TAG = process.argv[2] ?? 'AFTER';
const browser = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window._nav, null, { timeout: 60000 });
await page.evaluate(() => window._nav.startLevel(1));
await page.waitForTimeout(3000);

// NO CLICKS. FTUEOverlay installs a full-screen hitbox whose pointerdown calls
// _stopHandDemo(), so any tap to clear the intro card also kills the demo. The
// hand is visible on its own a few seconds in, before the card appears.
await page.waitForTimeout(300);

// The hand fades in and out on a cycle; sample until a bright cream blob appears
// in the road strip, so we do not shoot during a fade.
let best = null, bestScore = -1;
for (let i = 0; i < 10; i++) {
  await page.screenshot({ path: 'docs/review/_handtmp.png' });
  const { data, info } = await sharp('docs/review/_handtmp.png').raw().toBuffer({ resolveWithObject: true });
  let cream = 0;
  for (let y = Math.round(info.height * 0.42); y < Math.round(info.height * 0.62); y++) {
    for (let x = Math.round(info.width * 0.3); x < Math.round(info.width * 0.7); x += 2) {
      const p = (y * info.width + x) * info.channels;
      if (data[p] > 200 && data[p + 1] > 195 && data[p + 2] > 175 && Math.abs(data[p] - data[p + 2]) < 45) cream++;
    }
  }
  if (cream > bestScore) { bestScore = cream; best = i; await sharp('docs/review/_handtmp.png')
    .extract({ left: 60 * 3, top: 330 * 3, width: 270 * 3, height: 300 * 3 })
    .resize({ width: 810 }).toFile(`docs/review/0${TAG === 'BEFORE' ? 4 : 5}-hand-ingame-${TAG}.png`); }
  await page.waitForTimeout(220);
}
console.log(`${TAG}: best frame ${best}, cream pixels ${bestScore}`);
await browser.close();
