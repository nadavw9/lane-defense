// V2 review captures: special cars, boss, Hot Streak states (dev server :5173).
//   node scripts/v2-shots.mjs <outDir> [baseUrl]
// Plays real turns through the dev hooks (the same path a drag takes after
// validation) so boards show traffic mid-level, not the opening deal.
import { chromium } from 'playwright';
const [out, base = 'http://localhost:5173/', only] = process.argv.slice(2);
// Optional 3rd arg: comma list of levels to capture (e.g. 7,12) — skips the rest.
const ONLY = only ? only.split(',').map(Number) : null;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

async function open(level) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await p.addInitScript(() => {
    localStorage.setItem('ftue_banners', JSON.stringify(['multi_lane', 'first_shot', 'bench', 'merge', 'first_car', 'first_kill', 'first_combo', 'streak_charged', 'armor_break']));
  });
  await p.goto(base, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => !!window._nav, null, { timeout: 90000 });
  await p.evaluate((l) => window._nav.startLevel(l), level);
  await p.waitForTimeout(3500);
  for (let i = 0; i < 12; i++) {
    const paused = await p.evaluate(() => window._nav.getGameLoop()?.paused);
    if (!paused) break;
    await p.evaluate(() => window._nav.dismissTutorial?.());
    await p.mouse.click(195, 470); await p.waitForTimeout(500);
  }
  return p;
}

// Fire `n` shots: each turn, the first column top that can hit some lane's front car.
async function play(p, n) {
  for (let i = 0; i < n; i++) {
    const fired = await p.evaluate(() => {
      const loop = window._nav.getGameLoop(); const gs = loop._gs;
      if (gs.isOver || loop.paused) return 'stop';
      if (Object.values(gs.firingSlots).some(s => s)) return 'busy';
      for (let c = 0; c < gs.activeColCount; c++) {
        const top = gs.columns[c].top(); if (!top) continue;
        for (let l = 0; l < gs.activeLaneCount; l++) {
          const f = gs.lanes[l].frontCar();
          if (f && ((f.armor ?? 0) > 0 || f.color === top.color)) { loop.deploy(c, l); return 'ok'; }
        }
      }
      return 'none';
    });
    if (fired === 'stop') break;
    await p.waitForTimeout(900);
  }
  await p.waitForTimeout(700);
}

const shots = [
  ['01', 7, 8], ['02', 11, 8], ['03', 17, 8], ['04', 10, 6], ['05', 20, 7], ['06', 40, 8],
];
for (const [name, level, n] of (ONLY ? ONLY.map((l, i) => [`L${l}`, l, 8]) : shots)) {
  const p = await open(level);
  await play(p, n);
  await p.screenshot({ path: `${out}/${name}.png` });
  console.log(name, 'L' + level);
  await p.close();
}
// Hot Streak: pips at 2, then charged.
if (!ONLY) {
  const p = await open(5);
  await p.evaluate(() => { const l = window._nav.getGameLoop(); l._gs.streak = 2; l._onStreak?.(2, false, {}); });
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${out}/07.png` });
  await p.evaluate(() => { const l = window._nav.getGameLoop(); l._gs.streak = 0; l._gs.streakCharged = true; l._onStreak?.(0, true, { justCharged: true }); });
  await p.waitForTimeout(1300);
  await p.screenshot({ path: `${out}/08.png` });
  console.log('07-08 streak');
  await p.close();
}
await b.close();
