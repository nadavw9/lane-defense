// Temp: measure alpha bbox of EVERY color variant per type, flag per-color drift.
import sharp from 'sharp';

const BASES = {
  small:  (c) => `bike-${c}.png`,
  big:    (c) => `car-${c}-processed.png`,
  jeep:   (c) => `van-${c}.png`,
  truck:  (c) => `truck-${c}.png`,
  bigrig: (c) => `bigrig-${c}.png`,
  tank:   (c) => `tank-${c}.png`,
};
const COLORS = ['red', 'blue', 'green', 'orange', 'purple', 'yellow'];
const ALPHA_THRESHOLD = 16;

for (const [type, fileFor] of Object.entries(BASES)) {
  console.log(`\n${type}:`);
  for (const color of COLORS) {
    const file = fileFor(color);
    const img = sharp(`C:/Users/dalit/AppData/Local/Temp/claude/c--Users-dalit--claude-projects-C--Users-dalit/4c1787c7-fbb6-4698-9939-d1e25041feba/scratchpad/normalized-sprites/${file}`).ensureAlpha();
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    const { width: W, height: H, channels } = info;
    let minX = W, maxX = -1, minY = H, maxY = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (data[(y * W + x) * channels + 3] > ALPHA_THRESHOLD) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    const w  = ((maxX - minX + 1) / W).toFixed(3);
    const h  = ((maxY - minY + 1) / H).toFixed(3);
    const cx = (((minX + maxX) / 2 - (W - 1) / 2) / W).toFixed(3);
    console.log(`  ${color.padEnd(7)} ${W}x${H}  w=${w} h=${h} cx=${cx}`);
  }
}
