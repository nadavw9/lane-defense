// ThemeRegistry — per-level sub-variants of the "woods" theme.
//
// Design principle: ONE dominant background tone per theme. The game's
// saturated bomb/car colors pop against a muted, harmonized backdrop.
// All sky, ground, and environment elements shift toward the dominant
// tone at reduced saturation so hero elements always win visual hierarchy.

export const THEMES = {
  // Morning: warm cream-gold dominates. Soft sage greenery, hazy horizon.
  morning: {
    sky:    { zenith: 0xfff4d6, mid: 0xf5e8c0, horizon: 0xffd089, glow: 0xffbe50 },
    hemi:   { sky: 0xf5e8c0, ground: 0x8a9d6c, intensity: 1.10 },
    sun:    { color: 0xfff8e0, intensity: 1.45 },
    ambient:{ color: 0xfff8f0, intensity: 0.48 },
    fog:    { color: 0xf0d8a8, near: 30, far: 92 },
  },
  // Afternoon: deep sky blue dominates. Golden warm horizon, vivid greens.
  afternoon: {
    sky:    { zenith: 0x1a88dd, mid: 0x55b8f0, horizon: 0xffd060, glow: 0xffbe40 },
    hemi:   { sky: 0xc8e8ff, ground: 0x90a830, intensity: 1.50 },
    sun:    { color: 0xfffce8, intensity: 1.65 },
    ambient:{ color: 0xffffff, intensity: 0.62 },
    fog:    { color: 0xaad4f8, near: 38, far: 128 },
  },
  // Sunset: deep indigo-purple dominates. Warm orange rim, dramatic shadows.
  sunset: {
    sky:    { zenith: 0x1a3a80, mid: 0x703090, horizon: 0xff8820, glow: 0xff5500 },
    hemi:   { sky: 0x773399, ground: 0x7a3320, intensity: 1.00 },
    sun:    { color: 0xff8840, intensity: 1.25 },
    ambient:{ color: 0xff9960, intensity: 0.38 },
    fog:    { color: 0xff7722, near: 24, far: 90 },
  },
  // Misty: cool blue-grey dominates. Soft, low-contrast, fog-heavy.
  misty: {
    sky:    { zenith: 0x7a8c99, mid: 0xa0b0bb, horizon: 0xd8dede, glow: 0xc8cdd8 },
    hemi:   { sky: 0x8899aa, ground: 0x55687a, intensity: 0.82 },
    sun:    { color: 0xdde8ee, intensity: 0.62 },
    ambient:{ color: 0xd0dde8, intensity: 0.58 },
    fog:    { color: 0xc2cfd8, near: 30, far: 95 },
  },
  // Autumn: deep blue sky, rich amber/orange foliage, warm earth ground.
  autumn: {
    sky:    { zenith: 0x1848aa, mid: 0xbb6622, horizon: 0xffaa22, glow: 0xff7711 },
    hemi:   { sky: 0xdda030, ground: 0x8b4513, intensity: 1.20 },
    sun:    { color: 0xffeea0, intensity: 1.55 },
    ambient:{ color: 0xffeecc, intensity: 0.48 },
    fog:    { color: 0xffaa44, near: 20, far: 75 },
  },
};

// Map level id to a theme.  L1-4: morning, L5-8: afternoon, L9-12: sunset,
// L13-16: misty, L17+: autumn.
export function levelTheme(levelId) {
  if (levelId <= 4)  return THEMES.morning;
  if (levelId <= 8)  return THEMES.afternoon;
  if (levelId <= 12) return THEMES.sunset;
  if (levelId <= 16) return THEMES.misty;
  return THEMES.autumn;
}
