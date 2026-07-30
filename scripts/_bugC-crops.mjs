import sharp from 'sharp';
const P = 'C:/Users/dalit/.claude/projects/C--Users-dalit';
for (const [name, out] of [['bugC-before.png', 'before'], ['bugC-after.png', 'after']]) {
  const meta = await sharp(`${P}/${name}`).metadata();
  console.log(name, meta.width, meta.height);
  const buf = await sharp(`${P}/${name}`).extract({ left: 780, top: 575, width: 370, height: 210 }).toBuffer();
  await sharp(buf).resize(370 * 3, 210 * 3, { kernel: 'nearest' }).png().toFile(`docs/review/_${out}.png`);
}
// stack vertically: before on top
const a = await sharp('docs/review/_before.png').metadata();
await sharp({ create: { width: a.width, height: a.height * 2 + 10, channels: 4, background: '#111111' } })
  .composite([
    { input: 'docs/review/_before.png', left: 0, top: 0 },
    { input: 'docs/review/_after.png', left: 0, top: a.height + 10 },
  ]).png().toFile('docs/review/_stack.png');
console.log('done');
