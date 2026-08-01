// TASK 2 — inventory every bottom band with exact Y-extents, then price the
// proposed reclaim. MEASUREMENT ONLY — nothing moves.
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window._nav, null, { timeout: 60000 });

for (const [lv, tag] of [[5, '3-lane band600'], [13, '4-lane band540']]) {
  await page.evaluate((l) => window._nav.startLevel(l), lv);
  await page.waitForTimeout(2200);
  const m = await page.evaluate(async () => {
    const P  = await import('/src/renderer3d/projection.js');
    const BR = await import('/src/renderer/BenchRenderer.js');
    const BB = await import('/src/renderer/BoosterBar.js');
    const SR = await import('/src/renderer/ShooterRenderer.js');
    const LR = await import('/src/renderer/LaneRenderer.js');
    const gs = window._nav.getGs();
    const r = P.bombBallScreenRadius();
    return {
      lanes: gs.activeLaneCount, band: P.bandForLaneCount(gs.activeLaneCount),
      APP_H: P.APP_H, DESIGN_ROAD_TOP_Y: P.DESIGN_ROAD_TOP_Y,
      HUD_BOTTOM_Y: P.HUD_BOTTOM_Y,
      ROAD_TOP_Y: LR.ROAD_TOP_Y, ROAD_BOTTOM_Y: LR.ROAD_BOTTOM_Y,
      BREACH: P.BREACH_LINE_Y,
      slot0: P.bombSlotScreenY(0), slot1: P.bombSlotScreenY(1), slot2: P.bombSlotScreenY(2),
      ballR: r, socketBottom: P.bombSlotScreenY(2) + r * P.SOCKET_SHADOW_RATIO,
      SHOOTER_AREA_Y: SR.SHOOTER_AREA_Y, SHOOTER_AREA_H: SR.SHOOTER_AREA_H,
      benchY: BR.benchY(), benchSlotH: BR.benchSlotH(),
      BAR_Y: BB.BAR_Y,
      scale: P.BOMB_ZONE_SCALE, minLegible: 0.45,
    };
  });
  const trayTop = m.benchY - 4, trayBottom = m.benchY + m.benchSlotH + 4;
  console.log(`\n${'='.repeat(78)}`);
  console.log(`L${lv} (${tag})  lanes=${m.lanes}  band=${m.band}  BOMB_ZONE_SCALE=${m.scale.toFixed(4)}`);
  console.log('='.repeat(78));
  const rows = [
    ['TOP BAR / HUD',        0,                m.HUD_BOTTOM_Y,   'meta', 'HUD_BOTTOM_Y = DESIGN_ROAD_TOP_Y (44), band-independent'],
    ['ROAD (gameplay)',      m.ROAD_TOP_Y,     m.ROAD_BOTTOM_Y,  'GAMEPLAY', 'projected from the frustum; band drives this'],
    ['breach -> queue top',  m.ROAD_BOTTOM_Y,  m.slot0 - m.ballR, 'gap', 'breach stripe + BREACH_MARGIN clearance'],
    ['QUEUE row 0',          m.slot0 - m.ballR, m.slot0 + m.ballR, 'GAMEPLAY', 'bombSlotScreenY(0) +/- ball radius'],
    ['QUEUE row 1',          m.slot1 - m.ballR, m.slot1 + m.ballR, 'GAMEPLAY', 'slot pitch = CELL*0.70*BOMB_ZONE_SCALE'],
    ['QUEUE row 2',          m.slot2 - m.ballR, m.socketBottom,   'GAMEPLAY', 'incl. socket ring (SOCKET_SHADOW_RATIO)'],
    ['BENCH tray',           trayTop,          trayBottom,       'GAMEPLAY', 'benchY() = row2 ball bottom + 4 gap + 4 pad'],
    ['tray -> booster gap',  trayBottom,       m.BAR_Y,          'gap', 'BENCH_BAR_GAP=2 nominal'],
    ['BOOSTER row',          m.BAR_Y,          m.BAR_Y + 68,     'GAMEPLAY', 'BoosterBar BAR_Y=752 FIXED, band-independent'],
    ['bottom dead strip',    m.BAR_Y + 68,     m.APP_H,          'DEAD', 'below the booster cards, nothing drawn'],
  ];
  console.log('band                 │    top │ bottom │  px   │ kind     │ governed by');
  console.log('─────────────────────┼────────┼────────┼───────┼──────────┼─────────────────────────────');
  for (const [name, t, b, kind, gov] of rows) {
    console.log(`${name.padEnd(20)} │ ${t.toFixed(1).padStart(6)} │ ${b.toFixed(1).padStart(6)} │ ${(b - t).toFixed(1).padStart(5)} │ ${kind.padEnd(8)} │ ${gov}`);
  }
  console.log(`\n  queue-vs-bench overflow: socket bottom ${m.socketBottom.toFixed(2)} vs tray top ${trayTop.toFixed(2)}`
    + `  -> ${(m.socketBottom - trayTop).toFixed(2)}px ${m.socketBottom > trayTop ? 'CLIP' : 'clear'}`);
  console.log(`  bench slot height ${m.benchSlotH.toFixed(1)}px (floor 28)  ${m.benchSlotH <= 28 ? '<< AT FLOOR' : ''}`);
}
await browser.close();
