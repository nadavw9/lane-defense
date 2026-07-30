// Temp: per-lane car centroid check on a board screenshot.
// For each lane strip, clusters saturated (car-colored) pixels into cars by
// y-gaps and reports each car's centroid X; intra-lane spread = misalignment
// (idle wobble is phase-synced per lane, so it cancels within a lane).
import sharp from 'sharp';

const [,, file, lanesArg, yTopArg, yBotArg] = process.argv;
const laneCenters = lanesArg.split(',').map(Number);
const yTop = Number(yTopArg), yBot = Number(yBotArg);

const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, channels: C } = info;

function isCar(x, y) {
  const i = (y * W + x) * C;
  const r = data[i], g = data[i + 1], b = data[i + 2];
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  return sat > 0.30 && max > 70;
}

for (const cx of laneCenters) {
  const x0 = Math.round(cx - 46), x1 = Math.round(cx + 46);
  // row profile: count car pixels per y
  const rows = [];
  for (let y = yTop; y <= yBot; y++) {
    let n = 0;
    for (let x = x0; x <= x1; x++) if (isCar(x, y)) n++;
    rows.push(n);
  }
  // cluster into cars: runs of rows with >=3 car px, separated by >=4 empty rows
  const clusters = [];
  let start = -1, gap = 0;
  for (let k = 0; k <= rows.length; k++) {
    const on = k < rows.length && rows[k] >= 3;
    if (on) {
      if (start === -1) start = k;
      gap = 0;
    } else if (start !== -1) {
      gap++;
      if (gap >= 4 || k === rows.length) {
        clusters.push([start + yTop, k - gap + yTop]);
        start = -1; gap = 0;
      }
    }
  }
  console.log(`\nlane strip center x=${cx}:`);
  const xs = [];
  for (const [ya, yb] of clusters) {
    if (yb - ya < 6) continue;   // noise
    let sx = 0, n = 0;
    for (let y = ya; y <= yb; y++)
      for (let x = x0; x <= x1; x++)
        if (isCar(x, y)) { sx += x; n++; }
    const cxi = sx / n;
    xs.push(cxi);
    console.log(`  car y=${ya}-${yb}  centroidX=${cxi.toFixed(1)}  (offset ${(cxi - cx).toFixed(1)}px from strip center)`);
  }
  if (xs.length > 1) {
    const spread = Math.max(...xs) - Math.min(...xs);
    console.log(`  INTRA-LANE SPREAD: ${spread.toFixed(1)}px`);
  }
}
