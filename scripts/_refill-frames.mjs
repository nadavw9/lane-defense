// Refill motion review: fire one matching shot and capture the frames after it.
//   QA_URL=http://localhost:5177/ node scripts/_refill-frames.mjs <outDir> <prefix> [level=17] [shots=1]
// Writes <prefix>-sheet.png (frames left to right, 0.1 s of game time apart at DPR 1) and logs
// which column / lane fired and what the queue looked like before and after.
import { chromium } from 'playwright';
import sharp from 'sharp';
const [out, prefix, lvArg = '17', shotsArg = '1'] = process.argv.slice(2);
const URL = process.env.QA_URL ?? 'http://localhost:5177/';
const headed = !!process.env.HEADED;
const b = await chromium.launch(headed ? { headless: false, args: ['--use-gl=angle', '--enable-gpu'] } : { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await p.addInitScript(() => {
  const keys = ['tour', 'lane_2', 'lane_3', 'multi_color', 'combo', 'supercharge', 'goal_colour', 'freeze_booster', 'colour_change_booster',
    'freeze_earned', 'colour_change_earned', 'rainbow_bomb', 'first_kill', 'first_miss', 'hp_miss', 'streak_charged', 'plate_break', 'armor_break',
    'volatile_surge', 'mender_heal', 'gift_car', 'traffic_light', 'convoy'];
  for (let i = 1; i <= 200; i++) keys.push(`hint_L${i}`);
  localStorage.setItem('ftue_banners', JSON.stringify(keys));
  localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: 60, introducedCarTypes: ['small', 'big', 'jeep', 'truck', 'bigrig', 'tank'] }));
});
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 120000 });
await p.waitForTimeout(2500);
await p.evaluate((n) => window._nav.startLevel(n), Number(lvArg));
await p.waitForTimeout(6000);
for (let i = 0; i < 6; i++) { await p.evaluate(() => window._nav.dismissGuides?.()); await p.waitForTimeout(400); }
const paused = await p.evaluate(() => window._nav.getGameLoop().paused);
if (paused) { console.log('PAUSED — precondition failed'); await b.close(); process.exit(1); }

const frames = [];
for (let shot = 0; shot < Number(shotsArg); shot++) {
  // Wait for a settled board, then fire the first top bomb that matches a front car.
  await p.waitForFunction(() => { const gs = window._nav.getGs(); return !Object.values(gs.firingSlots).some(Boolean); }, null, { timeout: 30000 });
  await p.waitForTimeout(800);
  const fired = await p.evaluate(() => {
    const gs = window._nav.getGs(), gl = window._nav.getGameLoop();
    const q = gs.activeCols.map(c => c.shooters.map(s => s.color[0]).join(''));
    for (let ci = 0; ci < gs.activeColCount; ci++) {
      const top = gs.columns[ci].top(); if (!top) continue;
      for (let li = 0; li < gs.activeLaneCount; li++) {
        const fc = gs.lanes[li].frontCar();
        if (fc && fc.color === top.color) { const ok = gl.deploy(ci, li); return { ok, ci, li, before: q }; }
      }
    }
    return { ok: false, before: q };
  });
  console.log('shot', shot, JSON.stringify(fired));
  if (!fired.ok) break;
  if (shot === 0) await p.screenshot({ path: `${out}/${prefix}-full0.png` });
  for (let f = 0; f < 10; f++) {
    frames.push(await p.screenshot());
    await p.waitForTimeout(Number(process.env.FRAME_MS ?? 100));
  }
  console.log('after', await p.evaluate(() => JSON.stringify(window._nav.getGs().activeCols.map(c => c.shooters.map(s => s.color[0]).join('')))));
}
// Contact sheet: each frame cropped to the road + bomb queue at full resolution, 10 per row.
const CROP = { left: 66, top: 110, width: 260, height: 620 };
const W = Math.round(CROP.width * 0.6), H = Math.round(CROP.height * 0.6), per = 10, rows = Math.ceil(frames.length / per);
const tiles = await Promise.all(frames.map(f => sharp(f).extract(CROP).resize(W, H).toBuffer()));
await sharp({ create: { width: W * per, height: H * rows, channels: 3, background: '#000' } })
  .composite(tiles.map((t, i) => ({ input: t, left: (i % per) * W, top: Math.floor(i / per) * H })))
  .toFile(`${out}/${prefix}-sheet.png`);
console.log(`${out}/${prefix}-sheet.png`);
await b.close();
