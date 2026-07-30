// screenshot-l20-boss.mjs — capture L20 "The Surge" board.
// L20's identity is a time-based spawn-rate script (crest/lull), not a static
// scripted layout like L10 — so this captures the opening board (full 3/lane
// density, the "relentless" baseline) and a mid-crest frame after some deploys.
// Run: node scripts/screenshot-l20-boss.mjs

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = path.join(__dirname, '..', 'docs', 'review');
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

async function capture(n, name) {
  const out = path.join(OUT_DIR, `${String(n).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: out, fullPage: false });
  console.log(`Saved: ${out}`);
}

await page.evaluate((lv) => window._nav?.startLevel(lv), 20);
await page.waitForTimeout(3500);
for (let i = 0; i < 8; i++) await tapCenter();   // clear car-type intro cards
await page.waitForTimeout(500);
await capture(4, 'L20-opening-board');

// Fire several deploys (auto-matched by the dev hook's column→lane color pairing
// where possible) to advance kill-progress into the first crest (untilPct 0.20).
const gs = await page.evaluate(() => window._nav.getGs());
console.log(`Goals total: ${gs.goals.reduce((s, g) => s + g.count, 0)}, progress: ${JSON.stringify(gs.goalProgress)}`);

for (let i = 0; i < 6; i++) {
  await page.evaluate(() => {
    const g = window._nav.getGs();
    for (let col = 0; col < 4; col++) {
      const shooterColor = g.columns[col]?.shooters?.[0]?.color;
      if (!shooterColor) continue;
      for (let lane = 0; lane < g.activeLaneCount; lane++) {
        if (g.lanes[lane].cars[0]?.color === shooterColor) {
          window._nav.deploy(col, lane);
          return;
        }
      }
    }
  });
  await page.waitForTimeout(700);
}
const gs2 = await page.evaluate(() => window._nav.getGs());
console.log(`After deploys — progress: ${JSON.stringify(gs2.goalProgress)}`);
for (let i = 0; i < 6; i++) await tapCenter();   // clear any mid-play FTUE tip ("Still Alive!" etc.)
await page.waitForTimeout(500);
await capture(5, 'L20-mid-crest-density');

if (errors.length) { console.log('\nConsole errors:'); errors.forEach(e => console.log(' ', e)); }
else console.log('No console errors.');

await browser.close();
