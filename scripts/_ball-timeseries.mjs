// TASK 2 — full animation lifecycle, time series, not a before/after snapshot.
//
// Both prior fixes ARE live (e7b4720 + c35d40f are ancestors of the deployed
// 091d9e9), so the bug is not fully characterised: some OTHER path moves a ball
// while it is visible. The two fixes covered refill-drop and band-transition;
// this hunts merge-output placement, auto-fill after fire, and CRISIS inject.
//
// Canonical slot Z is measured AT REST, never imported from projection.js —
// importing that module from page context resolves to a second instance stuck at
// band-540 defaults, which has already contaminated two measurements.
//
// EVERY stimulus is verified to have actually happened. The first version of this
// script reported zero displacement because input was blocked and nothing fired.
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window._nav, null, { timeout: 60000 });
await page.evaluate(() => window._nav.startLevel(8));
await page.waitForTimeout(2500);
// dismissTutorial() does NOT clear the L8 tutorial — measured: paused stays true
// through 15 calls. Real canvas taps do. A trace taken under the paused loop is
// void (refills stop), which is what produced the first bogus numbers.
for (let i = 0; i < 6; i++) { await page.mouse.click(195, 500); await page.waitForTimeout(350); }
await page.waitForTimeout(800);

const ready = await page.evaluate(() => ({
  paused: window._nav.getGameLoop().paused,
  blocked: window._nav.getDragDrop().inputBlocked,
  queues: window._nav.getGs().columns.map(c => c.shooters.length),
  lanes: window._nav.getGs().activeLaneCount,
  cols: window._nav.getGs().activeColCount,
}));
console.log('preflight:', JSON.stringify(ready));
if (ready.paused) console.log('!! loop is PAUSED — any trace would be void');

const canon = await page.evaluate(() => {
  const s = window._nav.getShooter3D();
  const o = {};
  for (let r = 0; r < s._slots[0].length; r++) o[r] = s._slots[0][r].group.position.z;
  return o;
});
console.log('canonical slot Z at rest:', JSON.stringify(canon));

await page.evaluate((canon) => {
  const s = window._nav.getShooter3D();
  window.__ts = [];
  const t0 = performance.now();
  const tick = () => {
    const t = performance.now() - t0;
    for (let c = 0; c < s._slots.length; c++) {
      for (let r = 0; r < s._slots[c].length; r++) {
        const slot = s._slots[c][r], g = slot.group;
        // Scale 0 is how the merge parks a spent traveler at the destination
        // (GameApp.js:1943) — still `visible`, but the player cannot see it.
        // Counting those inflates the displacement window; only pixels count.
        const sc = g.scale?.x ?? 1;
        if (!g.visible || sc <= 0.15) continue;
        const dev = g.position.z - canon[r];
        if (Math.abs(dev) > 0.12) window.__ts.push({
          t: +t.toFixed(1), c, r, dev: +dev.toFixed(3),
          lock: !!slot._animLock, sc: +(g.scale?.x ?? 1).toFixed(2),
        });
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}, canon);

// Fire through the game's own deploy path, verifying each one landed.
let fired = 0, skipped = 0;
for (let i = 0; i < 18; i++) {
  const r = await page.evaluate(({ i, lanes, cols }) => {
    const gs = window._nav.getGs();
    const col = i % cols;
    if (!gs.columns[col].top()) return 'empty';
    const before = gs.columns[col].shooters.length;
    window._nav.deploy(col, i % lanes);
    return before !== gs.columns[col].shooters.length ? 'fired' : 'nochange';
  }, { i, lanes: ready.lanes, cols: ready.cols });
  r === 'fired' ? fired++ : skipped++;
  await page.waitForTimeout(650);
}
console.log(`stimulus: ${fired} deploys landed, ${skipped} skipped`);
if (!fired) { console.log('!! nothing fired — trace is VOID'); await browser.close(); process.exit(1); }
await page.waitForTimeout(1500);

const ts = await page.evaluate(() => window.__ts);
console.log(`\nframes with a VISIBLE ball off its slot: ${ts.length}`);

const eps = [];
for (const s of ts) {
  const last = eps.find(e => e.c === s.c && e.r === s.r && s.t - e.end < 120);
  if (last) { last.end = s.t; last.max = Math.max(last.max, Math.abs(s.dev));
              last.locked = last.locked || s.lock; last.n++; }
  else eps.push({ c: s.c, r: s.r, start: s.t, end: s.t, max: Math.abs(s.dev), locked: s.lock, n: 1 });
}
eps.sort((a, b) => (b.end - b.start) - (a.end - a.start));
console.log('\nlongest episodes (ball visible AND away from its slot):');
console.log('   dur(ms)  col row   maxDev(wu)  animLocked  frames');
for (const e of eps.slice(0, 12))
  console.log(`   ${String((e.end - e.start).toFixed(0)).padStart(7)}  ${String(e.c).padStart(3)} `
    + `${String(e.r).padStart(3)}   ${e.max.toFixed(3).padStart(9)}  ${String(e.locked).padStart(10)}  ${String(e.n).padStart(6)}`);

const pitch = canon[1] - canon[0];
const worst = eps[0];
if (worst) console.log(`\nworst: ${(worst.end - worst.start).toFixed(0)}ms, `
  + `${(worst.max / pitch).toFixed(2)} slot-pitches off (pitch=${pitch.toFixed(3)}wu)`);
const unlocked = eps.filter(e => !e.locked && (e.end - e.start) > 60);
console.log(`episodes NOT anim-locked and >60ms: ${unlocked.length}`
  + (unlocked.length ? '  <-- moved by a path that never took the lock' : ''));
await browser.close();
