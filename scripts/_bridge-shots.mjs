// BRIDGES review captures (2026-10-31): L6 with the LINK hints, a bridge drag in progress, a made
// bridge, the blast of a shot on a bridged car, and a snap (speeder) on L9. Drives the REAL
// DragDrop handlers through _nav. Writes numbered PNGs + 00-labels.txt into <outDir>.
//   QA_URL=http://localhost:5174/ node scripts/_bridge-shots.mjs docs/review
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] ?? 'docs/review';
mkdirSync(out, { recursive: true });
for (const f of readdirSync(out)) if (/\.(png|txt)$/.test(f)) unlinkSync(join(out, f));
const labels = [];
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs = [];
p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
await p.goto(process.env.QA_URL ?? 'http://localhost:5174/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 90000 });
await p.waitForTimeout(1200);

const shot = async (name, what) => {
  const n = String(labels.length + 1).padStart(2, '0');
  await p.screenshot({ path: join(out, `${n}.png`) });
  labels.push(`${n}=${name}: ${what}`);
  console.log(n, name);
};
const inPage = (fn, arg) => p.evaluate(fn, arg);
const clear = () => inPage(async () => {
  const nav = window._nav, gl = nav.getGameLoop(), dd = nav.getDragDrop();
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const tap = (sx, sy) => {
    const c = document.querySelector('canvas:not(#three-canvas)'), r = c.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
      clientX: r.left + (sx / 390) * r.width, clientY: r.top + (sy / 844) * r.height };
    c.dispatchEvent(new PointerEvent('pointerdown', o)); c.dispatchEvent(new PointerEvent('pointerup', o));
  };
  for (let a = 0; a < 30 && (gl.paused || dd.inputBlocked); a++) {
    nav.dismissTutorial(); nav.dismissGuides?.();
    if (dd.inputBlocked || gl.paused) tap(195, [560, 714, 520, 700][a % 4]);
    await sleep(250);
  }
  return { paused: gl.paused, blocked: dd.inputBlocked };
});

// A board with a guaranteed pair: set lane 0 and lane 1 front cars to the same colour at the same row.
const seedPair = () => inPage(() => {
  const gs = window._nav.getGs();
  const a = gs.lanes[0].cars.find(c => c.row >= 1), b = gs.lanes[1].cars.find(c => Math.abs(c.row - (a?.row ?? -9)) < 1e-6);
  if (!a || !b) return null;
  b.color = a.color; b.altColor = null; b.armor = 0; a.armor = 0;
  return { lane: 0, row: a.row, color: a.color };
});
const carXY = (lane, row) => inPage(([lane, row]) => {
  const nav = window._nav, gs = nav.getGs();
  const car = gs.lanes[lane].cars.find(c => Math.abs(c.row - row) < 1e-6);
  const pos = nav.getCarScreenPositions?.() ?? null;
  const xy = pos?.find(q => q.lane === lane && Math.abs(q.row - row) < 1e-6);
  return xy ? { x: xy.x, y: xy.y } : { x: nav.getPositions().laneX[lane], y: null, position: car?.position };
}, [lane, row]);

await inPage(() => window._nav.startLevel(6));
await p.waitForTimeout(2500);
await clear();
await p.waitForTimeout(400);
let pair = await seedPair();
await p.waitForTimeout(600);
await shot('L6 hints', 'dotted LINK links between every bridgeable pair (same colour, side by side, adjacent lanes); nothing else changed');

// Drag from lane 0 to lane 1 through the real handlers, pausing mid-way for the rubber band.
const dragInfo = await inPage(async () => {
  const nav = window._nav, gs = nav.getGs(), dd = nav.getDragDrop();
  const pairs = nav.bridgeable();
  if (!pairs.length) return { error: 'no bridgeable pair' };
  const pr = pairs[0];
  const pos = nav.getCarScreenPositions();
  const A = pos.find(q => q.lane === pr.a.lane && Math.abs(q.row - pr.a.row) < 1e-6);
  const B = pos.find(q => q.lane === pr.b.lane && Math.abs(q.row - pr.b.row) < 1e-6);
  dd.onPointerDown(A.x, A.y);
  dd.onPointerMove((A.x + B.x) / 2, A.y + 40);
  return { A, B, state: dd._state };
});
console.log('drag', JSON.stringify(dragInfo));
await p.waitForTimeout(150);
await shot('L6 drag', 'the finger left the first car: white rubber band from the car to the finger, gold ring on the source');
await inPage(({ B }) => { const dd = window._nav.getDragDrop(); dd.onPointerMove(B.x, B.y); }, dragInfo);
await p.waitForTimeout(120);
await shot('L6 armed', 'over the partner: the band turns green and the partner gets a pulsing green ring');
await inPage(({ B }) => { const dd = window._nav.getDragDrop(); dd.onPointerUp(B.x, B.y); }, dragInfo);
await p.waitForTimeout(140);
await shot('L6 made', 'release: sparks ring at the middle, the gold beam with rungs joins the two cars; its LINK hint is gone');
await p.waitForTimeout(700);
const bridges = await inPage(() => window._nav.bridges());
console.log('bridges', JSON.stringify(bridges));
await shot('L6 bridge', 'the bridge at rest, riding with the cars');

// Fire a matching bomb at the bridged lane and catch the blast.
const fired = await inPage(async () => {
  const nav = window._nav, gs = nav.getGs(), dd = nav.getDragDrop();
  const br = gs.bridges[0]; if (!br) return 'no bridge';
  // the bridged car must be its lane's front car for the shot to land on it
  const lane = br.a.lane, car = br.a.car;
  if (gs.lanes[lane].cars[0] !== car) return 'bridged car not in front';
  const col = gs.columns.findIndex((c, i) => i < gs.activeColCount && c.top()?.color === car.color);
  if (col < 0) { gs.columns[0].top().color = car.color; }
  const c = col < 0 ? 0 : col;
  const pos = nav.getPositions();
  dd.onPointerDown(pos.colX[c], pos.slotY[0]); dd.onPointerMove(pos.laneX[lane], 300); dd.onPointerUp(pos.laneX[lane], 300);
  return 'fired col ' + c + ' at lane ' + lane;
});
console.log(fired);
await p.waitForTimeout(330);
await shot('L6 blast', 'the shot landed: white flash along the bridge, arc of sparks, both cars explode, BRIDGE x2! tag');
await p.waitForTimeout(1200);
await shot('L6 after', 'both cars gone, bridge consumed, traffic advanced one step');

// Snap: L9 has speeders; force one bridged pair with a speeder and advance.
await inPage(() => window._nav.startLevel(9));
await p.waitForTimeout(2500);
await clear();
const snapSetup = await inPage(() => {
  const nav = window._nav, gs = nav.getGs();
  const a = gs.lanes[1].cars.find(c => c.row >= 1 && c.row < 3), b = gs.lanes[2].cars.find(c => Math.abs(c.row - (a?.row ?? -9)) < 1e-6);
  if (!a || !b) return 'no pair';
  b.color = a.color; a.armor = b.armor = 0; a.altColor = b.altColor = null;
  a.trait = 'speeder';
  return nav.makeBridge(1, 2) ? 'bridged speeder pair' : 'bridge refused';
});
console.log(snapSetup);
await p.waitForTimeout(500);
await shot('L9 speeder bridged', 'a bridge between a speeder (flame car) and a normal car');
await inPage(() => { const gl = window._nav.getGameLoop(); gl._advanceGrid(); });
await p.waitForTimeout(200);
await shot('L9 snap', 'after the advance the speeder is a row ahead: the beam cracks in the middle and the halves fall');

writeFileSync(join(out, '00-labels.txt'), labels.join('\n') + '\n');
console.log('errors:', errs);
await b.close();
