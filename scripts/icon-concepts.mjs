// App-icon concept sheet (2026-10-18). Renders the studio's appIconConcept subjects onto
// bright tiles and lays them out next to the current icon, big and at launcher size.
//   node scripts/icon-concepts.mjs <out.png>   (dev server must serve /tools/art/studio)
import { chromium } from 'playwright';
import sharp from 'sharp';

const URL = process.env.STUDIO_URL ?? 'http://localhost:5176/tools/art/studio/studio.html';
const out = process.argv[2] ?? 'icon-concepts.png';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage();
p.on('pageerror', e => console.error('PAGEERROR', e.message));
await p.goto(URL);
await p.waitForFunction(() => window.studio?.ready, null, { timeout: 90000 });
const FACES = process.env.FACES !== '0';
const subj = {};
for (const n of ['mascot', 'lineup', 'jump']) {
  const u = await p.evaluate(([n, faces]) => window.studio.appIconConcept(n, { px: 1024, faces }), [n, FACES]);
  subj[n] = Buffer.from(u.split(',')[1], 'base64');
}
await b.close();

const S = 512;
const rays = (n, color, op, cx = S / 2, cy = S / 2) => Array.from({ length: n }, (_, i) => {
  const a0 = (i / n) * Math.PI * 2, a1 = a0 + Math.PI / n, r = S * 1.2;
  return `<path d="M${cx} ${cy} L${cx + Math.cos(a0) * r} ${cy + Math.sin(a0) * r} L${cx + Math.cos(a1) * r} ${cy + Math.sin(a1) * r} Z" fill="${color}" opacity="${op}"/>`;
}).join('');
const BG = {
  mascot: `<radialGradient id="g" cx=".5" cy=".45" r=".7"><stop offset="0" stop-color="#FFF3A6"/><stop offset=".55" stop-color="#FFC93C"/><stop offset="1" stop-color="#FF8A1C"/></radialGradient>`,
  lineup: `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7FE0FF"/><stop offset="1" stop-color="#2F8CFF"/></linearGradient>`,
  jump:   `<radialGradient id="g" cx=".55" cy=".4" r=".75"><stop offset="0" stop-color="#FFE7F2"/><stop offset=".5" stop-color="#FF7EB6"/><stop offset="1" stop-color="#A35CFF"/></radialGradient>`,
};
const extra = {
  mascot: rays(20, '#FFFFFF', 0.22, S / 2, S * 0.46),
  lineup: rays(16, '#FFFFFF', 0.16, S / 2, S * 0.62),
  jump:   rays(18, '#FFFFFF', 0.2, S * 0.55, S * 0.4) + [[60, 80, '#FFD42A'], [440, 110, '#2FCC55'], [80, 420, '#2F8CFF'], [430, 430, '#FFD42A'], [250, 60, '#FFFFFF']]
    .map(([x, y, c]) => `<path d="M${x} ${y - 16} L${x + 5} ${y - 5} L${x + 16} ${y} L${x + 5} ${y + 5} L${x} ${y + 16} L${x - 5} ${y + 5} L${x - 16} ${y} L${x - 5} ${y - 5} Z" fill="${c}" opacity=".9"/>`).join(''),
};

// Road tiles (owner, 2026-10-18: "I want the lane in the picture"). Grass verges, a road with
// lane dashes and the red-white breach stripe, like the board.
const roadSvg = (angle) => {
  const trees = [[52, 70], [70, 300], [40, 440], [455, 120], [470, 360], [440, 470], [60, 190], [462, 240]]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="30" fill="#2FA84F"/><circle cx="${x - 8}" cy="${y - 9}" r="15" fill="#5FD27A"/>`).join('');
  const dashes = [-1, 1].map(k => Array.from({ length: 8 }, (_, i) => `<rect x="${S / 2 + k * 62 - 5}" y="${-40 + i * 90}" width="10" height="48" rx="4" fill="#FFFFFF" opacity=".85"/>`).join('')).join('');
  const hazard = Array.from({ length: 12 }, (_, i) => `<rect x="${S / 2 - 186 + i * 31}" y="${S * 0.8}" width="31" height="26" fill="${i % 2 ? '#FFFFFF' : '#FF3D3D'}"/>`).join('');
  return `<rect width="${S}" height="${S}" fill="#7ED957"/>
    <g transform="rotate(${angle} ${S / 2} ${S / 2})">
      <rect x="${S / 2 - 200}" y="-200" width="400" height="${S + 400}" fill="#E9E3D2"/>
      <rect x="${S / 2 - 186}" y="-200" width="372" height="${S + 400}" fill="#4A4E62"/>
      <rect x="${S / 2 - 186}" y="-200" width="8" height="${S + 400}" fill="#FFD42A"/><rect x="${S / 2 + 178}" y="-200" width="8" height="${S + 400}" fill="#FFD42A"/>
      ${dashes}${hazard}${trees}
    </g>
    <radialGradient id="v" cx=".5" cy=".45" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></radialGradient>
    <rect width="${S}" height="${S}" fill="url(#v)"/>`;
};
BG.road = `<linearGradient id="g"><stop stop-color="#7ED957"/></linearGradient>`; extra.road = roadSvg(0);
BG.roadTilt = BG.road; extra.roadTilt = roadSvg(-24);

async function tile(n, bg = n) {
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><defs>${BG[bg]}<clipPath id="c"><rect width="${S}" height="${S}" rx="${S * 0.22}"/></clipPath></defs><g clip-path="url(#c)"><rect width="${S}" height="${S}" fill="url(#g)"/>${extra[bg]}</g></svg>`);
  const layers = [];
  if (n === 'jump') {
    const boom = await sharp('public/sprites/designed/explosion.png').resize(Math.round(S * 0.62)).toBuffer();
    layers.push({ input: boom, left: Math.round(S * 0.3), top: Math.round(S * 0.08) });
  }
  const frac = n === 'lineup' ? 0.86 : 0.8;
  const sub = await sharp(subj[n]).resize(Math.round(S * frac)).toBuffer();
  layers.push({ input: sub, left: Math.round(S * (1 - frac) / 2), top: Math.round(S * (1 - frac) / 2 - (n === 'lineup' ? S * 0.03 : 0)) });
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><rect width="${S}" height="${S}" rx="${S * 0.22}"/></svg>`);
  const img = await sharp(svg).composite(layers).png().toBuffer();
  return sharp(img).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}
const cur = await sharp('docs/store/art/icon-512.png').resize(S).composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><rect width="${S}" height="${S}" rx="${S * 0.22}"/></svg>`), blend: 'dest-in' }]).png().toBuffer();
const SET = FACES
  ? [['mascot', 'mascot', 'A  Happy bomb'], ['lineup', 'lineup', 'B  Bomb + traffic'], ['jump', 'jump', 'C  Boom jump']]
  : process.env.ROAD ? [['jump', 'road', 'R1  Straight lane'], ['jump', 'roadTilt', 'R2  Tilted lane'], ['lineup', 'road', 'R3  Traffic on the lane']]
  : [['jump', 'jump', 'C1  Boom, pink'], ['jump', 'lineup', 'C2  Boom, sky'], ['jump', 'mascot', 'C3  Boom, sunny']];
const tiles = [cur];
for (const [n, bg] of SET) tiles.push(await tile(n, bg));
const names = ['NOW', ...SET.map(x => x[2])];
const W = 4 * 300 + 5 * 30, H = 300 + 150 + 120;
const comps = [];
for (let i = 0; i < 4; i++) {
  const x = 30 + i * 330;
  comps.push({ input: await sharp(tiles[i]).resize(300).toBuffer(), left: x, top: 60 });
  comps.push({ input: await sharp(tiles[i]).resize(96).toBuffer(), left: x + 40, top: 400 });
  comps.push({ input: await sharp(tiles[i]).resize(64).toBuffer(), left: x + 160, top: 416 });
  comps.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="40"><text x="150" y="28" font-family="sans-serif" font-size="24" font-weight="700" text-anchor="middle" fill="#222">${names[i]}</text></svg>`), left: x, top: 10 });
}
comps.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="40"><text x="30" y="26" font-family="sans-serif" font-size="18" fill="#555">launcher size (96 px / 64 px):</text></svg>`), left: 0, top: 365 });
await sharp({ create: { width: W, height: H, channels: 3, background: '#F4F1EA' } }).composite(comps).png().toFile(out);
for (const [i, x] of SET.entries()) await sharp(tiles[i + 1]).toFile(out.replace(/\.png$/, `-${i + 1}.png`));
console.log('wrote', out);
