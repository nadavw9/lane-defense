// Edge-case QA: window resizes mid-level, tab hide/show, reload mid-level.
// Every check drives the REAL input path (mouse drags on the Pixi canvas) and
// waits on state (turnCount, screens), never on time.
//   QA_URL=http://localhost:5174/ node scripts/edge-qa.mjs <outDir>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'edge-qa';
mkdirSync(out, { recursive: true });
const URL = process.env.QA_URL ?? 'http://localhost:5173/';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.addInitScript(() => { if (!localStorage.getItem('lane-defense-v1')) localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: 12, coins: 500 })); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 90000 });
const res = [];
let n = 0;
const shot = async (name) => p.screenshot({ path: `${out}/${String(++n).padStart(2, '0')}-${name}.png` });
const ok = (name, cond, extra = '') => res.push(`${cond ? 'PASS' : 'FAIL'} ${name} ${extra}`);
const S = () => p.evaluate(() => ({ ...window._nav.getScreens(), turn: window._nav.getGs().turnCount, over: window._nav.getGs().isOver }));
const until = async (pred, ms = 20000) => { const t0 = Date.now(); let s; while (Date.now() - t0 < ms) { s = await S(); if (pred(s)) return s; await p.waitForTimeout(150); } return s; };
const rect = () => p.evaluate(() => document.querySelector('canvas:not(#three-canvas)').getBoundingClientRect().toJSON());
const toClient = (r, sx, sy) => [r.x + sx / 390 * r.width, r.y + sy / 844 * r.height];
const tap = async (sx, sy) => { const r = await rect(); await p.mouse.click(...toClient(r, sx, sy)); };
const clearBlockers = async () => {
  for (let i = 0; i < 25; i++) {
    const s = await S();
    if (!s.paused && !s.modal && !s.introCard && s.blockers.length === 0) return true;
    await p.evaluate(() => window._nav.dismissTutorial()); await tap(195, 560); await p.waitForTimeout(400);
  }
  return false;
};
// One legal shot by a real mouse drag (stage coords → client coords of the CURRENT canvas box).
const dragShot = async () => {
  const mv = await p.evaluate(() => {
    const n = window._nav, gs = n.getGs(), pos = n.getPositions();
    for (let c = 0; c < gs.activeColCount; c++) { const s = gs.columns[c].top(); if (!s) continue;
      for (let l = 0; l < gs.activeLaneCount; l++) { const f = gs.lanes[l].frontCar();
        if (f && f.row >= 1 && (s.isColorBomb || f.color === s.color)) return { x0: pos.colX[c], y0: pos.slotY[0], x1: pos.laneX[l], y1: 320 }; } }
    return null;
  });
  if (!mv) return 'no-move';
  const r = await rect();
  const t0 = (await S()).turn;
  const [ax, ay] = toClient(r, mv.x0, mv.y0), [bx, by] = toClient(r, mv.x1, mv.y1);
  await p.mouse.move(ax, ay); await p.mouse.down();
  for (let i = 1; i <= 10; i++) { await p.mouse.move(ax + (bx - ax) * i / 10, ay + (by - ay) * i / 10); await p.waitForTimeout(16); }
  await p.mouse.up();
  const s = await until(s => s.turn !== t0 || s.over, 30000);
  return s.turn !== t0 || s.over ? 'landed' : 'no-effect';
};

await p.waitForTimeout(1500);
await p.evaluate(() => window._nav.startLevel(9));
await until(s => s.pauseBtn, 30000);
ok('L9 running', await clearBlockers());
ok('baseline drag lands at 390x844', (await dragShot()) === 'landed');

for (const [w, h, tag] of [[412, 915, 'phone-tall'], [1280, 720, 'desktop'], [844, 390, 'landscape-phone'], [390, 844, 'back-to-portrait']]) {
  await p.setViewportSize({ width: w, height: h });
  await p.waitForTimeout(1200);
  await clearBlockers();
  const r = await rect();
  ok(`${tag}: canvas fits the window`, r.width <= w + 1 && r.height <= h + 1 && r.x >= -1 && r.y >= -1, JSON.stringify({ x: r.x | 0, y: r.y | 0, w: r.width | 0, h: r.height | 0 }));
  const d = await dragShot();
  ok(`${tag}: real drag deploy lands after resize`, d === 'landed' || d === 'no-move', d);
  await shot(tag);
  if ((await S()).over) break;
}

// Tab hidden → visible mid-level: the loop pauses and the pause menu is up on return.
await clearBlockers();
await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
let s = await S();
ok('tab hidden pauses the loop', s.paused);
await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
s = await until(s => s.pause, 5000);
ok('returning shows the pause menu (not a silently frozen board)', s.pause && s.paused);
await p.keyboard.press('Escape');
s = await until(s => !s.pause, 5000);
ok('resume after tab return', !s.paused);
ok('drag lands after tab return', ['landed', 'no-move'].includes(await dragShot()));

// Reload mid-level: the game boots to the title, the save survives, nothing throws.
const before = await p.evaluate(() => JSON.parse(localStorage.getItem('lane-defense-v1')));
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 90000 });
s = await until(s => s.title, 30000);
ok('reload mid-level lands on the title', s.title);
const after = await p.evaluate(() => JSON.parse(localStorage.getItem('lane-defense-v1')));
ok('save survives reload (unlocked level, coins)', after.unlockedLevel === before.unlockedLevel && after.coins === before.coins, JSON.stringify({ before: [before.unlockedLevel, before.coins], after: [after.unlockedLevel, after.coins] }));

console.log(res.join('\n'));
console.log('errors:', errs.length, errs.slice(0, 5));
await b.close();
