// TASK 1 — reproduce the BOMB bug via an AMBIGUOUS tap.
//
// User: "i might have pressed exactly between to cars in the same lane (2 rows of
// cars one after the other)". The previous probe fired at a clean target and saw
// nothing wrong, so this sweeps the tap across the gap BETWEEN two cars and
// records, for every position: what lane the hit-test resolved, what row, and
// which cars actually died.
//
// Entry point is DragDrop.onPointerDown — the real hit-test path (InputManager
// calls exactly this). Raw canvas PointerEvents are also tried first, and whether
// they arrive is reported, because a tap that never reaches DragDrop is itself a
// finding.
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window._nav, null, { timeout: 60000 });

for (const [lv, tag] of [[8, '3-lane / gridRows 8'], [13, '4-lane / gridRows 16']]) {
  await page.evaluate((l) => window._nav.startLevel(l), lv);
  await page.waitForTimeout(2500);

  const res = await page.evaluate(async () => {
    const nav = window._nav, gs = nav.getGs(), gl = nav.getGameLoop(), dd = nav.getDragDrop();
    for (let i = 0; i < 60 && (gl.paused || dd.inputBlocked); i++) { nav.dismissTutorial(); await new Promise((r) => setTimeout(r, 100)); }

    const M  = await import('/src/models/Car.js');
    const LR = await import('/src/renderer/LaneRenderer.js');
    const PR = await import('/src/renderer/PositionRegistry.js');

    // Instrument what the handler RECEIVES, not just what dies.
    const calls = [];
    const origPlace = gl.placeBombOnLane.bind(gl);
    gl.placeBombOnLane = (laneIdx, tapRow) => { calls.push({ laneIdx, tapRow }); return origPlace(laneIdx, tapRow); };
    let pointerReached = 0;
    const origDown = dd.onPointerDown.bind(dd);
    dd.onPointerDown = (x, y) => { pointerReached++; return origDown(x, y); };

    const TARGET_LANE = 1;
    const rows = gs.gridRows;
    const out = [];

    // Two cars in the SAME lane at adjacent rows; other lanes populated so any
    // cross-lane effect is visible.
    const setup = () => {
      for (let l = 0; l < gs.activeLaneCount; l++) {
        gs.lanes[l].cars.length = 0;
        for (const r of [3, 4]) {
          const car = new M.Car({ color: gs.colors[(l + r) % gs.colors.length], hp: 3, speed: 5 });
          car.hp = 3; car.row = r; car.position = (r / rows) * 100;
          car.__tag = `L${l}R${r}`;
          gs.lanes[l].cars.push(car);
        }
      }
    };

    // Screen Y of a given row centre, via the shipped projection.
    const yOfRow = (r) => LR.posToScreenY((r / rows) * 100);
    const y3 = yOfRow(3), y4 = yOfRow(4);
    const laneX = PR.getLaneScreenX(TARGET_LANE);

    // Sweep across the gap between the two cars, plus a boundary case.
    const positions = [
      ['on car row3',        laneX, y3],
      ['25% into gap',       laneX, y3 + (y4 - y3) * 0.25],
      ['EXACTLY between',    laneX, (y3 + y4) / 2],
      ['75% into gap',       laneX, y3 + (y4 - y3) * 0.75],
      ['on car row4',        laneX, y4],
      ['lane boundary X',    (PR.getLaneScreenX(0) + PR.getLaneScreenX(1)) / 2, (y3 + y4) / 2],
      ['below breach line',  laneX, LR.ROAD_BOTTOM_Y + 4],
    ];

    for (const [label, x, y] of positions) {
      setup();
      const bs = gl._boosterState;
      bs.bombs = Math.max(1, bs.bombs);
      if (typeof bs.activateBomb === 'function') bs.activateBomb(); else bs.bombMode = true;
      const armed = !!bs.bombMode;
      calls.length = 0;
      const before = pointerReached;

      dd.onPointerDown(x, y);            // the real hit-test entry point
      await new Promise((r) => setTimeout(r, 250));

      const alive = new Set();
      for (let l = 0; l < gs.activeLaneCount; l++) for (const c of gs.lanes[l].cars) if (c.__tag) alive.add(c.__tag);
      const dead = [];
      for (let l = 0; l < gs.activeLaneCount; l++) for (const r of [3, 4]) if (!alive.has(`L${l}R${r}`)) dead.push(`L${l}R${r}`);

      out.push({ label, x: +x.toFixed(1), y: +y.toFixed(1), armed,
                 handlerCalls: calls.slice(), reached: pointerReached - before,
                 dead, strays: dead.filter((t) => !t.startsWith(`L${TARGET_LANE}`)) });
    }
    return { lanes: gs.activeLaneCount, rows, roadTop: LR.ROAD_TOP_Y, roadBottom: LR.ROAD_BOTTOM_Y, out };
  });

  console.log(`\n${'='.repeat(96)}`);
  console.log(`L${lv} — ${tag}   lanes=${res.lanes} rows=${res.rows}  road ${res.roadTop.toFixed(0)}..${res.roadBottom.toFixed(0)}   target lane 1`);
  console.log('='.repeat(96));
  console.log('tap position       │     y │ armed │ handler got      │ killed              │ strays');
  console.log('───────────────────┼───────┼───────┼──────────────────┼─────────────────────┼────────');
  for (const r of res.out) {
    const got = r.handlerCalls.length
      ? r.handlerCalls.map((c) => `lane=${c.laneIdx} row=${c.tapRow}`).join(' ')
      : '(never called)';
    console.log(`${r.label.padEnd(18)} │ ${String(r.y).padStart(5)} │ ${String(r.armed).padEnd(5)} │ ${got.padEnd(16)} │ `
      + `${(r.dead.join(',') || '-').padEnd(19)} │ ${r.strays.length ? r.strays.join(',') + ' <<<' : '-'}`);
  }
}
await browser.close();
