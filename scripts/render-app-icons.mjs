// App icon, adaptive icon layers, splash screens and the 512 px store icon,
// all from the sprite studio's appIcon subject (same art as the game).
//
//   node scripts/render-app-icons.mjs        (needs the Vite dev server on :5173)
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

const RES = 'android/app/src/main/res';
const PLUM = '#3A3550';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
page.on('pageerror', e => console.error('PAGEERROR', e.message));
await page.goto('http://localhost:5173/tools/art/studio/studio.html');
await page.waitForFunction(() => window.studio?.ready, null, { timeout: 60000 });
const url = await page.evaluate(() => window.studio.appIcon({ px: 1024 }));
await browser.close();
const subject = Buffer.from(url.split(',')[1], 'base64');

// Plum tile with a soft glow and faint sunburst behind the subject.
function tileSVG(size, radius = 0) {
  const rays = Array.from({ length: 16 }, (_, i) => {
    const a0 = (i / 16) * Math.PI * 2, a1 = a0 + Math.PI / 16, r = size;
    const c = size / 2;
    return `<path d="M${c} ${c} L${c + Math.cos(a0) * r} ${c + Math.sin(a0) * r} L${c + Math.cos(a1) * r} ${c + Math.sin(a1) * r} Z" fill="#FFD42A" opacity=".07"/>`;
  }).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs>
      <radialGradient id="g" cx=".5" cy=".45" r=".65"><stop offset="0" stop-color="#5C5290"/><stop offset="1" stop-color="#2C2742"/></radialGradient>
      <clipPath id="c"><rect width="${size}" height="${size}" rx="${radius}"/></clipPath>
    </defs>
    <g clip-path="url(#c)"><rect width="${size}" height="${size}" fill="url(#g)"/>${rays}</g></svg>`);
}

async function onTile(size, subjectFrac, { radius = 0, circle = false } = {}) {
  const s = Math.round(size * subjectFrac);
  const subj = await sharp(subject).resize(s, s).toBuffer();
  let img = sharp(tileSVG(size, radius)).composite([{ input: subj, left: Math.round((size - s) / 2), top: Math.round((size - s) / 2) }]);
  let buf = await img.png().toBuffer();
  if (circle) {
    const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`);
    buf = await sharp(buf).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  }
  return buf;
}

const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(DENS)) {
  const legacy = Math.round(48 * k), fg = Math.round(108 * k);
  await sharp(await onTile(legacy, 0.86, { radius: legacy * 0.22 })).toFile(`${RES}/mipmap-${d}/ic_launcher.png`);
  await sharp(await onTile(legacy, 0.8, { circle: true })).toFile(`${RES}/mipmap-${d}/ic_launcher_round.png`);
  // Adaptive foreground: subject inside the central 66/108 safe zone, transparent.
  const s = Math.round(fg * 0.6);
  await sharp({ create: { width: fg, height: fg, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp(subject).resize(s, s).toBuffer(), left: Math.round((fg - s) / 2), top: Math.round((fg - s) / 2) }])
    .png().toFile(`${RES}/mipmap-${d}/ic_launcher_foreground.png`);
}
writeFileSync(`${RES}/values/ic_launcher_background.xml`,
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${PLUM}</color>\n</resources>\n`);

// Splash screens: plum field, the subject centred at 42% of the short side.
const SPLASH = [
  ['drawable', 480, 320], ['drawable-land-mdpi', 480, 320], ['drawable-land-hdpi', 800, 480],
  ['drawable-land-xhdpi', 1280, 720], ['drawable-land-xxhdpi', 1600, 960], ['drawable-land-xxxhdpi', 1920, 1280],
  ['drawable-port-mdpi', 320, 480], ['drawable-port-hdpi', 480, 800], ['drawable-port-xhdpi', 720, 1280],
  ['drawable-port-xxhdpi', 960, 1600], ['drawable-port-xxxhdpi', 1280, 1920],
];
for (const [dir, w, h] of SPLASH) {
  const s = Math.round(Math.min(w, h) * 0.42);
  const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><radialGradient id="g" cx=".5" cy=".5" r=".7"><stop offset="0" stop-color="#4A4270"/><stop offset="1" stop-color="#2C2742"/></radialGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/></svg>`);
  await sharp(bg).composite([{ input: await sharp(subject).resize(s, s).toBuffer(), left: Math.round((w - s) / 2), top: Math.round((h - s) / 2) }])
    .png().toFile(`${RES}/${dir}/splash.png`);
}

// Play Store listing icon: 512 × 512, full bleed (the store applies its own mask).
mkdirSync('store', { recursive: true });
await sharp(await onTile(512, 0.86)).toFile('store/icon-512.png');
console.log('icons, adaptive layers, splash screens and store/icon-512.png written');
