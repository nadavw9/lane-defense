// normalize-car-variants.mjs
// Re-frames every car sprite color variant into ONE uniform frame per type so
// Car3D's per-type BODY_FRAC table is valid for ALL colors.
//
// Why: the original color variants were sliced inconsistently from montages —
// truck-green rode 14% left of center, bigrig-green 19% left, truck-orange and
// truck-yellow were cropped to 280×187 WITH ghost fragments of neighbouring
// montage cars in their corners, and 4 of 6 van variants were 140px-wide crops
// that stretched 2× onto the shared plane geometry. Car3D centers/scales by a
// single per-type measurement (taken from red), so every variant that didn't
// match red's framing rendered off-center and/or off-size in its lane.
//
// What it does, per type:
//   1. TRUCK ONLY: re-slice all 5 montage colors from the raw source
//      (sprite-sources/raw/split/pickup.webp: top row red/blue/green, bottom
//      row yellow/orange) + purple from pickup_purple.webp — the processed
//      truck PNGs are unrecoverably cropped, the raw art is complete.
//      White background removed by edge flood fill (same rule as
//      process-car-sprites.mjs); each car = one connected alpha component.
//   2. ALL types/colors (red included): take the largest connected alpha
//      component (drops montage ghost fragments), crop to its bbox, scale so
//      the body height equals the type target (red's original body height),
//      and composite centered on a transparent canvas of the type's standard
//      size. Result: body centered (cx=0) and identically sized across colors.
//
// Run after ANY car art change, BEFORE measure-car-bbox:
//   node scripts/normalize-car-variants.mjs
//   node scripts/measure-car-bbox.mjs   → paste table into Car3D.js
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR   = path.join(__dirname, '..', 'public', 'sprites', 'designed');
// --out=DIR writes the normalized set elsewhere (review staging); default is in-place.
const outArg    = process.argv.find((a) => a.startsWith('--out='));
const OUT_DIR   = outArg ? path.resolve(outArg.slice(6)) : SRC_DIR;
const RAW_DIR   = path.join(__dirname, '..', 'sprite-sources', 'raw', 'split');
import { mkdirSync } from 'fs';
mkdirSync(OUT_DIR, { recursive: true });

const COLORS = ['red', 'blue', 'green', 'yellow', 'orange', 'purple'];
const FILE_FOR = {
  small:  (c) => `bike-${c}.png`,
  big:    (c) => `car-${c}-processed.png`,
  jeep:   (c) => `van-${c}.png`,
  truck:  (c) => `truck-${c}.png`,
  bigrig: (c) => `bigrig-${c}.png`,
  tank:   (c) => `tank-${c}.png`,
};
// Uniform frame per type: canvas size + body height in px, all taken from the
// red variant's ORIGINAL framing (the one Car3D's FIT values were tuned on).
const FRAME = {
  small:  { W: 187, H: 280, bodyH: 250 },   // 0.893 × 280
  big:    { W: 280, H: 280, bodyH: 217 },   // 0.775 × 280
  jeep:   { W: 280, H: 280, bodyH: 252 },   // 0.900 × 280
  truck:  { W: 280, H: 280, bodyH: 269 },   // 0.961 × 280
  bigrig: { W: 125, H: 280, bodyH: 261 },   // 0.932 × 280
  tank:   { W: 279, H: 280, bodyH: 278 },   // 0.993 × 280
};
const ALPHA_THRESHOLD = 16;

// ── flood-fill near-white background → transparent (process-car-sprites rule) ─
function floodFillBackground(data, width, height) {
  const visited = new Uint8Array(width * height);
  function isBackground(idx) {
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    return r > 210 && g > 210 && b > 210 && saturation < 0.25;
  }
  const stack = [];
  function seed(px, py) {
    const i = py * width + px;
    if (!visited[i] && isBackground(i * 4)) { visited[i] = 1; stack.push(i); }
  }
  for (let x = 0; x < width; x++) { seed(x, 0); seed(x, height - 1); }
  for (let y = 0; y < height; y++) { seed(0, y); seed(width - 1, y); }
  while (stack.length > 0) {
    const i = stack.pop();
    const x = i % width, y = (i - x) / width;
    data[i * 4 + 3] = 0;
    if (x > 0) seed(x - 1, y);
    if (x < width - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < height - 1) seed(x, y + 1);
  }
}

// ── connected components on alpha > threshold, 4-neighbour ──────────────────
function components(data, width, height) {
  const label = new Int32Array(width * height).fill(-1);
  const comps = [];
  for (let start = 0; start < width * height; start++) {
    if (label[start] !== -1 || data[start * 4 + 3] <= ALPHA_THRESHOLD) continue;
    const id = comps.length;
    const comp = { id, area: 0, minX: width, maxX: -1, minY: height, maxY: -1 };
    const stack = [start];
    label[start] = id;
    while (stack.length > 0) {
      const i = stack.pop();
      const x = i % width, y = (i - x) / width;
      comp.area++;
      if (x < comp.minX) comp.minX = x;
      if (x > comp.maxX) comp.maxX = x;
      if (y < comp.minY) comp.minY = y;
      if (y > comp.maxY) comp.maxY = y;
      for (const ni of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, y > 0 ? i - width : -1, y < height - 1 ? i + width : -1]) {
        if (ni >= 0 && label[ni] === -1 && data[ni * 4 + 3] > ALPHA_THRESHOLD) {
          label[ni] = id;
          stack.push(ni);
        }
      }
    }
    comps.push(comp);
  }
  return { label, comps };
}

// Zero the alpha of every pixel outside the given component (ghost removal).
function isolateComponent(data, label, keepId) {
  for (let i = 0; i < label.length; i++) {
    if (label[i] !== keepId && data[i * 4 + 3] > ALPHA_THRESHOLD) data[i * 4 + 3] = 0;
  }
}

async function loadRaw(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data.buffer), width: info.width, height: info.height };
}

// Crop img to bbox, scale so body height = frame.bodyH, center on frame canvas.
async function normalizeToFrame(img, bbox, frame, outName) {
  const bodyW = bbox.maxX - bbox.minX + 1;
  const bodyH = bbox.maxY - bbox.minY + 1;
  const scale = frame.bodyH / bodyH;
  const newW = Math.min(frame.W, Math.round(bodyW * scale));
  const newH = Math.round(bodyH * scale);
  const cropped = sharp(Buffer.from(img.data), { raw: { width: img.width, height: img.height, channels: 4 } })
    .extract({ left: bbox.minX, top: bbox.minY, width: bodyW, height: bodyH })
    .resize(newW, newH, { fit: 'fill', kernel: 'lanczos3' });
  const buf = await cropped.png().toBuffer();
  await sharp({ create: { width: frame.W, height: frame.H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: buf, left: Math.round((frame.W - newW) / 2), top: Math.round((frame.H - newH) / 2) }])
    .png()
    .toFile(path.join(OUT_DIR, outName));
  console.log(`✓ ${outName.padEnd(26)} body ${bodyW}x${bodyH} → x${scale.toFixed(3)} → ${frame.W}x${frame.H} centered`);
}

// ── 1. trucks: re-slice from raw montage ────────────────────────────────────
async function resliceTrucks() {
  const montage = await loadRaw(path.join(RAW_DIR, 'pickup.webp'));
  floodFillBackground(montage.data, montage.width, montage.height);
  const { label, comps } = components(montage.data, montage.width, montage.height);
  const cars = comps.sort((a, b) => b.area - a.area).slice(0, 5);
  const midY = montage.height / 2;
  const top    = cars.filter((c) => (c.minY + c.maxY) / 2 <  midY).sort((a, b) => a.minX - b.minX);
  const bottom = cars.filter((c) => (c.minY + c.maxY) / 2 >= midY).sort((a, b) => a.minX - b.minX);
  if (top.length !== 3 || bottom.length !== 2) throw new Error(`pickup.webp montage: expected 3 top + 2 bottom cars, got ${top.length}+${bottom.length}`);
  const byColor = { red: top[0], blue: top[1], green: top[2], yellow: bottom[0], orange: bottom[1] };
  for (const [color, comp] of Object.entries(byColor)) {
    const iso = { data: montage.data.slice(), width: montage.width, height: montage.height };
    isolateComponent(iso.data, label, comp.id);
    await normalizeToFrame(iso, comp, FRAME.truck, FILE_FOR.truck(color));
  }
  // purple ships as its own raw file
  const purple = await loadRaw(path.join(RAW_DIR, 'pickup_purple.webp'));
  floodFillBackground(purple.data, purple.width, purple.height);
  const p = components(purple.data, purple.width, purple.height);
  const main = p.comps.sort((a, b) => b.area - a.area)[0];
  isolateComponent(purple.data, p.label, main.id);
  await normalizeToFrame(purple, main, FRAME.truck, FILE_FOR.truck('purple'));
}

// ── 2. everything else: normalize processed PNGs in place ───────────────────
async function normalizeProcessed(type) {
  for (const color of COLORS) {
    const file = FILE_FOR[type](color);
    const img = await loadRaw(path.join(SRC_DIR, file));
    const { label, comps } = components(img.data, img.width, img.height);
    if (comps.length === 0) throw new Error(`${file}: no visible pixels`);
    const main = comps.sort((a, b) => b.area - a.area)[0];
    isolateComponent(img.data, label, main.id);
    await normalizeToFrame(img, main, FRAME[type], file);
  }
}

await resliceTrucks();
for (const type of ['small', 'big', 'jeep', 'bigrig', 'tank']) await normalizeProcessed(type);
console.log('\nDone. Now run: node scripts/measure-car-bbox.mjs and update Car3D.js BODY_FRAC.');
