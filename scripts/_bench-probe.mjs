// Bench probe (2026-10-31, owner: "only 2 bombs go into the slots"): on a level with the bench,
// drag the top bomb of column 0 onto each of the four bench slots in turn through the real
// DragDrop handlers and report what the bench holds after each drop.
//   QA_URL=http://localhost:5174/ node scripts/_bench-probe.mjs [level=20]
import { chromium } from 'playwright';

const level = Number(process.argv[2] ?? 20);
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const errs = [];
p.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
await p.goto(process.env.QA_URL ?? 'http://localhost:5174/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 90000 });
await p.waitForTimeout(1200);
await p.evaluate((n) => window._nav.startLevel(n), level);
await p.waitForTimeout(2500);

const r = await p.evaluate(async () => {
  const nav = window._nav, gs = nav.getGs(), gl = nav.getGameLoop(), dd = nav.getDragDrop();
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const tapCanvas = (sx, sy) => {
    const c = document.querySelector('canvas:not(#three-canvas)'), r = c.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
      clientX: r.left + (sx / 390) * r.width, clientY: r.top + (sy / 844) * r.height };
    c.dispatchEvent(new PointerEvent('pointerdown', o)); c.dispatchEvent(new PointerEvent('pointerup', o));
  };
  for (let a = 0; a < 25 && (gl.paused || dd.inputBlocked); a++) {
    nav.dismissTutorial(); nav.dismissGuides?.();
    if (dd.inputBlocked || gl.paused) tapCanvas(195, [560, 714, 520][a % 3]);
    await sleep(250);
  }
  const pos = nav.getPositions();
  const br = dd._benchRenderer, bs = dd._benchStorage;
  const centers = Array.from({ length: bs.size }, (_, i) => br.getSlotCenter(i));
  const bench = () => Array.from({ length: bs.size }, (_, i) => bs.getSlot(i)?.color ?? '-').join(',');
  const log = [{ paused: gl.paused, blocked: dd.inputBlocked, size: bs.size, centers, benchVisible: br._visible ?? br.visible ?? null, bench: bench() }];
  const drag = (x0, y0, x1, y1) => { dd.onPointerDown(x0, y0); dd.onPointerMove((x0 + x1) / 2, (y0 + y1) / 2); dd.onPointerMove(x1, y1); dd.onPointerUp(x1, y1); };
  for (let i = 0; i < bs.size; i++) {
    const c = centers[i];
    const top = gs.columns[0].top()?.color;
    drag(pos.colX[0], pos.slotY[0], c.x, c.y);
    await sleep(500);
    log.push({ slot: i, dragged: top, state: dd._state, bench: bench(), hit: dd._hitTestBench?.(c.x, c.y) ?? 'n/a' });
  }
  return log;
});
console.log(JSON.stringify(r, null, 1));
console.log('errors:', errs);
await b.close();
