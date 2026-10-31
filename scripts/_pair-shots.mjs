// BRIDGED PAIR review captures (2026-10-31): the bridged pair drawn as ONE baked vehicle
// (Car3D.setPairs, pair-*.png). L6: hints, drag, the slide to contact, at rest, an
// advance mid-glide, the blast; L9: a speeder pair snapping apart. Also 2x crops of the pair so the
// seam can be judged. Drives the REAL DragDrop handlers through _nav. Writes numbered PNGs +
// 00-labels.txt into <outDir>.
//   QA_URL=http://localhost:5174/ node scripts/_pair-shots.mjs docs/review
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] ?? 'docs/review';
mkdirSync(out, { recursive: true });
for (const f of readdirSync(out)) if (/\.(png|txt)$/.test(f)) unlinkSync(join(out, f));
const labels = [];
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await p.addInitScript(() => {
  try {
    const keys = ['tour', 'lane_2', 'lane_3', 'second_colour', 'bridge', 'bridge_guide', 'speeder', 'combo', 'supercharge', 'goal_colour',
      'freeze_booster', 'colour_change_booster', 'freeze_earned', 'colour_change_earned', 'rainbow_bomb', 'first_kill', 'first_miss', 'barrier_down', 'wave_incoming', 'hp_miss',
      'streak_charged', 'plate_break', 'armor_break', 'volatile_surge', 'mender_heal', 'gift_car', 'traffic_light', 'convoy'];
    for (let i = 1; i <= 200; i++) keys.push('hint_L' + i);
    localStorage.setItem('ftue_banners', JSON.stringify(keys));
  } catch {}
});
const errs = [];
p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
await p.goto(process.env.QA_URL ?? 'http://localhost:5174/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 90000 });
await p.waitForTimeout(1200);

const shot = async (name, what) => {
  const n = String(labels.length + 1).padStart(2, '0');
  const path = join(out, `${n}.png`);
  await p.screenshot({ path });
  labels.push(`${n}=${name}: ${what}`);
  console.log(n, name);
  return path;
};
// A 2x crop around a pair (stage px -> device px at DPR 2) so the seam can be judged.
const crop = async (srcPath, name, what, cx, cy) => {
  const n = String(labels.length + 1).padStart(2, '0');
  const W = 240, H = 150;
  const left = Math.max(0, Math.round(cx * 2 - W)), top = Math.max(0, Math.round(cy * 2 - H));
  await sharp(srcPath).extract({ left, top, width: W * 2, height: H * 2 }).resize(W * 4, H * 4, { kernel: 'nearest' }).png().toFile(join(out, `${n}.png`));
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
const seedPair = (la, lb, rowMin = 1, rowMax = 9) => inPage(([la, lb, rowMin, rowMax]) => {
  const gs = window._nav.getGs();
  const a = gs.lanes[la].cars.find(c => c.row >= rowMin && c.row <= rowMax), b = gs.lanes[lb].cars.find(c => Math.abs(c.row - (a?.row ?? -9)) < 1e-6);
  if (!a || !b) return null;
  b.color = a.color; b.altColor = a.altColor = null; b.armor = a.armor = 0;
  return { row: a.row, color: a.color, types: [a.type + '/' + a.hp, b.type + '/' + b.hp] };
}, [la, lb, rowMin, rowMax]);
const pairXY = () => inPage(() => {
  const nav = window._nav, gs = nav.getGs();
  const br = gs.bridges[0]; if (!br) return null;
  const a = nav.getRenderer3D().carScreenPos(br.a.car), b = nav.getRenderer3D().carScreenPos(br.b.car);
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, a, b };
});

await inPage(() => window._nav.startLevel(6));
await p.waitForTimeout(2500);
await clear();
await p.waitForTimeout(400);
console.log('pair', JSON.stringify(await seedPair(0, 1)));
await p.waitForTimeout(600);
await shot('L6 hints', 'two same-colour cars side by side: NOTHING marks them before the link (owner rule); the board is just cars');

const dragInfo = await inPage(async () => {
  const nav = window._nav, dd = nav.getDragDrop();
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
await shot('L6 drag', 'the finger left the first car: rubber band from the car to the finger, gold ring on the source');
await inPage(({ B }) => { window._nav.getDragDrop().onPointerMove(B.x, B.y); }, dragInfo);
await p.waitForTimeout(120);
await shot('L6 armed', 'over the partner: green band, pulsing green ring on the partner');
await inPage(({ B }) => { window._nav.getDragDrop().onPointerUp(B.x, B.y); }, dragInfo);
await p.waitForTimeout(90);
await shot('L6 sliding', 'just after release: gold rings on both, the two cars sliding toward their slots in the pair');
await p.waitForTimeout(190);
await shot('L6 contact', 'the moment the two cars become the pair sprite: sparks at the seam');
await p.waitForTimeout(700);
const rest = await shot('L6 coupled', 'at rest: ONE vehicle, two cars coupled by the yellow clamp (the baked pair sprite)');
let xy = await pairXY();
console.log('pair xy', JSON.stringify(xy));
if (xy) await crop(rest, 'L6 coupled 2x', 'zoom on the pair sprite in place: judge size against the single cars, the clamp, the outline, the shadow', xy.x, xy.y);

// An advance with the pair on the board: they glide together.
await inPage(() => window._nav.getGameLoop()._advanceGrid());
await p.waitForTimeout(110);
await shot('L6 advancing', 'mid-advance (one step): the pair glides as one vehicle');
await p.waitForTimeout(600);

// Fire a matching bomb at the coupled lane.
const fired = await inPage(async () => {
  const nav = window._nav, gs = nav.getGs(), dd = nav.getDragDrop();
  const br = gs.bridges[0]; if (!br) return 'no bridge';
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
await shot('L6 blast', 'the shot landed on one car of the pair: white flash across both, arc of sparks, both take the hit');
await p.waitForTimeout(1300);
await shot('L6 after', 'after the hit: both cars shrank a rung together, still one pair sprite (the smaller combination), traffic advanced');

// Snap: L9 has speeders; couple a speeder with a normal car and advance.
await inPage(() => window._nav.startLevel(9));
await p.waitForTimeout(2500);
await clear();
const snapSetup = await inPage(() => {
  const nav = window._nav, gs = nav.getGs();
  const a = gs.lanes[1].cars.find(c => c.row >= 1 && c.row < 3), b = gs.lanes[2].cars.find(c => Math.abs(c.row - (a?.row ?? -9)) < 1e-6);
  if (!a || !b) return 'no pair';
  b.color = a.color; a.armor = b.armor = 0; a.altColor = b.altColor = null;
  a.trait = 'speeder';
  return nav.makeBridge(1, 2) ? 'coupled speeder pair' : 'bridge refused';
});
console.log(snapSetup);
await p.waitForTimeout(700);
const sp = await shot('L9 speeder coupled', 'a speeder (flame car) paired with a normal car: the pair sprite with flames on the speeder side');
xy = await pairXY();
if (xy) await crop(sp, 'L9 speeder coupled 2x', 'zoom: the speeder pair sprite', xy.x, xy.y);
await inPage(() => { window._nav.getGameLoop()._advanceGrid(); });
await p.waitForTimeout(140);
await shot('L9 snap', 'the speeder pulled a row ahead: a crack at the seam, the pair splits back into two cars sliding to their lane centres');
await p.waitForTimeout(600);
await shot('L9 apart', 'after the snap: two separate cars again, lane-centred, no link');

writeFileSync(join(out, '00-labels.txt'), labels.join('\n') + '\n');
console.log('errors:', errs);
await b.close();
