// Menu / screen captures for design review (dev server :5173).
//   node scripts/menu-shots.mjs <outDir> [prefix]
// Title, level select, pre-level, win, lose, shop, settings, pause.
import { chromium } from 'playwright';
const [out, prefix = 'menu'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await p.addInitScript(() => {
  localStorage.setItem('ftue_banners', JSON.stringify(['multi_lane', 'first_shot', 'bench', 'merge', 'first_car']));
  // A mid-game save so the level map shows progress.
  if (!localStorage.getItem('lane-defense-v1')) localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: 12, stars: { 1: 3, 2: 3, 3: 2, 4: 3, 5: 1, 6: 2, 7: 3, 8: 2, 9: 3, 10: 1, 11: 2 } }));
});
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 90000 });
await p.waitForTimeout(2500);
const shot = async (name) => { await p.waitForTimeout(1600); await p.screenshot({ path: `${out}/${prefix}-${name}.png` }); console.log(name); };
await p.evaluate(() => window._nav.showTitle()); await shot('title');
await p.evaluate(() => window._nav.showLevelSelect()); await shot('levels');
await p.evaluate(() => window._nav.showPreLevel(12)); await shot('prelevel');
await p.evaluate(() => window._nav.startLevel(12)); await p.waitForTimeout(3000);
await p.evaluate(() => window._nav.showWin()); await shot('win');
await p.evaluate(() => window._nav.startLevel(12)); await p.waitForTimeout(3000);
await p.evaluate(() => window._nav.showLose()); await shot('lose');
await p.evaluate(() => window._nav.showShop()); await shot('shop');
await p.evaluate(() => window._nav.showSettings()); await shot('settings');
await b.close();
