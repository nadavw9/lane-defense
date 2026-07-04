import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Unit/audit suite only. tests-visual/ is a Playwright Test suite
    // (npm run test:visual) and must not be collected by vitest.
    include: ['tests/**/*.test.js'],
  },
});
