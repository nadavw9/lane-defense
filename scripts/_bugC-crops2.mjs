import sharp from 'sharp';
const P = 'C:/Users/dalit/.claude/projects/C--Users-dalit';
// tight crop: leftmost + rightmost slot columns, 6x nearest
async function col(name, left) {
  return sharp(`${P}/${name}`).extract({ left, top: 590, width: 110, height: 190 }).toBuffer();
}
const cells = [];
let x = 0;
for (const [name, lbl] of [['bugC-before.png', 'before'], ['bugC-after.png', 'after']]) {
  for (const left of [790, 1030]) {
    const buf = await col(name, left);
    const big = await sharp(buf).resize(110 * 6, 190 * 6, { kernel: 'nearest' }).png().toBuffer();
    cells.push({ input: big, left: x, top: 0 });
    x += 110 * 6 + 8;
  }
}
await sharp({ create: { width: x - 8, height: 190 * 6, channels: 4, background: '#111111' } })
  .composite(cells).png().toFile('docs/review/_sides.png');
console.log('done');
