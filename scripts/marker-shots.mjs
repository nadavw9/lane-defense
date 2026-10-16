// Captures every tutorial marker / helper / hint for design review.
//   QA_URL=http://localhost:5173/ node scripts/marker-shots.mjs <outDir>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'marker-shots'; mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await p.addInitScript(() => { if (!localStorage.getItem('lane-defense-v1')) localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: 12, coins: 500 })); });
await p.goto(process.env.QA_URL ?? 'http://localhost:5173/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 90000 });
await p.waitForTimeout(1500);
let n = 0; const shot = (name) => p.screenshot({ path: `${out}/${String(++n).padStart(2, '0')}-${name}.png` });
const S = () => p.evaluate(() => window._nav.getScreens());
const until = async (pred, ms = 20000) => { const t0 = Date.now(); let s; while (Date.now() - t0 < ms) { s = await S(); if (pred(s)) return s; await p.waitForTimeout(150); } return s; };
// Force the bomb tutorial: earn a bomb via the real callback.
await p.evaluate(() => { localStorage.removeItem('ftue_completed'); window._nav.startLevel(2); });
await until(s => s.pauseBtn, 30000);
await p.waitForTimeout(3000);
for (let i = 0; i < 15; i++) { const s = await S(); if (!s.paused && !s.modal && !s.introCard) break; await p.evaluate(() => window._nav.dismissTutorial()); await p.waitForTimeout(400); }
await p.evaluate(() => { window._nav.getGameLoop()._onBombEarned?.(); });
await p.waitForTimeout(1500);
await shot('bomb-tutorial');
await p.evaluate(() => window._nav.dismissTutorial());
await p.evaluate(() => window._nav.startLevel(4));
await until(s => s.pauseBtn, 30000);
await p.waitForTimeout(4000);
await shot('L4-bench-tutorial');

const clear = async () => { for (let i = 0; i < 20; i++) { const s = await S(); if (!s.paused && !s.modal && !s.introCard && s.blockers.length === 0) return; await p.evaluate(() => window._nav.dismissTutorial()); await p.mouse.click(195, 560); await p.waitForTimeout(400); } };
const tap = async (x, y) => p.mouse.click(x, y);
// L1 fresh: arrow + tip
await p.evaluate(() => { localStorage.removeItem('ftue_completed'); window._nav.startLevel(1); });
await until(s => s.pauseBtn, 30000); await p.waitForTimeout(5000); await shot('L1-fresh-start');
// L3 start
await p.evaluate(() => { window._nav.cleanAll?.(); window._nav.startLevel(3); });
await until(s => s.pauseBtn, 30000); await p.waitForTimeout(5000); await shot('L3-start');
await clear();
await p.evaluate(() => window._nav.setBoosters(2, 2, 2));
const hud = await p.evaluate(() => window._nav.getHudBounds());
const c = (r) => [r.x + r.w / 2, r.y + r.h / 2];
// armed bomb
await tap(...c(hud.boosterBomb)); await p.waitForTimeout(700); await shot('bomb-armed');
await p.keyboard.press('Escape'); await p.waitForTimeout(400);
// colour change armed
await tap(...c(hud.boosterColor)); await p.waitForTimeout(700); await shot('colour-armed');
await p.keyboard.press('Escape'); await p.waitForTimeout(400);
// freeze
await tap(...c(hud.boosterFreeze)); await p.waitForTimeout(700); await shot('freeze-armed');
// mid-drag: hold a bomb over a lane
const mv = await p.evaluate(() => { const n = window._nav, pos = n.getPositions(); return { x0: pos.colX[0], y0: pos.slotY[0], x1: pos.laneX[1] }; });
await p.mouse.move(mv.x0, mv.y0); await p.mouse.down();
for (let i = 1; i <= 10; i++) { await p.mouse.move(mv.x0 + (mv.x1 - mv.x0) * i / 10, mv.y0 - 200 * i / 10); await p.waitForTimeout(30); }
await p.waitForTimeout(400); await shot('dragging-over-lane');
await p.mouse.move(mv.x1, 760); await p.waitForTimeout(400); await shot('dragging-over-bench');
await p.mouse.up();
await b.close();
