// First-time player QA: a brand-new save walks the real UI — title PLAY, map
// node, level card PLAY, real mouse drags, win screen NEXT — for levels 1..N,
// screenshotting every screen and flagging anything that stops a new player.
//   QA_URL=http://localhost:5174/ node scripts/ftue-play.mjs <outDir> [levels=5]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const [out, nArg = '5'] = process.argv.slice(2);
const N = Number(nArg);
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/Failed to load resource|AudioContext/.test(t)) errs.push(t.slice(0, 200)); });
await p.goto(process.env.QA_URL ?? 'http://localhost:5173/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 90000 });
const log = [];
let shotN = 0;
const shot = async (name) => { await p.screenshot({ path: `${out}/${String(++shotN).padStart(3, '0')}-${name}.png` }); };
const S = () => p.evaluate(() => {
  const n = window._nav, gs = n.getGs(), gl = n.getGameLoop(), sc = n.getScreens();
  return { ...sc, over: gs?.isOver, won: gs?.won, paused: gl?.paused, turn: gs?.turnCount, lvl: gs?.levelId,
    visible: gs ? gs.lanes.slice(0, gs.activeLaneCount).flatMap(l => l.cars).filter(c => c.row >= 1).length : 0,
    blocked: n.getDragDrop()?.inputBlocked };
});
await p.waitForTimeout(5000);                          // title intro
await shot('title');
await p.mouse.click(195, 474);                         // PLAY
await p.waitForTimeout(2000);
await shot('map');
for (let lv = 1; lv <= N; lv++) {
  let s = await S();
  if (!s.preLevel) {
    // Tap the level's node on the map (read its position from the map screen).
    const node = await p.evaluate((n) => window._nav.getMapNode?.(n) ?? null, lv);
    if (node) await p.mouse.click(node.x, node.y); else await p.evaluate((n) => window._nav.showPreLevel(n), lv);
    await p.waitForTimeout(1500);
  }
  await shot(`L${lv}-card`);
  const playY = await p.evaluate(() => window._nav.getPreLevelPlayY());
  if (playY == null) log.push(`L${lv}: level card did not open`);
  await p.mouse.click(195, playY ?? 609);                 // card PLAY (real tap)
  await p.waitForTimeout(2500);
  s = await S();
  if (s.preLevel) log.push(`L${lv}: PLAY tap did not start the level`);
  await shot(`L${lv}-start`);
  const t0 = Date.now(); let drags = 0, idleNoTarget = 0;
  while (Date.now() - t0 < 180000) {
    s = await S();
    if (s.over) break;
    if (s.blocked || s.modal || s.introCard) { await shot(`L${lv}-modal`); await p.mouse.click(195, 560); await p.waitForTimeout(700); continue; }
    if (s.paused) { log.push(`L${lv}: paused with no modal (tutorial?) turn ${s.turn}`); await shot(`L${lv}-paused`); await p.evaluate(() => window._nav.dismissTutorial()); await p.waitForTimeout(500); continue; }
    const move = await p.evaluate(() => {
      const n = window._nav, gs = n.getGs(), pos = n.getPositions();
      const ok = (car, s) => car && (s.isColorBomb || (car.armor ?? 0) > 0 || car.color === s.color);
      let best = null;
      for (let c = 0; c < gs.activeColCount; c++) { const s = gs.columns[c].top(); if (!s) continue;
        for (let l = 0; l < gs.activeLaneCount; l++) { const f = gs.lanes[l].frontCar(); if (!ok(f, s) || f.row < 1) continue;
          const sc = f.row * 10 + (s.damage >= f.hp ? 5 : 0); if (!best || sc > best.sc) best = { sc, x0: pos.colX[c], y0: pos.slotY[0], x1: pos.laneX[l], y1: 320 }; } }
      return best;
    });
    if (!move) {
      if (++idleNoTarget === 4) { log.push(`L${lv}: no visible target to shoot at turn ${s.turn} (visible cars ${s.visible})`); await shot(`L${lv}-no-target`); }
      await p.waitForTimeout(800); if (idleNoTarget > 12) break; continue;
    }
    idleNoTarget = 0;
    const turn = s.turn;
    await p.mouse.move(move.x0, move.y0); await p.mouse.down();
    for (let i = 1; i <= 10; i++) { await p.mouse.move(move.x0 + (move.x1 - move.x0) * i / 10, move.y0 + (move.y1 - move.y0) * i / 10); await p.waitForTimeout(16); }
    await p.mouse.up(); drags++;
    let w = 0; while (w < 30 && (await S()).turn === turn && !(await S()).over) { await p.waitForTimeout(200); w++; }
    if ((await S()).turn === turn && !(await S()).over) {
      const s2 = await S();
      if (!s2.blocked && !s2.modal) { log.push(`L${lv}: drag ${drags} did nothing (turn ${turn})`); await shot(`L${lv}-drag-nothing`); }
    }
    if (drags === 1 || drags % 6 === 0) await shot(`L${lv}-t${turn}`);
  }
  await p.waitForTimeout(2500);
  s = await S();
  await shot(`L${lv}-end-${s.won ? 'win' : 'lose'}`);
  log.push(`L${lv}: ${s.won ? 'WIN' : s.over ? 'LOSE' : 'STUCK'} after ${drags} drags, turn ${s.turn}`);
  if (s.win) { await p.waitForTimeout(2500); await p.mouse.click(195, (await p.evaluate(() => window._nav.getWinNextY?.() ?? 560))); await p.waitForTimeout(2000); await shot(`L${lv}-after-next`); }
  else { await p.evaluate(() => window._nav.cleanAll()); await p.evaluate(() => window._nav.showLevelSelect()); await p.waitForTimeout(1500); }
}
writeFileSync(`${out}/log.txt`, log.join('\n') + '\n\nERRORS\n' + errs.join('\n'));
console.log(log.join('\n')); console.log('errors:', errs.length, errs.slice(0, 5));
await b.close();
