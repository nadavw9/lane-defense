// Process Batch-2 UI chrome (button plates + frames) → public/sprites/ui/.
// Same white-bg flood-fill as process-ui-icons.mjs, but preserves aspect (no
// square 128 resize) since these are 9-slice plates / frames. Trims the white
// margin, caps the long side, and reports the trimmed size so 9-slice insets can
// be set from real geometry. Missing sources skip.
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const SRC = 'sprite-sources/raw/split';
const OUT = 'public/sprites/ui';
const CAP = 640;          // long-side cap (buttons render ≤308px → ~2x headroom)
const WHITE = 245;

const CHROME = ['button-primary', 'button-secondary', 'win-burst', 'win-stars', 'lose-frame'];

fs.mkdirSync(OUT, { recursive: true });

for (const name of CHROME) {
  const srcPath = path.join(SRC, `${name}.png`);
  if (!fs.existsSync(srcPath)) { console.log(`${name}: source not found, skipped`); continue; }

  // Flood-fill the white background to transparent from the four edges.
  const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, ch = info.channels;
  const isWhite = (i) => data[i] > WHITE && data[i + 1] > WHITE && data[i + 2] > WHITE;
  const visited = new Uint8Array(W * H);
  const stack = [];
  const push = (x, y) => { if (x >= 0 && x < W && y >= 0 && y < H && !visited[y * W + x]) { visited[y * W + x] = 1; stack.push(x, y); } };
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
  // Also seed the centre: a frame (e.g. lose-frame) encloses a white "open centre"
  // unreachable from the edges — seed it so the interior goes transparent too.
  // Harmless for solid-centre art (the isWhite test stops at the first opaque pixel).
  push(Math.floor(W / 2), Math.floor(H / 2));
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    const p = (y * W + x) * ch;
    if (!isWhite(p)) continue;
    data[p + 3] = 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }

  const long = Math.max(W, H);
  const scale = long > CAP ? CAP / long : 1;
  const out = await sharp(data, { raw: { width: W, height: H, channels: ch } })
    .png().trim()
    .resize(Math.round(W * scale), Math.round(H * scale), { fit: 'inside' })
    .png().toBuffer();
  const meta = await sharp(out).metadata();
  await sharp(out).toFile(path.join(OUT, `${name}.png`));
  console.log(`${name}.png → ${meta.width}x${meta.height} (bg removed, trimmed)`);
}
