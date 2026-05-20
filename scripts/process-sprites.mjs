// process-sprites.mjs — download and process all 5 car sprites
// Run: node scripts/process-sprites.mjs

import { chromium } from 'playwright';
import { writeFileSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRITES_DIR = path.join(__dirname, '..', 'public', 'sprites', 'designed');
const SCREENSHOTS_DIR = 'C:\\Users\\dalit\\.claude\\projects\\C--Users-dalit';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1600, height: 900 });

// ── Processing function (runs in browser context) ───────────────────────────
const PROCESS_FN = async ({ rotate180, cropX, cropY, cropW, cropH }) => {
  const img = document.getElementById('src-img');
  if (!img.complete) await new Promise(r => { img.onload = r; });

  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  const cx = cropX !== undefined ? cropX : 0;
  const cy = cropY !== undefined ? cropY : 0;
  const cw = cropW !== undefined ? cropW : srcW;
  const ch = cropH !== undefined ? cropH : srcH;

  const canvas = document.createElement('canvas');
  canvas.width  = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');

  if (rotate180) {
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate(Math.PI);
    ctx.translate(-cw / 2, -ch / 2);
  }
  ctx.drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch);

  const imageData = ctx.getImageData(0, 0, cw, ch);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const grey = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    d[i] = d[i + 1] = d[i + 2] = grey;
    // White/near-white background → transparent
    d[i + 3] = (r > 242 && g > 242 && b > 242) ? 0 : 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png').split(',')[1];
};

async function processFile(name, localPath, opts) {
  console.log(`Processing ${name} from file...`);
  const fileData  = readFileSync(localPath);
  const base64Src = fileData.toString('base64');
  const dataUrl   = `data:image/png;base64,${base64Src}`;

  await page.setContent(`<html><body style="margin:0;background:#000">
    <img id="src-img" src="${dataUrl}" style="display:block">
  </body></html>`);
  await page.waitForSelector('#src-img');

  const result = await page.evaluate(PROCESS_FN, opts);
  writeFileSync(path.join(SPRITES_DIR, `${name}.png`), Buffer.from(result, 'base64'));
  console.log(`  ✓ ${name}.png`);
}

async function processUrl(name, url, opts) {
  console.log(`Processing ${name} from URL...`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const finalUrl = page.url();

  // Fetch the image and embed it to avoid any canvas tainting
  const imgBase64 = await page.evaluate(async (imgUrl) => {
    const resp = await fetch(imgUrl);
    const buf  = await resp.arrayBuffer();
    const arr  = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
    return btoa(bin);
  }, finalUrl);

  await page.setContent(`<html><body style="margin:0;background:#000">
    <img id="src-img" src="data:image/png;base64,${imgBase64}" style="display:block">
  </body></html>`);
  await page.waitForSelector('#src-img');

  const result = await page.evaluate(PROCESS_FN, opts);
  writeFileSync(path.join(SPRITES_DIR, `${name}.png`), Buffer.from(result, 'base64'));
  console.log(`  ✓ ${name}.png`);
}

// ── Sprite definitions ──────────────────────────────────────────────────────
// Screenshot crop: Canva thumbnails (400×566) centered in 1536×784 viewport
// x_start = (1536-400)/2 = 568, y_start = (784-566)/2 = 109
const SS_X = 568, SS_Y = 109, SS_W = 400, SS_H = 566;

// All sources are local files — no remote fetching needed
await processFile('jeep',     path.join(SPRITES_DIR, 'jeep_raw.png'),   { rotate180: false });
await processFile('truck',    path.join(SPRITES_DIR, 'truck_raw.png'),  { rotate180: true  });
await processFile('bigrig',   path.join(SPRITES_DIR, 'bigrig_raw.png'), { rotate180: true  });
await processFile('motorbike',path.join(SCREENSHOTS_DIR, 'car_small_bike.png'), { rotate180: true,  cropX: SS_X, cropY: SS_Y, cropW: SS_W, cropH: SS_H });
await processFile('sedan',    path.join(SCREENSHOTS_DIR, 'car_big_sedan.png'),  { rotate180: false, cropX: SS_X, cropY: SS_Y, cropW: SS_W, cropH: SS_H });

await browser.close();
console.log('\nAll sprites done →', SPRITES_DIR);
