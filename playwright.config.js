// Playwright config for the visual/integration harness (tests-visual/).
// Separate from vitest on purpose: the 1062 headless unit/audit tests stay at ~2s
// (`npm test`), while this suite boots the real game in chromium.
//
//   npm run test:visual        → smoke set (per-commit, ~2-3 min)
//   npm run test:visual:full   → smoke + all-40-level sweep (nightly/manual)
//
// The dev server is auto-started (and reused if already running on :5173).

import { defineConfig } from '@playwright/test';

// GitHub-hosted runners have no GPU, so Chromium's WebGL falls back to
// software rendering (SwiftShader) — every frame the game's Three.js scene
// (ortho camera + composer/bloom) draws costs much more wall-clock than on a
// real GPU. Confirmed 2026-07-14 via `gh run download` on a red CI run:
// zero test assertions failed (grepped the full log — no "did not land", no
// toBeGreaterThan, nothing); every failure was Playwright's own
// `Test timeout of 60000ms exceeded` tripping mid-animation, and the failure
// screenshots showed the game working correctly (one even mid-combo, with an
// achievement toast firing) at the moment the clock ran out. This is a
// wall-clock budget problem, not a test-logic or rendering-correctness bug —
// fix the budget, not the per-step waits (those are tuned to give the game
// time to actually process each event; shrinking them would make the tests
// LESS reliable, not more).
const CI_TIMEOUT_MS = 120_000;

export default defineConfig({
  testDir: 'tests-visual',
  timeout: process.env.CI ? CI_TIMEOUT_MS : 60_000,
  retries: 1,                     // WebGL boot can be flaky under CI load
  workers: 2,                     // each worker holds a WebGL context — keep low
  outputDir: 'tests-visual/failures',
  use: {
    baseURL: 'http://localhost:5173/',
    viewport: { width: 390, height: 844 },   // APP_W × APP_H — stage coords == client coords
    deviceScaleFactor: 1,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    // Force ANGLE's SwiftShader-WebGL backend explicitly on CI (rather than
    // whatever fallback path Chromium picks on its own) — the standard
    // pattern for reliable + faster software WebGL on headless CI runners.
    // Untouched locally: real GPU is already faster than any software path.
    launchOptions: process.env.CI ? {
      args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'],
    } : {},
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
