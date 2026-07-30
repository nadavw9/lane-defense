// screenshot-red-bomb-fix.mjs — red powerball artifact fix verification: the
// bomb queue with red next to other colors, full frame + zoomed crop.
// Retries level start until the visible queue actually contains a red bomb.
// Run: node scripts/screenshot-red-bomb-fix.mjs

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = path.join(__dirname, '..', 'docs', 'review');
mkdirSync(OUT_DIR, { recursive: true });

const URL = `http://localhost:${process.env.PORT || 5173}/`;

const browser = await chromium.launch({ headless: false });
const page    = await browser.newPage();
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30_000 });
await page.waitForTimeout(2000);

async function tapCenter() {
  await page.evaluate(() => {
    const c = document.querySelector('canvas:not(#three-canvas)');
    const r = c.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
      clientX: r.left + (195 / 390) * r.width, clientY: r.top + (420 / 844) * r.height };
    c.dispatchEvent(new PointerEvent('pointerdown', o));
    c.dispatchEvent(new PointerEvent('pointerup', o));
  });
  await page.waitForTimeout(180);
}

// L31: 6-color palette. Retry until at least one visible (top-3-rows) shooter is Red.
let hasRed = false;
for (let attempt = 0; attempt < 5 && !hasRed; attempt++) {
  await page.evaluate((lv) => window._nav?.startLevel(lv), 31);
  await page.waitForTimeout(3000);
  for (let i = 0; i < 6; i++) await tapCenter();
  hasRed = await page.evaluate(() =>
    window._nav.getGs().columns.some((c) => c.shooters.slice(0, 3).some((s) => s.color === 'Red')));
  console.log(`attempt ${attempt + 1}: red visible in queue = ${hasRed}`);
}
await page.waitForTimeout(500);

const full = path.join(OUT_DIR, '11-red-bomb-queue.png');
await page.screenshot({ path: full });
console.log(`Saved: ${full}`);

// Queue region (below the breach stripe): y ≈ 555-700 in 390x844 stage coords.
await sharp(full)
  .extract({ left: 40, top: 550, width: 320, height: 160 })
  .resize(320 * 3, 160 * 3, { kernel: 'nearest' })
  .toFile(path.join(OUT_DIR, '12-red-bomb-queue-zoomed.png'));
console.log(`Saved: ${path.join(OUT_DIR, '12-red-bomb-queue-zoomed.png')}`);

await browser.close();
