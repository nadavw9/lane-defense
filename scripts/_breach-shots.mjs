// First-breach review captures (2026-11-26, lane barriers removed): L5 at rest, then a car pushed
// over the breach line by a correct shot in another lane, captured just after and a second later.
// Runs against any build, so the same script makes the BEFORE (master, barriers) and AFTER pair:
//   QA_URL=http://localhost:5181/ node scripts/_breach-shots.mjs <outDir> <prefix>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'qa-breach'; mkdirSync(out, { recursive: true });
const pre = process.argv[3] ?? '';
const b = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await p.addInitScript(() => {
  const k = ['tour', 'lane_2', 'lane_3', 'second_colour', 'bridge', 'combo', 'supercharge', 'goal_colour', 'freeze_booster',
    'colour_change_booster', 'freeze_earned', 'colour_change_earned', 'rainbow_bomb', 'first_kill', 'first_miss', 'hp_miss', 'streak_charged',
    'plate_break', 'armor_break', 'volatile_surge', 'mender_heal', 'gift_car', 'traffic_light', 'convoy', 'speeder'];
  for (let i = 1; i <= 200; i++) k.push(`hint_L${i}`);
  localStorage.setItem('ftue_banners', JSON.stringify(k));
  localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: 20, introducedCarTypes: ['small', 'big', 'jeep'] }));
});
await p.goto(process.env.QA_URL ?? 'http://localhost:5182/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 120000 }); await p.waitForTimeout(2000);
const dismiss = async () => { for (let i = 0; i < 6; i++) { await p.evaluate(() => window._nav.dismissGuides?.()); await p.waitForTimeout(150); } };

await p.evaluate(() => window._nav.startLevel(5)); await p.waitForTimeout(3500); await dismiss(); await p.waitForTimeout(600);
const rest = await p.evaluate(() => ({ paused: window._nav.getGameLoop().paused, over: window._nav.getGs().isOver }));
console.log('rest', JSON.stringify(rest));
await p.screenshot({ path: `${out}/${pre}1-rest.png` });
const pushed = await p.evaluate(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const gs = window._nav.getGs(), gl = window._nav.getGameLoop();
  // Lane 1's front car goes to the last row; a correct shot at lane 0 moves it over the line.
  const fc = gs.lanes[1].frontCar(); fc.row = gs.gridRows - 1; fc.position = 100; fc.hp = 99;
  const top = gs.columns[0].top(); const f0 = gs.lanes[0].frontCar(); if (f0) { f0.color = top.color; f0.hp = 1; }
  await sleep(400);
  const accepted = gl.deploy(0, 0);
  return { accepted, paused: gl.paused };
});
console.log('pushed', JSON.stringify(pushed));
await p.waitForTimeout(300); await p.screenshot({ path: `${out}/${pre}2-moment.png` });
await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/${pre}3-after.png` });
const end = await p.evaluate(() => { const gs = window._nav.getGs(); return { over: gs.isOver, won: gs.won, guide: window._nav.guideTitle?.() ?? null }; });
console.log('end', JSON.stringify(end));
await b.close();
