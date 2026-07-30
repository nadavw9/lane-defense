// screenshot-l40-boss.mjs — capture L40 "Grandmaster Finale" gauntlet frames.
// The opening IS verifiable (INFRA-A all-bike seed, like L10); stage 2/3 frames
// are driven by setting gs.goalProgress directly (the live object via _nav.getGs)
// so the spawnScript stage flips, then deploying to trigger refills that spawn
// the new stage's types.
// Run: node scripts/screenshot-l40-boss.mjs

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = path.join(__dirname, '..', 'docs', 'review');
mkdirSync(OUT_DIR, { recursive: true });

const PORT = process.env.PORT || 5173;
const URL  = `http://localhost:${PORT}/`;

const browser = await chromium.launch({ headless: false });
const page    = await browser.newPage();
await page.setViewportSize({ width: 390, height: 844 });

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

// Deploy a color-matched shot (col whose top bomb matches a lane's front car).
async function deployMatched(times) {
  for (let i = 0; i < times; i++) {
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
  for (let i = 0; i < 5; i++) await tapCenter();   // clear any mid-play FTUE tips
  await page.waitForTimeout(400);
}

const stageInfo = () => page.evaluate(() => {
  const g = window._nav.getGs();
  const types = g.lanes.slice(0, g.activeLaneCount).map(l => l.cars.map(c => c.type));
  return { goalProgress: [...g.goalProgress], types };
});

// ── Stage 1: opening bike-swarm seed ────────────────────────────────────────────
await page.evaluate((lv) => window._nav?.startLevel(lv), 40);
await page.waitForTimeout(3500);
for (let i = 0; i < 8; i++) await tapCenter();
await page.waitForTimeout(500);
console.log('opening:', JSON.stringify(await stageInfo()));
await capture(6, 'L40-stage1-bike-swarm-opening');

// ── Stage 2: force progress to 0.33+ (goalProgress [2,1,1] → 4/6 remaining) ────
await page.evaluate(() => { const g = window._nav.getGs(); g.goalProgress = [2, 1, 1]; });
await deployMatched(6);
console.log('stage2:', JSON.stringify(await stageInfo()));
await capture(7, 'L40-stage2-truck-wall');

// ── Stage 3: fresh level (resets combo — a ×10 streak earns a BOMB whose
// tutorial spotlight veils the board), then force progress to 0.66+ ─────────────
await page.evaluate((lv) => window._nav?.startLevel(lv), 40);
await page.waitForTimeout(3000);
for (let i = 0; i < 5; i++) await tapCenter();
await page.evaluate(() => { const g = window._nav.getGs(); g.goalProgress = [0, 1, 1]; });
await deployMatched(4);
console.log('stage3:', JSON.stringify(await stageInfo()));
await capture(8, 'L40-stage3-tank-bigrig-pincer');

if (errors.length) { console.log('\nConsole errors:'); errors.forEach(e => console.log(' ', e)); }
else console.log('No console errors.');

await browser.close();
