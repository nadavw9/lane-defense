// Measure the LIVE production build. No `_nav` — it is dev-only (GameApp.js:2363),
// so every prior probe silently gated on a condition production can never satisfy.
// Clipping is a layout property, so the title screen shows it as well as L8 does.
import { chromium } from 'playwright';
import sharp from 'sharp';

const CASES = [
  [1280, 595, 1.5,  '1080p @ Windows 150% + chrome'],
  [1536, 739, 1.25, '1080p @ Windows 125% + chrome'],
  [1366, 625, 1.25, '768p @ 125% + chrome'],
  [1920, 955, 1,    '1080p maximized, DPR 1'],
];

const browser = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
console.log('window     DPR  │ pixi css box       │ expected  │ lit content │ verdict');
console.log('───────────────┼────────────────────┼───────────┼─────────────┼────────');

for (const [w, h, dpr, label] of CASES) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  await page.goto('https://nadavw9.github.io/lane-defense/', { waitUntil: 'networkidle', timeout: 90000 });
  // NOT 'canvas' — that matches #three-canvas first, which is display:none on the
  // title screen, so the wait resolves against an element that is never visible.
  await page.waitForSelector('canvas:not(#three-canvas)', { timeout: 60000 });
  await page.waitForTimeout(6000);   // let assets + loading screen finish

  const m = await page.evaluate(() => {
    const p = document.querySelector('canvas:not(#three-canvas)');
    const b = p.getBoundingClientRect();
    return { w: b.width, h: b.height, top: b.top, bot: b.bottom,
             style: `${p.style.width} x ${p.style.height}`,
             vw: innerWidth, vh: innerHeight, dpr: devicePixelRatio };
  });

  const shot = `docs/review/_live-${w}x${h}@${dpr}.png`;
  await page.screenshot({ path: shot });
  const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
  const lit = (y) => { let n = 0; for (let x = 0; x < info.width; x += 3) {
    const i = (y * info.width + x) * info.channels;
    if (data[i] > 30 || data[i+1] > 30 || data[i+2] > 30) n++; } return n; };
  let top = -1, bot = -1;
  for (let y = 0; y < info.height; y++) if (lit(y) > 5) { top = y; break; }
  for (let y = info.height - 1; y >= 0; y--) if (lit(y) > 5) { bot = y; break; }
  const px = info.width / m.vw;                       // screenshot px per CSS px

  const scale = Math.min(m.vw / 390, m.vh / 844);
  const expH = 844 * scale;
  const bad = Math.abs(m.h - expH) > 1.5 || m.top < -1 || m.bot > m.vh + 1
           || top <= 0 || bot >= info.height - 1;
  console.log(`${String(w).padStart(4)}x${String(h).padEnd(4)} ${String(dpr).padEnd(4)} │ `
    + `${`${m.w.toFixed(0)}x${m.h.toFixed(0)} @${m.top.toFixed(0)}..${m.bot.toFixed(0)}`.padEnd(18)} │ `
    + `${`${(390*scale).toFixed(0)}x${expH.toFixed(0)}`.padEnd(9)} │ `
    + `${`${(top/px).toFixed(0)}..${(bot/px).toFixed(0)}`.padEnd(11)} │ ${bad ? '*** CLIPPED ***' : 'ok'}`);
  console.log(`                 ${label}  style="${m.style}"`);
  await page.close();
}
await browser.close();
