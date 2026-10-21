// New early schedule (2026-10-22): the level card and the board for each level that changed.
import { chromium } from 'playwright';
const [out, prefix] = process.argv.slice(2);
const b = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.addInitScript(() => {
  const keys = ['tour', 'lane_2', 'lane_3', 'multi_color', 'combo', 'supercharge', 'goal_colour', 'freeze_booster', 'colour_change_booster',
    'freeze_earned', 'colour_change_earned', 'rainbow_bomb', 'first_kill', 'first_miss', 'hp_miss', 'streak_charged', 'plate_break', 'armor_break',
    'volatile_surge', 'mender_heal', 'gift_car', 'traffic_light', 'convoy', 'bench'];
  localStorage.setItem('ftue_banners', JSON.stringify(keys));
  localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: 30, coins: 100, benchTutorialDone: true, introducedCarTypes: ['small', 'big', 'jeep'] }));
});
await p.goto(process.env.QA_URL ?? 'http://localhost:5180/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 120000 }); await p.waitForTimeout(2500);
const shot = (n) => p.screenshot({ path: `${out}/${prefix}-${n}.png` });
for (const lv of (process.env.LEVELS ?? '7,9,12,14,16,18').split(',').map(Number)) {
  await p.evaluate((n) => window._nav.showPreLevel(n), lv); await p.waitForTimeout(1500); await shot(`card-L${lv}`);
  await p.evaluate((n) => window._nav.startLevel(n), lv); await p.waitForTimeout(4000);
  for (let i = 0; i < 6; i++) { await p.evaluate(() => { window._nav.dismissGuides?.(); window._nav.dismissTutorial?.(); }); await p.waitForTimeout(200); }
  await p.waitForTimeout(800); await shot(`play-L${lv}`);
}
await b.close();
