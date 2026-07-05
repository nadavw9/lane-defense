// Process AI-generated UI icons → public/sprites/ui/
// Source: sprite-sources/raw/split/icon-<name>.png, single object on a PLAIN
// WHITE background (see IMPLEMENTATION_PLAYBOOK.md §6 prompt). Flood-fills the
// white background from the 4 corners (same technique as the title-logo
// dark-bg removal in process-ai-backgrounds.mjs, inverted for a light bg),
// trims to content, resizes to 128×128. Missing sources are skipped so a
// partial batch never crashes the run.
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const SRC = 'sprite-sources/raw/split';
const OUT = 'public/sprites/ui';

// Batch 1 — kept in sync with IMPLEMENTATION_PLAYBOOK.md §6.
const ICON_NAMES = [
  'star-filled', 'star-empty', 'play', 'back', 'heart', 'coin', 'gear',
  'trophy', 'book', 'share', 'chart', 'gift', 'fire', 'timer', 'target',
  'check', 'close', 'shield', 'skull', 'hand',
];

fs.mkdirSync(OUT, { recursive: true });

const WORK = 900;
const WHITE = 245;   // near-white background threshold

let processed = 0, skipped = 0;
for (const name of ICON_NAMES) {
  const srcPath = path.join(SRC, `icon-${name}.png`);
  if (!fs.existsSync(srcPath)) { console.log(`icon-${name}: source not found, skipped`); skipped++; continue; }

  const { data, info } = await sharp(srcPath)
    .resize(WORK, WORK, { fit: 'inside' })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, ch = info.channels;
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

  await sharp(data, { raw: { width: W, height: H, channels: ch } })
    .png().trim()
    .resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toFile(path.join(OUT, `icon-${name}.png`));
  console.log(`icon-${name}.png → bg removed, trimmed, 128×128`);
  processed++;
}
console.log(`done: ${processed} processed, ${skipped} skipped`);
