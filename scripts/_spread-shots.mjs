// CHAIN REACTION check (2026-10-27): set three same-colour front cars on L6, fire the middle lane,
// and capture the arc + neighbour explosions. Logs what the loop paid and destroyed.
//   QA_URL=http://localhost:5180/ node scripts/_spread-shots.mjs <outDir>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'qa-spread'; mkdirSync(out, { recursive: true });
const b = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await p.addInitScript(() => { const k = ['tour','lane_2','lane_3','multi_color','combo','supercharge','goal_colour','freeze_booster','first_kill','first_miss','hp_miss','streak_charged']; for (let i = 1; i <= 200; i++) k.push(`hint_L${i}`); localStorage.setItem('ftue_banners', JSON.stringify(k)); localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: 10, introducedCarTypes: ['small','big','jeep'] })); });
await p.goto(process.env.QA_URL ?? 'http://localhost:5180/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 120000 }); await p.waitForTimeout(2000);
await p.evaluate(() => window._nav.startLevel(6)); await p.waitForTimeout(4000);
await p.screenshot({ path: `${out}/0-card.png` });          // the CHAIN REACTION card opens L6
for (let i = 0; i < 6; i++) { await p.evaluate(() => window._nav.dismissGuides?.()); await p.waitForTimeout(200); }
await p.waitForTimeout(800);
const setup = await p.evaluate(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const gs = window._nav.getGs(), gl = window._nav.getGameLoop();
  while (Object.values(gs.firingSlots).some(Boolean) || gl.paused) await sleep(80);
  const top = gs.columns[0].top(); const color = top.color;
  // Every lane's front car takes the colour of column 0's bomb; a middle-lane shot should take all three.
  for (let li = 0; li < gs.activeLaneCount; li++) { const fc = gs.lanes[li].frontCar(); if (fc) { fc.color = color; fc.hp = 1; } }
  await sleep(600);
  const before = { score: gs.score, kills: gs.totalKills, spread: gs.spreadEnabled, color, fronts: gs.lanes.slice(0, gs.activeLaneCount).map(l => l.frontCar()?.color) };
  gl.deploy(0, 1);
  return before;
});
console.log('before', JSON.stringify(setup));
for (const [ms, name] of [[140, '1-arc'], [260, '2-pop'], [700, '3-after']]) { await p.waitForTimeout(ms - (name === '1-arc' ? 0 : name === '2-pop' ? 140 : 260)); await p.screenshot({ path: `${out}/${name}.png` }); }
const after = await p.evaluate(() => { const gs = window._nav.getGs(); return { score: gs.score, kills: gs.totalKills, fronts: gs.lanes.slice(0, gs.activeLaneCount).map(l => l.frontCar()?.color) }; });
console.log('after', JSON.stringify(after));
await b.close();
