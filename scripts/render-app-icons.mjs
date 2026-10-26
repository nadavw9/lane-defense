// App icon, adaptive icon layers, splash screens and the 512 px store icon.
// Design R1 (owner-picked 2026-10-18): a toy car flung out of a comic BOOM by a red bomb,
// over a lane of the game's road (grass verges, lane dashes, the red-white breach line).
// The 3D subject comes from the sprite studio (appIconConcept 'jump', no face); the road
// is drawn here so the adaptive icon can keep it as its own background layer.
//
//   node scripts/render-app-icons.mjs        (needs a Vite dev server serving the studio;
//                                             STUDIO_URL overrides the default :5173)
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

const RES = 'android/app/src/main/res';
const URL = process.env.STUDIO_URL ?? 'http://localhost:5173/tools/art/studio/studio.html';
const GRASS = '#7ED957';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
page.on('pageerror', e => console.error('PAGEERROR', e.message));
await page.goto(URL);
await page.waitForFunction(() => window.studio?.ready, null, { timeout: 90000 });
const url = await page.evaluate(() => window.studio.appIconConcept('jump', { px: 1024, faces: false }));
await browser.close();
const car = Buffer.from(url.split(',')[1], 'base64');

// Subject = the BOOM behind the car-and-bomb render, on a transparent square.
const SUB = 1024;
const subject = await sharp({ create: { width: SUB, height: SUB, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([
    { input: await sharp('public/sprites/designed/explosion.png').resize(Math.round(SUB * 0.78)).toBuffer(), left: Math.round(SUB * 0.22), top: Math.round(SUB * -0.03) },
    { input: car, left: 0, top: 0 },
  ]).png().toBuffer();

// The lane: vertical road with yellow edges, white lane dashes, the breach line near the
// bottom, grass and round trees on the verges, a soft vignette. `w`×`h` any size.
function roadSVG(w, h, { radius = 0, vignette = true } = {}) {
  const u = Math.min(w, h) / 512;                     // drawn on a 512 grid, scaled
  const cx = w / 2, half = 186 * u;
  const dashes = [-1, 1].map(k => Array.from({ length: Math.ceil(h / (90 * u)) + 1 }, (_, i) =>
    `<rect x="${cx + k * 62 * u - 5 * u}" y="${-40 * u + i * 90 * u}" width="${10 * u}" height="${48 * u}" rx="${4 * u}" fill="#FFFFFF" opacity=".85"/>`).join('')).join('');
  const hy = h - 102 * u;
  const hazard = Array.from({ length: 12 }, (_, i) =>
    `<rect x="${cx - half + i * 31 * u}" y="${hy}" width="${31 * u}" height="${26 * u}" fill="${i % 2 ? '#FFFFFF' : '#FF3D3D'}"/>`).join('');
  const treeRows = Math.ceil(h / (120 * u));
  const trees = Array.from({ length: treeRows * 2 }, (_, i) => {
    const left = i % 2 === 0, row = Math.floor(i / 2);
    const x = left ? cx - half - 50 * u + (row % 2) * 14 * u : cx + half + 50 * u - (row % 2) * 14 * u;
    const y = 70 * u + row * 120 * u + (left ? 0 : 55 * u);
    return `<circle cx="${x}" cy="${y}" r="${30 * u}" fill="#2FA84F"/><circle cx="${x - 8 * u}" cy="${y - 9 * u}" r="${15 * u}" fill="#5FD27A"/>`;
  }).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><clipPath id="c"><rect width="${w}" height="${h}" rx="${radius}"/></clipPath>
      <radialGradient id="v" cx=".5" cy=".45" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></radialGradient></defs>
    <g clip-path="url(#c)"><rect width="${w}" height="${h}" fill="${GRASS}"/>
      <rect x="${cx - half - 14 * u}" y="0" width="${(half + 14 * u) * 2}" height="${h}" fill="#E9E3D2"/>
      <rect x="${cx - half}" y="0" width="${half * 2}" height="${h}" fill="#4A4E62"/>
      <rect x="${cx - half}" y="0" width="${8 * u}" height="${h}" fill="#FFD42A"/><rect x="${cx + half - 8 * u}" y="0" width="${8 * u}" height="${h}" fill="#FFD42A"/>
      ${dashes}${hazard}${trees}
      ${vignette ? `<rect width="${w}" height="${h}" fill="url(#v)"/>` : ''}</g></svg>`);
}

async function tile(size, frac, { radius = 0, circle = false } = {}) {
  const s = Math.round(size * frac);
  let buf = await sharp(roadSVG(size, size, { radius }))
    .composite([{ input: await sharp(subject).resize(s, s).toBuffer(), left: Math.round((size - s) / 2), top: Math.round((size - s) / 2) }])
    .png().toBuffer();
  if (circle) {
    const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`);
    buf = await sharp(buf).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  }
  return buf;
}

// iOS (`node scripts/render-app-icons.mjs ios` writes only these): the 1024 App Store / home-screen
// icon (opaque: Apple rejects an icon with an alpha channel; iOS rounds the corners itself) and
// the 2732 square launch image, shown aspect-fill, so the subject sits well inside the centre
// strip a portrait phone actually shows (~46% of the width).
const IOS = 'ios/App/App/Assets.xcassets';
async function writeIos() {
  const icon = await sharp(await tile(1024, 0.8)).flatten({ background: GRASS }).removeAlpha().png().toBuffer();
  await sharp(icon).toFile(`${IOS}/AppIcon.appiconset/AppIcon-512@2x.png`);
  const S = 2732, sub = Math.round(S * 0.40);
  const splash = await sharp(roadSVG(S, S, { vignette: false }))
    .composite([{ input: await sharp(subject).resize(sub, sub).toBuffer(), left: Math.round((S - sub) / 2), top: Math.round((S - sub) / 2) }])
    .flatten({ background: GRASS }).removeAlpha().png().toBuffer();
  for (const f of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) await sharp(splash).toFile(`${IOS}/Splash.imageset/${f}`);
}
if (process.argv[2] === 'ios') {
  await writeIos();
  console.log('iOS app icon and launch images written');
  process.exit(0);
}

const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(DENS)) {
  const legacy = Math.round(48 * k), fg = Math.round(108 * k);
  await sharp(await tile(legacy, 0.82, { radius: legacy * 0.22 })).toFile(`${RES}/mipmap-${d}/ic_launcher.png`);
  await sharp(await tile(legacy, 0.76, { circle: true })).toFile(`${RES}/mipmap-${d}/ic_launcher_round.png`);
  // Adaptive layers: the lane is the background, the car + boom the foreground, kept inside
  // the 66/108 safe zone so no launcher mask cuts it.
  await sharp(roadSVG(fg, fg, { vignette: false })).png().toFile(`${RES}/mipmap-${d}/ic_launcher_background.png`);
  const s = Math.round(fg * 0.66);
  await sharp({ create: { width: fg, height: fg, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp(subject).resize(s, s).toBuffer(), left: Math.round((fg - s) / 2), top: Math.round((fg - s) / 2) }])
    .png().toFile(`${RES}/mipmap-${d}/ic_launcher_foreground.png`);
}
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>`;
writeFileSync(`${RES}/mipmap-anydpi-v26/ic_launcher.xml`, adaptive);
writeFileSync(`${RES}/mipmap-anydpi-v26/ic_launcher_round.xml`, adaptive);
// Kept for anything that still names the colour (e.g. a themed-icon fallback): the grass.
writeFileSync(`${RES}/values/ic_launcher_background.xml`,
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${GRASS}</color>\n</resources>\n`);

// Splash screens: the lane runs the full height, the subject centred at 66% of the short side.
const SPLASH = [
  ['drawable', 480, 320], ['drawable-land-mdpi', 480, 320], ['drawable-land-hdpi', 800, 480],
  ['drawable-land-xhdpi', 1280, 720], ['drawable-land-xxhdpi', 1600, 960], ['drawable-land-xxxhdpi', 1920, 1280],
  ['drawable-port-mdpi', 320, 480], ['drawable-port-hdpi', 480, 800], ['drawable-port-xhdpi', 720, 1280],
  ['drawable-port-xxhdpi', 960, 1600], ['drawable-port-xxxhdpi', 1280, 1920],
];
for (const [dir, w, h] of SPLASH) {
  const s = Math.round(Math.min(w, h) * 0.66);
  await sharp(roadSVG(w, h)).composite([{ input: await sharp(subject).resize(s, s).toBuffer(), left: Math.round((w - s) / 2), top: Math.round((h - s) / 2) }])
    .png().toFile(`${RES}/${dir}/splash.png`);
}

// Play Store listing icon: 512 × 512, full bleed (the store applies its own mask).
mkdirSync('store', { recursive: true });
const store = await tile(512, 0.8);
await sharp(store).toFile('store/icon-512.png');
await sharp(store).toFile('docs/store/art/icon-512.png');
// The title screen and the in-game splash reuse the subject (public, served by Vite).
await sharp(subject).resize(512, 512).png().toFile('public/sprites/designed/app-hero.png');
await writeIos();
console.log('icons, adaptive layers, splash screens, store icon, app-hero.png and the iOS icon + launch images written');
