// Autoplay QA bot — plays real levels end to end through the game's own input
// path (DragDrop pointer handlers, the same code a finger drives) and reports
// anything that looks like a bug instead of a game.
//
//   node scripts/autoplay.mjs <outDir> [from=1] [to=40] [--fresh]
//
// Per level it records: result (win/lose/stall/timeout), turns, kills, console
// errors, and EVENTS — each one a suspected defect with the board attached:
//   emptyBoard  — not over, loop running, but no car visible (row >= 1)
//   noMove      — idle, nothing on the queue or bench can legally be fired
//   turnStuck   — a drop was accepted but no turn completed within 12 s
//   pauseStuck  — something holds the loop and a real tap / dismiss can't clear it
//   dropRefused — a legal-looking drop (colour matches) snapped back
// Every sample asserts the loop is running before it counts anything
// (CLAUDE.md: a paused game reads as a broken one).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const out = args[0];
const list = String(args[1] ?? '').includes(',') ? args[1].split(',').map(Number) : null;
const from = Number(list ? 0 : args[1] ?? 1), to = Number(list ? 0 : args[2] ?? 40);
const levels = list ?? Array.from({ length: to - from + 1 }, (_, i) => from + i);
const fresh = args.includes('--fresh');
mkdirSync(out, { recursive: true });

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
let errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('console', m => {
  const t = m.text();
  if (m.type() === 'error' && !/Failed to load resource|AudioContext/.test(t)) errs.push('CONSOLE ' + t.slice(0, 240));
});
if (!fresh) {
  await p.addInitScript(() => {
    // Seen-before flags so the run measures the GAME, not first-time tutorials
    // (a --fresh run covers the first-time path).
    if (!localStorage.getItem('lane-defense-v1')) localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: 40, coins: 500 }));
  });
}
await p.goto(process.env.QA_URL ?? 'http://localhost:5173/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 90000 });
await p.waitForTimeout(1500);

const report = [];
for (const lv of levels) {
  errs = [];
  await p.evaluate((n) => n > 40 ? window._nav.startDaily() : window._nav.startLevel(n), lv);   // 41 = today's daily challenge
  await p.waitForTimeout(2200);
  const t0 = Date.now();
  const r = await p.evaluate(playLevel, { capMs: 7 * 60 * 1000 });
  r.level = lv; r.wallS = Math.round((Date.now() - t0) / 1000); r.errors = errs.slice(0, 8);
  await p.screenshot({ path: `${out}/L${lv}-end.png` });
  report.push(r);
  const ev = r.events.map(e => e.kind).join(',');
  console.log(`L${lv} ${r.result} turns=${r.turns} kills=${r.kills} goal=${r.goalLeft} ${r.wallS}s events=[${ev}] errors=${r.errors.length}`);
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1));
}
await b.close();

// ── In-page player ────────────────────────────────────────────────────────────
async function playLevel({ capMs }) {
  const nav = window._nav;
  const gs = nav.getGs(), gl = nav.getGameLoop(), dd = nav.getDragDrop();
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const events = [];
  const stats = { bomb: 0, freeze: 0, rescue: 0 };
  const history = [];   // last boards, attached when a level is lost
  const lanesN = gs.activeLaneCount, colsN = gs.activeColCount;
  const board = () => gs.lanes.slice(0, lanesN).map(l => l.cars.map(c =>
    `${c.color[0]}${c.hp}${c.armor ? 'A' : ''}${c.trait ? c.trait[0] : ''}${c.sequence ? 'B' : ''}@${c.row}`).join(' '));
  const queue = () => gs.columns.slice(0, colsN).map(c => c.shooters.map(s => `${s.color?.[0] ?? '?'}${s.damage}`).join(','));
  const bench = () => (dd._benchStorage?._slots ?? []).map(s => s ? `${s.color[0]}${s.damage}` : '-').join(',');
  const ev = (kind, extra = {}) => { if (events.filter(e => e.kind === kind).length < 4) events.push({ kind, t: +gs.elapsed.toFixed(1), turn: gs.turnCount, board: board(), queue: queue(), bench: bench(), ...extra }); };
  const canTarget = (car, s) => !!car && (s.isColorBomb || (car.armor ?? 0) > 0 || car.color === s.color);
  const inFlight = () => gs.firingSlots.some(Boolean) || (gs.hitStopRemaining ?? 0) > 0 || dd._state !== 'idle';

  const tapCanvas = (sx, sy) => {
    const c = document.querySelector('canvas:not(#three-canvas)'), r = c.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
      clientX: r.left + (sx / 390) * r.width, clientY: r.top + (sy / 844) * r.height };
    c.dispatchEvent(new PointerEvent('pointerdown', o)); c.dispatchEvent(new PointerEvent('pointerup', o));
  };
  const clearBlockers = async () => {
    for (let a = 0; a < 25; a++) {
      if (!gl.paused && !dd.inputBlocked) return true;
      if (gs.isOver) return true;
      nav.dismissTutorial();
      // Modal cards: TAP TO CONTINUE sits low-centre; the feature-unlock screen's
      // PLAY sits near the bottom. Cycle through the real button spots.
      if (dd.inputBlocked || gl.paused) tapCanvas(195, [560, 714, 520][a % 3]);
      await sleep(250);
    }
    return !gl.paused && !dd.inputBlocked;
  };
  const drag = (x0, y0, x1, y1) => { dd.onPointerDown(x0, y0); dd.onPointerMove((x0 + x1) / 2, (y0 + y1) / 2); dd.onPointerMove(x1, y1); dd.onPointerUp(x1, y1); };

  const t0 = performance.now();
  let emptySince = null, lastTurnAt = performance.now(), lastTurn = gs.turnCount;
  while (performance.now() - t0 < capMs) {
    if (gs.isOver) {
      if (gs.won) break;
      if (!events.some(e => e.kind === 'lost')) events.push({ kind: 'lost', turn: gs.turnCount, history: history.slice(), after: board() });
      // Breach: the rescue offer must appear (once); take it once, then verify
      // the level really resumes in a playable state.
      let sc = null;
      for (let w = 0; w < 40; w++) { sc = nav.getScreens(); if (sc.rescue) break; await sleep(150); }
      if (!sc.rescue) { if (!gs.rescueUsed && !stats.noRescueLevel) ev('noRescueOffer'); break; }
      if (stats.rescue >= 1) break;
      await sleep(1500);     // the panel builds after the red flash
      stats.rescue++;
      for (let tries = 0; tries < 3 && gs.isOver; tries++) {
        tapCanvas(195, 471);   // CONTINUE (watch a video → 5 s web mock ad)
        for (let w = 0; w < 60 && gs.isOver; w++) await sleep(150);
      }
      await sleep(400);
      if (gs.isOver) { ev('rescueDidNotResume'); break; }
      const sc2 = nav.getScreens();
      if (sc2.rescue) ev('rescueOverlayStayed');
      if (!sc2.pauseBtn) ev('rescueNoPauseButton');
      if (gs.lanes.slice(0, lanesN).some(l => l.cars.some(c => c.row > gs.gridRows - 1))) ev('rescueCarPastBreach');
      continue;
    }
    if (gl.paused || dd.inputBlocked) {
      if (!(await clearBlockers())) { ev('pauseStuck', { tutorial: !!nav.getGameLoop().paused, blocked: dd.inputBlocked }); await sleep(2000); }
      continue;
    }
    if (inFlight()) { await sleep(60); continue; }
    if (gs.turnCount !== lastTurn || history.length === 0) {
      lastTurn = gs.turnCount; lastTurnAt = performance.now();
      history.push({ turn: gs.turnCount, board: board(), queue: queue(), bench: bench() });
      if (history.length > 4) history.shift();
    }

    // Empty-looking board (the device-reported soft-lock class).
    const cars = gs.lanes.slice(0, lanesN).flatMap(l => l.cars);
    if (!cars.some(c => c.row >= 1)) {
      emptySince ??= performance.now();
      if (performance.now() - emptySince > 1500) { ev('emptyBoard'); emptySince = performance.now() + 1e9; }
    } else emptySince = null;

    const pos = nav.getPositions();
    const fronts = gs.lanes.slice(0, lanesN).map(l => l.frontCar?.() ?? null);
    // ── Invariants (a broken state, whatever the player does) ──
    for (let c = 0; c < colsN; c++) if (!gs.columns[c].top()) ev('emptyColumn', { c });
    if (gs.goalProgress.some(g => g < 0)) ev('negativeGoal');
    if (cars.some(c => c.row > gs.gridRows - 1)) ev('carPastBreach');
    const bsNow = nav.getBoosterState();
    if (bsNow.colorChange < 0 || bsNow.freeze < 0 || bsNow.bombs < 0) ev('negativeBooster');
    // ── Danger response with the REAL booster buttons (exercises their paths) ──
    const lastRow = gs.gridRows - 1;
    const danger = fronts.map((f, l) => f ? { l, f, rows: lastRow - f.row - (f.trait === 'speeder' ? 1 : 0) } : null).filter(Boolean)
      .sort((a, b) => a.rows - b.rows)[0];
    const hud = nav.getHudBounds();
    const tapHud = (r) => r && tapCanvas(r.x + r.w / 2, r.y + r.h / 2);
    if (danger && danger.rows <= 1 && !bsNow.isFrozen?.()) {
      const killable = (s) => s && canTarget(danger.f, s) && s.damage >= danger.f.hp;
      const haveKill = gs.columns.slice(0, colsN).some(c => killable(c.top())) || (dd._benchStorage?._slots ?? []).some(killable);
      if (!haveKill && bsNow.bombs > 0 && !bsNow.bombMode) {
        const before = bsNow.bombs, turn = gs.turnCount;
        tapHud(hud.boosterBomb); await sleep(150);
        const car = nav.getCarScreenPositions().find(c => c.lane === danger.l && c.row === danger.f.row);
        if (bsNow.bombMode && car) { tapCanvas(car.x, car.y); await sleep(600); }
        stats.bomb++;
        const laneCleared = !gs.lanes[danger.l].cars.some(c => c !== danger.f && !c.sequence) && !gs.lanes[danger.l].cars.includes(danger.f);
        if (bsNow.bombs === before && !bsNow.bombMode && !laneCleared) ev('bombNotSpent', { before });
        if (bsNow.bombMode) { tapHud(hud.boosterBomb); ev('bombStuckArmed'); }
        continue;
      }
      if (!haveKill && bsNow.freeze > 0) {
        const before = bsNow.freeze;
        tapHud(hud.boosterFreeze); await sleep(150);
        stats.freeze++;
        if (bsNow.freeze !== before - 1 || !bsNow.isFrozen()) ev('freezeNotApplied', { before, after: bsNow.freeze });
      }
    }
    // Candidate moves: queue tops, then bench slots.
    const moves = [];
    for (let c = 0; c < colsN; c++) {
      const s = gs.columns[c].top(); if (!s) continue;
      for (let l = 0; l < lanesN; l++) {
        const f = fronts[l]; if (!canTarget(f, s)) continue;
        // A car that breaches on the next advance must die NOW (a kill, not a scratch).
        const steps = f.trait === 'speeder' ? 2 : 1;
        const breachesNext = f.row + steps > gs.gridRows - 1 && s.damage >= f.hp && !f.sequence;
        moves.push({ src: 'col', c, l, score: f.row * 10 + (s.damage >= f.hp ? 6 : 0) + (f.sequence ? 3 : 0) + (breachesNext ? 1000 : 0) });
      }
    }
    const benchSlots = dd._benchStorage?._slots ?? [];
    benchSlots.forEach((s, i) => {
      if (!s) return;
      for (let l = 0; l < lanesN; l++) {
        const f = fronts[l]; if (!canTarget(f, s)) continue;
        moves.push({ src: 'bench', i, l, score: f.row * 10 + (s.damage >= f.hp ? 6 : 0) - 1 });
      }
    });
    moves.sort((a, b) => b.score - a.score);
    const laneY = Math.max(200, Math.min(420, 300));
    if (moves.length) {
      const m = moves[0];
      const turnBefore = gs.turnCount;
      if (m.src === 'col') drag(pos.colX[m.c], pos.slotY[0], pos.laneX[m.l], laneY);
      else { const sc = dd._benchRenderer.getSlotCenter(m.i); drag(sc.x, sc.y, pos.laneX[m.l], laneY); }
      await sleep(30);
      if (dd._state === 'snapping' || (!inFlight() && gs.turnCount === turnBefore && !gl.paused && !dd.inputBlocked)) {
        ev('dropRefused', { move: m });
      }
      // Wait for the turn to resolve (signal: turnCount), with a tripwire.
      const w0 = performance.now();
      while (!gs.isOver && gs.turnCount === turnBefore && performance.now() - w0 < 12000) {
        if (gl.paused || dd.inputBlocked) { await clearBlockers(); }
        if (!inFlight() && !gl.paused && performance.now() - w0 > 1500) break;   // refused or frozen-turn
        await sleep(60);
      }
      if (!gs.isOver && gs.turnCount === turnBefore && performance.now() - w0 >= 12000) ev('turnStuck', { move: m });
      continue;
    }
    // No legal shot: try COLOR CHANGE through the real UI (button → car → swatch),
    // recolouring the most urgent front car to a colour on the queue.
    if (bsNow.colorChange > 0 && fronts.some(Boolean)) {
      const target = fronts.map((f, l) => f && !f.sequence ? { f, l } : null).filter(Boolean).sort((a, b) => b.f.row - a.f.row)[0];
      const want = gs.columns.slice(0, colsN).map(c => c.top()?.color).find(c => c && c !== target?.f.color);
      if (target && want) {
        const before = bsNow.colorChange, fromColor = target.f.color;
        tapHud(hud.boosterColor); await sleep(200);
        const car = nav.getCarScreenPositions().find(c => c.lane === target.l && c.row === target.f.row);
        if (car) { tapCanvas(car.x, car.y); await sleep(300); }
        const sw = nav.getColorPickerSwatches()?.find(x => x.color === want && x.enabled);
        if (sw) { tapCanvas(sw.x, sw.y); await sleep(300); }
        stats.colorChange = (stats.colorChange ?? 0) + 1;
        if (!sw) ev('colorPickerMissing', { want, fromColor });
        else if (target.f.color === fromColor) ev('colorChangeNoEffect', { want, fromColor });
        else if (bsNow.colorChange !== before - 1) ev('colorChangeNotSpent', { before, after: bsNow.colorChange });
        if (bsNow.colorChangeMode) { tapHud(hud.boosterColor); ev('colorChangeStuckArmed'); }
        continue;
      }
    }
    // No legal shot: park the top bomb on the bench if there is room, else report.
    const free = benchSlots.findIndex(s => !s);
    if (free >= 0 && gs.columns[0].top() && dd._benchRenderer) {
      const sc = dd._benchRenderer.getSlotCenter(free);
      const before = benchSlots.filter(Boolean).length;
      drag(pos.colX[0], pos.slotY[0], sc.x, sc.y);
      await sleep(400);
      if ((dd._benchStorage?._slots ?? []).filter(Boolean).length > before) continue;
    }
    ev('noMove');
    await sleep(1500);
    if (performance.now() - lastTurnAt > 20000) { ev('stalled'); break; }
  }
  const goalLeft = gs.goalProgress.reduce((a, b) => a + b, 0);
  // End-screen checks.
  await sleep(1800);
  const end = nav.getScreens();
  if (gs.isOver && gs.won && !end.win) ev('noWinScreen');
  if (gs.isOver && gs.won && end.boosters && Object.values(end.inventory).some(v => v < 0)) ev('negativeInventory');
  return { result: gs.isOver ? (gs.won ? 'win' : 'lose') : 'timeout', turns: gs.turnCount, kills: gs.totalKills, goalLeft, events, stats, rescueUsed: gs.rescueUsed };
}
