// Car-size measurement by FRAME DIFFERENCING (the standard method recorded in
// GEOMETRY_MECHANICS_BATCH.md §0c). Screenshot the board with cars, remove the
// cars, screenshot the identical board again, diff. The changed pixels ARE the
// cars — immune to lane-dash leakage, road texture and threshold guessing,
// which is what made flood-fill produce a wrong number twice.
//
// Usage: node scripts/_measure-cars.mjs <levelOrDaily> <label>
import { chromium } from 'playwright';
import sharp from 'sharp';

const TARGET = process.argv[2] || '5';
const LABEL  = process.argv[3] || TARGET;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 500, height: 900 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window._nav, null, { timeout: 30000 });

const info = await page.evaluate(async (t) => {
  if (t === 'daily') {
    const mod = await import('/src/game/DailyChallengeManager.js');
    window._nav.startLevel(new mod.DailyChallengeManager().getChallenge());
  } else {
    window._nav.startLevel(Number(t));
  }
  return true;
}, TARGET);

await page.waitForTimeout(1200);
for (let i = 0; i < 3; i++) { await page.mouse.click(250, 450); await page.waitForTimeout(350); }
await page.waitForTimeout(2200);

const gs = await page.evaluate(() => {
  const g = window._nav.getGs();
  return { gridRows: g.gridRows, lanes: g.lanes.map((l) => l.cars.map((c) => c.type)) };
});

const withCars = await page.screenshot();
// Remove every car, then let the renderer reconcile (it culls meshes whose car
// is gone). Board, camera, chrome and lighting are otherwise untouched.
await page.evaluate(() => { for (const l of window._nav.getGs().lanes) l.cars.length = 0; });
await page.waitForTimeout(1200);
const noCars = await page.screenshot();
await browser.close();

const a = await sharp(withCars).raw().toBuffer({ resolveWithObject: true });
const b = await sharp(noCars).raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = a.info;

// Changed-pixel mask. Threshold is generous: we want the car's full silhouette
// including its darker edge pixels, but not sensor-style noise.
const THRESH = 18;
const mask = new Uint8Array(W * H);
for (let i = 0, p = 0; i < a.data.length; i += C, p++) {
  const d = Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
  if (d > THRESH) mask[p] = 1;
}

// Connected components -> one blob per car. Ignores the HUD/text areas because
// nothing there changed between the two frames.
const seen = new Uint8Array(W * H);
const blobs = [];
const stack = new Int32Array(W * H);
for (let p0 = 0; p0 < mask.length; p0++) {
  if (!mask[p0] || seen[p0]) continue;
  let sp = 0; stack[sp++] = p0; seen[p0] = 1;
  let minX = W, maxX = 0, minY = H, maxY = 0, n = 0;
  while (sp > 0) {
    const p = stack[--sp];
    const x = p % W, y = (p / W) | 0;
    n++;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const np = ny * W + nx;
      if (mask[np] && !seen[np]) { seen[np] = 1; stack[sp++] = np; }
    }
  }
  if (n >= 60) blobs.push({ n, w: maxX - minX + 1, h: maxY - minY + 1, x: minX, y: minY });
}

// Reject non-car blobs: the hint banner and the HUD counters also change
// between the two frames (they react to car count). Cars are narrow, sit on the
// road, and never span the stage. Bounds are in DEVICE px (dpr=2).
const dpr = 2;
const isCar = (c) => c.w <= 60 * dpr && c.h <= 120 * dpr && (c.y + c.h) <= 600 * dpr && c.y >= 60 * dpr;
blobs.sort((p, q) => q.n - p.n);
const cars = blobs.filter(isCar).slice(0, 8);
console.log(`\n=== ${LABEL} — gridRows=${gs.gridRows} types=${JSON.stringify(gs.lanes)} ===`);
for (const c of cars) {
  console.log(`  blob px=${c.n}\tw=${(c.w / dpr).toFixed(1)}\th=${(c.h / dpr).toFixed(1)} (CSS px)\tat(${(c.x / dpr).toFixed(0)},${(c.y / dpr).toFixed(0)})`);
}
if (cars.length) {
  const hs = cars.map((c) => c.h / dpr).sort((p, q) => p - q);
  const med = hs[Math.floor(hs.length / 2)];
  console.log(`  MEDIAN CAR LENGTH (h): ${med.toFixed(1)} CSS px   [n=${cars.length}]`);
}
