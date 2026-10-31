// Demo cards review captures (2026-10-31): every scene in src/screens/demoScenes.js, opened on a
// real level through _nav.showDemo, captured at two moments of its loop. Writes numbered PNGs +
// 00-labels.txt into <outDir>.
//   QA_URL=http://localhost:5174/ node scripts/_demo-cards-shots.mjs docs/review/cards
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { DEMO_SCENES } from '../src/screens/demoScenes.js';

const out = process.argv[2] ?? 'docs/review/cards';
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
await p.evaluate(() => window._nav.startLevel(12));
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

let n = 0;
for (const key of Object.keys(DEMO_SCENES)) {
  const ok = await p.evaluate((k) => window._nav.showDemo(k), key);
  if (!ok) { console.log('no demo for', key); continue; }
  const loop = DEMO_SCENES[key].scene.loop;
  await p.waitForTimeout(Math.min(1400, loop * 1000 * 0.35));
  for (const [i, frac] of [[1, 0.35], [2, 0.8]]) {
    if (i === 2) await p.waitForTimeout(Math.max(200, loop * 1000 * (frac - 0.35)));
    const id = String(++n).padStart(2, '0');
    await p.screenshot({ path: join(out, `${id}.png`) });
    labels.push(`${id}=${key} (${i === 1 ? 'early' : 'late'} in the loop): ${DEMO_SCENES[key].title} — ${DEMO_SCENES[key].caption}`);
  }
  // GOT IT sits at the card's bottom: tap it, then make sure the loop resumed.
  await p.evaluate(async () => {
    const nav = window._nav, gl = nav.getGameLoop(), dd = nav.getDragDrop();
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const tap = (sx, sy) => {
      const c = document.querySelector('canvas:not(#three-canvas)'), r = c.getBoundingClientRect();
      const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
        clientX: r.left + (sx / 390) * r.width, clientY: r.top + (sy / 844) * r.height };
      c.dispatchEvent(new PointerEvent('pointerdown', o)); c.dispatchEvent(new PointerEvent('pointerup', o));
    };
    for (let a = 0; a < 12 && (gl.paused || dd.inputBlocked); a++) { tap(195, 844 / 2 - 10 + 478 / 2 - 46); await sleep(200); if (gl.paused || dd.inputBlocked) { nav.dismissGuides?.(); tap(195, 600); } }
  });
  await p.waitForTimeout(250);
  console.log(key);
}
writeFileSync(join(out, '00-labels.txt'), labels.join('\n') + '\n');
console.log('errors:', errs);
await b.close();
