// Green button plate captures (PrimeTestLab report 10510, M-01): the title PLAY,
// the FIRST BOOM card's GOT IT and the level card's PLAY, each cropped and enlarged.
//   QA_URL=http://localhost:5176/ node scripts/_button-plate-shots.mjs <outDir> <prefix>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] ?? 'docs/review';
const prefix = process.argv[3] ?? 'shot';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
const errs = [];
p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
await p.goto(process.env.QA_URL ?? 'http://localhost:5176/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 90000 });
await p.waitForTimeout(1500);

const shot = async (name, clip) => p.screenshot({ path: join(out, `${prefix}-${name}.png`), ...(clip ? { clip } : {}) });

await p.evaluate(() => window._nav.showTitle());
await p.waitForTimeout(4500);                       // the intro bomb-drop reveals PLAY
const ty = await p.evaluate(() => window._nav.getTitlePlayY?.());
await shot('title', ty ? { x: 20, y: ty - 60, width: 350, height: 120 } : null);

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
await p.evaluate(() => window._nav.showDemo('first_kill'));
await p.waitForTimeout(1200);
await shot('card');

await p.evaluate(() => window._nav.showPreLevel(5));
await p.waitForTimeout(1500);
const py = await p.evaluate(() => window._nav.getPreLevelPlayY?.());
await shot('prelevel', py ? { x: 40, y: py - 60, width: 310, height: 120 } : null);

console.log('titleY', ty, 'preLevelY', py, 'errors:', errs);
await b.close();
