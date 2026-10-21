// Whole player path, one screenshot each: title, map, level card, play (L5/L9/L13/L17), pause,
// rescue, lose, win, shop. For the polish pass review.
//   QA_URL=http://localhost:5180/ node scripts/_flow-shots.mjs <outDir> <prefix>
import { chromium } from 'playwright';
const [out, prefix] = process.argv.slice(2);
const URL = process.env.QA_URL ?? 'http://localhost:5180/';
const b = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const ACH = 'first_blood combo_starter combo_master bench_warmer sharpshooter survivor speed_demon collector shopkeeper dedicated chain_reaction combo_legend crisis_saved weekly_hero streak_master survival_rookie survival_veteran no_mercy big_spender daily_challenger race_champion';
await p.addInitScript((ach) => {
  const keys = ['tour', 'lane_2', 'lane_3', 'multi_color', 'combo', 'supercharge', 'goal_colour', 'freeze_booster', 'colour_change_booster',
    'freeze_earned', 'colour_change_earned', 'rainbow_bomb', 'first_kill', 'first_miss', 'hp_miss', 'streak_charged', 'plate_break', 'armor_break',
    'volatile_surge', 'mender_heal', 'gift_car', 'traffic_light', 'convoy'];
  for (let i = 1; i <= 200; i++) keys.push(`hint_L${i}`);
  localStorage.setItem('ftue_banners', JSON.stringify(keys));
  localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: 18, coins: 140, achievements: Object.fromEntries(ach.split(' ').map(k => [k, true])), introducedCarTypes: ['small', 'big', 'jeep', 'truck', 'bigrig', 'tank'] }));
}, ACH);
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 120000 });
await p.waitForTimeout(2500);
const shot = (n) => p.screenshot({ path: `${out}/${prefix}-${n}.png` });
const settle = async () => { for (let i = 0; i < 8; i++) { await p.evaluate(() => window._nav.dismissGuides?.()); await p.waitForTimeout(200); } };
const fire = (k) => p.evaluate(async (k) => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  let n = 0;
  for (let t = 0; t < 200 && n < k; t++) {
    const gs = window._nav.getGs(), gl = window._nav.getGameLoop();
    if (gs.isOver) break;
    if (Object.values(gs.firingSlots).some(Boolean) || gl.paused) { await sleep(100); continue; }
    let done = false;
    for (let ci = 0; ci < gs.activeColCount && !done; ci++) {
      const top = gs.columns[ci].top(); if (!top) continue;
      for (let li = 0; li < gs.activeLaneCount && !done; li++) {
        const fc = gs.lanes[li].frontCar();
        if (fc && fc.color === top.color && gl.deploy(ci, li)) { done = true; n++; }
      }
    }
    await sleep(done ? 900 : 150);
  }
  return n;
}, k);

await shot('01-title');
await p.evaluate(() => window._nav.showLevelSelect()); await p.waitForTimeout(2500); await shot('02-map');
await p.evaluate(() => window._nav.showPreLevel(9)); await p.waitForTimeout(1500); await shot('03-card-L9');
for (const lv of [5, 9, 13, 17]) {
  await p.evaluate((n) => window._nav.startLevel(n), lv); await p.waitForTimeout(4000); await settle();
  await fire(3); await p.waitForTimeout(1200); await shot(`04-play-L${lv}`);
}
await p.evaluate(() => window._nav.showPause()); await p.waitForTimeout(1000); await shot('05-pause');
await p.evaluate(() => window._nav.startLevel(9)); await p.waitForTimeout(4000); await settle();
await p.evaluate(() => window._nav.showRescue()); await p.waitForTimeout(2000); await shot('06-rescue');
await p.evaluate(() => window._nav.startLevel(9)); await p.waitForTimeout(4000); await settle();
await p.evaluate(() => window._nav.showLose()); await p.waitForTimeout(2500); await shot('07-lose');
await p.evaluate(() => window._nav.startLevel(9)); await p.waitForTimeout(4000); await settle();
await fire(3); await p.waitForTimeout(1000);
await p.evaluate(() => { const g = window._nav.getGs(); g.score = g.starTargets[2] + 50; });
await p.evaluate(() => window._nav.winLevel()); await p.waitForFunction(() => window._nav.getScreens().win, null, { timeout: 30000 }); await p.waitForTimeout(3500); await shot('08-win');
await p.evaluate(() => window._nav.showShop()); await p.waitForTimeout(1500); await shot('09-shop');
await b.close();
