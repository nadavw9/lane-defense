// CAR HP manual capture. argv[2] = 'BEFORE' | 'AFTER'.
// Two levels so the per-level difference is visible: L5 (early, small/big/jeep,
// hp 0.70) and L30 (late boss, jeep/truck/bigrig/tank, hp 0.70).
import { chromium } from 'playwright';
import sharp from 'sharp';

const TAG = process.argv[2] ?? 'AFTER';
const browser = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });

for (const [level, idx] of [[5, 1], [30, 2]]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window._nav, null, { timeout: 60000 });
  await page.evaluate((lv) => window._nav.startLevel(lv), level);
  await page.waitForTimeout(2500);
  for (let i = 0; i < 6; i++) { await page.mouse.click(195, 500); await page.waitForTimeout(300); }
  await page.waitForTimeout(600);

  // Open via the real goal-bar car button.
  const btn = await page.evaluate(() => window._nav.getHudBounds().hpGuideBtn);
  if (!btn) { console.log(`L${level}: hpGuideBtn not found`); await page.close(); continue; }
  await page.mouse.click(btn.x + btn.w / 2, btn.y + btn.h / 2);
  await page.waitForTimeout(1400);   // let sprites load

  const n = TAG === 'BEFORE' ? idx : idx + 2;
  await page.screenshot({ path: 'docs/review/_tmp.png' });
  await sharp('docs/review/_tmp.png')
    .extract({ left: 30 * 3, top: 130 * 3, width: 330 * 3, height: 520 * 3 })
    .resize({ width: 990 })
    .toFile(`docs/review/0${n}-carhp-L${level}-${TAG}.png`);
  console.log(`L${level} ${TAG}: captured`);
  await page.close();
}
await browser.close();
