// Rasterise the Toy Town art (tools/art/vehicles.mjs) into the shipped sprites.
//
//   node scripts/render-toy-sprites.mjs
//
// Overwrites the car and powerball sprites IN PLACE (public/sprites/designed/,
// legacy file names kept) so every consumer — road, bench, car manual, intro
// cards, title, onboarding — picks up the new art with no path changes. Prints
// the per-type table Car3D needs: image aspect (-> TYPE_DIMS.wF) and the measured
// alpha-bbox BODY_FRAC. The SVG source is the single truth — re-run after any
// art change and paste the printed table.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { vehicleSVG, bombSVG, PALETTE, VEHICLE_TYPES } from '../tools/art/vehicles.mjs';
import { roadTileSVG, vergeStripSVG, zoneFloorSVG } from '../tools/art/world1.mjs';

const OUT = 'public/sprites/designed';
// Legacy file names the game already loads (Car3D SPRITE_MAP and friends).
const FILE = {
  small: c => `bike-${c}`, big: c => `car-${c}-processed`, jeep: c => `van-${c}`,
  truck: c => `truck-${c}`, bigrig: c => `bigrig-${c}`, tank: c => `tank-${c}`,
};
const CAR_H = 384;          // px height of every vehicle image
const BOMB_PX = 256;        // matches the powerball sprites it replaces
// Replaced powerball: opaque ball ≈ 0.715 of its canvas. Ball + outline here is
// ~93 viewBox units across, so a 130-unit frame lands on the same fraction and
// the ball keeps sitting in its socket exactly as before.
const BOMB_FRAME = 130;
const COLORS = Object.keys(PALETTE);

mkdirSync(OUT, { recursive: true });

async function alphaBox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * C + 3] > 200) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return { W, H, w: (x1 - x0 + 1) / W, h: (y1 - y0 + 1) / H, cx: ((x0 + x1 + 1) / 2 - W / 2) / W };
}

const table = {};
for (const type of VEHICLE_TYPES) {
  for (const color of COLORS) {
    const svg = vehicleSVG(type, color, 'toy');
    const vbH = Number(/height="([\d.]+)"/.exec(svg)[1]);
    const buf = await sharp(Buffer.from(svg), { density: 72 * CAR_H / vbH }).png().toBuffer();
    await sharp(buf).toFile(`${OUT}/${FILE[type](color.toLowerCase())}.png`);
    if (color === 'Red') table[type] = await alphaBox(buf);
  }
}
for (const color of COLORS) {
  const svg = bombSVG(color, null, 'toy', { size: BOMB_PX, frame: BOMB_FRAME });
  await sharp(Buffer.from(svg)).resize(BOMB_PX, BOMB_PX).png().toFile(`${OUT}/powerball-${color.toLowerCase()}.png`);
}

// World 1 scenery (L1-15): road tile, verge strips per scene variant, dispatch floor.
const png = (svg, file) => sharp(Buffer.from(svg)).png().toFile(`${OUT}/${file}`);
await png(roadTileSVG(), 'road-world1.png');
for (const [i, v] of ['', '-a', '-b', '-c'].entries()) {
  for (const side of ['left', 'right']) await png(vergeStripSVG(side, i + 1), `strip-world1${v}-${side}.png`);
  if (v) await png(zoneFloorSVG(), `zone-world1${v}.png`);
}

console.log('type    img WxH    aspect  body.w  body.h  body.cx');
for (const [t, b] of Object.entries(table)) {
  console.log(`${t.padEnd(7)} ${String(b.W).padStart(4)}x${b.H}  ${(b.W / b.H).toFixed(3)}   ${b.w.toFixed(3)}   ${b.h.toFixed(3)}   ${b.cx.toFixed(3)}`);
}
