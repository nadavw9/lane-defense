// Shared fixture for the visual harness.
//
// Every test gets a `game` object that:
//   - boots the app and waits for the dev hooks (window._nav) to exist
//   - records TRIPWIRES: console.error, uncaught page errors, and any HTTP >= 400
//     response — asserted empty automatically after every test. This alone catches
//     the two historical production-404 bug classes (case-mismatch, gitignored asset).
//   - exposes game-state / geometry helpers that read the game's OWN source of
//     truth (window._nav.getPositions / getGs / getHudBounds), so assertions never
//     re-derive frustum math that could drift from the real renderer.
//   - samples real rendered pixels via screenshot + sharp (colored-car vs grey-road
//     saturation checks), because the WebGL canvas can't be read directly.

import { test as base, expect } from '@playwright/test';
import sharp from 'sharp';
import { posToScreenYProjected } from '../../src/renderer3d/projection.js';

// Requests that are allowed to fail without failing the test:
//  - favicon (browser noise)
//  - third-party analytics/ads endpoints (Firebase RTDB returns 401 with locked
//    rules, AdMob is absent in web builds) — external services, not our assets.
const IGNORED_URLS = [
  /favicon\.ico$/,
  /firebaseio\.com/,
  /googleads|admob|googlesyndication|doubleclick/,
];

// GitHub-hosted CI runners have no GPU — Chromium's WebGL falls back to
// software rendering (SwiftShader, forced explicitly via playwright.config.js
// launchOptions), and booting the full app (WebGL context + Pixi + Three.js
// scene init) costs much more wall-clock there than on a real GPU. Same
// budget-not-steps fix as the per-test timeout in playwright.config.js —
// see that file's comment for the CI investigation this is based on.
const BOOT_TIMEOUT_MS = process.env.CI ? 90_000 : 45_000;

export class GamePage {
  constructor(page) {
    this.page = page;
    this.consoleErrors = [];
    this.failedRequests = [];
  }

  async boot() {
    this.page.on('pageerror', (e) => this.consoleErrors.push(`pageerror: ${e.message}`));
    this.page.on('console', (m) => {
      // Generic resource-load failures are duplicated (with the URL) by the
      // response listener below, which filters IGNORED_URLS precisely — the
      // console variant has no URL, so skip it here to avoid false positives.
      if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) {
        this.consoleErrors.push(`console.error: ${m.text()}`);
      }
    });
    this.page.on('response', (r) => {
      if (r.status() >= 400 && !IGNORED_URLS.some((rx) => rx.test(r.url()))) {
        this.failedRequests.push(`${r.status()} ${r.url()}`);
      }
    });
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    await this.page.waitForFunction(() => !!window._nav, null, { timeout: BOOT_TIMEOUT_MS });
    // Let the loading screen finish + title settle.
    await this.page.waitForTimeout(1500);
  }

  async startLevel(n) {
    await this.page.evaluate((lv) => window._nav.startLevel(lv), n);
    await this.page.waitForTimeout(2500);          // level boot + prime
    await this.dismissOverlays();
  }

  // Tap screen-center a few times to clear FTUE / intro-card overlays.
  async dismissOverlays(times = 5) {
    for (let i = 0; i < times; i++) {
      await this.tapStage(195, 420);
      await this.page.waitForTimeout(180);
    }
    await this.page.waitForTimeout(300);
  }

  tapStage(x, y) {
    return this.page.evaluate(([sx, sy]) => {
      const c = document.querySelector('canvas:not(#three-canvas)');
      const r = c.getBoundingClientRect();
      const o = {
        bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
        clientX: r.left + (sx / 390) * r.width,
        clientY: r.top + (sy / 844) * r.height,
      };
      c.dispatchEvent(new PointerEvent('pointerdown', o));
      c.dispatchEvent(new PointerEvent('pointerup', o));
    }, [x, y]);
  }

  // Full pointer drag on the pixi canvas (for real DragDrop deploy tests).
  async dragStage(x1, y1, x2, y2, steps = 6) {
    const dispatch = (type, x, y) => this.page.evaluate(([t, sx, sy]) => {
      const c = document.querySelector('canvas:not(#three-canvas)');
      const r = c.getBoundingClientRect();
      const o = {
        bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
        clientX: r.left + (sx / 390) * r.width,
        clientY: r.top + (sy / 844) * r.height,
      };
      c.dispatchEvent(new PointerEvent(t, o));
    }, [type, x, y]);
    await dispatch('pointerdown', x1, y1);
    for (let i = 1; i <= steps; i++) {
      await dispatch('pointermove', x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps);
      await this.page.waitForTimeout(40);
    }
    await dispatch('pointerup', x2, y2);
  }

  // Plain-data snapshot of GameState (gs itself has cycles — never return it raw).
  gs() {
    return this.page.evaluate(() => {
      const gs = window._nav.getGs();
      if (!gs) return null;
      return {
        levelId: gs.levelId,
        isOver: gs.isOver,
        laneCount: gs.activeLaneCount,
        colCount: gs.activeColCount,
        colors: gs.colors,
        gridRows: gs.gridRows,
        goals: gs.goals,
        goalProgress: gs.goalProgress,
        lanes: gs.lanes.slice(0, gs.activeLaneCount).map((l) => ({
          count: l.cars.length,
          rows: l.cars.map((c) => c.row),
          frontColor: l.cars[0]?.color ?? null,
          frontHp: l.cars[0]?.hp ?? null,
          frontRow: l.cars[0]?.row ?? null,
        })),
        cols: gs.columns.slice(0, gs.activeColCount).map((c) => ({
          count: c.shooters.length,
          topColor: c.shooters[0]?.color ?? null,
          topDamage: c.shooters[0]?.damage ?? null,
        })),
      };
    });
  }

  positions() { return this.page.evaluate(() => window._nav.getPositions()); }
  hudBounds() { return this.page.evaluate(() => window._nav.getHudBounds()); }
  winLevel()  { return this.page.evaluate(() => window._nav.winLevel()); }

  async deploy(colIdx, laneIdx) {
    await this.page.evaluate(([c, l]) => window._nav.deploy(c, l), [colIdx, laneIdx]);
    await this.page.waitForTimeout(650);           // shot travel + advance + refill
  }

  // Row → stage Y through the game's OWN projection math (renderer3d/projection.js)
  // — the same formula the live camera uses, so this can never drift from the
  // renderer the way a copied constant would.
  rowToStageY(row, gridRows) {
    const pos = (row / (gridRows - 1)) * 100;
    return posToScreenYProjected(pos);
  }

  // Mean color + colorfulness of a small region (stage coords == client coords
  // at viewport 390×844). Uses screenshot + sharp — WebGL canvas is unreadable
  // directly. `colorfulness` = mean(maxChannel - minChannel): grey road ≈ 0-10,
  // a colored car / painted panel ≈ 40+.
  async sampleRegion(cx, cy, size = 10) {
    const half = size / 2;
    const buf = await this.page.screenshot({
      clip: {
        x: Math.max(0, cx - half), y: Math.max(0, cy - half),
        width: size, height: size,
      },
    });
    const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
    let r = 0, g = 0, b = 0, colorfulness = 0;
    const px = info.width * info.height;
    for (let i = 0; i < px; i++) {
      const R = data[i * info.channels], G = data[i * info.channels + 1], B = data[i * info.channels + 2];
      r += R; g += G; b += B;
      colorfulness += Math.max(R, G, B) - Math.min(R, G, B);
    }
    return {
      r: r / px, g: g / px, b: b / px,
      brightness: (r + g + b) / (3 * px),
      colorfulness: colorfulness / px,
    };
  }

  assertNoTripwires() {
    expect(this.consoleErrors, `Console errors:\n${this.consoleErrors.join('\n')}`).toEqual([]);
    expect(this.failedRequests, `Failed requests (404s ship as broken art!):\n${this.failedRequests.join('\n')}`).toEqual([]);
  }
}

export const test = base.extend({
  game: async ({ page }, use) => {
    const game = new GamePage(page);
    await game.boot();
    await use(game);
    game.assertNoTripwires();   // every visual test fails on console.error / 404
  },
});

export { expect };
