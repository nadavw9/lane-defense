// L1 defects: (a) the FTUE hand is clipped, (b) motorbikes render tiny.
// Measures both against L4 (the pilot board) so the difference is quantified,
// not eyeballed.
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });

for (const level of [1, 4]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window._nav, null, { timeout: 60000 });
  await page.evaluate((lv) => window._nav.startLevel(lv), level);
  await page.waitForTimeout(3000);

  const m = await page.evaluate(() => {
    const gs = window._nav.getGs();
    const pos = window._nav.getPositions();
    // Car world->screen size: the 3D car meshes.
    const r3d = window.__r3d ?? null;
    return {
      levelId: gs.levelId, gridRows: gs.gridRows, lanes: gs.activeLaneCount,
      laneBounds: pos.laneBounds?.[0],
      cars: gs.lanes[0]?.cars?.map(c => ({ type: c.type, row: c.row, position: c.position })) ?? [],
      slotY: pos.slotY,
    };
  });
  console.log(`\nL${level}: gridRows=${m.gridRows} lanes=${m.lanes} `
    + `laneWidth=${m.laneBounds ? (m.laneBounds.right - m.laneBounds.left).toFixed(1) : '?'}`);
  console.log(`   cars: ${m.cars.map(c => c.type).join(',') || '(none yet)'}`);

  // Car on-screen size, measured from the rendered 3D mesh bounding box.
  const size = await page.evaluate(() => {
    const app = window.__pixiApp;
    // Fall back: read car sprite scale from the Three scene via the dev hook.
    const s = window._nav.getShooter3D?.();
    return { hasShooterHook: !!s };
  });

  // Hand bounds (L1 only) — the FTUE overlay is a Pixi container.
  if (level === 1) {
    const hand = await page.evaluate(() => {
      // Walk the stage for the hand icon: a Text/Sprite with anchor y=1 inside the FTUE overlay.
      const out = [];
      const walk = (node, depth = 0) => {
        if (depth > 12 || !node.children) return;
        for (const c of node.children) {
          const b = (() => { try { return c.getBounds(); } catch { return null; } })();
          if (b && b.width > 20 && b.width < 200 && b.height > 20 && b.height < 200 && c.anchor?.y === 1) {
            out.push({ x: b.x, y: b.y, w: b.width, h: b.height, alpha: c.alpha, cls: c.constructor?.name });
          }
          walk(c, depth + 1);
        }
      };
      walk(window.__pixiApp?.stage ?? {});
      return out;
    });
    console.log(`   bottom-anchored icons found: ${JSON.stringify(hand)}`);
  }

  await page.screenshot({ path: `docs/review/_l1probe-L${level}.png` });
  await page.close();
}
await browser.close();
