// Windows display scaling is the untested variable. A 1920x1080 laptop at 150%
// reports a 1280x720 CSS viewport; minus Chrome's chrome that is ~595 innerHeight,
// far below the 844 stage. At 125% it is ~739. Both letterbox left/right, matching
// "black bars visible" — and both are heights I only ever tested at DPR 1.
//
// Pixi is initialised with `resolution: devicePixelRatio` + `autoDensity: true`,
// which makes Pixi itself write canvas.style.width/height. `_fitCanvas` overrides
// that once at boot and then ONLY on window resize — there is no ResizeObserver
// driving the fit (InputManager has one, but it only invalidates an input rect).
// So if anything re-applies autoDensity styling, the fit never recovers.
import { chromium } from 'playwright';

const URLS = {
  dev:  'http://localhost:5173/',
  live: 'https://nadavw9.github.io/lane-defense/',
};
const CASES = [
  [1280, 595, 1.5,  '1080p @ Windows 150% + chrome'],
  [1536, 739, 1.25, '1080p @ Windows 125% + chrome'],
  [1366, 625, 1.25, '768p  @ 125% + chrome'],
  [1280, 595, 1,    'same box, DPR 1 (control)'],
];

const browser = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });

for (const [tag, url] of Object.entries(URLS)) {
  console.log(`\n=== ${tag.toUpperCase()}  ${url}`);
  console.log('window     DPR  │ pixi css box      │ three css box     │ expected   │ verdict');
  console.log('───────────────┼───────────────────┼───────────────────┼────────────┼────────');
  for (const [w, h, dpr, label] of CASES) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
      await page.waitForFunction(() => !!window._nav, null, { timeout: 60000 });
      await page.evaluate(() => window._nav.startLevel(8));
      await page.waitForTimeout(2200);
      for (let i = 0; i < 12; i++) await page.evaluate(() => window._nav.dismissTutorial());
      await page.waitForTimeout(500);

      const m = await page.evaluate(() => {
        const p = document.querySelector('canvas:not(#three-canvas)');
        const t = document.getElementById('three-canvas');
        const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect();
          return { w: b.width, h: b.height, top: b.top, bot: b.bottom }; };
        return { pixi: r(p), three: r(t), vw: innerWidth, vh: innerHeight, dpr: devicePixelRatio,
                 pixiStyle: p ? `${p.style.width} x ${p.style.height}` : 'n/a' };
      });

      const scale = Math.min(m.vw / 390, m.vh / 844);
      const expH = 844 * scale;
      const bad = Math.abs(m.pixi.h - expH) > 1.5 || m.pixi.top < -1 || m.pixi.bot > m.vh + 1;
      console.log(`${String(w).padStart(4)}x${String(h).padEnd(4)} ${String(dpr).padEnd(4)} │ `
        + `${`${m.pixi.w.toFixed(0)}x${m.pixi.h.toFixed(0)} @${m.pixi.top.toFixed(0)}..${m.pixi.bot.toFixed(0)}`.padEnd(17)} │ `
        + `${`${m.three.w.toFixed(0)}x${m.three.h.toFixed(0)} @${m.three.top.toFixed(0)}..${m.three.bot.toFixed(0)}`.padEnd(17)} │ `
        + `${`${(390*scale).toFixed(0)}x${expH.toFixed(0)}`.padEnd(10)} │ ${bad ? '*** CLIPPED ***' : 'ok'}`);
      console.log(`                 ${label}   pixi style="${m.pixiStyle}" dpr=${m.dpr}`);
      if (bad) await page.screenshot({ path: `docs/review/_dpr-${tag}-${w}x${h}@${dpr}.png` });
    } catch (e) {
      console.log(`${w}x${h} dpr${dpr}  ERROR: ${String(e.message).split('\n')[0]}`);
    }
    await page.close();
  }
}
await browser.close();
