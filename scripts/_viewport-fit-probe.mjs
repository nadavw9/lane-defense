// TASKS 2+3 — how does the 390x844 stage actually fit real viewports?
//
// Reports, per viewport: both canvas CSS rects, whether any part of the stage
// falls outside the visible window (clipped), and the body/html overflow state.
// Nothing is imported from the app — pure DOM geometry, so no module-instance risk.
import { chromium } from 'playwright';

const VIEWPORTS = [
  // [w, h, dpr, label]
  [390,  844, 3, 'iPhone 12/13/14 (design size)'],
  [393,  852, 3, 'iPhone 14 Pro'],
  [412,  915, 2.6, 'Pixel 7 (taller)'],
  [360,  640, 3, 'older Android (SHORTER than design)'],
  [414,  896, 2, 'iPhone XR'],
  [1920, 1080, 1, 'desktop 16:9'],
  [1440,  900, 1, 'laptop 16:10'],
  [2560, 1440, 1, 'desktop 1440p'],
  [1280,  720, 1, 'small desktop'],
];

const browser = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });

console.log('STAGE = 390 x 844.  A correct fit letterboxes: whole stage visible, centred.\n');
console.log('viewport        dpr │ label                        │ canvas CSS box (w x h @ x,y) │ visible? │ notes');
console.log('────────────────────┼──────────────────────────────┼──────────────────────────────┼──────────┼──────');

for (const [w, h, dpr, label] of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  await page.goto('https://nadavw9.github.io/lane-defense/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window._nav, null, { timeout: 60000 });
  await page.evaluate(() => window._nav.startLevel(8));
  await page.waitForTimeout(1800);

  const m = await page.evaluate(() => {
    const pixi  = document.querySelector('canvas:not(#three-canvas)');
    const three = document.querySelector('#three-canvas');
    const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect();
      return { x:+b.x.toFixed(1), y:+b.y.toFixed(1), w:+b.width.toFixed(1), h:+b.height.toFixed(1) }; };
    const bs = getComputedStyle(document.body), hs = getComputedStyle(document.documentElement);
    return {
      pixi: r(pixi), three: r(three),
      vw: window.innerWidth, vh: window.innerHeight,
      bodyOverflow: bs.overflow, bodyMargin: bs.margin, htmlOverflow: hs.overflow,
      bodyH: bs.height, scrollH: document.documentElement.scrollHeight,
    };
  });

  const p = m.pixi;
  const clippedTop    = p && p.y < -0.5;
  const clippedBottom = p && (p.y + p.h) > m.vh + 0.5;
  const clippedLeft   = p && p.x < -0.5;
  const clippedRight  = p && (p.x + p.w) > m.vw + 0.5;
  const anyClip = clippedTop || clippedBottom || clippedLeft || clippedRight;
  const mismatch = m.pixi && m.three &&
    (Math.abs(m.pixi.w - m.three.w) > 1 || Math.abs(m.pixi.h - m.three.h) > 1 ||
     Math.abs(m.pixi.x - m.three.x) > 1 || Math.abs(m.pixi.y - m.three.y) > 1);
  const notes = [];
  if (clippedTop) notes.push(`TOP cut ${(-p.y).toFixed(0)}px`);
  if (clippedBottom) notes.push(`BOTTOM cut ${((p.y + p.h) - m.vh).toFixed(0)}px`);
  if (clippedLeft || clippedRight) notes.push('side cut');
  if (mismatch) notes.push('PIXI/THREE CANVAS MISMATCH');
  if (m.scrollH > m.vh + 1) notes.push(`page scrolls (${m.scrollH} > ${m.vh})`);

  console.log(`${String(w).padStart(4)}x${String(h).padEnd(4)} dpr${String(dpr).padEnd(4)} │ ${label.padEnd(28)} │ `
    + `${p ? `${p.w}x${p.h} @ ${p.x},${p.y}`.padEnd(28) : 'no canvas'.padEnd(28)} │ `
    + `${(anyClip ? 'CLIPPED' : 'ok').padEnd(8)} │ ${notes.join('; ') || '-'}`);
  await page.close();
}
await browser.close();
