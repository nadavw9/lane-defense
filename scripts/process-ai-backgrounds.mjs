// Process AI-generated background assets → public/sprites/designed/
//  - title-background.png : cover-resize to 390×844 (full screen)
//  - title-logo.png       : remove DARK background (flood-fill from corners), trim, fit 350×200
//  - world{1,2,3}-{left,right}.png : resize to 95×844 (side panels)
import sharp from 'sharp';
import path from 'path';
const SRC = 'sprite-sources/raw/split';
const OUT = 'public/sprites/designed';

// ── title-background → 390×844 cover ────────────────────────────────────────
await sharp(path.join(SRC, 'title-background.png'))
  .resize(390, 844, { fit: 'cover', position: 'centre' })
  .png().toFile(path.join(OUT, 'title-background.png'));
console.log('title-background.png → 390×844 (cover)');

// ── title-logo: remove dark bg via flood-fill from the 4 corners ────────────
{
  const WORK = 900;
  const { data, info } = await sharp(path.join(SRC, 'title-logo.png'))
    .resize(WORK, WORK, { fit: 'inside' })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, ch = info.channels;
  const lum = (i) => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  const DARK = 55;                         // near-black background threshold
  const visited = new Uint8Array(W * H);
  const stack = [];
  const push = (x, y) => { if (x >= 0 && x < W && y >= 0 && y < H && !visited[y * W + x]) { visited[y * W + x] = 1; stack.push(x, y); } };
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
  let cleared = 0;
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    const p = (y * W + x) * ch;
    if (lum(p) > DARK) continue;           // reached the bright explosion → stop
    data[p + 3] = 0; cleared++;            // make this dark bg pixel transparent
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  await sharp(data, { raw: { width: W, height: H, channels: ch } })
    .png().trim()                          // crop away the now-transparent border
    .resize(350, 200, { fit: 'inside' })
    .png().toFile(path.join(OUT, 'title-logo.png'));
  console.log(`title-logo.png → dark-bg removed (${cleared} px), trimmed, fit 350×200`);
}

// ── world side panels → 95×844 ──────────────────────────────────────────────
for (const w of [1, 2, 3]) {
  for (const side of ['left', 'right']) {
    const name = `world${w}-${side}.png`;
    await sharp(path.join(SRC, name))
      .resize(95, 844, { fit: 'fill' })
      .png().toFile(path.join(OUT, name));
    console.log(`${name} → 95×844`);
  }
}
console.log('done');
