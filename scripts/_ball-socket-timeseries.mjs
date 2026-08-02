// TASK 1 — ball-vs-socket alignment as a TIME SERIES across a full
// fire -> refill -> merge -> settle cycle.
//
// Reading state once after a guessed delay is the failure mode that broke five
// instruments in this project. This samples continuously and prints the sequence,
// so both the divergence AND whatever corrects it are visible with timestamps.
//
// Balls are Three meshes (slot.group.position.z, world space); sockets are Pixi
// circles at bombSlotScreenY(row) (screen space). The canonical slot position is
// bombSlotZ(row). Divergence = ball z - canonical z, converted to px.
import { chromium } from 'playwright';

const LEVEL = Number(process.argv[2] ?? 5);
const browser = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window._nav, null, { timeout: 60000 });
await page.evaluate((l) => window._nav.startLevel(l), LEVEL);
await page.waitForTimeout(2500);

const out = await page.evaluate(async () => {
  const nav = window._nav, gs = nav.getGs(), gl = nav.getGameLoop(), dd = nav.getDragDrop();
  const s3 = nav.getShooter3D?.();
  if (!s3) return { err: 'no getShooter3D hook' };
  const P = await import('/src/renderer3d/projection.js');

  const canvas = document.querySelector('canvas:not(#three-canvas)');
  const tap = () => { const r = canvas.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
                clientX: r.left + 0.5 * r.width, clientY: r.top + (420 / 844) * r.height };
    canvas.dispatchEvent(new PointerEvent('pointerdown', o)); canvas.dispatchEvent(new PointerEvent('pointerup', o)); };
  for (let i = 0; i < 40 && (gl.paused || dd.inputBlocked); i++) { nav.dismissTutorial(); tap(); await new Promise((r) => setTimeout(r, 200)); }

  // One sample: for column 0, every slot's ball z vs the canonical slot z.
  const sample = (t, label) => {
    const rows = [];
    for (let row = 0; row < 3; row++) {
      const slot = s3._slots?.[0]?.[row];
      if (!slot) continue;
      const ballZ = slot.group.position.z;
      const canonZ = P.bombSlotZ(row);
      rows.push({
        row,
        ballZ: +ballZ.toFixed(4),
        canonZ: +canonZ.toFixed(4),
        // Same conversion both sides so the delta is in real screen pixels.
        deltaPx: +((P.zToScreenY(ballZ) - P.zToScreenY(canonZ))).toFixed(2),
        baseZ: slot.group._baseZ == null ? null : +slot.group._baseZ.toFixed(4),
        animLock: !!slot._animLock,
      });
    }
    return { t, label, scale: +P.BOMB_ZONE_SCALE.toFixed(4),
             socketY2: +P.bombSlotScreenY(2).toFixed(1), rows };
  };

  const series = [];
  const t0 = performance.now();
  const snap = (label) => series.push(sample(Math.round(performance.now() - t0), label));

  snap('at rest (pre-fire)');
  // Fire into a lane that has a car.
  const lane = [0, 1, 2, 3].find((l) => l < gs.activeLaneCount && gs.lanes[l].cars.length);
  if (lane != null) {
    for (const c of gs.lanes[lane].cars) c.color = gs.columns[0].shooters[0].color;
    nav.deploy(0, lane);
  }
  // Sample densely for 4s — long enough to cover fire, hit-stop, refill, merge
  // window and the reported "couple of seconds later" correction.
  for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 100)); snap(`+${(i + 1) * 100}ms`); }
  return { lane, series };
});

if (out.err) { console.log('ERR: ' + out.err); await browser.close(); process.exit(1); }

console.log(`\nBALL vs SOCKET TIME SERIES — L${LEVEL}, column 0, fired into lane ${out.lane}`);
console.log('deltaPx = ball screen Y - canonical slot screen Y   (0 = aligned)\n');
console.log('   t(ms) │ label            │ scale  │ row0 Δpx │ row1 Δpx │ row2 Δpx │ locks │ _baseZ set');
console.log('─────────┼──────────────────┼────────┼──────────┼──────────┼──────────┼───────┼───────────');
let prev = null;
for (const s of out.series) {
  const d = (r) => { const x = s.rows.find((q) => q.row === r); return x ? x.deltaPx.toFixed(2).padStart(8) : '     -  '; };
  const locks = s.rows.filter((r) => r.animLock).map((r) => r.row).join(',') || '-';
  const bz = s.rows.map((r) => (r.baseZ == null ? 'null' : r.baseZ)).join('/');
  const maxAbs = Math.max(...s.rows.map((r) => Math.abs(r.deltaPx)));
  const mark = (prev != null && Math.abs(maxAbs - prev) > 1) ? '  <<< CHANGE' : '';
  prev = maxAbs;
  console.log(`${String(s.t).padStart(8)} │ ${s.label.padEnd(16)} │ ${s.scale.toFixed(4)} │ ${d(0)} │ ${d(1)} │ ${d(2)} │ ${locks.padEnd(5)} │ ${bz}${mark}`);
}
await browser.close();
