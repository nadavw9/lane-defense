// Side strips (PrimeTestLab report 10510, M-02): the title, the map and level 5 on
// the tester's phone size (393 x 873 CSS px, Redmi Note 12 Pro+), with the safe-area
// insets an Android WebView reports. Bars shown: TOP=35 BOTTOM=24. Bars hidden:
// TOP=35 (the camera cutout band) BOTTOM=0.
//   QA_URL=http://localhost:5186/ TOP=35 BOTTOM=24 node scripts/_side-strips-shots.mjs <outDir> <prefix>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] ?? 'docs/review';
const prefix = process.argv[3] ?? 'shot';
const top = Number(process.env.TOP ?? 0), bottom = Number(process.env.BOTTOM ?? 0);
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 393, height: 873 }, deviceScaleFactor: 2 });
await p.addInitScript(([t, bt]) => {
  const set = () => {
    document.documentElement.style.setProperty('--safe-area-inset-top', `${t}px`);
    document.documentElement.style.setProperty('--safe-area-inset-bottom', `${bt}px`);
  };
  try { set(); } catch {} document.addEventListener('DOMContentLoaded', set);
}, [top, bottom]);
const errs = [];
p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
await p.goto(process.env.QA_URL ?? 'http://localhost:5186/', { waitUntil: 'load' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 90000 });
await p.evaluate(() => window.dispatchEvent(new Event('resize')));
await p.waitForTimeout(1500);

// Draw the cutout band and the gesture band so the reviewer sees what the phone covers.
const bands = async () => p.evaluate(([t, bt]) => {
  for (const id of ['_bandT', '_bandB']) document.getElementById(id)?.remove();
  const mk = (id, css) => { const d = document.createElement('div'); d.id = id;
    d.style.cssText = `position:fixed;left:0;right:0;z-index:9999;pointer-events:none;background:rgba(0,0,0,0.55);${css}`;
    document.body.appendChild(d); };
  if (t) mk('_bandT', `top:0;height:${t}px`);
  if (bt) mk('_bandB', `bottom:0;height:${bt}px`);
}, [top, bottom]);
const shot = async (name) => { await bands(); await p.screenshot({ path: join(out, `${prefix}-${name}.png`) }); };

await p.evaluate(() => window._nav.showTitle());
await p.waitForTimeout(4500);
await shot('title');

await p.evaluate(() => window._nav.showLevelSelect());
await p.waitForTimeout(2500);
await shot('map');

await p.evaluate(() => window._nav.startLevel(5));
await p.waitForTimeout(2500);
await p.evaluate(async () => {
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
});
await p.waitForTimeout(1500);
await shot('level5');

const box = await p.evaluate(() => { const r = document.querySelector('canvas:not(#three-canvas)').getBoundingClientRect();
  return { left: +r.left.toFixed(1), right: +(393 - r.right).toFixed(1), top: +r.top.toFixed(1), bottom: +(873 - r.bottom).toFixed(1) }; });
console.log(prefix, 'stage gaps (CSS px)', JSON.stringify(box), 'errors:', errs);
await b.close();
