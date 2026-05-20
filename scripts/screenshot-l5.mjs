// screenshot-l5.mjs — navigate to L5, play shots, save screenshot
// Run: node scripts/screenshot-l5.mjs

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = path.join(__dirname, '..', 'docs', 'level-screenshots', 'current');
mkdirSync(OUT_DIR, { recursive: true });

const PORT = process.env.PORT || 5173;
const URL  = `http://localhost:${PORT}/`;

const W = 390, H = 844;

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page    = await context.newPage();

// Collect console errors
const errors = [];
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', err => errors.push(err.message));
page.on('response', resp => {
  if (resp.status() >= 400) errors.push(`HTTP ${resp.status()}: ${resp.url()}`);
});

await page.setViewportSize({ width: W, height: H });

console.log(`Navigating to ${URL} …`);
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30_000 });
await page.waitForTimeout(2000);

// Jump straight to L5
console.log('Starting L5 …');
await page.evaluate(() => window._nav?.startLevel(5));
await page.waitForTimeout(4000); // wait for level load + initial state

// Get the canvas bounding rect and bomb/lane positions
const layout = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return null;
  const r = canvas.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
console.log('Canvas layout:', JSON.stringify(layout));

// Simulate drag from bomb column → lane target to fire a shot
// For 4-lane L5: shooter cols at bottom ~55% of canvas height
// Lane X positions evenly divided, bomb shooter near bottom
async function fireDrag(colIdx, targetColIdx) {
  if (!layout) return;
  const laneCount = 4;
  const laneW = W / laneCount;

  // Shooter column top row Y = 544 (from ShooterRenderer.TOP_Y)
  const bombX = layout.x + laneW * (colIdx + 0.5);
  const bombY = layout.y + 544;

  // Lane drop target: inside road area (44–510), use mid-road Y ≈ 220
  const dropX = layout.x + laneW * (targetColIdx + 0.5);
  const dropY = layout.y + 220;

  console.log(`  Drag from (${Math.round(bombX)}, ${Math.round(bombY)}) to (${Math.round(dropX)}, ${Math.round(dropY)})`);

  await page.mouse.move(bombX, bombY);
  await page.waitForTimeout(100);
  await page.mouse.down();
  await page.waitForTimeout(100);
  // Smooth drag in multiple steps
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await page.mouse.move(
      bombX + (dropX - bombX) * t,
      bombY + (dropY - bombY) * t
    );
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
  await page.waitForTimeout(800); // wait for turn to resolve
}

// Fire 4 shots (one per lane) to spread cars across rows
console.log('Firing shots …');
await fireDrag(0, 0);
await fireDrag(1, 1);
await fireDrag(2, 2);
await fireDrag(3, 3);

// One more round to spread more
await fireDrag(0, 0);
await fireDrag(1, 1);

await page.waitForTimeout(1500);

console.log('Taking screenshot …');
const screenshotPath = path.join(OUT_DIR, 'L05_sprites_motion.png');
await page.screenshot({ path: screenshotPath, fullPage: false });
console.log('Saved:', screenshotPath);

if (errors.length) {
  console.log('\nConsole errors:');
  errors.forEach(e => console.log(' ', e));
} else {
  console.log('No console errors.');
}

await browser.close();
