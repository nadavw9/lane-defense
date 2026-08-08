// Queue capture for the merge-removal review. argv[2] = 'BEFORE' | 'AFTER'.
// Plays a few real deploys so the queue has cycled (refill + auto-fill paths),
// then shoots the bomb-queue region at rest.
import { chromium } from 'playwright';
import sharp from 'sharp';

const TAG = process.argv[2] ?? 'AFTER';
const browser = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window._nav, null, { timeout: 60000 });
await page.evaluate(() => window._nav.startLevel(8));
await page.waitForTimeout(2500);
for (let i = 0; i < 6; i++) { await page.mouse.click(195, 500); await page.waitForTimeout(350); }
await page.waitForTimeout(800);

// Cycle the queue through real deploys so refills have happened.
let fired = 0;
for (let i = 0; i < 10; i++) {
  const ok = await page.evaluate(({ i }) => {
    const gs = window._nav.getGs();
    const col = i % gs.activeColCount;
    if (!gs.columns[col].top()) return false;
    const before = gs.totalDeploys;
    window._nav.deploy(col, i % gs.activeLaneCount);
    return true;
  }, { i });
  if (ok) fired++;
  await page.waitForTimeout(600);
}
await page.waitForTimeout(1200);
console.log(`${TAG}: ${fired} deploys driven`);

await page.screenshot({ path: 'docs/review/_tmp.png' });
const n = TAG === 'BEFORE' ? 1 : 2;
// Bomb-queue + bench region.
await sharp('docs/review/_tmp.png')
  .extract({ left: 0, top: 560 * 3, width: 390 * 3, height: 220 * 3 })
  .resize({ width: 1170 }).toFile(`docs/review/0${n}-queue-${TAG}.png`);
// Whole board.
await sharp('docs/review/_tmp.png')
  .extract({ left: 0, top: 0, width: 390 * 3, height: 780 * 3 })
  .resize({ width: 900 }).toFile(`docs/review/0${n + 2}-board-${TAG}.png`);
console.log('captured');
await browser.close();
