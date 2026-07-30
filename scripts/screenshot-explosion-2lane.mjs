// screenshot-explosion-2lane.mjs — verify the 2D impact explosion lands centered
// on the car in a 2-lane level (L2). Drives real kills via the deploy dev hook so
// the fixed ParticleSystem.spawnExplosion path runs, then burst-captures frames.
// Run: node scripts/screenshot-explosion-2lane.mjs

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = path.join(__dirname, '..', 'docs', 'level-screenshots', 'current');
mkdirSync(OUT_DIR, { recursive: true });

const URL = `http://localhost:${process.env.PORT || 5173}/`;
const W = 390, H = 844;

const browser = await chromium.launch({ headless: false });
const page    = await browser.newPage();
await page.setViewportSize({ width: W, height: H });
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30_000 });
await page.waitForTimeout(2000);

await page.evaluate(() => window._nav?.startLevel(2));
await page.waitForTimeout(3500);

// Numeric proof: where the registry places each lane center (screen px) on this
// 2-lane level, vs the OLD hardcoded-4-lane laneCenterX formula.
const xproof = await page.evaluate(() => {
  const gs = window._nav.getGs();
  const n = gs.activeLaneCount;
  const FH = 9.651, FD = 2 * FH, APP_W = 390;
  const laneToX = (i, lanes) => -(lanes * 4) / 2 + 2 + i * 4;
  const reg = (i) => (laneToX(i, n) + FH) / FD * APP_W;          // getLaneScreenX (fixed)
  const old = (i) => (i + 0.5) * (390 / 4);                       // laneCenterX (buggy, /4)
  return { n, lane0_fixed: reg(0).toFixed(1), lane1_fixed: reg(1).toFixed(1),
           lane0_old: old(0).toFixed(1), lane1_old: old(1).toFixed(1) };
});
console.log('X-PROOF', JSON.stringify(xproof));

// Snapshot of the board: active lanes/cols, front-car color/hp, top-bomb color/damage,
// and the registry screen-X for each lane so we can annotate where the explosion lands.
async function board() {
  return page.evaluate(() => {
    const gs = window._nav.getGs();
    const reg = window.__pr;
    const lanes = [];
    for (let i = 0; i < gs.activeLaneCount; i++) {
      const c = gs.lanes[i].cars[0];
      lanes.push(c ? { lane: i, color: c.color, hp: c.hp, pos: c.position } : { lane: i, empty: true });
    }
    const cols = [];
    for (let i = 0; i < (gs.activeColCount ?? gs.columns.length); i++) {
      const b = gs.columns[i].shooters[0];
      cols.push(b ? { col: i, color: b.color, dmg: b.damage } : { col: i, empty: true });
    }
    return { lanes, cols };
  });
}

// Find a (col,lane) whose colors match; prefer one that will KILL (hp <= dmg).
function pick(b) {
  let chip = null;
  for (const ln of b.lanes) {
    if (ln.empty) continue;
    for (const co of b.cols) {
      if (co.empty || co.color !== ln.color) continue;
      if (ln.hp <= co.dmg) return { col: co.col, lane: ln.lane, kill: true, ln, co };
      if (!chip) chip = { col: co.col, lane: ln.lane, kill: false, ln, co };
    }
  }
  return chip;
}

let shot = 0, captured = false;
for (let turn = 0; turn < 30 && !captured; turn++) {
  const b = await board();
  const choice = pick(b);
  if (!choice) { console.log('no matching pair this turn', JSON.stringify(b)); break; }
  console.log(`turn ${turn}: deploy col${choice.col}->lane${choice.lane} kill=${choice.kill} (car hp${choice.ln.hp} ${choice.ln.color} vs bomb dmg${choice.co.dmg})`);

  await page.evaluate(({ c, l }) => window._nav.deploy(c, l), { c: choice.col, l: choice.lane });

  if (choice.kill) {
    // Burst-capture to catch the ~0.5s explosion transient at its peak. Capture both
    // a full frame and a zoom on the road's upper region (where the opening car was).
    for (let f = 0; f < 8; f++) {
      await page.waitForTimeout(40);
      await page.screenshot({ path: path.join(OUT_DIR, `explosion-2lane-f${f}.png`), fullPage: false });
      await page.screenshot({ path: path.join(OUT_DIR, `explosion-2lane-zoom-f${f}.png`),
        clip: { x: 95, y: 44, width: 200, height: 230 } });
    }
    console.log('  captured 8 full + 8 zoom frames');
    captured = true;
  } else {
    await page.waitForTimeout(900); // let the turn resolve + cars advance/refill
  }
  shot++;
}

if (!captured) console.log('WARNING: never captured a kill explosion');
await browser.close();
