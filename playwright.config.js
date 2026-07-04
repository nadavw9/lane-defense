// Playwright config for the visual/integration harness (tests-visual/).
// Separate from vitest on purpose: the 1062 headless unit/audit tests stay at ~2s
// (`npm test`), while this suite boots the real game in chromium.
//
//   npm run test:visual        → smoke set (per-commit, ~2-3 min)
//   npm run test:visual:full   → smoke + all-40-level sweep (nightly/manual)
//
// The dev server is auto-started (and reused if already running on :5173).

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests-visual',
  timeout: 60_000,
  retries: 1,                     // WebGL boot can be flaky under CI load
  workers: 2,                     // each worker holds a WebGL context — keep low
  outputDir: 'tests-visual/failures',
  use: {
    baseURL: 'http://localhost:5173/',
    viewport: { width: 390, height: 844 },   // APP_W × APP_H — stage coords == client coords
    deviceScaleFactor: 1,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
