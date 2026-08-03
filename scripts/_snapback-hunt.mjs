// TASK 1 — find what makes the bombs sit out of their slots at L8 IN PLAY, and
// what triggers the snap-back ~1s later.
//
// INSTRUMENT DISCIPLINE (learned the hard way this session): do NOT import
// projection.js from page context — a dynamic import resolves to a DIFFERENT
// module instance stuck at band-540 defaults, and that artifact has already
// produced two false readings. Everything here is read off the live Three meshes
// and the game objects, and compared against each other.
//
// At rest every slot Z must be CONSTANT. Any slot whose Z moves and then returns
// is the reported symptom; the sample where it moves and the sample where it
// comes back bracket the trigger.
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window._nav, null, { timeout: 60000 });
await page.evaluate(() => window._nav.startLevel(8));
await page.waitForTimeout(2500);

const out = await page.evaluate(async () => {
  const nav = window._nav, gs = nav.getGs(), gl = nav.getGameLoop(), dd = nav.getDragDrop();
  const ms = nav.getMergeSequencer?.();
  const s3 = nav.getShooter3D?.();
  if (!s3) return { err: 'no getShooter3D' };

  const canvas = document.querySelector('canvas:not(#three-canvas)');
  const tap = () => { const r = canvas.getBoundingClientRect();
    const o = { bubbles:true, cancelable:true, pointerId:1, pointerType:'mouse', isPrimary:true,
                clientX:r.left+0.5*r.width, clientY:r.top+(420/844)*r.height };
    canvas.dispatchEvent(new PointerEvent('pointerdown',o)); canvas.dispatchEvent(new PointerEvent('pointerup',o)); };
  for (let i=0;i<40 && (gl.paused||dd.inputBlocked); i++){ nav.dismissTutorial(); tap(); await new Promise(r=>setTimeout(r,200)); }

  const series = [];
  const t0 = performance.now();
  const snap = (evt) => {
    const rows = [];
    for (let r = 0; r < 3; r++) {
      const s = s3._slots?.[0]?.[r];
      if (!s) continue;
      rows.push({ r,
        z: +s.group.position.z.toFixed(4),
        y: +s.group.position.y.toFixed(4),
        sc: +s.group.scale.x.toFixed(3),
        lock: !!s._animLock,
        vis: !!s.sphereMesh?.visible,
      });
    }
    series.push({ t: Math.round(performance.now()-t0), evt,
      rows, occupancy: gs.columns[0].shooters.length,
      firing: Object.values(gs.firingSlots).some(v=>v!==null),
      hitStop: +(gs.hitStopRemaining ?? 0).toFixed(3),
      msActive: !!ms?.active, msPending: !!ms?._pending,
      turn: gs.turnCount });
  };

  snap('rest');
  const lane = [0,1,2,3].find(l => l < gs.activeLaneCount && gs.lanes[l].cars.length);
  if (lane != null) for (const c of gs.lanes[lane].cars) c.color = gs.columns[0].shooters[0].color;
  snap('pre-deploy');
  if (lane != null) nav.deploy(0, lane);
  // Dense sampling: 30ms x 130 ≈ 3.9s, well past the reported ~1s correction.
  for (let i=0;i<130;i++){ await new Promise(r=>setTimeout(r,30)); snap(''); }
  return { lane, series };
});

if (out.err) { console.log('ERR ' + out.err); await browser.close(); process.exit(1); }

// Baseline = the resting Z of each slot in the first sample.
const base = {}; for (const r of out.series[0].rows) base[r.r] = r.z;
console.log(`\nSNAP-BACK HUNT — L8, column 0, fired into lane ${out.lane}`);
console.log('dz = slot Z minus its RESTING Z at t=0. Non-zero = ball off its slot.\n');
console.log('  t(ms) │ dz row0 │ dz row1 │ dz row2 │ locks │ occ │ fire │ hitStop │ merge │ turn │ note');
console.log('────────┼─────────┼─────────┼─────────┼───────┼─────┼──────┼─────────┼───────┼──────┼─────');
let prevKey = null;
for (const s of out.series) {
  const d = (r) => { const x = s.rows.find(q=>q.r===r); return x ? (x.z-base[r]).toFixed(3).padStart(7) : '   -   '; };
  const off = s.rows.some(r => Math.abs(r.z-base[r.r]) > 0.02);
  const locks = s.rows.filter(r=>r.lock).map(r=>r.r).join(',') || '-';
  const key = `${off}|${locks}|${s.occupancy}|${s.msActive}`;
  const changed = prevKey !== null && key !== prevKey;
  prevKey = key;
  if (!off && !changed && s.t % 300 !== 0 && s.evt === '') continue;   // keep the table readable
  console.log(`${String(s.t).padStart(7)} │ ${d(0)} │ ${d(1)} │ ${d(2)} │ ${locks.padEnd(5)} │ `
    + `${String(s.occupancy).padStart(3)} │ ${String(s.firing).padEnd(4)} │ ${String(s.hitStop).padStart(7)} │ `
    + `${(s.msActive?'ACTIVE':(s.msPending?'pend':'-')).padEnd(5)} │ ${String(s.turn).padStart(4)} │ ${off?'OFF-SLOT':''}${changed?' <<CHANGE':''} ${s.evt}`);
}
const anyOff = out.series.some(s => s.rows.some(r => Math.abs(r.z-base[r.r]) > 0.02));
console.log(`\nany slot left its resting Z during the cycle: ${anyOff ? 'YES' : 'NO'}`);
await browser.close();
