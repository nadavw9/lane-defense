// TASK 1 — desktop clipping, re-opened against direct evidence.
//
// The prior sweep used DEVICE PRESETS and found clipped=false everywhere. The
// user's screenshot is a real Chrome window, where tab bar + bookmarks + URL bar
// eat 100-200px of height. Playwright's `viewport` IS innerHeight, so a preset
// like 1920x1080 models a window with NO chrome — a case that never happens on a
// desktop. These heights model real windows.
//
// It also distinguishes the two candidate bugs the user named:
//   (a) content rendering OUTSIDE the fitted/letterboxed box  -> overflow
//   (b) the fitted box itself sized wrong for this window     -> fit math
// plus a third the screenshot wording suggests:
//   (c) content clipped by an IN-STAGE element (the goal band cutting the HUD
//       numbers), which a viewport-level check can never see.
import { chromium } from 'playwright';
import fs from 'fs';

const CASES = [
  // [w, h, label]  — h = innerHeight AFTER browser chrome
  [1920,  955, '1080p maximized, standard chrome (~125px)'],
  [1920,  880, '1080p maximized, chrome + bookmarks bar'],
  [1512,  760, 'MacBook-ish window'],
  [1366,  625, '768p laptop maximized, chrome'],
  [1280,  600, 'small window'],
  [1100,  500, 'short window — extreme'],
];

fs.mkdirSync('docs/review', { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });

console.log('STAGE 390x844. scale = min(vw/390, vh/844); expect letterbox, whole stage visible.\n');
console.log('window        │ scale │ canvas box (wxh @x,y)   │ box vs window │ content rows (top..bot) │ verdict');
console.log('──────────────┼───────┼─────────────────────────┼───────────────┼─────────────────────────┼────────');

for (const [w, h, label] of CASES) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window._nav, null, { timeout: 60000 });
  await page.evaluate(() => window._nav.startLevel(8));
  await page.waitForTimeout(2200);
  for (let i = 0; i < 12; i++) await page.evaluate(() => window._nav.dismissTutorial());
  await page.waitForTimeout(600);

  const m = await page.evaluate(() => {
    const c = document.querySelector('canvas:not(#three-canvas)');
    const b = c.getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height, vw: innerWidth, vh: innerHeight };
  });

  const shot = `docs/review/_clip-${w}x${h}.png`;
  await page.screenshot({ path: shot });

  // Where does LIT content actually start and end, in window pixels?
  const sharp = (await import('sharp')).default;
  const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
  const scanRow = (y) => { let lit = 0;
    for (let x = 0; x < info.width; x += 3) { const i = (y * info.width + x) * info.channels;
      if (data[i] > 30 || data[i + 1] > 30 || data[i + 2] > 30) lit++; }
    return lit; };
  let top = -1, bot = -1;
  for (let y = 0; y < info.height; y++) if (scanRow(y) > 5) { top = y; break; }
  for (let y = info.height - 1; y >= 0; y--) if (scanRow(y) > 5) { bot = y; break; }

  const boxTop = m.y, boxBot = m.y + m.h;
  const outsideTop = top < boxTop - 1;
  const outsideBot = bot > boxBot + 1;
  const cutTop = top <= 0;
  const cutBot = bot >= info.height - 1;
  const scale = Math.min(m.vw / 390, m.vh / 844);

  const verdict = (outsideTop || outsideBot) ? 'CONTENT OUTSIDE BOX'
    : (cutTop || cutBot) ? 'CUT AT WINDOW EDGE'
    : 'ok';
  console.log(`${String(w).padStart(4)}x${String(h).padEnd(4)}    │ ${scale.toFixed(3)} │ `
    + `${`${m.w.toFixed(0)}x${m.h.toFixed(0)} @ ${m.x.toFixed(0)},${m.y.toFixed(0)}`.padEnd(23)} │ `
    + `${`${boxTop.toFixed(0)}..${boxBot.toFixed(0)}`.padEnd(13)} │ ${`${top}..${bot}`.padEnd(23)} │ ${verdict}`);
  console.log(`               ${label}`);
  await page.close();
}
await browser.close();
