import { defineConfig } from 'vite';

export default defineConfig({
  // '/lane-defense/' for GitHub Pages, './' for Capacitor APK builds.
  // GitHub Actions sets VITE_BASE; local dev and Capacitor leave it unset.
  base: process.env.VITE_BASE ?? './',
});
