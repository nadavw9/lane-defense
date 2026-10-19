// Side-by-side strip of screenshots at phone size: node scripts/_strip.mjs <out.png> <a.png> <b.png> ...
import sharp from 'sharp';
const [out, ...files] = process.argv.slice(2);
const t = await Promise.all(files.map(f => sharp(f).resize(390, 844).toBuffer()));
await sharp({ create: { width: 390 * t.length + 6 * (t.length - 1), height: 844, channels: 3, background: '#fff' } })
  .composite(t.map((x, i) => ({ input: x, left: i * 396, top: 0 }))).png().toFile(out);
