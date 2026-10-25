import { chromium } from 'playwright';
const [out, prefix = 'w4'] = process.argv.slice(2);
const URL = process.env.QA_URL ?? 'http://127.0.0.1:5173/';
const levels = (process.env.LEVELS ?? '52,58').split(',').map(Number);
const b = await chromium.launch({
  executablePath: process.env.PW_EXE ?? '/home/box/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
p.on('pageerror', e => console.error('PAGEERROR', e.message));
await p.addInitScript(() => {
  const keys = ['intro', 'lane_2', 'lane_3', 'multi_color', 'combo', 'supercharge', 'goal_colour', 'freeze_booster', 'colour_change_booster',
    'freeze_earned', 'colour_change_earned', 'rainbow_bomb', 'first_kill', 'first_miss', 'hp_miss', 'streak_charged', 'plate_break', 'armor_break',
    'volatile_surge', 'mender_heal', 'gift_car', 'traffic_light', 'convoy', 'bench'];
  for (let i = 1; i <= 200; i++) keys.push(`hint_L${i}`);
  localStorage.setItem('ftue_banners', JSON.stringify(keys));
  const stars = {}; for (let i = 1; i <= 60; i++) stars[i] = 3;
  localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: 60, coins: 500, stars, benchTutorialDone: true, introducedCarTypes: ['small', 'big', 'jeep', 'truck', 'bigrig', 'tank'] }));
});
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 120000 });
await p.waitForTimeout(2500);
const shot = async (n) => { await p.screenshot({ path: `${out}/${prefix}-${n}.png` }); console.log('shot', n); };
await p.evaluate(() => window._nav.showLevelSelect());
await p.waitForTimeout(2000);
// Page the map to Sun Valley (world4 starts L46).
await p.evaluate(async () => {
  const nav = window._nav;
  for (let i = 0; i < 12; i++) {
    if (typeof nav.goToWorld === 'function') { nav.goToWorld(4); break; }
    if (typeof nav.showWorld === 'function') { nav.showWorld(4); break; }
    if (typeof nav.mapNext === 'function') nav.mapNext();
    else if (typeof nav.nextMapPage === 'function') nav.nextMapPage();
    else if (nav._levelSelect?.nextPage) nav._levelSelect.nextPage();
    else if (nav.levelSelect?.nextPage) nav.levelSelect.nextPage();
    await new Promise(r => setTimeout(r, 350));
  }
});
await p.waitForTimeout(1500);
await shot('map');
for (const lv of levels) {
  await p.evaluate((n) => { window._nav.cleanAll?.(); window._nav.startLevel(n); }, lv);
  await p.waitForTimeout(4500);
  for (let i = 0; i < 8; i++) { await p.evaluate(() => { window._nav.dismissGuides?.(); window._nav.dismissTutorial?.(); }); await p.waitForTimeout(200); }
  await p.waitForTimeout(800);
  await shot(`L${lv}`);
}
await b.close();
