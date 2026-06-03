// process-car-sprites.mjs
// Reads car PNG files from Downloads, removes white background, flips 180°,
// saves to public/sprites/designed/ as car-<color>-processed.png

import sharp from 'sharp';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = path.join(__dirname, '..', 'public', 'sprites', 'designed');
mkdirSync(OUT_DIR, { recursive: true });

const JOBS = [
  { src: 'C:\\Users\\dalit\\Downloads\\Red-car.png',            out: 'car-red-processed.png'    },
  { src: 'C:\\Users\\dalit\\Downloads\\Blue-car.png',           out: 'car-blue-processed.png'   },
  { src: 'C:\\Users\\dalit\\Downloads\\Copy of Green-car.png',  out: 'car-green-processed.png'  },
  { src: 'C:\\Users\\dalit\\Downloads\\Copy of Yellow-car.png', out: 'car-yellow-processed.png' },
  { src: 'C:\\Users\\dalit\\Downloads\\Copy of Orange-car.png', out: 'car-orange-processed.png' },
  { src: 'C:\\Users\\dalit\\Downloads\\Copy of Purple-car.png', out: 'car-purple-processed.png' },
];

// Flood-fill from corners to mark connected near-white background pixels.
// This avoids erasing white highlights inside the car body.
function floodFillBackground(data, width, height) {
  // data = Uint8Array of RGBA, length = width * height * 4
  const visited = new Uint8Array(width * height);

  function isBackground(idx) {
    const r = data[idx],  g = data[idx+1],  b = data[idx+2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    return r > 210 && g > 210 && b > 210 && saturation < 0.25;
  }

  const stack = [];
  function seed(px, py) {
    const i = py * width + px;
    if (!visited[i] && isBackground(i * 4)) {
      visited[i] = 1;
      stack.push(i);
    }
  }

  // Seed from all four edges
  for (let x = 0; x < width; x++) { seed(x, 0); seed(x, height - 1); }
  for (let y = 0; y < height; y++) { seed(0, y); seed(width - 1, y); }

  // BFS / iterative flood fill
  while (stack.length > 0) {
    const i = stack.pop();
    const x = i % width;
    const y = Math.floor(i / width);
    // Set alpha to 0
    data[i * 4 + 3] = 0;

    const neighbors = [
      [x-1, y], [x+1, y], [x, y-1], [x, y+1],
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const ni = ny * width + nx;
      if (!visited[ni] && isBackground(ni * 4)) {
        visited[ni] = 1;
        stack.push(ni);
      }
    }
  }
}

async function processOne(src, outName) {
  const outPath = path.join(OUT_DIR, outName);

  // 1. Load → ensure RGBA (4 channels)
  const { data, info } = await sharp(src)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const pixels = new Uint8Array(data.buffer);

  // 2. Flood-fill background removal from edges
  floodFillBackground(pixels, width, height);

  // 3. Reconstruct image (original orientation already has nose pointing down)
  await sharp(Buffer.from(pixels), { raw: { width, height, channels: 4 } })
    .png()
    .toFile(outPath);

  const stat = await sharp(outPath).metadata();
  console.log(`✓ ${outName}  ${stat.width}×${stat.height}  hasAlpha:${stat.hasAlpha}`);
}

for (const { src, out } of JOBS) {
  await processOne(src, out);
}
console.log('\nAll done →', OUT_DIR);
