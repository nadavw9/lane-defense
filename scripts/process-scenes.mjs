// process-scenes — slice full-scene world art into the 4 game surfaces.
//
// Input : sprite-sources/raw/split/L{1..9}[ ]full.png   (3 scenes per world)
//         L1-3 = world1 (sunny), L4-6 = world2 (industrial), L7-9 = world3 (neon)
// Output: public/sprites/designed/
//         strip-world{n}-{a|b|c}-left.png / -right.png   (side panels, 196w)
//         zone-world{n}-{a|b|c}.png                      (dispatch floor, 780w)
//         road-world{n}.png                              (512x512 tile + painted dash)
//
// Detection: the road is the wide vertically-uniform band around the image
// centre; the dispatch zone is the strong horizontal edge in the bottom third.
// Everything is sliced from ONE image per scene, so palette/lighting unity is
// guaranteed. Lane dashes are painted here (procedural, centred) — the AI road
// is unmarked by design.

import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';

const SRC = 'sprite-sources/raw/split';
const OUT = 'public/sprites/designed';

const SCENES = [];
for (let k = 1; k <= 9; k++) {
  const world   = k <= 3 ? 1 : k <= 6 ? 2 : 3;
  const variant = ['a', 'b', 'c'][(k - 1) % 3];
  // user saved as "L1full.png" or "L{k} full.png"
  const cands = [`L${k}full.png`, `L${k} full.png`, `L${k}.full.png`, `L${k} full .png`];
  const file = cands.map(c => path.join(SRC, c)).find(p => fs.existsSync(p));
  if (file) SCENES.push({ file, world, variant });
  else console.log(`scene L${k}: NOT FOUND, skipped`);
}

function colAt(data, info, x, y) {
  const i = (y * info.width + x) * info.channels;
  return [data[i], data[i + 1], data[i + 2]];
}
const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

for (const { file, world, variant } of SCENES) {
  const img = sharp(file);
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  // ── dispatch-zone top: biggest sustained row jump in the bottom 40% at centre ─
  const cx = Math.floor(W / 2);
  let zoneTop = Math.floor(H * 0.78), best = 0;
  for (let y = Math.floor(H * 0.60); y < H - 40; y += 2) {
    const d = dist(colAt(data, info, cx, y), colAt(data, info, cx, y + 8));
    if (d > best) { best = d; zoneTop = y + 4; }
  }

  // ── road edges: from centre outward, where columns stop matching the road tone ─
  const roadY = [0.15, 0.30, 0.45].map(f => Math.floor(zoneTop * f) + Math.floor(H * 0.05));
  const roadRef = roadY.map(y => colAt(data, info, cx, y));
  const colIsRoad = (x) => {
    let d = 0;
    for (let i = 0; i < roadY.length; i++) d += dist(colAt(data, info, x, roadY[i]), roadRef[i]);
    return d / roadY.length < 60;
  };
  let roadL = cx, roadR = cx;
  while (roadL > 10 && colIsRoad(roadL - 4)) roadL -= 4;
  while (roadR < W - 10 && colIsRoad(roadR + 4)) roadR += 4;

  console.log(`w${world}${variant}: ${W}x${H}  road x=${roadL}..${roadR}  zoneTop y=${zoneTop}`);

  // ── side strips (edge → just past the curb, full height above the zone) ──────
  const curbPad = Math.round((roadR - roadL) * 0.02);   // keep a sliver of curb
  const stripLW = roadL + curbPad;
  const stripRX = roadR - curbPad;
  await sharp(file).extract({ left: 0, top: 0, width: stripLW, height: zoneTop })
    .resize({ width: 196 }).png()
    .toFile(path.join(OUT, `strip-world${world}-${variant}-left.png`));
  await sharp(file).extract({ left: stripRX, top: 0, width: W - stripRX, height: zoneTop })
    .resize({ width: 196 }).png()
    .toFile(path.join(OUT, `strip-world${world}-${variant}-right.png`));

  // ── dispatch-zone floor (full width, includes its designed top edge) ──────────
  await sharp(file).extract({ left: 0, top: Math.max(0, zoneTop - 6), width: W, height: H - Math.max(0, zoneTop - 6) })
    .resize({ width: 780 }).png()
    .toFile(path.join(OUT, `zone-world${world}-${variant}.png`));

  // ── road tile (variant 'a' only): clean square patch + painted centre dash ───
  if (variant === 'a') {
    const patch = Math.min(roadR - roadL - 40, 420);
    const px = Math.floor((roadL + roadR) / 2 - patch / 2);
    const py = Math.floor(zoneTop * 0.45);
    const tile = await sharp(file).extract({ left: px, top: py, width: patch, height: patch })
      .resize(512, 512).png().toBuffer();
    // dash: white rounded bar, centred — Road3D's half-tile offset makes it the
    // lane divider. Sized to match the legacy road-tile.jpg dash proportions.
    const dashW = 26, dashH = 210, rx = 12;
    const dashSvg = Buffer.from(
      `<svg width="512" height="512"><rect x="${(512 - dashW) / 2}" y="${(512 - dashH) / 2}"
        width="${dashW}" height="${dashH}" rx="${rx}" fill="white" fill-opacity="0.85"/></svg>`);
    await sharp(tile).composite([{ input: dashSvg }]).png()
      .toFile(path.join(OUT, `road-world${world}.png`));
  }
}
console.log('done');
