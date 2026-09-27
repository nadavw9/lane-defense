// Bake the 3D toy vehicles and bombs (tools/art/studio) into the game sprites.
//
//   node scripts/render-3d-sprites.mjs sheet <out.png>   contact sheet only
//   node scripts/render-3d-sprites.mjs verges <out.png>  verge preview only
//   node scripts/render-3d-sprites.mjs ship              overwrite game sprites
//   node scripts/render-3d-sprites.mjs scenery           overwrite verge strips
//
// Needs the Vite dev server on :5173 (it serves and bundles the studio page).
// `ship` overwrites the legacy file names in public/sprites/designed/ so every
// consumer picks the art up unchanged, and GENERATES src/renderer3d/
// carSpriteGeometry.js (aspect + measured body bbox) for Car3D. `scenery`
// writes the side-verge strips for every world and scene variant.
import { chromium } from 'playwright';
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const [mode = 'sheet', outArg] = process.argv.slice(2);
const OUT = 'public/sprites/designed';
const FILE = {
  small: c => `bike-${c}`, big: c => `car-${c}-processed`, jeep: c => `van-${c}`,
  truck: c => `truck-${c}`, bigrig: c => `bigrig-${c}`, tank: c => `tank-${c}`,
};

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
page.on('pageerror', e => console.error('PAGEERROR', e.message));
await page.goto('http://localhost:5173/tools/art/studio/studio.html');
await page.waitForFunction(() => window.studio?.ready, null, { timeout: 60000 });
const { types, colors } = await page.evaluate(() => ({ types: window.studio.types, colors: window.studio.colors }));

const decode = (url) => Buffer.from(url.split(',')[1], 'base64');
const vehicle = async (t, c) => decode(await page.evaluate(([t, c]) => window.studio.vehicle(t, c), [t, c]));
const bomb = async (c) => decode(await page.evaluate((c) => window.studio.bomb(c), c));

async function alphaBox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  // > 200: the solid body + outline, not the soft shadow (which peaks near 80).
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * C + 3] > 200) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return { W, H, w: (x1 - x0 + 1) / W, h: (y1 - y0 + 1) / H, cx: ((x0 + x1 + 1) / 2 - W / 2) / W };
}

const verge = async (w, side, seed, opts = {}) => decode(await page.evaluate(([w, side, seed, o]) => window.studio.verge(w, side, seed, o), [w, side, seed, opts]));

if (mode === 'verges') {
  // Preview: left + right strip for each world, side by side.
  const comps = []; let x = 20;
  for (const w of ['world1', 'world2', 'world3']) {
    for (const side of ['left', 'right']) {
      comps.push({ input: await verge(w, side, 1), left: x, top: 20 });
      x += 256 + (side === 'left' ? 8 : 40);
    }
  }
  await sharp({ create: { width: x, height: 1064, channels: 4, background: '#5A5E70' } }).composite(comps).png().toFile(outArg ?? 'verges.png');
  console.log('verges ->', outArg);
} else if (mode === 'scenery') {
  // strip-<world>[-<variant>]-<side>.png; the variant picks the layout seed so
  // neighbouring levels differ. The base (no-variant) strip is the fallback.
  for (const w of ['world1', 'world2', 'world3']) {
    for (const [i, v] of ['', '-a', '-b', '-c'].entries()) {
      for (const side of ['left', 'right']) {
        await sharp(await verge(w, side, i + 1)).toFile(`${OUT}/strip-${w}${v}-${side}.png`);
      }
    }
  }
  console.log('verge strips written for world1-3');
} else if (mode === 'v2' || mode === 'v2sheet') {
  // V2 special cars + bosses. Variant sprites share the base sprite's canvas
  // (the studio frames them on the base vehicle), so Car3D swaps textures only.
  //   armored-<type>-<color>, speeder-<type>-<color>, chameleon-<type>-<color>,
  //   boss.png, boss-armored.png, and GENERATED src/renderer3d/bossSpriteGeometry.js
  const VARIANT_TYPES = {
    armored: ['big', 'jeep', 'truck', 'bigrig'],
    speeder: ['small', 'big', 'jeep'],
    chameleon: ['small', 'big', 'jeep', 'truck'],
  };
  const variantBuf = async (t, c, v) => decode(await page.evaluate(([t, c, v]) => window.studio.vehicle(t, c, { variant: v }), [t, c, v]));
  const boss = await page.evaluate(() => window.studio.boss());
  const bossArm = await page.evaluate(() => window.studio.boss({ armored: true }));
  if (mode === 'v2sheet') {
    const tiles = [];
    for (const [v, ts] of Object.entries(VARIANT_TYPES)) for (const t of ts) tiles.push(await variantBuf(t, v === 'speeder' ? 'Yellow' : v === 'armored' ? 'Blue' : 'Green', v));
    tiles.push(decode(boss.url), decode(bossArm.url));
    const CELL = 260, GAP = 16, cols = 7, rows = Math.ceil(tiles.length / cols);
    const comps = [];
    for (let i = 0; i < tiles.length; i++) {
      const img = await sharp(tiles[i]).resize(CELL, CELL, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
      comps.push({ input: img, left: GAP + (i % cols) * (CELL + GAP), top: GAP + Math.floor(i / cols) * (CELL + GAP) });
    }
    await sharp({ create: { width: GAP + cols * (CELL + GAP), height: GAP + rows * (CELL + GAP), channels: 4, background: '#5A5E70' } })
      .composite(comps).png().toFile(outArg ?? 'v2sheet.png');
    console.log('v2 sheet ->', outArg);
  } else {
    for (const [v, ts] of Object.entries(VARIANT_TYPES)) for (const t of ts) for (const c of colors) {
      await sharp(await variantBuf(t, c, v)).toFile(`${OUT}/${v}-${t}-${c.toLowerCase()}.png`);
    }
    await sharp(decode(boss.url)).toFile(`${OUT}/boss.png`);
    await sharp(decode(bossArm.url)).toFile(`${OUT}/boss-armored.png`);
    const box = await alphaBox(decode(boss.url));
    const r3 = (x) => Number(x.toFixed(3));
    const geo = { aspect: r3(box.W / box.H), w: r3(box.w), h: r3(box.h), cx: r3(box.cx),
      panel: Object.fromEntries(Object.entries(boss.panel).map(([k, x]) => [k, r3(x)])) };
    writeFileSync('src/renderer3d/bossSpriteGeometry.js',
      `// GENERATED by scripts/render-3d-sprites.mjs v2 — do not edit by hand.\n` +
      `// Boss sprite: image aspect, alpha bbox of the body (fractions), and the roof\n` +
      `// light panel rectangle (fractions of the image) where Car3D draws the sequence.\n` +
      `export const BOSS_SPRITE_GEOMETRY = ${JSON.stringify(geo, null, 2)};\n`);
    console.log('v2 sprites written; boss geometry', geo);
  }
} else if (mode === 'sheet') {
  // Row 1: every type in Red. Row 2: the sedan in all six colours. Row 3: bombs.
  const tiles = [];
  for (const t of types) tiles.push({ row: 0, buf: await vehicle(t, 'Red') });
  for (const c of colors) tiles.push({ row: 1, buf: await vehicle('big', c) });
  for (const c of colors) tiles.push({ row: 2, buf: await bomb(c) });
  const CELL = 300, GAP = 20, cols = 6;
  const comps = [];
  for (let r = 0; r < 3; r++) {
    const row = tiles.filter(t => t.row === r);
    for (let i = 0; i < row.length; i++) {
      const img = await sharp(row[i].buf).resize(CELL, CELL, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
      comps.push({ input: img, left: GAP + i * (CELL + GAP), top: GAP + r * (CELL + GAP) });
    }
  }
  await sharp({ create: { width: GAP + cols * (CELL + GAP), height: GAP + 3 * (CELL + GAP), channels: 4, background: '#5A5E70' } })
    .composite(comps).png().toFile(outArg ?? 'sheet.png');
  console.log('sheet ->', outArg);
} else {
  const table = {};
  for (const t of types) for (const c of colors) {
    const buf = await vehicle(t, c);
    await sharp(buf).toFile(`${OUT}/${FILE[t](c.toLowerCase())}.png`);
    if (c === 'Red') table[t] = await alphaBox(buf);
  }
  for (const c of colors) await sharp(await bomb(c)).toFile(`${OUT}/powerball-${c.toLowerCase()}.png`);
  for (const n of ['colorchange', 'freeze', 'bomb']) {
    const url = await page.evaluate((n) => window.studio.icon(n), n);
    // Trim to the drawn pixels, then an even margin: BoosterBar fits icons by
    // their max dimension, so empty frame space would shrink the subject.
    const trimmed = await sharp(decode(url)).trim({ threshold: 1 }).toBuffer();
    await sharp(trimmed).extend({ top: 6, bottom: 6, left: 6, right: 6, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toFile(`${OUT}/booster-${n}.png`);
  }
  // Car3D imports this — generated, never hand-copied (a hand-copied table is
  // exactly the stale-value bug class the project keeps paying for).
  const r3 = (v) => Number(v.toFixed(3));
  const geo = Object.fromEntries(Object.entries(table).map(([t, b]) =>
    [t, { aspect: r3(b.W / b.H), w: r3(b.w), h: r3(b.h), cx: r3(b.cx) }]));
  writeFileSync('src/renderer3d/carSpriteGeometry.js',
    `// GENERATED by scripts/render-3d-sprites.mjs — do not edit by hand.\n` +
    `// Per vehicle type, measured from the baked sprite: image aspect (W/H) and the\n` +
    `// alpha bbox of the solid body + outline as fractions of the image (cx = body\n` +
    `// centre offset, + = right). The soft baked shadow is excluded.\n` +
    `export const CAR_SPRITE_GEOMETRY = ${JSON.stringify(geo, null, 2)};\n`);
  console.log('type    img WxH    aspect  body.w  body.h  body.cx');
  for (const [t, b] of Object.entries(table)) {
    console.log(`${t.padEnd(7)} ${String(b.W).padStart(4)}x${b.H}  ${(b.W / b.H).toFixed(3)}   ${b.w.toFixed(3)}   ${b.h.toFixed(3)}   ${b.cx.toFixed(3)}`);
  }
}
await browser.close();
