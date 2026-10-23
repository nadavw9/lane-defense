// Review captures for the world-complete ceremony and the supercharge-on-bench rule.
//   QA_URL=http://localhost:5176/ node scripts/_world-shots.mjs <outDir> <prefix>
// Works on builds with and without the ceremony (a build without it shows the map instead).
import { chromium } from 'playwright';
const [out, prefix = 'x'] = process.argv.slice(2);
const URL = process.env.QA_URL ?? 'http://localhost:5176/';

const b = await chromium.launch({ executablePath: process.env.PW_EXE ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
await p.addInitScript(() => {
  if (localStorage.getItem('lane-defense-v1')) return;
  localStorage.setItem('ftue_banners', JSON.stringify(['tour', 'multi_lane', 'first_shot', 'bench', 'merge', 'first_car', 'supercharge', 'streak_charged']));
  const stars = {}; for (let i = 1; i <= 14; i++) stars[i] = i % 3 === 0 ? 2 : 3;
  localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: 15, stars, coins: 120 }));
});
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 120000 });
await p.waitForTimeout(3000);
const shot = async (name, wait = 1500) => { await p.waitForTimeout(wait); await p.screenshot({ path: `${out}/${prefix}-${name}.png` }); console.log(name); };
const tap = (x, y) => p.mouse.click(x, y);   // viewport = stage (390x844)
const screens = () => p.evaluate(() => window._nav.getScreens());

// ── 1. Supercharge, then a charged bomb moved to the bench ──────────────────────
await p.evaluate(() => { window._nav.cleanAll?.(); window._nav.startLevel(14); });
await p.waitForTimeout(6000);
for (let i = 0; i < 4; i++) { await p.evaluate(() => window._nav.dismissGuides?.()); await p.waitForTimeout(600); }
await p.evaluate(() => {
  const loop = window._nav.getGameLoop(), gs = loop._gs;
  gs.streakEnabled = true;
  if (loop._chargeFrontRow) loop._chargeFrontRow();
  gs.streakCharged = true;
  loop._onStreak?.(0, true, { justCharged: false });
});
await shot('charged');
await p.evaluate(() => {
  const loop = window._nav.getGameLoop(), gs = loop._gs, bench = loop._benchStorage;
  const top = gs.columns[0].top(); gs.columns[0].consume(); bench.store(top);
});
await shot('charged-bench');

// ── 2. Win L15 (last level of world 1), tap NEXT ────────────────────────────────
await p.evaluate(() => { window._nav.cleanAll?.(); window._nav.startLevel(15); });
await p.waitForTimeout(6000);
await p.evaluate(() => { window._nav.dismissGuides?.(); window._nav.showWin(); });
await p.waitForTimeout(3500);
for (let i = 0; i < 10 && (await screens()).modal; i++) { await p.evaluate(() => window._nav.dismissGuides()); await p.waitForTimeout(400); }
await shot('win', 1500);
// NEXT runs _showWorldComplete; headless clicks do not reach the win screen here, so the QA
// hook opens the same ceremony (then the same map drive) directly.
const hasWorld = await p.evaluate(() => { window._nav.cleanAll?.(); return window._nav.showWorldComplete ? window._nav.showWorldComplete(15) : false; });
if (!hasWorld) await p.evaluate(() => window._nav.showLevelSelect({ drive: { from: 15, to: 16 } }));
await shot('after-next-0', 500);
await shot('after-next-1', 1600);
const s = await screens();
console.log('world phase:', s.world);
if (s.world) {
  await tap(195, 614);       // open the gift
  await shot('gift-open-0', 250);
  await shot('gift-open-1', 1400);
  await tap(195, 784);       // NEXT WORLD
  await shot('reveal', 1600);
  await tap(195, 784);       // LET'S GO
  await shot('map-0', 1200);
  await shot('map-1', 3500);
}
console.log('screens', JSON.stringify(await screens()));
console.log('inventory', JSON.stringify(await p.evaluate(() => window._nav.inventory?.())));
console.log(errs.join('\n') || 'no page errors');
await b.close();
