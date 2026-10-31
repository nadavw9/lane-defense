// Wide-vehicle concept sheet (2026-10-31): the three two-lane rungs next to the normal ladder, all
// at the SAME scale, so their proportions can be judged before they go into the game.
//   BAKE_HEADED=1 STUDIO_URL=http://localhost:5174/tools/art/studio/studio.html node scripts/_wide-concept.mjs docs/review/wide-concept.png
import { chromium } from 'playwright';
import sharp from 'sharp';

const out = process.argv[2] ?? 'docs/review/wide-concept.png';
const browser = await chromium.launch({
  ...(process.env.BAKE_HEADED ? { headless: false } : {}),
  args: process.env.BAKE_HEADED ? ['--use-gl=angle', '--enable-gpu'] : ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
await page.goto(process.env.STUDIO_URL ?? 'http://localhost:5174/tools/art/studio/studio.html');
await page.waitForFunction(() => !!window.studio, null, { timeout: 60000 });
await page.waitForTimeout(800);
const decode = (url) => Buffer.from(url.split(',')[1], 'base64');
const tile = async (t, c) => decode(await page.evaluate(([t, c]) => window.studio.vehicle(t, c), [t, c]));

const row1 = [['jeep', 'Blue'], ['big', 'Blue'], ['small', 'Blue']];
const row2 = [['wide3', 'Blue'], ['wide2', 'Blue'], ['wide1', 'Blue']];
const row3 = [['wide3', 'Red'], ['wide3', 'Green'], ['wide3', 'Yellow']];
const rows = [];
for (const r of [row1, row2, row3]) {
  const bufs = [];
  for (const [t, c] of r) { const b = await tile(t, c); const m = await sharp(b).metadata(); bufs.push({ b, w: m.width, h: m.height, t }); }
  rows.push(bufs);
}
await browser.close();
const GAP = 40;
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
console.log('sheet ->', out, W + 'x' + H);
