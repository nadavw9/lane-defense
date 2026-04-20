import { defineConfig } from 'vite';

export default defineConfig({
  // '/lane-defense/' for GitHub Pages, './' for Capacitor APK builds.
  base: process.env.VITE_BASE ?? './',
});
