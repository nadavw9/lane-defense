// Stars + goal-card review: pre-level card (L5), early-level gameplay (L1, L2, L3: step ruler),
// mid-level HUD after a few shots (L5), and the win screen with its stars.
//   QA_URL=http://localhost:5180/ node scripts/_stars-shots.mjs <outDir> <prefix>
import { chromium } from 'playwright';
const [out, prefix] = process.argv.slice(2);
const URL = process.env.QA_URL ?? 'http://localhost:5180/';
const b = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.addInitScript(() => {
  const keys = ['tour', 'lane_2', 'lane_3', 'multi_color', 'combo', 'supercharge', 'goal_colour', 'freeze_booster', 'colour_change_booster',
    'freeze_earned', 'colour_change_earned', 'rainbow_bomb', 'first_kill', 'first_miss', 'hp_miss', 'streak_charged', 'plate_break', 'armor_break',
    'volatile_surge', 'mender_heal', 'gift_car', 'traffic_light', 'convoy'];
  for (let i = 1; i <= 200; i++) keys.push(`hint_L${i}`);
  localStorage.setItem('ftue_banners', JSON.stringify(localStorage.getItem('qa_tour') ? keys.filter(k => k !== 'tour') : keys));
  localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: 30, achievements: Object.fromEntries('first_blood combo_starter combo_master bench_warmer sharpshooter survivor speed_demon collector shopkeeper dedicated chain_reaction combo_legend crisis_saved weekly_hero streak_master survival_rookie survival_veteran no_mercy big_spender daily_challenger race_champion'.split(' ').map(k => [k, true])), introducedCarTypes: ['small', 'big', 'jeep', 'truck', 'bigrig', 'tank'] }));
});
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 120000 });
await p.waitForTimeout(2000);
const shot = (n) => p.screenshot({ path: `${out}/${prefix}-${n}.png` });
const settle = async () => { for (let i = 0; i < 8; i++) { await p.evaluate(() => window._nav.dismissGuides?.()); await p.waitForTimeout(250); } };
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

await p.evaluate(() => window._nav.showPreLevel(5)); await p.waitForTimeout(1500); await shot('L5-card');
await p.evaluate(() => window._nav.showPreLevel(26)); await p.waitForTimeout(1500); await shot('L26-card');
for (const lv of [1, 2, 3]) {
  await p.evaluate((n) => window._nav.startLevel(n), lv); await p.waitForTimeout(4000); await settle();
  await fire(2); await p.waitForTimeout(800); await shot(`L${lv}-play`);
}
await p.evaluate(() => window._nav.startLevel(5)); await p.waitForTimeout(4000); await settle();
await fire(5); await p.waitForTimeout(800);
console.log('L5 score', await p.evaluate(() => { const g = window._nav.getGs(); return [g.score, g.starTargets]; }));
await shot('L5-play');
await fire(60); await p.waitForTimeout(4000);
console.log('L5 end', await p.evaluate(() => { const g = window._nav.getGs(); return [g.isOver, g.score, g.starTargets, window._nav.getScreens().win]; }));
await shot('L5-end');
// Win screens: play a few real shots, then set the score and win (2 stars on L5, 3 on L2).
for (const [lv, pick] of [[5, 1], [2, 2]]) {
  await p.evaluate((n) => window._nav.startLevel(n), lv); await p.waitForTimeout(4000); await settle();
  await fire(3); await p.waitForTimeout(1500);
  await p.evaluate((pick) => { const g = window._nav.getGs(); g.score = g.starTargets[pick] + 25; }, pick);
  await p.waitForTimeout(1500); await shot(`L${lv}-bar`);
  await p.evaluate(() => window._nav.winLevel());
  await p.waitForFunction(() => window._nav.getScreens().win, null, { timeout: 30000 }); await p.waitForTimeout(3500);
  await shot(`L${lv}-win`);
}
// The L1 tour's MOVES LEFT card (fresh tutorials: drop the 'tour' key).
await p.evaluate(() => localStorage.setItem('qa_tour', '1'));
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 120000 }); await p.waitForTimeout(2000);
await p.evaluate(() => window._nav.startLevel(1));
await p.waitForFunction(() => window._nav.guideStep() === 0, null, { timeout: 30000 });
for (let i = 0; i < 2; i++) { await p.evaluate(() => window._nav.guideNext()); await p.waitForTimeout(700); }
console.log('tour card', await p.evaluate(() => window._nav.guideTitle()));
await shot('L1-tour-moves');
await b.close();
