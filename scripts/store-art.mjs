// Store art: Play screenshots (1080x1920) and the feature graphic (1024x500), composed from real
// game captures (DPR 3) in an HTML template and rendered with Playwright, so the captions use the
// game's own fonts (Lilita One / Fredoka).
//
//   node scripts/store-art.mjs <rawDir> <outDir> [ios]   (CHROME_PATH optional: a Chromium binary)
// `ios` writes appstore-iphone-N.png at 1320x2868 (App Store 6.9" iPhone) instead of the Play set.
// rawDir holds s0-title.png, s1-l12.png ... s8-l88.png (390x844 stage at DPR 3).
import { chromium } from 'playwright';
import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const [rawDir, outDir] = process.argv.slice(2).map(p => resolve(p));
mkdirSync(outDir, { recursive: true });
const font = (f) => `data:font/woff2;base64,${readFileSync(resolve('node_modules/@fontsource', f)).toString('base64')}`;
const img = (f) => `data:image/png;base64,${readFileSync(resolve(rawDir, f)).toString('base64')}`;
const FONTS = `
@font-face { font-family: Lilita; src: url(${font('lilita-one/files/lilita-one-latin-400-normal.woff2')}) format('woff2'); }
@font-face { font-family: Fredoka; font-weight: 700; src: url(${font('fredoka/files/fredoka-latin-700-normal.woff2')}) format('woff2'); }`;

// [file, headline (gold words in *stars*), sub line, background top, background bottom]
const SHOTS = [
  ['s1-l12.png', 'Match the color, *drop the bomb!*', 'One drag. One boom.', '#3B2580', '#160F3A'],
  ['s2-l35.png', 'Beat the *traffic lights*', 'Red holds a lane. Plan your shots.', '#24124F', '#07051A'],
  ['s3-l23.png', 'Gift cars drop *free boosters*', 'Destroy the cars with a bow!', '#2E5A1E', '#10240C'],
  ['s4-l55.png', '*200 levels* to beat', 'From Toy Town to the Starlight Strip and back', '#7A4A12', '#2A1606'],
  ['s5-l65.png', 'Special cars *change the rules*', 'Speeders, armor, chameleons and more', '#1E4A7A', '#0A1A30'],
  ['s6-map.png', 'Repair *your city*', 'Every win rebuilds a building', '#2A2458', '#100C2A'],
  ['s7-win.png', 'Win streaks = *free boosters*', 'Daily rewards and trophies too', '#5A1E6E', '#1E0A28'],
  ['s8-l88.png', 'Stop the jam *before it breaks through*', 'No timers. Think as long as you like.', '#123E4A', '#05161C'],
];

const caption = (t) => t.replace(/\*(.+?)\*/g, '<b>$1</b>');

// Layout per store. Play: 1080x1920 at 1x. App Store 6.9" iPhone: 1320x2868, drawn on a 1080-wide
// canvas 2347 tall at DPR 1320/1080, so the type keeps the Play proportions and the phone grows.
const LAYOUT = {
  play: { h: 1920, h1: 70, sub: 300, phoneTop: 400, phoneW: 690, scale: 1 },
  ios:  { h: 2347, h1: 96, sub: 330, phoneTop: 440, phoneW: 840, scale: 1320 / 1080 },
};
const MODE = process.argv[4] === 'ios' ? 'ios' : 'play';
const L = LAYOUT[MODE];

function shotPage([file, head, sub, c1, c2]) {
  const phoneH = Math.round(L.phoneW * 844 / 390);
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}
  html,body{margin:0;width:1080px;height:${L.h}px;overflow:hidden}
  body{background:radial-gradient(ellipse at 50% 38%, ${c1} 0%, ${c2} 72%);font-family:Lilita,sans-serif;position:relative}
  .rays{position:absolute;inset:0;background:repeating-conic-gradient(from 0deg at 50% 62%, rgba(255,255,255,.06) 0 6deg, transparent 6deg 18deg)}
  h1{position:absolute;top:${L.h1}px;left:60px;right:60px;margin:0;text-align:center;color:#fff;font-size:92px;line-height:1.02;font-weight:400;
     -webkit-text-stroke:5px #1F1A33;paint-order:stroke fill;text-shadow:0 8px 0 #1F1A33;letter-spacing:.5px}
  h1 b{color:#FFD42A;font-weight:400}
  p{position:absolute;top:${L.sub}px;left:0;right:0;margin:0;text-align:center;color:#E9E4FF;font:700 44px Fredoka,sans-serif}
  .phone{position:absolute;left:50%;top:${L.phoneTop}px;width:${L.phoneW}px;height:${phoneH}px;transform:translateX(-50%);border-radius:64px;
     border:12px solid #1F1A33;box-shadow:0 26px 0 rgba(0,0,0,.35),0 0 0 6px rgba(255,255,255,.12);overflow:hidden;background:#000}
  .phone img{width:100%;height:100%;object-fit:cover;object-position:top}
  </style></head><body><div class="rays"></div>
  <h1>${caption(head)}</h1><p>${sub}</p><div class="phone"><img src="${img(file)}"></div></body></html>`;
}

const sprite = (f) => `data:image/png;base64,${readFileSync(resolve('public/sprites', f)).toString('base64')}`;

// Feature graphic: the wordmark is set in type (the game's own Lilita One), not cropped from the
// low-res title sprite, so it stays sharp at 1024x500.
function featurePage() {
  const bombs = ['red', 'blue', 'green', 'yellow'];
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}
  html,body{margin:0;width:1024px;height:500px;overflow:hidden}
  body{position:relative;background:radial-gradient(ellipse at 30% 45%, #5A34B8 0%, #241663 45%, #110A30 85%);font-family:Lilita,sans-serif}
  .rays{position:absolute;inset:0;background:repeating-conic-gradient(from 0deg at 30% 42%, rgba(255,255,255,.07) 0 6deg, transparent 6deg 18deg)}
  .boom{position:absolute;left:150px;top:-10px;width:330px;height:330px;opacity:.9;filter:drop-shadow(0 0 30px rgba(255,170,40,.6))}
  .title{position:absolute;left:44px;top:70px;width:560px;text-align:center}
  .w{display:block;font-size:132px;line-height:.9;letter-spacing:2px;color:#FFD42A;
     background:linear-gradient(#FFF27A 0%, #FFD42A 40%, #FF8A1C 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
     -webkit-text-stroke:0;filter:drop-shadow(0 7px 0 #1F1A33)}
  .w.s{position:absolute;left:0;right:0;-webkit-text-fill-color:#1F1A33;background:none;-webkit-text-stroke:16px #1F1A33;filter:none}
  .w2{font-size:150px;color:#FF3D3D;background:linear-gradient(#FF8A8A 0%, #FF3D3D 45%, #C81E2E 100%);-webkit-background-clip:text;background-clip:text}
  .tag{position:absolute;left:44px;width:560px;top:372px;text-align:center;color:#fff;font:700 34px Fredoka,sans-serif;text-shadow:0 3px 0 #1F1A33}
  .tag b{color:#FFD42A}
  .bombs{position:absolute;left:150px;top:418px;display:flex;gap:26px}
  .bombs img{height:70px;filter:drop-shadow(0 4px 0 rgba(0,0,0,.35))}
  .play{position:absolute;right:52px;top:-34px;width:330px;height:714px;transform:rotate(6deg);border-radius:40px;border:10px solid #1F1A33;
     box-shadow:0 20px 0 rgba(0,0,0,.35),0 0 0 5px rgba(255,255,255,.14);overflow:hidden}
  .play img{width:100%;height:100%;object-fit:cover;object-position:top}
  </style></head><body><div class="rays"></div>
  <img class="boom" src="${sprite('designed/explosion.png')}">
  <div class="title">
    <span class="w s" style="top:0">TRAFFIC</span><span class="w">TRAFFIC</span>
    <span class="w s w2" style="top:118px">BOMB</span><span class="w w2">BOMB</span>
  </div>
  <div class="tag">Match the color, <b>drop the bomb!</b></div>
  <div class="bombs">${bombs.map(c => `<img src="${sprite(`designed/powerball-${c}.png`)}">`).join('')}</div>
  <div class="play"><img src="${img('s1-l12.png')}"></div></body></html>`;
}

const b = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const page = await b.newPage({ viewport: { width: 1080, height: L.h }, deviceScaleFactor: L.scale });
let n = 0;
for (const s of SHOTS) {
  if (!existsSync(resolve(rawDir, s[0]))) { console.log('missing', s[0]); continue; }
  await page.setContent(shotPage(s), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  if (MODE === 'ios') {
    // Apple wants exactly 1320x2868 (the DPR rounding can land a pixel off), opaque.
    const buf = await page.screenshot();
    await sharp(buf).resize(1320, 2868, { fit: 'fill' }).removeAlpha().png().toFile(resolve(outDir, `appstore-iphone-${++n}.png`));
  } else {
    await page.screenshot({ path: resolve(outDir, `screenshot-${++n}.png`) });
  }
  console.log('screenshot', n, s[0]);
}
if (MODE === 'play' && existsSync(resolve(rawDir, 's0-title.png'))) {
  await page.setViewportSize({ width: 1024, height: 500 });
  await page.setContent(featurePage(), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(outDir, 'feature-graphic.png') });
  console.log('feature graphic');
}
await b.close();
