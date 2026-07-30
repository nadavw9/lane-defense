import sharp from 'sharp';
const P = 'C:/Users/dalit/.claude/projects/C--Users-dalit';
// intro card crop (game column only, 2x)
const a = await sharp(`${P}/bugA-l15-tank-card2.png`).extract({ left: 588, top: 0, width: 360, height: 770 }).toBuffer();
await sharp(a).resize(720, 1540, { kernel: 'lanczos3' }).png().toFile('docs/review/01.png');
// restart, no card
const b = await sharp(`${P}/bugA-l15-restart-nocard.png`).extract({ left: 588, top: 0, width: 360, height: 770 }).toBuffer();
await sharp(b).png().toFile('docs/review/02.png');
console.log('done');
