import sharp from 'sharp';
const PROJ = 'C:/Users/dalit/.claude/projects/C--Users-dalit';
const OUT = 'docs/review';
async function crop(src, region, scale, out) {
  const img = sharp(src).extract(region);
  const buf = await img.toBuffer();
  const meta = await sharp(buf).metadata();
  await sharp(buf).resize(meta.width * scale, meta.height * scale, { kernel: 'nearest' }).png().toFile(out);
  console.log(out);
}
async function sideBySide(a, b, out) {
  const [ma, mb] = [await sharp(a).metadata(), await sharp(b).metadata()];
  const H = Math.max(ma.height, mb.height), GAP = 12;
  await sharp({ create: { width: ma.width + mb.width + GAP, height: H, channels: 4, background: '#111111' } })
    .composite([{ input: a, left: 0, top: 0 }, { input: b, left: ma.width + GAP, top: 0 }])
    .png().toFile(out);
  console.log(out);
}
// lane 0 user case (green truck / blue tank / red sedan): x 228-298, y 488-612
await crop(`${PROJ}/before-board.png`, { left: 228, top: 488, width: 70, height: 124 }, 4, 'docs/review/_tmp_a.png');
await crop(`${PROJ}/after-board.png`,  { left: 228, top: 488, width: 70, height: 124 }, 4, 'docs/review/_tmp_b.png');
await sideBySide('docs/review/_tmp_a.png', 'docs/review/_tmp_b.png', `${OUT}/01.png`);
// full car region
await crop(`${PROJ}/before-board.png`, { left: 220, top: 378, width: 360, height: 240 }, 3, `${OUT}/02.png`);
await crop(`${PROJ}/after-board.png`,  { left: 220, top: 378, width: 360, height: 240 }, 3, `${OUT}/03.png`);
