import sharp from 'sharp';
const P = 'C:/Users/dalit/.claude/projects/C--Users-dalit';
// sample a floor-tile patch (no balls): x 950-990, y 700-740 device px
async function patch(file, box) {
  const { data, info } = await sharp(file).extract(box).raw().toBuffer({ resolveWithObject: true });
  let r = 0, g = 0, b = 0, n = data.length / info.channels;
  for (let i = 0; i < data.length; i += info.channels) { r += data[i]; g += data[i+1]; b += data[i+2]; }
  return [r/n, g/n, b/n].map(v => v.toFixed(1)).join(',');
}
const floorBox = { left: 950, top: 700, width: 40, height: 40 };
const roadBox  = { left: 950, top: 400, width: 40, height: 40 };
const ballBox  = { left: 826, top: 605, width: 30, height: 30 };  // green ball top-left
console.log('floor tile  before:', await patch(`${P}/bugC-before.png`, floorBox), ' after:', await patch(`${P}/bugC-after.png`, floorBox));
console.log('road (ref)  before:', await patch(`${P}/bugC-before.png`, roadBox),  ' after:', await patch(`${P}/bugC-after.png`, roadBox));
console.log('green ball  before:', await patch(`${P}/bugC-before.png`, ballBox),  ' after:', await patch(`${P}/bugC-after.png`, ballBox));
