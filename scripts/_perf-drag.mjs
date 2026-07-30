// Drag responsiveness probe. Separates the three candidate causes:
//   (1) raw frame rate     -> frame-time distribution while idle vs while dragging
//   (2) drag-follow lag    -> ghost position vs pointer position, same frame
//   (3) input handling     -> forced synchronous layout (getBoundingClientRect)
//                             count + cost inside the pointer handler
import { chromium } from 'playwright';

const LEVEL = process.argv[2] || '5';
const CPU_THROTTLE = Number(process.argv[3] || 4);   // mobile-ish

// MUST be headed with a real GPU. Headless Chromium falls back to SwiftShader
// (software rasterisation), which pins this game at ~6fps regardless of what the
// code does — measuring it tells you about the rasteriser, not the game.
const browser = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const cdp = await page.context().newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window._nav, null, { timeout: 30000 });
await page.evaluate((n) => window._nav.startLevel(Number(n)), LEVEL);
await page.waitForTimeout(1800);
for (let i = 0; i < 6; i++) { await page.mouse.click(195, 430); await page.waitForTimeout(260); }
await page.waitForTimeout(1500);

// Instrument: count + time every getBoundingClientRect (forced layout), and
// record frame times.
await page.evaluate(() => {
  window.__perf = { grcCalls: 0, grcTime: 0, frames: [], moveCalls: 0, moveTime: 0 };
  const proto = Element.prototype;
  const orig = proto.getBoundingClientRect;
  proto.getBoundingClientRect = function (...a) {
    const t0 = performance.now();
    const r = orig.apply(this, a);
    window.__perf.grcTime += performance.now() - t0;
    window.__perf.grcCalls++;
    return r;
  };
  const c = document.querySelector('canvas:not(#three-canvas)');
  c.addEventListener('pointermove', () => { window.__perf.moveCalls++; }, true);
  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    window.__perf.frames.push(now - last);
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

const sample = async (label, fn) => {
  await page.evaluate(() => { window.__perf.frames.length = 0; window.__perf.grcCalls = 0; window.__perf.grcTime = 0; window.__perf.moveCalls = 0; });
  await fn();
  const r = await page.evaluate(() => {
    window.__perf.__ordered = window.__perf.frames.slice();
    const f = window.__perf.frames.slice().sort((a, b) => a - b);
    const pick = (p) => f[Math.floor(f.length * p)] ?? 0;
    return {
      frames: f.length, med: pick(0.5), p95: pick(0.95), worst: f[f.length - 1] ?? 0,
      fps: f.length ? (1000 / (f.reduce((a, b) => a + b, 0) / f.length)) : 0,
      grcCalls: window.__perf.grcCalls, grcTime: window.__perf.grcTime, moveCalls: window.__perf.moveCalls,
    };
  });
  console.log(
    `${label.padEnd(22)} fps=${r.fps.toFixed(1).padStart(5)}  medFrame=${r.med.toFixed(1)}ms  p95=${r.p95.toFixed(1)}ms  worst=${r.worst.toFixed(1)}ms` +
    `  | pointermove=${r.moveCalls}  getBoundingClientRect=${r.grcCalls} calls / ${r.grcTime.toFixed(1)}ms`,
  );
  // Where do the janky frames sit? A single early spike is a one-time cost
  // (shader compile / texture upload); spikes spread through the drag are
  // sustained per-move work.
  const jank = await page.evaluate(() => window.__perf.__ordered
    .map((ms, i) => ({ i, ms }))
    .filter((f) => f.ms > 33)
    .map((f) => `#${f.i}:${f.ms.toFixed(0)}ms`));
  if (jank.length) console.log(`${' '.repeat(22)} jank frames (>33ms), in order: ${jank.join('  ')}`);
  return r;
};

console.log(`\n=== L${LEVEL} @ ${CPU_THROTTLE}x CPU throttle ===`);
await sample('IDLE (no input)', async () => { await page.waitForTimeout(3000); });

// Synthetic drag: press on the front bomb slot, move in many small steps.
const pos = await page.evaluate(() => window._nav.getPositions());
await sample('DRAGGING', async () => {
  await page.mouse.move(pos.colX[0], pos.slotY[0]);
  await page.mouse.down();
  for (let i = 0; i < 60; i++) {
    await page.mouse.move(pos.colX[0] + i * 2, pos.slotY[0] - i * 4, { steps: 1 });
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
});

await browser.close();
