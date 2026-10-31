// Connected-pair concept sheet (2026-10-31): the bridged pair baked as ONE 3D sprite, several joint
// designs x (car+car at lane pitch | car+car pulled half-way | van+bike at lane pitch), same scale.
//   BAKE_HEADED=1 STUDIO_URL=http://localhost:5174/tools/art/studio/studio.html node scripts/_pair-concept.mjs docs/review/pair-concept.png
//   JOINTS=clamp,frame  (default: every joint the studio knows)
import { chromium } from 'playwright';
import sharp from 'sharp';

const out = process.argv[2] ?? 'docs/review/pair-concept.png';
const browser = await chromium.launch({
  ...(process.env.BAKE_HEADED ? { headless: false } : {}),
  args: process.env.BAKE_HEADED ? ['--use-gl=angle', '--enable-gpu'] : ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
page.on('pageerror', e => console.log('pageerror', e.message));
await page.goto(process.env.STUDIO_URL ?? 'http://localhost:5174/tools/art/studio/studio.html');
await page.waitForFunction(() => !!window.studio, null, { timeout: 60000 });
await page.waitForTimeout(800);
const decode = (url) => Buffer.from(url.split(',')[1], 'base64');
const tile = async (a) => decode((await page.evaluate((a) => window.studio.pair(...a), a)).url);

const joints = process.env.JOINTS ? process.env.JOINTS.split(',') : await page.evaluate(() => window.studio.joints);
const cols = [
  ['big', 'big', 'Blue', { pull: 0 }],
  ['big', 'big', 'Blue', { pull: 0.5 }],
  ['jeep', 'small', 'Blue', { pull: 0 }],
];
const rows = [];
for (const j of joints) {
  const bufs = [];
  for (const [l, r, c, o] of cols) { const b = await tile([l, r, c, { ...o, joint: j }]); const m = await sharp(b).metadata(); bufs.push({ b, w: m.width, h: m.height }); }
  rows.push(bufs);
}
await browser.close();
const GAP = 36;
const W = Math.max(...rows.map(r => r.reduce((a, x) => a + x.w, 0) + GAP * (r.length + 1)));
const rowH = rows.map(r => Math.max(...r.map(x => x.h)));
const H = rowH.reduce((a, h) => a + h, 0) + GAP * (rows.length + 1);
const comps = [];
let y = GAP;
rows.forEach((r, i) => {
  let x = GAP;
  for (const t of r) { comps.push({ input: t.b, left: x, top: y + Math.round((rowH[i] - t.h) / 2) }); x += t.w + GAP; }
  y += rowH[i] + GAP;
});
await sharp({ create: { width: W, height: H, channels: 4, background: '#4B4E5A' } }).composite(comps).png().toFile(out);
console.log('sheet ->', out, W + 'x' + H, 'joints:', joints.join(','));
