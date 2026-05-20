// generate-sprites.mjs — create 5 car SVG sprites and export as PNG
// Each SVG is 256×256, white fills, dark outlines, transparent background.
// Nose points DOWN (car drives toward bottom of screen).
// Run: node scripts/generate-sprites.mjs

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = path.join(__dirname, '..', 'public', 'sprites', 'designed');
mkdirSync(OUT_DIR, { recursive: true });

// ── SVG definitions (all 256×256, nose at BOTTOM) ─────────────────────────────

const SPRITES = {

  // ── MOTORBIKE ─────────────────────────────────────────────────────────────
  // Narrow pill body, two wheels, handlebars at bottom (front/nose)
  motorbike: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <!-- Rear wheel (top = rear of bike) -->
  <ellipse cx="128" cy="52" rx="24" ry="32" fill="#444444" stroke="#222222" stroke-width="2"/>
  <!-- Body pill (70px wide, 170px tall) -->
  <rect x="93" y="43" width="70" height="170" rx="35" fill="#FFFFFF" stroke="#222222" stroke-width="3"/>
  <!-- Rider suggestion (center blob) -->
  <ellipse cx="128" cy="118" rx="18" ry="13" fill="#CCCCCC" stroke="#555555" stroke-width="1.5"/>
  <!-- Handlebars (front area, 75% from top = y≈170) -->
  <line x1="80" y1="178" x2="176" y2="178" stroke="#222222" stroke-width="3" stroke-linecap="round"/>
  <circle cx="80" cy="178" r="5" fill="#444444"/>
  <circle cx="176" cy="178" r="5" fill="#444444"/>
  <!-- Front wheel (bottom = front of bike) -->
  <ellipse cx="128" cy="205" rx="24" ry="32" fill="#444444" stroke="#222222" stroke-width="2"/>
</svg>`,

  // ── SEDAN ──────────────────────────────────────────────────────────────────
  // 4-door car, windshield at bottom (front), rear window at top, door lines
  sedan: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <!-- Wheel arches (protrude from body sides) -->
  <rect x="28" y="22" width="32" height="22" rx="11" fill="#DDDDDD" stroke="#222222" stroke-width="2"/>
  <rect x="196" y="22" width="32" height="22" rx="11" fill="#DDDDDD" stroke="#222222" stroke-width="2"/>
  <rect x="28" y="212" width="32" height="22" rx="11" fill="#DDDDDD" stroke="#222222" stroke-width="2"/>
  <rect x="196" y="212" width="32" height="22" rx="11" fill="#DDDDDD" stroke="#222222" stroke-width="2"/>
  <!-- Main body -->
  <rect x="53" y="18" width="150" height="220" rx="20" fill="#FFFFFF" stroke="#222222" stroke-width="3"/>
  <!-- Roof panel (slightly off-white for depth) -->
  <rect x="65" y="80" width="126" height="100" rx="6" fill="#F5F5F5"/>
  <!-- Rear window (top = rear of car) -->
  <rect x="72" y="27" width="112" height="42" rx="12" fill="#334455" stroke="#333333" stroke-width="1.5"/>
  <!-- Door lines (2 horizontal across body) -->
  <line x1="53" y1="125" x2="203" y2="125" stroke="#888888" stroke-width="1.5"/>
  <line x1="53" y1="158" x2="203" y2="158" stroke="#888888" stroke-width="1.5"/>
  <!-- Front windshield (bottom = front of car) -->
  <rect x="68" y="192" width="120" height="42" rx="12" fill="#334455" stroke="#333333" stroke-width="1.5"/>
  <!-- Side mirrors (front-top corners) -->
  <rect x="37" y="88" width="16" height="10" rx="3" fill="#CCCCCC" stroke="#333333" stroke-width="1.5"/>
  <rect x="203" y="88" width="16" height="10" rx="3" fill="#CCCCCC" stroke="#333333" stroke-width="1.5"/>
</svg>`,

  // ── VAN (jeep) ─────────────────────────────────────────────────────────────
  // Boxy panel van, windshield at bottom (front), solid rear (no rear window)
  jeep: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <!-- Wheel arches (larger than sedan) -->
  <rect x="24" y="24" width="36" height="26" rx="13" fill="#DDDDDD" stroke="#222222" stroke-width="2"/>
  <rect x="196" y="24" width="36" height="26" rx="13" fill="#DDDDDD" stroke="#222222" stroke-width="2"/>
  <rect x="24" y="207" width="36" height="26" rx="13" fill="#DDDDDD" stroke="#222222" stroke-width="2"/>
  <rect x="196" y="207" width="36" height="26" rx="13" fill="#DDDDDD" stroke="#222222" stroke-width="2"/>
  <!-- Main boxy body -->
  <rect x="48" y="18" width="160" height="220" rx="12" fill="#FFFFFF" stroke="#222222" stroke-width="3"/>
  <!-- Rear panel (top, no window — panel van) -->
  <rect x="60" y="26" width="136" height="50" rx="6" fill="#F0F0F0" stroke="#555555" stroke-width="1"/>
  <!-- Sliding door line (vertical) on each side at ~60% body height -->
  <line x1="48" y1="148" x2="208" y2="148" stroke="#888888" stroke-width="2"/>
  <!-- Roof rack lines -->
  <line x1="70" y1="95" x2="186" y2="95" stroke="#AAAAAA" stroke-width="2" stroke-dasharray="6,4"/>
  <line x1="70" y1="112" x2="186" y2="112" stroke="#AAAAAA" stroke-width="2" stroke-dasharray="6,4"/>
  <!-- Front windshield (bottom = front) -->
  <rect x="62" y="192" width="132" height="45" rx="10" fill="#334455" stroke="#333333" stroke-width="1.5"/>
  <!-- Side mirrors (front corners) -->
  <rect x="30" y="95" width="18" height="11" rx="3" fill="#CCCCCC" stroke="#333333" stroke-width="1.5"/>
  <rect x="208" y="95" width="18" height="11" rx="3" fill="#CCCCCC" stroke="#333333" stroke-width="1.5"/>
</svg>`,

  // ── TRUCK (pickup) ─────────────────────────────────────────────────────────
  // Cab at bottom (front/nose), open bed at top (rear)
  truck: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <!-- Truck bed (top = rear) — open bed with rail lines -->
  <rect x="55" y="18" width="146" height="115" rx="8" fill="#FFFFFF" stroke="#222222" stroke-width="3"/>
  <!-- Inner bed rails (inset rectangle) -->
  <rect x="71" y="30" width="114" height="91" rx="4" fill="none" stroke="#888888" stroke-width="2"/>
  <!-- Bed divider / tailgate area at top -->
  <rect x="55" y="18" width="146" height="16" rx="8" fill="#EEEEEE" stroke="#555555" stroke-width="1.5"/>
  <!-- Cab-to-bed divider line -->
  <line x1="50" y1="133" x2="206" y2="133" stroke="#444444" stroke-width="3"/>
  <!-- Cab body (bottom = front) -->
  <rect x="50" y="133" width="156" height="108" rx="15" fill="#FFFFFF" stroke="#222222" stroke-width="3"/>
  <!-- Cab windshield -->
  <rect x="68" y="150" width="120" height="50" rx="10" fill="#334455" stroke="#333333" stroke-width="1.5"/>
  <!-- Wheel arches (cab corners, front axle; bed top corners, rear axle) -->
  <rect x="24" y="22" width="36" height="24" rx="12" fill="#DDDDDD" stroke="#222222" stroke-width="2"/>
  <rect x="196" y="22" width="36" height="24" rx="12" fill="#DDDDDD" stroke="#222222" stroke-width="2"/>
  <rect x="24" y="210" width="36" height="24" rx="12" fill="#DDDDDD" stroke="#222222" stroke-width="2"/>
  <rect x="196" y="210" width="36" height="24" rx="12" fill="#DDDDDD" stroke="#222222" stroke-width="2"/>
  <!-- Side mirrors (cab front corners) -->
  <rect x="30" y="158" width="18" height="11" rx="3" fill="#CCCCCC" stroke="#333333" stroke-width="1.5"/>
  <rect x="208" y="158" width="18" height="11" rx="3" fill="#CCCCCC" stroke="#333333" stroke-width="1.5"/>
</svg>`,

  // ── BIGRIG (semi-truck) ────────────────────────────────────────────────────
  // Cab at bottom (nose/front), long trailer at top
  bigrig: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <!-- Trailer (top = rear) -->
  <rect x="58" y="12" width="140" height="155" rx="6" fill="#FFFFFF" stroke="#222222" stroke-width="2"/>
  <!-- Trailer panel lines (inner rectangle) -->
  <rect x="68" y="22" width="120" height="135" rx="3" fill="none" stroke="#AAAAAA" stroke-width="1"/>
  <!-- Trailer horizontal ribs -->
  <line x1="68" y1="59" x2="188" y2="59" stroke="#CCCCCC" stroke-width="1"/>
  <line x1="68" y1="96" x2="188" y2="96" stroke="#CCCCCC" stroke-width="1"/>
  <line x1="68" y1="120" x2="188" y2="120" stroke="#CCCCCC" stroke-width="1"/>
  <!-- Rear dual-axle wheels (top of trailer) -->
  <ellipse cx="90" cy="152" rx="14" ry="10" fill="#444444" stroke="#222222" stroke-width="1.5"/>
  <ellipse cx="90" cy="166" rx="14" ry="10" fill="#444444" stroke="#222222" stroke-width="1.5"/>
  <ellipse cx="166" cy="152" rx="14" ry="10" fill="#444444" stroke="#222222" stroke-width="1.5"/>
  <ellipse cx="166" cy="166" rx="14" ry="10" fill="#444444" stroke="#222222" stroke-width="1.5"/>
  <!-- Cab-trailer coupling / fifth wheel -->
  <rect x="88" y="167" width="80" height="12" rx="4" fill="#CCCCCC" stroke="#555555" stroke-width="1.5"/>
  <!-- Cab body (bottom = front) -->
  <rect x="53" y="179" width="150" height="65" rx="15" fill="#FFFFFF" stroke="#222222" stroke-width="3"/>
  <!-- Cab windshield -->
  <rect x="70" y="186" width="116" height="42" rx="10" fill="#334455" stroke="#333333" stroke-width="1.5"/>
  <!-- Front wheel arches -->
  <rect x="24" y="207" width="36" height="22" rx="11" fill="#DDDDDD" stroke="#222222" stroke-width="2"/>
  <rect x="196" y="207" width="36" height="22" rx="11" fill="#DDDDDD" stroke="#222222" stroke-width="2"/>
  <!-- Side mirrors -->
  <rect x="28" y="192" width="20" height="12" rx="3" fill="#CCCCCC" stroke="#333333" stroke-width="1.5"/>
  <rect x="208" y="192" width="20" height="12" rx="3" fill="#CCCCCC" stroke="#333333" stroke-width="1.5"/>
</svg>`,
};

// ── Convert SVG → PNG via Playwright ─────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
const page    = await browser.newPage();

for (const [name, svgContent] of Object.entries(SPRITES)) {
  console.log(`Generating ${name}.png …`);

  await page.setViewportSize({ width: 256, height: 256 });
  await page.setContent(`<!DOCTYPE html>
<html>
<head><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 256px; height: 256px; background: transparent; overflow: hidden; }
  svg { display: block; }
</style></head>
<body>${svgContent}</body>
</html>`);

  await page.waitForTimeout(100);

  const png = await page.screenshot({
    type: 'png',
    omitBackground: true,
    clip: { x: 0, y: 0, width: 256, height: 256 },
  });

  const outPath = path.join(OUT_DIR, `${name}.png`);
  writeFileSync(outPath, png);
  console.log(`  ✓ ${outPath} (${Math.round(png.length / 1024)} KB)`);
}

await browser.close();
console.log('\nAll sprites generated →', OUT_DIR);
