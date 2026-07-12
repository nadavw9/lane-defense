// measure-car-bbox — regenerates the BODY_FRAC table in src/renderer3d/Car3D.js.
//
// Measures each car sprite's alpha bounding box (the VISIBLE body, ignoring the
// transparent padding, which varies wildly across the set: the sedan body is only
// 78% of its image height while the tank fills ~99%). Car3D derives each type's
// render scale from these fractions so the body — not the padded image — is
// normalized to the projected row pitch (no lane-neighbour touching), and centers
// the body on the lane via the measured cx offset.
//
// Measures the RED variant of each type; scripts/normalize-car-variants.mjs
// re-frames all other colors to red's framing, so red stands for the whole set.
// Run after ANY car art change:  node scripts/normalize-car-variants.mjs
// then:  node scripts/measure-car-bbox.mjs  → copy the table into Car3D.js BODY_FRAC.
import sharp from 'sharp';

const SPRITES = {
  small:  'bike-red.png',
  big:    'car-red-processed.png',
  jeep:   'van-red.png',
  truck:  'truck-red.png',
  bigrig: 'bigrig-red.png',
  tank:   'tank-red.png',
};
const ALPHA_THRESHOLD = 16;   // ignore near-transparent halo pixels

console.log('const BODY_FRAC = {');
for (const [type, file] of Object.entries(SPRITES)) {
  const img = sharp(new URL(`../public/sprites/designed/${file}`, import.meta.url).pathname.slice(1))
    .ensureAlpha();
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
  console.log(`  ${type.padEnd(6)}: { w: ${w}, h: ${h}, cx: ${cx.startsWith('-') ? cx : ' ' + cx} },   // ${file}`);
}
console.log('};');
