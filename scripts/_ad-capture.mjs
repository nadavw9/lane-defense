// Traffic Bomb video ad v1 (9:16): real gameplay recorded in headed Chromium, ad text drawn as a DOM
// overlay in the game's own font so it is recorded with the frame. Story: a car is ONE move from the
// red line -> the save -> combo kills -> 3-star win -> end card.
//   QA_URL=http://localhost:5180/ node scripts/_ad-capture.mjs <outDir> [level=17]
// Writes <outDir>/ad1-silent.mp4 (1080x1920, 30 fps), cut from the hook to the end card.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync } from 'node:fs';

const [out, lvArg = '17'] = process.argv.slice(2);
const URL = process.env.QA_URL ?? 'http://localhost:5180/';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const ctx = await b.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1, recordVideo: { dir: out, size: { width: 1080, height: 1920 } } });
const p = await ctx.newPage();
const t0 = Date.now();
const ACH = 'first_blood combo_starter combo_master bench_warmer sharpshooter survivor speed_demon collector shopkeeper dedicated chain_reaction combo_legend crisis_saved weekly_hero streak_master survival_rookie survival_veteran no_mercy big_spender daily_challenger race_champion';
await p.addInitScript((ach) => {
  const keys = ['tour', 'lane_2', 'lane_3', 'multi_color', 'combo', 'supercharge', 'goal_colour', 'freeze_booster', 'colour_change_booster',
    'freeze_earned', 'colour_change_earned', 'rainbow_bomb', 'first_kill', 'first_miss', 'hp_miss', 'streak_charged', 'plate_break', 'armor_break',
    'volatile_surge', 'mender_heal', 'gift_car', 'traffic_light', 'convoy'];
  for (let i = 1; i <= 200; i++) keys.push(`hint_L${i}`);
  localStorage.setItem('ftue_banners', JSON.stringify(keys));
  localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: 40, achievements: Object.fromEntries(ach.split(' ').map(k => [k, true])), introducedCarTypes: ['small', 'big', 'jeep', 'truck', 'bigrig', 'tank'] }));
}, ACH);
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 120000 });
await p.waitForTimeout(2500);

// Overlay for the hook, captions and end card, in Lilita One like the game's titles.
await p.evaluate(async () => {
  // The ad's own copy of Lilita One (served by the dev server from node_modules), loaded before any text shows.
  const ff = new FontFace('AdTitle', "url('/node_modules/@fontsource/lilita-one/files/lilita-one-latin-400-normal.woff2')");
  document.fonts.add(await ff.load());
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99;display:flex;flex-direction:column;align-items:center;font-family:AdTitle,Fredoka,Arial,sans-serif;';
  document.body.appendChild(d);
  window._ad = (html) => { d.innerHTML = html; };
});
const POP = '<style>@keyframes pop{0%{transform:scale(.4)}70%{transform:scale(1.12)}100%{transform:scale(1)}}</style>';
const cap = (text, top, size, color) => p.evaluate((h) => window._ad(h), text
  ? `<div style="margin-top:${top}px;font-size:${size}px;color:${color};-webkit-text-stroke:6px #1B1340;text-shadow:0 12px 0 #1B1340,0 0 60px rgba(255,80,40,.6);text-align:center;line-height:1.05;padding:18px 60px;background:rgba(20,14,50,.55);border-radius:40px;animation:pop .35s ease-out">${text}</div>${POP}`
  : '');

await p.evaluate((n) => window._nav.startLevel(n), Number(lvArg));
await p.waitForTimeout(4500);
for (let i = 0; i < 8; i++) { await p.evaluate(() => window._nav.dismissGuides?.()); await p.waitForTimeout(200); }
if (await p.evaluate(() => window._nav.getGameLoop().paused)) { console.log('PAUSED: precondition failed'); process.exit(1); }

// The hook: lane 0's front car on the last step before the red line, a matching bomb on column 0,
// and a short goal so the clip ends in a win.
const setup = await p.evaluate(() => {
  const gs = window._nav.getGs(), gl = window._nav.getGameLoop();
  // A lane whose front car dies in one hit (a motorbike), so the save is one shot.
  const li = Math.max(0, gs.lanes.slice(0, gs.activeLaneCount).findIndex(l => l.cars[0]?.hp === 1));
  const car = gs.lanes[li].cars[0];
  if (car.hp !== 1) { car.hp = 1; car.maxHp = 1; car.type = 'small'; }
  car.row = gs.gridRows - 1;
  if (li !== 0) { const c0 = gs.columns[0].top(); c0.color = car.color; }
  car.position = gl._rowToPosition(car.row, gs.gridRows);
  gs.columns[0].top().color = car.color;
  gs.goalProgress = gs.goalProgress.map(() => 0); gs.goalProgress[0] = 5;
  gs.score = gs.starTargets[2] - 420;   // the short clip still climbs the star bar to three stars
  return { color: car.color, row: car.row };
});
console.log('setup', JSON.stringify(setup));
await p.waitForTimeout(600);
const tStart = (Date.now() - t0) / 1000;
await cap('ONLY 1 MOVE LEFT!', 820, 120, '#FF5A3C');
await p.waitForTimeout(1800);
await cap('');

// A good player's shots: nearest car first, matching bomb.
const fire = (k, gap) => p.evaluate(async ([k, gap]) => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  let n = 0;
  for (let t = 0; t < 300 && n < k; t++) {
    const gs = window._nav.getGs(), gl = window._nav.getGameLoop();
    if (gs.isOver) break;
    if (Object.values(gs.firingSlots).some(Boolean) || gl.paused) { await sleep(60); continue; }
    const order = [...Array(gs.activeLaneCount).keys()].filter(li => gs.lanes[li].frontCar())
      .sort((a, c) => gs.lanes[c].frontCar().row - gs.lanes[a].frontCar().row);
    let done = false;
    for (const li of order) {
      const fc = gs.lanes[li].frontCar();
      for (let ci = 0; ci < gs.activeColCount && !done; ci++) {
        const top = gs.columns[ci].top();
        if (top && top.color === fc.color && gl.deploy(ci, li)) done = true;
      }
      if (done) break;
    }
    if (done) n++;
    await sleep(done ? gap : 100);
  }
  return n;
}, [k, gap]);
console.log('save shot', await fire(1, 900));
await cap('SAVED!', 820, 130, '#7CFF6A');
await p.waitForTimeout(900);
await cap('');
console.log('shots', await fire(12, 650));
await p.waitForFunction(() => window._nav.getScreens().win || window._nav.getGs().isOver, null, { timeout: 30000 });
console.log('end', JSON.stringify(await p.evaluate(() => { const g = window._nav.getGs(); return [g.score, g.starTargets, window._nav.getScreens().win]; })));
await p.waitForTimeout(3800);
await p.evaluate(() => window._ad(`<div style="position:absolute;inset:0;background:linear-gradient(#2A1F66,#160F3A);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:52px;animation:fade .4s;font-family:AdTitle,Fredoka,Arial,sans-serif;font-weight:400">
  <img src="sprites/designed/title-logo.png" style="width:860px">
  <img src="sprites/designed/app-hero.png" style="width:560px;border-radius:80px;box-shadow:0 20px 0 #0B0820">
  <div style="font-size:84px;color:#fff;-webkit-text-stroke:4px #1B1340;text-align:center;padding:0 60px">Can you stop the traffic?</div>
  <div style="font-size:58px;color:#1B1340;background:#FFE14A;padding:24px 56px;border-radius:80px;border:6px solid #1B1340">Coming soon on Google Play</div></div>
  <style>@keyframes fade{from{opacity:0}to{opacity:1}}</style>`));
await p.waitForTimeout(2800);
const tEnd = (Date.now() - t0) / 1000;
await ctx.close(); await b.close();

const v = readdirSync(out).find(f => f.endsWith('.webm') && f !== 'raw.webm');
renameSync(`${out}/${v}`, `${out}/raw.webm`);
// The webm's clock starts a little after t0, so cut from the END: the last (tEnd - tStart) seconds.
const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', `${out}/raw.webm`]).toString().trim());
const len = tEnd - tStart + 0.3;
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(Math.max(0, dur - len)), '-i', `${out}/raw.webm`, '-t', String(len),
  '-vf', 'scale=1080:1920:flags=lanczos,fps=30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-an', `${out}/ad1-silent.mp4`]);
console.log(`${out}/ad1-silent.mp4  (${(tEnd - tStart).toFixed(1)} s)`);
