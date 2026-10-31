import { chromium } from 'playwright';
const out = process.argv[2];
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await p.goto(process.env.QA_URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 90000 });
await p.waitForTimeout(1200);
const clear = () => p.evaluate(async () => {
  const nav = window._nav, gl = nav.getGameLoop(), dd = nav.getDragDrop();
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const tap = (sx, sy) => { const c = document.querySelector('canvas:not(#three-canvas)'), r = c.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, clientX: r.left + (sx / 390) * r.width, clientY: r.top + (sy / 844) * r.height };
    c.dispatchEvent(new PointerEvent('pointerdown', o)); c.dispatchEvent(new PointerEvent('pointerup', o)); };
  for (let a = 0; a < 30 && (gl.paused || dd.inputBlocked); a++) { nav.dismissTutorial(); nav.dismissGuides?.(); if (dd.inputBlocked || gl.paused) tap(195, [560, 714, 520, 700][a % 4]); await sleep(250); }
});
for (const [i, lv] of [[1, 13], [2, 21]]) {
  await p.evaluate((n) => window._nav.startLevel(n), lv);
  await p.waitForTimeout(2500); await clear(); await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/0${i}.png` });
  console.log('shot L' + lv);
}
await b.close();
