// compress-sprites.mjs — shrink the public/sprites/designed/ payload for faster
// cold loads on mobile (Play Store gate). Re-encodes every PNG with max zlib
// compression + palette quantization, and downsizes anything over MAX_DIM on its
// longest side (the game renders these sprites small, so source detail above
// ~512px is wasted bytes).
//
// Usage:
//   node scripts/compress-sprites.mjs            # compress in place
//   node scripts/compress-sprites.mjs --dry      # report only, write nothing
//   node scripts/compress-sprites.mjs --max=384  # override longest-side cap
//
// Safe: each file is read fully into a buffer (sharp resolves the source before
// we overwrite), so reading + writing the same path never races.
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const DIR     = 'public/sprites/designed';
const DRY     = process.argv.includes('--dry');
const maxArg  = process.argv.find(a => a.startsWith('--max='));
// 280px longest-side keeps the total payload under 2MB while staying crisp at the
// game's small on-screen render sizes (cars ~80px, buildings ~60px, trees ~30px),
// even at retina DPR. Override with --max=N to re-tune.
const MAX_DIM = maxArg ? parseInt(maxArg.split('=')[1], 10) : 280;

const kb = (bytes) => bytes / 1024;
const pad = (s, n) => String(s).padStart(n);

const files = readdirSync(DIR).filter(f => /\.png$/i.test(f)).sort();

let totalBefore = 0, totalAfter = 0, overLimit = 0;
const rows = [];

for (const f of files) {
  const fp = join(DIR, f);
  const before = statSync(fp).size;
  totalBefore += before;

  const img  = sharp(fp);
  const meta = await img.metadata();
  const longest = Math.max(meta.width, meta.height);
  const willResize = longest > MAX_DIM;

  let pipe = sharp(fp);
  if (willResize) {
    // Fit inside MAX_DIM×MAX_DIM, preserve aspect ratio, never enlarge.
    pipe = pipe.resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true });
  }
  // Palette quantization (PNG8) with dithering keeps flat game art crisp at a
  // fraction of full-colour RGBA size; max compression effort on top.
  pipe = pipe.png({ compressionLevel: 9, effort: 10, palette: true, quality: 90, colors: 256, dither: 1.0 });

  const buf = await pipe.toBuffer();          // fully resolves source before write
  const after = buf.length;

  if (!DRY) writeFileSync(fp, buf);
  totalAfter += after;
  if (after > 200 * 1024) overLimit++;

  rows.push({
    f,
    before, after,
    dim: willResize ? `${meta.width}x${meta.height}→≤${MAX_DIM}` : `${meta.width}x${meta.height}`,
    pct: 100 * (1 - after / before),
    over: after > 200 * 1024,
  });
}

rows.sort((a, b) => b.after - a.after);

console.log(`\nCompression ${DRY ? '(DRY RUN)' : ''} — MAX_DIM=${MAX_DIM}, ${files.length} PNGs\n`);
console.log('  BEFORE     AFTER    SAVED   DIMENSIONS              FILE');
for (const r of rows) {
  const flag = r.over ? ' !!>200KB' : '';
  console.log(
    `${pad(kb(r.before).toFixed(1), 8)}KB ${pad(kb(r.after).toFixed(1), 8)}KB ` +
    `${pad(r.pct.toFixed(0), 5)}%   ${r.dim.padEnd(22)}  ${r.f}${flag}`,
  );
}
console.log('  ' + '-'.repeat(60));
console.log(`  TOTAL: ${kb(totalBefore / 1024).toFixed(2)}MB → ${(totalAfter / 1024 / 1024).toFixed(2)}MB`);
console.log(`  Files over 200KB after: ${overLimit}`);
console.log(`  ${DRY ? 'DRY RUN — no files written.' : 'Written in place.'}\n`);
