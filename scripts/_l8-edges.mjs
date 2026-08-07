// Stop trusting lit-row heuristics; LOOK at the pixels. Renders L8 at the config
// the user most likely has (1080p laptop at Windows 150% scaling => 1280x595 CSS,
// DPR 1.5) and crops the top and bottom edges of the fitted canvas at high zoom.
import { chromium } from 'playwright';
import sharp from 'sharp';

const W = 1280, H = 595, DPR = 1.5;
const browser = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window._nav, null, { timeout: 60000 });
await page.evaluate(() => window._nav.startLevel(8));
await page.waitForTimeout(2500);
for (let i = 0; i < 12; i++) await page.evaluate(() => window._nav.dismissTutorial());
await page.waitForTimeout(800);

const box = await page.evaluate(() => {
  const p = document.querySelector('canvas:not(#three-canvas)');
  const b = p.getBoundingClientRect();
  return { x: b.x, y: b.y, w: b.width, h: b.height };
});
await page.screenshot({ path: 'docs/review/_l8-full.png' });

const s = DPR;                                  // screenshot px per CSS px
const L = Math.round(box.x * s), BW = Math.round(box.w * s);
const TH = Math.round(box.h * s);
// Top 15% and bottom 15% of the fitted canvas, blown up.
await sharp('docs/review/_l8-full.png')
  .extract({ left: L, top: 0, width: BW, height: Math.round(TH * 0.15) })
  .resize({ width: 1200 }).toFile('docs/review/_l8-top.png');
await sharp('docs/review/_l8-full.png')
  .extract({ left: L, top: TH - Math.round(TH * 0.15), width: BW, height: Math.round(TH * 0.15) })
  .resize({ width: 1200 }).toFile('docs/review/_l8-bottom.png');

console.log(`canvas ${box.w.toFixed(1)}x${box.h.toFixed(1)} @ ${box.x.toFixed(1)},${box.y.toFixed(1)}`);
console.log(`stage scale ${(box.h / 844).toFixed(4)}  -> 1 stage px = ${(box.h/844*s).toFixed(2)} shot px`);
await browser.close();
