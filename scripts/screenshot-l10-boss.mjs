// screenshot-l10-boss.mjs — capture L10 "The Bench Test" opening board
// (color-clustered lanes 0/2 Blue, 1/3 Red) for design review.
// Run: node scripts/screenshot-l10-boss.mjs

import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = path.join(__dirname, '..', 'docs', 'review');
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const PORT = process.env.PORT || 5173;
const URL  = `http://localhost:${PORT}/`;
const W = 390, H = 844;

const browser = await chromium.launch({ headless: false });
const page    = await browser.newPage();
await page.setViewportSize({ width: W, height: H });

const errors = [];
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', err => errors.push(err.message));

console.log(`Navigating to ${URL} …`);
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30_000 });
await page.waitForTimeout(2000);

async function capture(n, name) {
  const out = path.join(OUT_DIR, `${String(n).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: out, fullPage: false });
  console.log(`Saved: ${out}`);
}

// L10 opening board — scripted color-clustered lanes, before any player action.
await page.evaluate((lv) => window._nav?.startLevel(lv), 10);
await page.waitForTimeout(3500);
await capture(1, 'L10-opening-board');

// Tap-clear the car-type intro cards (one per new type on this fresh profile —
// R+B palette here has several: motorbike/car/etc.), then re-shoot clean.
async function tapCenter() {
  await page.evaluate(() => {
    const c = document.querySelector('canvas:not(#three-canvas)');
    const r = c.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
      clientX: r.left + (195 / 390) * r.width, clientY: r.top + (420 / 844) * r.height };
    c.dispatchEvent(new PointerEvent('pointerdown', o));
    c.dispatchEvent(new PointerEvent('pointerup', o));
  });
  await page.waitForTimeout(200);
}
for (let i = 0; i < 8; i++) await tapCenter();
await page.waitForTimeout(500);
await capture(2, 'L10-opening-board-clean');

if (errors.length) { console.log('\nConsole errors:'); errors.forEach(e => console.log(' ', e)); }
else console.log('No console errors.');

await browser.close();
