// Capture the How-to-Play BRIDGES slide (page index 2) via the dev hooks.
import { chromium } from 'playwright';
const out = process.argv[2];
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await p.goto(process.env.QA_URL ?? 'http://localhost:5174/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 90000 });
await p.waitForTimeout(1000);
await p.evaluate(() => window._nav.showHowToPlay());
await p.waitForTimeout(800);
// NEXT button sits at (APP_W/2, panelTop + PH - 56); the panel is centred: top = (844 - 540) / 2.
const tap = async (sx, sy) => p.evaluate(([sx, sy]) => {
  const c = document.querySelector('canvas:not(#three-canvas)'), r = c.getBoundingClientRect();
  const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, clientX: r.left + (sx / 390) * r.width, clientY: r.top + (sy / 844) * r.height };
  c.dispatchEvent(new PointerEvent('pointerdown', o)); c.dispatchEvent(new PointerEvent('pointerup', o));
}, [sx, sy]);
const top = (844 - 540) / 2;
await tap(195, top + 540 - 56); await p.waitForTimeout(500);
await tap(195, top + 540 - 56); await p.waitForTimeout(800);
await p.screenshot({ path: out });
await b.close();
console.log('->', out);
