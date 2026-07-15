// process-powerball-sprites.mjs
// Processes the new powerball bomb sprites (6 regular + 6 merged) from
// sprite-sources/raw/split into public/sprites/designed/.
//
// Pipeline (matches the original powerball processing in process-sprites-sharp.mjs):
//   1. flood-fill the near-white background → transparent
//   2. resize to 256×256 (square source → uniform scale; transparent pad if needed)
//
// NOTE: 3 of the source files arrived with typo'd names (pwerball-red,
// owerball-green, owerball-yellow); the candidate lists below tolerate that.

import sharp from 'sharp';
import path from 'path';
import { existsSync, statSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'sprite-sources', 'raw', 'split');
const OUT = path.join(__dirname, '..', 'public', 'sprites', 'designed');
const SIZE = 256;

const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];

// output name → candidate source filenames. The split folder contains BOTH old
// (May) correctly-named leftovers AND the new (Jun) batch — 3 of which arrived
// typo'd (pwerball-red, owerball-green, owerball-yellow). Pick the NEWEST existing
// candidate by mtime so we always take the fresh upload regardless of naming.
// normalize: scale + center the ball BODY (solid core, alpha>200) to match the
// sibling sprites' framing on the 256 canvas — the powerball equivalent of the
// car-variant normalization (eff01b8). Sibling cores measure 184-187px centered
// ~(128.5, 120); a fresh source whose ball is drawn smaller/offset in its frame
// would otherwise ship visibly off-size next to the other 5 in the queue.
const BODY_NORM = { size: 186, cx: 128.5, cy: 120 };

const JOBS = [];
for (const c of COLORS) {
  // bomb_red_new: 2026-07-16 regenerated red (white-line artifact under the ball);
  // normalized — its ball body arrived ~4% smaller than the other 5 (178 vs 184-187).
  JOBS.push({ out: `powerball-${c}.png`, srcs: [`powerball-${c}.png`, `pwerball-${c}.png`, `owerball-${c}.png`, `bomb_${c}_new.png`],
              normalize: c === 'red' });
}
for (const c of COLORS) {
  JOBS.push({ out: `powerball-merged-${c}.png`, srcs: [`powerball-merged-${c}.png`] });
}

function pickNewest(srcs) {
  const existing = srcs.map(s => path.join(SRC, s)).filter(existsSync);
  if (!existing.length) return null;
  return existing.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}

// Flood-fill near-white / low-saturation background from the edges → alpha 0.
function floodFillBackground(data, width, height, threshold = 210, satThreshold = 0.25) {
  const visited = new Uint8Array(width * height);
  const isBg = (i) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    return r > threshold && g > threshold && b > threshold && sat < satThreshold;
  };
  const stack = [];
  const seed = (px, py) => {
    const i = py * width + px;
    if (!visited[i] && isBg(i * 4)) { visited[i] = 1; stack.push(i); }
  };
  for (let x = 0; x < width; x++) { seed(x, 0); seed(x, height - 1); }
  for (let y = 0; y < height; y++) { seed(0, y); seed(width - 1, y); }
  while (stack.length) {
    const i = stack.pop();
    data[i * 4 + 3] = 0;
    const x = i % width, y = (i / width) | 0;
    for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const ni = ny * width + nx;
      if (!visited[ni] && isBg(ni * 4)) { visited[ni] = 1; stack.push(ni); }
    }
  }
}

// --only=<output name> reprocesses a single sprite (exact match) — a fresh source
// for one color must not silently re-emit the other 11 outputs.
const only = process.argv.find(a => a.startsWith('--only='))?.slice(7) ?? null;

// Solid-core (alpha>200) bounding box — the ball body, excluding glow fringe.
function coreBBox(px, width, height) {
  let minX = width, maxX = -1, minY = height, maxY = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (px[(y * width + x) * 4 + 3] > 200) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  return { minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1,
           cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

async function run() {
  for (const { out, srcs, normalize } of JOBS) {
    if (only && out !== only) continue;
    const file = pickNewest(srcs);
    if (!file) { console.log(`  ✗ ${out} — no source found (${srcs.join(', ')})`); continue; }

    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = new Uint8Array(data.buffer);
    floodFillBackground(px, info.width, info.height);

    const flooded = sharp(Buffer.from(px), { raw: { width: info.width, height: info.height, channels: 4 } });

    if (normalize) {
      // Scale so the source's solid core lands at BODY_NORM.size on the canvas,
      // positioned so the core center hits (BODY_NORM.cx, BODY_NORM.cy).
      const core = coreBBox(px, info.width, info.height);
      const factor = BODY_NORM.size / ((core.w + core.h) / 2);
      const W2 = Math.round(info.width * factor), H2 = Math.round(info.height * factor);
      const resized = await flooded.resize(W2, H2).png().toBuffer();
      let left = Math.round(BODY_NORM.cx - core.cx * factor);
      let top  = Math.round(BODY_NORM.cy - core.cy * factor);
      // Composite offsets must be >= 0: pre-crop anything hanging off the canvas.
      const cropL = Math.max(0, -left), cropT = Math.max(0, -top);
      const cropW = Math.min(W2 - cropL, SIZE - Math.max(0, left));
      const cropH = Math.min(H2 - cropT, SIZE - Math.max(0, top));
      const piece = await sharp(resized).extract({ left: cropL, top: cropT, width: cropW, height: cropH }).png().toBuffer();
      await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: piece, left: Math.max(0, left), top: Math.max(0, top) }])
        .png()
        .toFile(path.join(OUT, out));
    } else {
      await flooded
        .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(path.join(OUT, out));
    }

    const m = await sharp(path.join(OUT, out)).metadata();
    console.log(`  ✓ ${out.padEnd(26)} from ${path.basename(file).padEnd(28)} ${m.width}×${m.height} alpha:${m.hasAlpha}${normalize ? ' (body-normalized)' : ''}`);
  }
}

run().catch(e => { console.error(e); process.exit(1); });
