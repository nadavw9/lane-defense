// One frame per Tutorial City time of day (L3, L5, L9, L13) + the map, for the polish review.
//   QA_URL=http://localhost:5180/ node scripts/_theme-shots.mjs <outDir> <prefix>
import { chromium } from 'playwright';
const [out, prefix] = process.argv.slice(2);
const URL = process.env.QA_URL ?? 'http://localhost:5180/';
const b = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.addInitScript(() => {
  const keys = ['tour', 'lane_2', 'lane_3', 'multi_color', 'combo', 'supercharge', 'goal_colour', 'freeze_booster', 'colour_change_booster',
    'freeze_earned', 'colour_change_earned', 'rainbow_bomb', 'first_kill', 'first_miss', 'hp_miss', 'streak_charged', 'plate_break', 'armor_break',
    'volatile_surge', 'mender_heal', 'gift_car', 'traffic_light', 'convoy', 'bench'];
  for (let i = 1; i <= 200; i++) keys.push(`hint_L${i}`);
  localStorage.setItem('ftue_banners', JSON.stringify(keys));
  localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: 18, coins: 140, benchTutorialDone: true, introducedCarTypes: ['small', 'big', 'jeep', 'truck', 'bigrig', 'tank'] }));
});
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 120000 });
await p.waitForTimeout(2500);
const shot = (n) => p.screenshot({ path: `${out}/${prefix}-${n}.png` });
await p.evaluate(() => window._nav.showLevelSelect()); await p.waitForTimeout(2500); await shot('map');
for (const lv of (process.env.LEVELS ?? '3,5,9,13').split(',').map(Number)) {
  await p.evaluate((n) => window._nav.startLevel(n), lv); await p.waitForTimeout(4000);
  for (let i = 0; i < 6; i++) { await p.evaluate(() => { window._nav.dismissGuides?.(); window._nav.dismissTutorial?.(); }); await p.waitForTimeout(200); }
  await p.waitForTimeout(600); await shot(`L${lv}`);
}
await b.close();
