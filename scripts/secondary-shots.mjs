// Secondary screen captures for design review (dev server :5173).
//   node scripts/secondary-shots.mjs <outDir> [prefix]
import { chromium } from 'playwright';
const [out, prefix = 'sec'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await p.addInitScript(() => {
  localStorage.setItem('ftue_banners', JSON.stringify(['multi_lane', 'first_shot', 'bench', 'merge', 'first_car']));
  localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: 12, stars: { 1: 3, 2: 3, 3: 2, 4: 3, 5: 1, 6: 2, 7: 3, 8: 2, 9: 3, 10: 1, 11: 2 } }));
});
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 90000 });
await p.waitForTimeout(2500);
const shot = async (name) => { await p.waitForTimeout(1600); await p.screenshot({ path: `${out}/${prefix}-${name}.png` }); console.log(name); };
const reset = async () => { await p.evaluate(() => { window._nav.cleanAll(); window._nav.showTitle(); }); await p.waitForTimeout(400); };
await reset(); await p.evaluate(() => window._nav.showDaily()); await shot('daily');
await reset(); await p.evaluate(() => window._nav.showStats()); await shot('stats');
await reset(); await p.evaluate(() => window._nav.showAchievements()); await shot('achievements');
await p.evaluate(() => { window._nav.cleanAll(); window._nav.startLevel(12); }); await p.waitForTimeout(3500); await p.evaluate(() => window._nav.dismissTutorial());
await p.evaluate(() => window._nav.dismissTutorial());
await p.evaluate(() => window._nav.showHowToPlay()); await shot('howtoplay');
await p.evaluate(() => { window._nav.cleanAll(); window._nav.startLevel(12); }); await p.waitForTimeout(3500); await p.evaluate(() => window._nav.dismissTutorial());
await p.evaluate(() => window._nav.showCarManual()); await shot('carmanual');
await p.evaluate(() => { window._nav.cleanAll(); window._nav.startLevel(12); }); await p.waitForTimeout(3500); await p.evaluate(() => window._nav.dismissTutorial());
await p.evaluate(() => window._nav.showHpGuide()); await shot('hpguide');
await p.evaluate(() => { window._nav.cleanAll(); window._nav.startLevel(12); }); await p.waitForTimeout(3500); await p.evaluate(() => window._nav.dismissTutorial());
await p.evaluate(() => window._nav.showCarIntro('truck')); await shot('carintro');
await p.evaluate(() => { window._nav.cleanAll(); window._nav.startLevel(12); }); await p.waitForTimeout(3500); await p.evaluate(() => window._nav.dismissTutorial());
await p.evaluate(() => window._nav.showRescue()); await shot('rescue');
await b.close();
