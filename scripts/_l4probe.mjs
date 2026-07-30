import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import path from 'path';
const OUT = 'docs/level-screenshots/current';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ headless: false });
const p = await b.newPage();
await p.setViewportSize({ width: 390, height: 844 });
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 });
await p.waitForTimeout(2000);
await p.evaluate(() => { try { localStorage.clear(); } catch {} });
await p.evaluate(() => window._nav?.startLevel(4));
await p.waitForTimeout(4000);
await p.screenshot({ path: path.join(OUT, '_l4_raw.png') });
// report any overlay state
const info = await p.evaluate(() => {
  const gs = window._nav?.getGs?.();
  return { lanes: gs?.activeLaneCount, cols: gs?.activeColCount };
});
console.log('INFO', JSON.stringify(info));
await b.close();
