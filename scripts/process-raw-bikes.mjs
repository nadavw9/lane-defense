// process-raw-bikes.mjs  (one-off asset tool — not part of build/runtime)
// Source: sprite-sources/raw/split/{color}_bike.png or {color}-bike.png (white backgrounds)
// Output: public/sprites/designed/bike-{color}.png
//
// Processing: flood-fill white bg removal, 180° rotation (front wheel → faces player)

import sharp from 'sharp';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(__dirname, '..', 'sprite-sources', 'raw', 'split');
const OUT_DIR = path.join(__dirname, '..', 'public', 'sprites', 'designed');
mkdirSync(OUT_DIR, { recursive: true });

// Filename → color mapping (handles both _ and - separators, and order variations)
const BIKES = [
  { file: 'red_bike.png',    name: 'bike-red'    },
  { file: 'blue_bike.png',   name: 'bike-blue'   },
  { file: 'green-bike.png',  name: 'bike-green'  },
  { file: 'yellow-bike.png', name: 'bike-yellow' },
  { file: 'orange-bike.png', name: 'bike-orange' },
  { file: 'purple-bike.png', name: 'bike-purple' },
];

function removeWhiteBackground(data, width, height) {
  const visited = new Uint8Array(width * height);

  function isBackground(idx) {
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    return r > 230 && g > 230 && b > 230;
  }

  const stack = [];
  function seed(px, py) {
    const i = py * width + px;
    if (!visited[i] && isBackground(i * 4)) { visited[i] = 1; stack.push(i); }
  }

  for (let x = 0; x < width; x++)  { seed(x, 0); seed(x, height - 1); }
  for (let y = 0; y < height; y++) { seed(0, y); seed(width - 1, y); }

  while (stack.length > 0) {
    const i = stack.pop();
    const x = i % width, y = Math.floor(i / width);
    data[i * 4 + 3] = 0;
    for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const ni = ny * width + nx;
      if (!visited[ni] && isBackground(ni * 4)) { visited[ni] = 1; stack.push(ni); }
    }
  }
}

for (const { file, name } of BIKES) {
  const srcPath = path.join(SRC_DIR, file);
  const outPath = path.join(OUT_DIR, `${name}.png`);

  const buf = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(buf.data.buffer);
  removeWhiteBackground(pixels, buf.info.width, buf.info.height);

  await sharp(Buffer.from(pixels), {
    raw: { width: buf.info.width, height: buf.info.height, channels: 4 },
  })
    .rotate(180)
    .resize(512, 768, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);

  const meta = await sharp(outPath).metadata();
  console.log(`  ✓ ${name}.png  ${meta.width}×${meta.height}  alpha:${meta.hasAlpha}`);
}

console.log('\n=== Raw bike processing complete ===');
console.log('Output:', OUT_DIR);
