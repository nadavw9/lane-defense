// Temp: before/after contact sheet per type — current designed sprite vs
// normalized preview, each centered in a cell with a magenta lane-center line.
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CUR_DIR = path.join(__dirname, '..', 'public', 'sprites', 'designed');
const NEW_DIR = process.argv[2];
const OUT_DIR = process.argv[3];

const COLORS = ['red', 'blue', 'green', 'yellow', 'orange', 'purple'];
const FILE_FOR = {
  small:  (c) => `bike-${c}.png`,
  big:    (c) => `car-${c}-processed.png`,
  jeep:   (c) => `van-${c}.png`,
  truck:  (c) => `truck-${c}.png`,
  bigrig: (c) => `bigrig-${c}.png`,
  tank:   (c) => `tank-${c}.png`,
};
const CELL_W = 290, CELL_H = 290, GAP = 6;

async function cell(file, tint) {
  // cell background + center line
  const bg = Buffer.from(
    `<svg width="${CELL_W}" height="${CELL_H}">
       <rect width="100%" height="100%" fill="${tint}"/>
       <line x1="${CELL_W / 2}" y1="0" x2="${CELL_W / 2}" y2="${CELL_H}" stroke="#ff00ff" stroke-width="1"/>
     </svg>`);
  const meta = await sharp(file).metadata();
  // scale image to fit cell height, keep aspect — mimics the plane stretch ONLY
  // in height; horizontal offset within the image reads directly against the line
  const s = Math.min((CELL_H - 8) / meta.height, (CELL_W - 4) / meta.width);
  const h = Math.round(meta.height * s);
  const w = Math.round(meta.width * s);
  const img = await sharp(file).resize(w, h, { fit: 'fill' }).png().toBuffer();
  return sharp(bg).composite([{ input: img, left: Math.round((CELL_W - w) / 2), top: 4 }]).png().toBuffer();
}

for (const [type, fileFor] of Object.entries(FILE_FOR)) {
  const rows = [];
  for (const [dir, tint] of [[CUR_DIR, '#3a3a3a'], [NEW_DIR, '#2a3a2a']]) {
    for (let i = 0; i < COLORS.length; i++) {
      rows.push({
        input: await cell(path.join(dir, fileFor(COLORS[i])), tint),
        left: i * (CELL_W + GAP),
        top: dir === CUR_DIR ? 0 : CELL_H + GAP,
      });
    }
  }
  const W = COLORS.length * (CELL_W + GAP) - GAP;
  const H = 2 * CELL_H + GAP;
  await sharp({ create: { width: W, height: H, channels: 4, background: '#111111' } })
    .composite(rows)
    .png()
    .toFile(path.join(OUT_DIR, `sheet-${type}.png`));
  console.log(`sheet-${type}.png`);
}
