// process-bikes-all-colors.mjs
// Source: bikes-all-colors.webp (1024×1024)
// Layout:
//   Top row (row 0): 3 bikes in equal thirds (341px each)
//     [0,0] blue   [1,0] green   [2,0] yellow
//   Bottom row (row 1): 2 bikes in equal halves (512px each)
//     [0,1] orange              [1,1] purple
//   Red bike: generated from orange via -25° hue shift (no source cell)
//
// Processing: flood-fill black bg removal, 180° rotation (front wheel → faces player)

import sharp from 'sharp';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'public', 'sprites', 'raw', 'split', 'bikes-all-colors.webp');
const OUT_DIR = path.join(__dirname, '..', 'public', 'sprites', 'designed');
mkdirSync(OUT_DIR, { recursive: true });

// top row: 3 equal thirds; bottom row: 2 equal halves
const GRID = [
  { left: 0,   top: 0,   width: 341, height: 512, name: 'bike-blue'   },
  { left: 341, top: 0,   width: 341, height: 512, name: 'bike-green'  },
  { left: 682, top: 0,   width: 342, height: 512, name: 'bike-yellow' },
  { left: 0,   top: 512, width: 512, height: 512, name: 'bike-orange' },
  { left: 512, top: 512, width: 512, height: 512, name: 'bike-purple' },
];

function removeBlackBackground(data, width, height) {
  const visited = new Uint8Array(width * height);

  function isBackground(idx) {
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    return r < 25 && g < 25 && b < 25;
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

const { width, height } = await sharp(SRC).metadata();
console.log(`Source: ${width}x${height}`);

for (const { left, top, width: w, height: h, name } of GRID) {
  const outPath = path.join(OUT_DIR, `${name}.png`);

  const buf = await sharp(SRC)
    .extract({ left, top, width: w, height: h })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(buf.data.buffer);
  removeBlackBackground(pixels, buf.info.width, buf.info.height);

  await sharp(Buffer.from(pixels), { raw: { width: buf.info.width, height: buf.info.height, channels: 4 } })
    .rotate(180)
    .png()
    .toFile(outPath);

  const meta = await sharp(outPath).metadata();
  console.log(`  ✓ ${name}.png  ${meta.width}×${meta.height}  alpha:${meta.hasAlpha}`);
}

// Generate bike-red by hue-shifting orange by -25° (orange ~30° → red ~5°)
{
  const orangePath = path.join(OUT_DIR, 'bike-orange.png');
  const redPath    = path.join(OUT_DIR, 'bike-red.png');
  await sharp(orangePath)
    .modulate({ hue: -25 })
    .png()
    .toFile(redPath);
  const meta = await sharp(redPath).metadata();
  console.log(`  ✓ bike-red.png  ${meta.width}×${meta.height}  (hue-shifted from orange)  alpha:${meta.hasAlpha}`);
}

console.log('\n=== Bike processing complete ===');
console.log('Output:', OUT_DIR);
