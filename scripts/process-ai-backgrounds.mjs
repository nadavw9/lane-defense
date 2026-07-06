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

// NOTE: the old "aspect-preserving full panel" step was removed — the raw
// world{n}-{side}.png sources are now BAND-style (Batch S: art band + white),
// consumed by the strip section below. The legacy public/sprites/designed/
// world*.png files remain on disk as the cover-crop fallback and must not be
// regenerated from band-style sources.
// ── per-world road tiles (optional — processed only if present) ─────────────
// CONTRACT (see Road3D): seamless SQUARE tile = ONE LANE of road surface, with a
// single vertical dash segment on the tile centre-line (Road3D's half-tile U
// offset turns that dash into the lane dividers). 512×512 output.
for (const w of [1, 2, 3]) {
  const name = `road-world${w}.png`;
  try {
    await sharp(path.join(SRC, name))
      .resize(512, 512, { fit: 'cover', position: 'centre' })
      .png().toFile(path.join(OUT, name));
    console.log(`${name} → 512×512 (cover)`);
  } catch { /* not generated yet — skip */ }
}
// ── strip-native side panels (Batch S / Option B) ───────────────────────────
// Source: art band flush to one canvas edge, rest pure white. Auto-crop the
// non-white band → resize to width 196 (4× the 49px display width) →
// public/sprites/designed/strip-world{n}-{side}.png. The game shows the FULL
// band width (width-fit + vertical tile) — zero horizontal crop, so buildings
// can never be sliced again.
for (const w of [1, 2, 3]) {
  for (const side of ['left', 'right']) {
    const src = path.join(SRC, `world${w}-${side}.png`);
    let raw;
    try { raw = await sharp(src).raw().toBuffer({ resolveWithObject: true }); }
    catch { continue; }
    const { data, info } = raw;
    const W = info.width, H = info.height, ch = info.channels;
    const colWhite = (x) => {
      let white = 0, n = 0;
      for (let y = 0; y < H; y += 16) {
        const i = (y * W + x) * ch;
        if (data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245) white++;
        n++;
      }
      return white / n > 0.95;
    };
    let lo = null, hi = null;
    for (let x = 0; x < W; x++) { if (!colWhite(x)) { if (lo === null) lo = x; hi = x; } }
    if (lo === null) { console.log(`strip-world${w}-${side}: no band found, skipped`); continue; }
    const bandW = hi - lo + 1;
    await sharp(src)
      .extract({ left: lo, top: 0, width: bandW, height: H })
      .resize({ width: 196 })
      .png().toFile(path.join(OUT, `strip-world${w}-${side}.png`));
    console.log(`strip-world${w}-${side}.png ← band x=${lo}..${hi} (${bandW}px) → 196w`);
  }
}
console.log('done');
