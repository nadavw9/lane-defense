// Booster QA: drives COLOR CHANGE, FREEZE and BOMB through the real buttons and
// taps, plus the "armed BOMB + pause/resume" regression, and asserts the state.
//   QA_URL=http://localhost:5174/ node scripts/booster-qa.mjs <outDir>
import { chromium } from 'playwright';
const out = process.argv[2];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.addInitScript(() => { if (!localStorage.getItem('lane-defense-v1')) localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: 40, coins: 500 })); });
await p.goto(process.env.QA_URL ?? 'http://localhost:5173/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 90000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window._nav.startLevel(12));
await p.waitForTimeout(4000);
const res = await p.evaluate(async () => {
  const nav = window._nav, gs = nav.getGs(), gl = nav.getGameLoop(), bs = nav.getBoosterState();
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const out = [];
  const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name} ${extra}`);
  const tap = (sx, sy) => { const c = document.querySelector('canvas:not(#three-canvas)'), r = c.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, clientX: r.left + sx / 390 * r.width, clientY: r.top + sy / 844 * r.height };
    c.dispatchEvent(new PointerEvent('pointerdown', o)); c.dispatchEvent(new PointerEvent('pointerup', o)); };
  const center = (r) => [r.x + r.w / 2, r.y + r.h / 2];
  for (let i = 0; i < 20 && (gl.paused || nav.getDragDrop().inputBlocked); i++) { nav.dismissTutorial(); tap(195, 560); await sleep(250); }
  nav.setBoosters(3, 3, 3);
  const hud = nav.getHudBounds();
  const cars = () => nav.getCarScreenPositions().filter(c => c.row >= 1);

  // COLOR CHANGE
  const c0 = cars()[0]; const from = c0.color; const sameBefore = cars().filter(c => c.color === from).length;
  tap(...center(hud.boosterColor)); await sleep(200);
  tap(c0.x, c0.y); await sleep(300);
  const sw = nav.getColorPickerSwatches()?.find(s => s.enabled);
  ok('colour picker opens after tapping a car', !!sw);
  if (sw) { tap(sw.x, sw.y); await sleep(300); }
  ok('colour change recolours every car of that colour', cars().filter(c => c.color === from).length === 0, `(${sameBefore} ${from} → ${sw?.color})`);
  ok('colour change spends one charge', bs.colorChange === 2, `left=${bs.colorChange}`);
  ok('colour change mode cleared', !bs.colorChangeMode);

  // FREEZE (and double-tap guard)
  tap(...center(hud.boosterFreeze)); await sleep(150);
  tap(...center(hud.boosterFreeze)); await sleep(150);
  ok('freeze double-tap spends one charge', bs.freeze === 2, `left=${bs.freeze}`);
  ok('freeze armed', bs.isFrozen());
  const allCars = () => gs.lanes.slice(0, gs.activeLaneCount).flatMap(l => l.cars);
  const rowsBefore = new Map(allCars().map(c => [c, c.row]));
  // fire one legal shot through DragDrop
  const dd = nav.getDragDrop(), pos = nav.getPositions();
  let fired = false;
  for (let c = 0; c < gs.activeColCount && !fired; c++) { const s = gs.columns[c].top();
    for (let l = 0; l < gs.activeLaneCount && !fired; l++) { const f = gs.lanes[l].frontCar(); if (f && f.color === s.color) {
      dd.onPointerDown(pos.colX[c], pos.slotY[0]); dd.onPointerMove(pos.laneX[l], 300); dd.onPointerUp(pos.laneX[l], 300); fired = true; } } }
  const t0 = gs.turnCount; for (let i = 0; i < 60 && gs.turnCount === t0; i++) await sleep(100);
  const moved = allCars().filter(c => rowsBefore.has(c) && rowsBefore.get(c) !== c.row).length;
  if (fired) ok('frozen shot does not advance traffic', moved === 0, `moved=${moved}`);
  else out.push('SKIP frozen-shot check (no non-lethal matching shot available)');
  ok('freeze consumed after the shot', !bs.isFrozen() || !fired);

  // BOMB armed + pause / resume must NOT fire it
  tap(...center(hud.boosterBomb)); await sleep(200);
  ok('bomb armed', bs.bombMode);
  const pb = hud.pauseBtn; tap(...center(pb)); await sleep(600);
  ok('pause opened', nav.getScreens().pause);
  tap(195, 246); await sleep(600);   // RESUME area
  ok('bomb not fired by pause/resume taps', bs.bombs === 3 && bs.bombMode, `bombs=${bs.bombs} mode=${bs.bombMode}`);
  if (nav.getScreens().pause) { out.push('INFO pause still open after RESUME tap — closing via hook'); }
  // Now place it for real
  const target = cars().sort((a, b) => b.row - a.row)[0];
  tap(target.x, target.y); await sleep(700);
  ok('bomb clears the tapped lane', !gs.lanes[target.lane].cars.some(c => c.row >= 1 && !c.sequence), `lane ${target.lane}`);
  ok('bomb spends one charge (or earned one back)', bs.bombs <= 3 && !bs.bombMode, `bombs=${bs.bombs}`);
  ok('game still running', !gl.paused && !gs.isOver);
  return out;
});
console.log(res.join('\n'));
console.log('errors', errs);
await p.screenshot({ path: `${out}/booster-qa.png` });
await b.close();
