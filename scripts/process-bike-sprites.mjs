// process-bike-sprites.mjs
// Reads split bike PNGs, removes black background, rotates 180°,
// saves to public/sprites/designed/ as bike-<color>-processed.png
//
// Run AFTER split-bike-sheet.mjs.
// Skips bike-red (already handled separately).

import sharp from 'sharp';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPLIT_DIR = path.join(__dirname, '..', 'public', 'sprites', 'raw', 'split');
const OUT_DIR   = path.join(__dirname, '..', 'public', 'sprites', 'designed');
mkdirSync(OUT_DIR, { recursive: true });

// Skip red — already processed separately
const JOBS = [
  { src: 'bike-blue.png',    out: 'bike-blue-processed.png'   },
  { src: 'bike-green.png',   out: 'bike-green-processed.png'  },
  { src: 'bike-yellow.png',  out: 'bike-yellow-processed.png' },
  { src: 'bike-orange.png',  out: 'bike-orange-processed.png' },
  { src: 'bike-purple.png',  out: 'bike-purple-processed.png' },
];

// Flood-fill from corners to mark connected near-black background pixels.
// Uses a dark-pixel threshold that avoids eating black outlines inside the sprite
// (those aren't reachable from the edges in most sprite art).
function floodFillBlackBackground(data, width, height) {
  const visited = new Uint8Array(width * height);

  function isBackground(idx) {
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    // Near-black: all channels below threshold
    return r < 40 && g < 40 && b < 40;
  }

  const stack = [];
  function seed(px, py) {
    const i = py * width + px;
    if (!visited[i] && isBackground(i * 4)) {
      visited[i] = 1;
      stack.push(i);
    }
  }

  for (let x = 0; x < width; x++) { seed(x, 0); seed(x, height - 1); }
  for (let y = 0; y < height; y++) { seed(0, y); seed(width - 1, y); }

  while (stack.length > 0) {
    const i  = stack.pop();
    const x  = i % width;
    const y  = Math.floor(i / width);
    data[i * 4 + 3] = 0;   // transparent

    for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const ni = ny * width + nx;
      if (!visited[ni] && isBackground(ni * 4)) {
        visited[ni] = 1;
        stack.push(ni);
      }
    }
  }
}

async function processOne(srcName, outName) {
  const srcPath = path.join(SPLIT_DIR, srcName);
  const outPath = path.join(OUT_DIR, outName);

  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const pixels = new Uint8Array(data.buffer);

  floodFillBlackBackground(pixels, width, height);

  // Rotate 180° — bike sheet has front wheel pointing UP; flip so it points DOWN
  await sharp(Buffer.from(pixels), { raw: { width, height, channels: 4 } })
    .rotate(180)
    .png()
    .toFile(outPath);

  const meta = await sharp(outPath).metadata();
  console.log(`  ✓ ${outName}  ${meta.width}×${meta.height}  hasAlpha:${meta.hasAlpha}`);
}

console.log('Processing bike sprites...');
for (const { src, out } of JOBS) {
  await processOne(src, out);
}
console.log('\nDone →', OUT_DIR);
