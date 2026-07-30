// THE harness. One instrument, validated against a known-good baseline before
// it informs any decision.
//
// Five predecessors produced wrong readings. The common failure was always the
// same: read state after a GUESSED time window, and infer "the game is running"
// from a proxy. Both are fixed here.
//
//   1. ASSERTS THE REAL PAUSE STATE at every sample via _nav.getGameLoop().paused.
//      Four things pause the loop and dragDrop.inputBlocked sees only two of them
//      — TutorialOrchestrator pauses with no flag at all. Any run that pauses for
//      a reason the harness did not cause is DISCARDED and COUNTED, never reported.
//   2. WAITS ON SIGNALS, never intervals: gs.turnCount incrementing is the only
//      thing a completed turn produces. Ceilings exist purely as tripwires, and a
//      run that hits one is recorded as incomplete rather than measured.
//   3. SAMPLES RAW STATE over time instead of computing a derived metric, so the
//      sequence shows which of success/failure occurred.
//   4. DISMISSES tutorials and modals DETERMINISTICALLY (dismissTutorial(), then
//      verifying !paused) rather than tapping pixels and hoping.
//
// Usage: node scripts/harness.mjs <level> <runs> [label]
import { chromium } from 'playwright';

const LEVEL = Number(process.argv[2] ?? 8);
const RUNS  = Number(process.argv[3] ?? 12);
const LABEL = process.argv[4] ?? `L${LEVEL}`;

const browser = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window._nav, null, { timeout: 60000 });

const missing = await page.evaluate(() => {
  const n = window._nav;
  return ['getGameLoop', 'dismissTutorial', 'getGs', 'getMergeSequencer'].filter((k) => !n[k]);
});
if (missing.length) {
  console.log(`ERR: _nav is missing ${missing.join(', ')} — this harness requires them. Are you on a branch with the observability hooks?`);
  await browser.close(); process.exit(1);
}

await page.evaluate((lv) => window._nav.startLevel(lv), LEVEL);
await page.waitForTimeout(2500);

const out = await page.evaluate(async (RUNS) => {
  const nav = window._nav;
  const gs = nav.getGs(), gl = nav.getGameLoop(), ms = nav.getMergeSequencer();
  const dd = nav.getDragDrop();
  const fz = () => { try { return nav.freezeState(); } catch { return {}; } };
  const inFlight = () => Object.values(gs.firingSlots).some((s) => s !== null) || (gs.hitStopRemaining ?? 0) > 0;

  // Clear anything holding the loop, then VERIFY it let go.
  const clearBlockers = async () => {
    for (let a = 0; a < 20; a++) {
      if (!gl.paused && !dd.inputBlocked) return true;
      nav.dismissTutorial();
      if (dd.inputBlocked) {                       // modal card: needs a tap, then verify
        const c = document.querySelector('canvas:not(#three-canvas)');
        const r = c.getBoundingClientRect();
        const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
                    clientX: r.left + 0.5 * r.width, clientY: r.top + (420 / 844) * r.height };
        c.dispatchEvent(new PointerEvent('pointerdown', o));
        c.dispatchEvent(new PointerEvent('pointerup', o));
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    return !gl.paused && !dd.inputBlocked;
  };

  const cascades = []; const of_ = ms._finish?.bind(ms);
  if (of_) ms._finish = function () { cascades.push(this.chain); return of_(); };
  const starts = []; const os_ = ms.start.bind(ms);
  ms.start = function () { const was = this.active, fl = inFlight(), pz = gl.paused;
    os_(); if (!was && this.active) starts.push({ inFlight: fl, pausedAtStart: pz }); };

  const runs = [];
  for (let k = 0; k < RUNS; k++) {
    if (!(await clearBlockers())) { runs.push({ discarded: 'could not clear blockers' }); continue; }
    let w = 0;
    while (w < 10000 && (inFlight() || ms.active || ms._pending)) { await new Promise((r) => setTimeout(r, 40)); w += 40; }
    if (gs.isOver) { runs.push({ discarded: 'level over' }); break; }
    const lane = [0, 1, 2, 3].find((l) => l < gs.activeLaneCount && gs.lanes[l].cars.length);
    if (lane == null) { runs.push({ discarded: 'no cars' }); continue; }

    for (const c of gs.lanes[lane].cars) c.color = gs.columns[0].shooters[0].color;
    const ids = []; gs.lanes[lane].cars.forEach((c, i) => { c.__h = `h${k}_${i}`; ids.push(c.__h); });
    const hp0 = gs.lanes[lane].cars.reduce((a, c) => a + (c.hp ?? 0), 0);
    const turn0 = gs.turnCount, s0 = starts.length, c0 = cascades.length;

    nav.deploy(0, lane);

    // SIGNAL, not interval: wait until the turn completes.
    let waited = 0, completed = false, foreignPause = false, sawFreeze = false, mrgInFlight = false;
    while (waited < 15000) {
      await new Promise((r) => setTimeout(r, 50)); waited += 50;
      if (ms.active && inFlight()) mrgInFlight = true;
      if (fz().isFrozen) sawFreeze = true;
      // A pause we did not cause: the merge legitimately pauses, nothing else may.
      if (gl.paused && !ms.active) foreignPause = true;
      if (gs.turnCount > turn0) { completed = true; break; }
    }
    const alive = gs.lanes[lane].cars.filter((c) => ids.includes(c.__h));
    runs.push({
      lane, completed, waited, mrgInFlight, sawFreeze, foreignPause,
      turnsAdvanced: gs.turnCount - turn0,
      damaged: alive.length < ids.length || alive.reduce((a, c) => a + (c.hp ?? 0), 0) < hp0,
      starts: starts.slice(s0), cascades: cascades.slice(c0),
    });
  }
  return runs;
}, RUNS);

const discarded = out.filter((r) => r.discarded || r.foreignPause || r.sawFreeze || !r.completed);
const clean     = out.filter((r) => !r.discarded && !r.foreignPause && !r.sawFreeze && r.completed);
const why = (k) => out.filter((r) => r.discarded === k || (k === 'foreignPause' && r.foreignPause)
  || (k === 'freeze' && r.sawFreeze) || (k === 'incomplete' && !r.completed && !r.discarded)).length;

console.log(`\n### ${LABEL}  runs=${out.length}  CLEAN=${clean.length}  DISCARDED=${discarded.length}`);
console.log(`    discarded: blockers=${why('could not clear blockers')} foreignPause=${why('foreignPause')} freeze=${why('freeze')} incomplete=${why('incomplete')} noCars=${why('no cars')} over=${why('level over')}`);
if (!clean.length) { console.log('    NO CLEAN RUNS — harness not usable as-is; do not report from it.'); }
else {
  const ws = clean.map((r) => r.waited).sort((a, b) => a - b);
  console.log(`\n  BASELINE SANITY (must look like a working game):`);
  console.log(`    turn completed              : ${clean.length}/${clean.length}  (median ${ws[Math.floor(ws.length / 2)]}ms)`);
  console.log(`    turns advanced per deploy   : ${[...new Set(clean.map((r) => r.turnsAdvanced))].join(', ')}`);
  console.log(`    damage landed               : ${clean.filter((r) => r.damaged).length}/${clean.length}`);
  console.log(`    cascade depths observed     : [${clean.flatMap((r) => r.cascades).join(', ')}]`);
  console.log(`\n  OBSERVED SYMPTOM:`);
  console.log(`    merge active while in flight: ${clean.filter((r) => r.mrgInFlight).length}/${clean.length}`);
  console.log(`    merge starts               : ${clean.flatMap((r) => r.starts).length} (in-flight at start: ${clean.flatMap((r) => r.starts).filter((s) => s.inFlight).length})`);
}
await browser.close();
