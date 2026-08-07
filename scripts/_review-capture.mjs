// Review-batch capture. Run once with the fix applied and once with it stashed;
// pass the label as argv[2] ("BEFORE" | "AFTER").
//
// The merge travel phase is 150ms, so catching it by luck is unreliable — this
// polls mergeSequencer.phase and shoots the moment it reads 'travel'.
import { chromium } from 'playwright';
import sharp from 'sharp';

const TAG = process.argv[2] ?? 'AFTER';
const browser = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window._nav, null, { timeout: 60000 });
await page.evaluate(() => window._nav.startLevel(8));
await page.waitForTimeout(2500);
// dismissTutorial() does not clear L8's tutorial; real taps do.
for (let i = 0; i < 6; i++) { await page.mouse.click(195, 500); await page.waitForTimeout(350); }
await page.waitForTimeout(800);

const crop = async (src, dst, top, height) => {
  await sharp(src).extract({ left: 0, top: top * 3, width: 390 * 3, height: height * 3 })
    .resize({ width: 1170 }).toFile(dst);
};

// 1 — bottom chrome at rest: booster cards + labels vs the stage bottom edge.
await page.screenshot({ path: 'docs/review/_tmp.png' });
await crop('docs/review/_tmp.png', `docs/review/0${TAG === 'BEFORE' ? 1 : 3}-boosterbar-${TAG}.png`, 700, 144);

// 2 — mid-merge: the frame the device report screenshotted.
let shot = false;
for (let i = 0; i < 40 && !shot; i++) {
  await page.evaluate(({ i }) => {
    const gs = window._nav.getGs();
    const col = i % gs.activeColCount;
    if (gs.columns[col].top()) window._nav.deploy(col, i % gs.activeLaneCount);
  }, { i });
  // Poll fast for the 150ms travel window.
  for (let k = 0; k < 60; k++) {
    const ph = await page.evaluate(() => window._nav.getMergeSequencer()?.phase ?? null);
    if (ph === 'travel') {
      await page.screenshot({ path: 'docs/review/_tmp2.png' });
      await crop('docs/review/_tmp2.png', `docs/review/0${TAG === 'BEFORE' ? 2 : 4}-merge-${TAG}.png`, 560, 220);
      shot = true; break;
    }
    await page.waitForTimeout(12);
  }
  if (!shot) await page.waitForTimeout(200);
}
console.log(`${TAG}: boosterbar captured, merge-travel captured=${shot}`);
if (!shot) console.log('  !! never caught the travel phase — merge capture is MISSING, not "fine"');
await browser.close();
