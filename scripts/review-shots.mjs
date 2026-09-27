// Capture review screenshots of given levels (dev server on :5173, container Chromium).
//   node scripts/review-shots.mjs <outDir> <prefix> 5 9 13 17
import { chromium } from 'playwright';
const [out, prefix, ...levels] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
for (const lv of levels.map(Number)) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await p.addInitScript(() => localStorage.setItem('ftue_banners', JSON.stringify(['multi_lane', 'first_shot', 'bench', 'merge'])));
  await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => !!window._nav, null, { timeout: 90000 });
  await p.evaluate((l) => window._nav.startLevel(l), lv);
  await p.waitForTimeout(4000);
  let paused = true;
  for (let i = 0; i < 10; i++) {
    paused = await p.evaluate(() => window._nav.getGameLoop()?.paused);
    if (!paused) break;
    await p.evaluate(() => window._nav.dismissTutorial?.());
    await p.mouse.click(195, 470); await p.waitForTimeout(600);
  }
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/${prefix}-L${lv}.png` });
  console.log(`L${lv} paused=${paused}`);
  await p.close();
}
await b.close();
