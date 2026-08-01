// TASK 4 (spare budget, REPORT ONLY) — name the ~1.4s session-init cost.
//
// Known shape: the FIRST shot of a session is far slower than later shots, and the
// cost is paid once per SESSION, not per level (measured 2026-07-27: L5 shot#1
// 1699ms, shot#2 267ms; then L13 shot#1 188ms, L5 re-entered shot#1 274ms).
// Playwright gives every test a fresh page, so every test's first drag pays it —
// which is why tests-visual/smoke/boundaries.spec.js carries a 20000ms budget.
//
// This attributes the cost rather than just re-observing it: wrap the named
// candidates with cumulative timers, fire shot #1 and shot #2 in the SAME session,
// and report per-candidate milliseconds for each. Instrument only — fixes nothing.
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window._nav, null, { timeout: 60000 });
await page.evaluate(() => window._nav.startLevel(5));
await page.waitForTimeout(2500);

const out = await page.evaluate(async () => {
  const nav = window._nav, gs = nav.getGs(), gl = nav.getGameLoop(), dd = nav.getDragDrop();
  const inFlight = () => Object.values(gs.firingSlots).some((s) => s !== null) || (gs.hitStopRemaining ?? 0) > 0;

  const P3 = await import('/src/renderer3d/Particles3D.js');
  const AM = await import('/src/audio/AudioManager.js');

  const acc = {};
  const wrap = (obj, name, label) => {
    if (!obj || typeof obj[name] !== 'function') return;
    const orig = obj[name];
    obj[name] = function (...a) {
      const t = performance.now();
      try { return orig.apply(this, a); } finally { acc[label] = (acc[label] ?? 0) + (performance.now() - t); }
    };
  };
  // Candidate 1: Particles3D — module-scoped shared geometries/materials are built
  // lazily on first spawn.
  for (const m of ['spawnHit', 'spawnExplosion', 'spawnFlash', 'spawnDamageNumber', 'spawnShockwave', 'spawnMissBounce'])
    wrap(P3.Particles3D.prototype, m, `Particles3D.${m}`);
  // Candidate 2: audio — first play() decodes / resumes the AudioContext.
  const amProto = AM.AudioManager?.prototype ?? Object.getPrototypeOf(nav.getGs()).constructor.prototype;
  wrap(AM.AudioManager?.prototype, 'play', 'AudioManager.play');
  // Candidate 3: long tasks anywhere on the main thread (catches Pixi font
  // rasterisation and texture upload without naming them individually).
  const longTasks = [];
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) longTasks.push(Math.round(e.duration)); })
      .observe({ entryTypes: ['longtask'] });
  } catch { /* not supported */ }

  const shoot = async () => {
    for (let i = 0; i < 200 && (inFlight() || gl.paused || dd.inputBlocked); i++) {
      nav.dismissTutorial(); await new Promise((r) => setTimeout(r, 50));
    }
    const lane = [0, 1, 2].find((l) => l < gs.activeLaneCount && gs.lanes[l].cars.length);
    if (lane == null) return null;
    for (const c of gs.lanes[lane].cars) c.color = gs.columns[0].shooters[0].color;
    for (const k of Object.keys(acc)) acc[k] = 0;
    longTasks.length = 0;
    const t0 = performance.now();
    const turn0 = gs.turnCount;
    nav.deploy(0, lane);
    for (let i = 0; i < 300 && gs.turnCount === turn0; i++) await new Promise((r) => setTimeout(r, 20));
    return { total: Math.round(performance.now() - t0), acc: { ...acc }, longTasks: [...longTasks] };
  };

  const first = await shoot();
  const second = await shoot();
  const third = await shoot();
  return { first, second, third };
});

const show = (label, r) => {
  if (!r) { console.log(`${label}: no cars, skipped`); return; }
  console.log(`\n${label}  — turn completed in ${r.total}ms`);
  const rows = Object.entries(r.acc).filter(([, v]) => v > 0.5).sort((a, b) => b[1] - a[1]);
  if (!rows.length) console.log('    (no instrumented candidate consumed >0.5ms)');
  for (const [k, v] of rows) console.log(`    ${k.padEnd(28)} ${v.toFixed(1).padStart(8)}ms`);
  const lt = r.longTasks.filter((d) => d >= 50);
  console.log(`    main-thread long tasks >=50ms: ${lt.length ? lt.join(', ') + 'ms' : 'none'}`);
};
console.log('SESSION-INIT COST ATTRIBUTION (L5, same session, three consecutive shots)');
show('SHOT #1 (session-first)', out.first);
show('SHOT #2', out.second);
show('SHOT #3', out.third);
await browser.close();
