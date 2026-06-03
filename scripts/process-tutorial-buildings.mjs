// process-tutorial-buildings.mjs
// Processes the 5 new warm/suburban Tutorial City building raws
// (building-tutorial-1..5) into designed/ for the L1-15 theme swap.
//
// Same defensive pipeline as process-building-sprites.mjs:
//   1. flood-fill edge-connected near-WHITE or near-BLACK bg -> alpha 0
//   2. VERIFY the four full-frame corners are alpha=0 (report failures)
//   3. trim the transparent margin (preserves aspect — no distortion)
//   4. downscale so the longest side <= MAX_DIM
//
// Output: public/sprites/designed/building-tutorial-<n>.png
import sharp from 'sharp';
import path from 'path';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(__dirname, '..', 'public', 'sprites', 'raw', 'split');
const OUT = path.join(__dirname, '..', 'public', 'sprites', 'designed');
mkdirSync(OUT, { recursive: true });

const MAX_DIM = 512;
const NAMES = [1, 2, 3, 4, 5].map(i => `building-tutorial-${i}`);

function floodFillBg(data, width, height, {
  whiteThresh = 205, blackThresh = 34, satThresh = 0.28,
} = {}) {
  const visited = new Uint8Array(width * height);
  const isBg = (idx) => {
    const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
    if (a === 0) return true;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    const nearWhite = r > whiteThresh && g > whiteThresh && b > whiteThresh && sat < satThresh;
    const nearBlack = max < blackThresh;
    return nearWhite || nearBlack;
  };
  const stack = [];
  const seed = (px, py) => { const i = py * width + px; if (!visited[i] && isBg(i * 4)) { visited[i] = 1; stack.push(i); } };
  for (let x = 0; x < width; x++) { seed(x, 0); seed(x, height - 1); }
  for (let y = 0; y < height; y++) { seed(0, y); seed(width - 1, y); }
  while (stack.length) {
    const i = stack.pop();
    data[i * 4 + 3] = 0;
    const x = i % width, y = Math.floor(i / width);
    for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const ni = ny * width + nx;
      if (!visited[ni] && isBg(ni * 4)) { visited[ni] = 1; stack.push(ni); }
    }
  }
}

const report = [];
for (const name of NAMES) {
  const src = path.join(RAW, `${name}.png`);
  const out = path.join(OUT, `${name}.png`);

  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const pixels = new Uint8Array(data.buffer);

  floodFillBg(pixels, W, H);

  const cornerAlpha = [
    pixels[(0) * 4 + 3],
    pixels[((W - 1)) * 4 + 3],
    pixels[((H - 1) * W) * 4 + 3],
    pixels[(((H - 1) * W) + (W - 1)) * 4 + 3],
  ];
  const allClear = cornerAlpha.every(a => a === 0);
  report.push({ name, cornerAlpha, allClear });

  const trimmed = await sharp(Buffer.from(pixels), { raw: { width: W, height: H, channels: 4 } })
    .png().trim({ threshold: 1 }).toBuffer();

  const meta  = await sharp(trimmed).metadata();
  const scale = Math.min(1, MAX_DIM / Math.max(meta.width, meta.height));
  const w     = Math.round(meta.width  * scale);
  const h     = Math.round(meta.height * scale);
  await sharp(trimmed).resize(w, h).png().toFile(out);

  const m = await sharp(out).metadata();
  console.log(`  ${name}.png  ${m.width}x${m.height}  corners=[${cornerAlpha.join(',')}]  ${allClear ? 'OK' : 'WARN residual opaque corner'}`);
}

console.log('\n--- Corner verification summary ---');
const bad = report.filter(r => !r.allClear);
console.log(bad.length === 0
  ? 'All 5 tutorial buildings: four corners transparent (alpha=0). No box defects.'
  : 'Residual opaque corners: ' + bad.map(b => `${b.name}[${b.cornerAlpha.join(',')}]`).join(', '));
console.log('Done -> ' + OUT);
