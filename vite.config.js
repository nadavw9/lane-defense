import { defineConfig } from 'vite';

export default defineConfig({
  // '/lane-defense/' for GitHub Pages, './' for Capacitor APK builds.
  base: process.env.VITE_BASE ?? './',
  build: {
    // Disable minification temporarily to get readable error messages.
    // Re-enable once the startup crash is fixed.
    minify: false,
    sourcemap: true,
  },
});
