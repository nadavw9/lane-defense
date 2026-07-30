import sharp from 'sharp';
const P = 'C:/Users/dalit/.claude/projects/C--Users-dalit';
// stripe + row-0 bombs band, 3x
const buf = await sharp(`${P}/bugC-after.png`).extract({ left: 780, top: 570, width: 370, height: 100 }).toBuffer();
await sharp(buf).resize(370 * 3, 100 * 3, { kernel: 'lanczos3' }).png().toFile('docs/review/_stripe.png');
console.log('done');
