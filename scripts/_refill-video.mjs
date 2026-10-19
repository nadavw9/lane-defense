// Refill motion review, real time: record video of N matching shots (headed, GPU), then cut
// 20 fps frames for the 0.9 s after each shot into two strips per shot: the top of the road
// (where refill cars enter) and the bomb queue.
//   QA_URL=http://localhost:5177/ node scripts/_refill-video.mjs <outDir> <prefix> [level=17] [shots=3]
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync } from 'node:fs';
import sharp from 'sharp';
const [out, prefix, lvArg = '17', shotsArg = '3'] = process.argv.slice(2);
const URL = process.env.QA_URL ?? 'http://localhost:5177/';
const vdir = `${out}/${prefix}-video`;
mkdirSync(vdir, { recursive: true });
const b = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, recordVideo: { dir: vdir, size: { width: 390, height: 844 } } });
const p = await ctx.newPage();
const t0 = Date.now();
await p.addInitScript((save) => {
  const keys = ['tour', 'lane_2', 'lane_3', 'multi_color', 'combo', 'supercharge', 'goal_colour', 'freeze_booster', 'colour_change_booster',
    'freeze_earned', 'colour_change_earned', 'rainbow_bomb', 'first_kill', 'first_miss', 'hp_miss', 'streak_charged', 'plate_break', 'armor_break',
    'volatile_surge', 'mender_heal', 'gift_car', 'traffic_light', 'convoy'];
  for (let i = 1; i <= 200; i++) keys.push(`hint_L${i}`);
  localStorage.setItem('ftue_banners', JSON.stringify(keys));
  localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: save, introducedCarTypes: ['small', 'big', 'jeep', 'truck', 'bigrig', 'tank'] }));
}, Number(process.env.SAVE_LEVEL ?? 60));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 120000 });
await p.waitForTimeout(2000);
await p.evaluate((n) => window._nav.startLevel(n), Number(lvArg));
await p.waitForTimeout(5000);
for (let i = 0; i < 6; i++) { await p.evaluate(() => window._nav.dismissGuides?.()); await p.waitForTimeout(300); }
if (await p.evaluate(() => window._nav.getGameLoop().paused)) { console.log('PAUSED — precondition failed'); process.exit(1); }
const shotTimes = [];
if (process.env.MODE === 'gap') {
  // A lane with a car staged at the back and a visible gap below it, then one refill: the case
  // where the old rule dropped the new car into the visible gap.
  await p.waitForTimeout(800);
  await p.evaluate(() => {
    const gs = window._nav.getGs(), gl = window._nav.getGameLoop(), ROWS = gs.gridRows;
    const lane = gs.lanes[1];
    const keep = lane.cars.slice(0, 2);
    lane.cars.length = 0;
    keep[0].row = 3.5; keep[1].row = 0.5;
    for (const c of keep) { c.position = gl._rowToPosition(c.row, ROWS); lane.addCar(c); }
  });
  await p.waitForTimeout(1200);
  shotTimes.push((Date.now() - t0) / 1000);
  const after = await p.evaluate(() => {
    const gs = window._nav.getGs(), gl = window._nav.getGameLoop();
    gs.laneTargetCarCount = 3;
    gl._refillLanes();
    return gs.lanes[1].cars.map(c => c.row + ':' + c.color);
  });
  console.log('refill at', shotTimes.at(-1).toFixed(2), 'lane 1 rows', JSON.stringify(after));
}
if (process.env.MODE === 'effects') {
  // 1) the viability guard's recolour, as the player sees it (same bomb, new colour)
  await p.waitForTimeout(800);
  shotTimes.push((Date.now() - t0) / 1000);
  await p.evaluate(() => { const gs = window._nav.getGs(); const t = gs.columns[1].top(); t.color = t.color === 'Red' ? 'Yellow' : 'Red'; });
  console.log('recolour at', shotTimes.at(-1).toFixed(2));
  // 2) a crisis bomb pushed in on top of column 2
  await p.waitForTimeout(1500);
  shotTimes.push((Date.now() - t0) / 1000);
  await p.evaluate(() => { const gs = window._nav.getGs(); const col = gs.columns[2]; const s0 = col.top();
    const c = Object.assign(Object.create(Object.getPrototypeOf(s0)), s0, { color: 'Red' }); col.shooters.unshift(c); col.shooters.length = 3; });
  console.log('crisis insert at', shotTimes.at(-1).toFixed(2));
}
for (let shot = 0; shot < (process.env.MODE ? 0 : Number(shotsArg)); shot++) {
  await p.waitForFunction(() => !Object.values(window._nav.getGs().firingSlots).some(Boolean), null, { timeout: 30000 });
  await p.waitForTimeout(1200);
  const fired = await p.evaluate(() => {
    const gs = window._nav.getGs(), gl = window._nav.getGameLoop();
    for (let ci = 0; ci < gs.activeColCount; ci++) {
      const top = gs.columns[ci].top(); if (!top) continue;
      for (let li = 0; li < gs.activeLaneCount; li++) {
        const fc = gs.lanes[li].frontCar();
        if (fc && fc.color === top.color) return { ok: gl.deploy(ci, li), ci, li };
      }
    }
    return { ok: false };
  });
  shotTimes.push((Date.now() - t0) / 1000);
  console.log('shot', shot, JSON.stringify(fired), 'at', shotTimes.at(-1).toFixed(2), 's');
  if (!fired.ok) break;
}
await p.waitForTimeout(1500);
await ctx.close(); await b.close();
const video = readdirSync(vdir).find(f => f.endsWith('.webm'));
renameSync(`${vdir}/${video}`, `${vdir}/run.webm`);
// The recording starts when the page opens (~t0): cut 18 frames at 20 fps from each shot.
const TOP = { left: 66, top: 40, width: 260, height: 300 }, Q = { left: 66, top: 600, width: 260, height: 140 };
for (let s = 0; s < shotTimes.length; s++) {
  const fdir = `${vdir}/s${s}`; mkdirSync(fdir, { recursive: true });
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(Math.max(0, shotTimes[s] - 0.05)), '-i', `${vdir}/run.webm`, '-t', '0.9', '-vf', 'fps=20', `${fdir}/f%02d.png`]);
  const files = readdirSync(fdir).filter(f => f.endsWith('.png')).sort();
  for (const [name, R] of [['top', TOP], ['queue', Q]]) {
    const W = Math.round(R.width * 0.5), H = Math.round(R.height * 0.5);
    const tiles = await Promise.all(files.map(f => sharp(`${fdir}/${f}`).extract(R).resize(W, H).toBuffer()));
    await sharp({ create: { width: W * tiles.length, height: H, channels: 3, background: '#000' } })
      .composite(tiles.map((t, i) => ({ input: t, left: i * W, top: 0 }))).toFile(`${out}/${prefix}-s${s}-${name}.png`);
  }
  console.log(`${out}/${prefix}-s${s}-top.png / -queue.png (${files.length} frames, 50 ms apart)`);
}
