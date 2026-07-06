// Process AI-generated UI icons → public/sprites/ui/
//
// Two source modes (auto-detected):
//   MONTAGE  sprite-sources/raw/split/20icons.png — ALL 20 icons in one image,
//            laid out in a GRID (4 rows × 5 cols, row-major, matching ICON_NAMES
//            order). Each cell is sliced out, then processed like a single icon.
//   PER-FILE sprite-sources/raw/split/icon-<name>.png — one object per file.
//
// Either way, each icon's PLAIN WHITE background is flood-filled away from the
// (cell) corners (same technique as the title-logo dark-bg removal in
// process-ai-backgrounds.mjs, inverted for a light bg), trimmed to content, and
// resized to 128×128. Missing sources are skipped so a partial batch never
// crashes the run. Pass --review to also emit a labelled contact sheet to
// docs/review/ui-icons-sliced.png for the naming-confirmation checkpoint.
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const SRC = 'sprite-sources/raw/split';
const OUT = 'public/sprites/ui';
const MONTAGE = path.join(SRC, '20icons.png');
const GRID_ROWS = 4, GRID_COLS = 5;   // row-major; must equal ICON_NAMES layout
const REVIEW = process.argv.includes('--review');

// Batch 1 — kept in sync with IMPLEMENTATION_PLAYBOOK.md §6. In the montage the
// icons appear in THIS exact order, left-to-right then top-to-bottom.
const ICON_NAMES = [
  'star-filled', 'star-empty', 'play', 'back', 'heart', 'coin', 'gear',
  'trophy', 'book', 'share', 'chart', 'gift', 'fire', 'timer', 'target',
  'check', 'close', 'shield', 'skull', 'hand',
];

// Batch 1b — generated as INDIVIDUAL files (icon-<name>.png), not part of the
// montage. Always processed via the per-file path, even when 20icons.png (the
// Batch-1 montage) is still present. Missing files are skipped, so this stays a
// no-op until the art lands.
const EXTRA_ICON_NAMES = ['explosion', 'snowflake', 'lightning', 'car', 'speaker'];

fs.mkdirSync(OUT, { recursive: true });

const WORK = 900;
const WHITE = 245;   // near-white background threshold

// Flood-fill the white background of a single raw RGBA buffer to transparent,
// starting from its four edges (the icon sits in the middle on white).
function stripWhiteBg(data, W, H, ch) {
  const isWhite = (i) => data[i] > WHITE && data[i + 1] > WHITE && data[i + 2] > WHITE;
  const visited = new Uint8Array(W * H);
  const stack = [];
  const push = (x, y) => { if (x >= 0 && x < W && y >= 0 && y < H && !visited[y * W + x]) { visited[y * W + x] = 1; stack.push(x, y); } };
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    const p = (y * W + x) * ch;
    if (!isWhite(p)) continue;         // reached the opaque icon → stop
    data[p + 3] = 0;                   // make this white bg pixel transparent
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
}

// Keep only the largest connected blob of opaque pixels; erase the rest. Removes
// stray fragments of a neighbouring icon that bled across a montage cell edge
// (the grid isn't perfectly even, so a tip of the icon below can sneak in).
function keepLargestBlob(data, W, H, ch) {
  const OPAQUE = 24;                    // alpha above this counts as icon
  const label = new Int32Array(W * H).fill(-1);
  const blobs = [];                     // blobs[id] = pixel count
  const stack = [];
  for (let start = 0; start < W * H; start++) {
    if (data[start * ch + 3] <= OPAQUE || label[start] !== -1) continue;
    const id = blobs.length; let count = 0;
    stack.push(start); label[start] = id;
    while (stack.length) {
      const idx = stack.pop(); count++;
      const x = idx % W, y = (idx / W) | 0;
      const nb = [x + 1 < W ? idx + 1 : -1, x > 0 ? idx - 1 : -1, y + 1 < H ? idx + W : -1, y > 0 ? idx - W : -1];
      for (const n of nb) {
        if (n < 0 || label[n] !== -1 || data[n * ch + 3] <= OPAQUE) continue;
        label[n] = id; stack.push(n);
      }
    }
    blobs.push(count);
  }
  if (blobs.length <= 1) return;
  let best = 0; for (let i = 1; i < blobs.length; i++) if (blobs[i] > blobs[best]) best = i;
  for (let i = 0; i < W * H; i++) if (label[i] !== -1 && label[i] !== best) data[i * ch + 3] = 0;
}

// Yield a { name, buffer } (raw-source PNG buffer) for every icon, from whichever
// source mode is present. Montage cells are cut with a small inset so a neighbour
// never bleeds across the white gutter.
async function* iterSources() {
  if (fs.existsSync(MONTAGE)) {
    const meta = await sharp(MONTAGE).metadata();
    const cw = Math.floor(meta.width / GRID_COLS);
    const chh = Math.floor(meta.height / GRID_ROWS);
    const inset = Math.round(Math.min(cw, chh) * 0.02);   // trim seam/gutter
    for (let i = 0; i < ICON_NAMES.length; i++) {
      const r = Math.floor(i / GRID_COLS), c = i % GRID_COLS;
      const left = Math.min(c * cw + inset, meta.width - 1);
      const top = Math.min(r * chh + inset, meta.height - 1);
      const width = Math.min(cw - inset * 2, meta.width - left);
      const height = Math.min(chh - inset * 2, meta.height - top);
      const buffer = await sharp(MONTAGE)
        .extract({ left, top, width, height }).png().toBuffer();
      yield { name: ICON_NAMES[i], buffer };
    }
    // Batch 1b individual files are ALWAYS processed alongside the montage.
    yield* perFile(EXTRA_ICON_NAMES);
    return;
  }
  yield* perFile([...ICON_NAMES, ...EXTRA_ICON_NAMES]);
}

function* perFile(names) {
  for (const name of names) {
    const srcPath = path.join(SRC, `icon-${name}.png`);
    if (!fs.existsSync(srcPath)) { console.log(`icon-${name}: source not found, skipped`); continue; }
    yield { name, buffer: fs.readFileSync(srcPath) };
  }
}

console.log(fs.existsSync(MONTAGE) ? `montage mode: ${MONTAGE} (${GRID_ROWS}×${GRID_COLS})` : 'per-file mode');
let processed = 0;
for await (const { name, buffer } of iterSources()) {
  const { data, info } = await sharp(buffer)
    .resize(WORK, WORK, { fit: 'inside' })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, ch = info.channels;
  stripWhiteBg(data, W, H, ch);
  keepLargestBlob(data, W, H, ch);

  await sharp(data, { raw: { width: W, height: H, channels: ch } })
    .png().trim()
    .resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toFile(path.join(OUT, `icon-${name}.png`));
  console.log(`icon-${name}.png → bg removed, trimmed, 128×128`);
  processed++;
}
console.log(`done: ${processed} processed`);

// Labelled contact sheet for the STEP 0.4 naming-confirmation checkpoint.
if (REVIEW && processed > 0) {
  const CELL = 150, PAD = 26, COLS = 5;
  const rows = Math.ceil(ICON_NAMES.length / COLS);
  const sheetW = COLS * CELL, sheetH = rows * (CELL + PAD);
  const composites = [];
  for (let i = 0; i < ICON_NAMES.length; i++) {
    const name = ICON_NAMES[i];
    const iconPath = path.join(OUT, `icon-${name}.png`);
    if (!fs.existsSync(iconPath)) continue;
    const r = Math.floor(i / COLS), c = i % COLS;
    const icon = await sharp(iconPath).resize(112, 112, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
    composites.push({ input: icon, left: c * CELL + (CELL - 112) / 2, top: r * (CELL + PAD) + 8 });
    const label = Buffer.from(
      `<svg width="${CELL}" height="${PAD}"><text x="${CELL / 2}" y="18" font-family="monospace" font-size="15" fill="#111" text-anchor="middle">${name}</text></svg>`);
    composites.push({ input: label, left: c * CELL, top: r * (CELL + PAD) + CELL - 4 });
  }
  fs.mkdirSync('docs/review', { recursive: true });
  await sharp({ create: { width: sheetW, height: sheetH, channels: 4, background: { r: 235, g: 236, b: 240, alpha: 1 } } })
    .composite(composites).png().toFile('docs/review/ui-icons-sliced.png');
  console.log('review sheet → docs/review/ui-icons-sliced.png');
}
