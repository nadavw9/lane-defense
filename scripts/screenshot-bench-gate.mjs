// screenshot-bench-gate.mjs — capture L1 (bench hidden) and L4 (bench visible)
// to verify the bench unlock gate. Run: node scripts/screenshot-bench-gate.mjs

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = path.join(__dirname, '..', 'docs', 'level-screenshots', 'current');
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

async function capture(level, name) {
  await page.evaluate((lv) => window._nav?.startLevel(lv), level);
  await page.waitForTimeout(3500);
  const out = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: out, fullPage: false });
  console.log(`Saved: ${out}`);
}

await capture(1, 'bench-gate-L1-hidden');
await capture(4, 'bench-gate-L4-visible');

if (errors.length) { console.log('\nConsole errors:'); errors.forEach(e => console.log(' ', e)); }
else console.log('No console errors.');

await browser.close();
