// ThemeRegistry — per-level sub-variants of the "woods" theme.
// Each theme adjusts sky gradient colors, lighting, and fog to create a
// distinct time-of-day feel without changing the core road/environment assets.

export const THEMES = {
  morning: {
    sky:    { zenith: 0x6ba8d8, mid: 0xaad4f5, horizon: 0xffd8b0, glow: 0xffbb88 },
    hemi:   { sky: 0xb8d4f0, ground: 0x5a8030, intensity: 1.3 },
    sun:    { color: 0xfff0d0, intensity: 1.4 },
    ambient:{ color: 0xfff8f0, intensity: 0.55 },
    fog:    { color: 0xffd0a8, near: 22, far: 80 },
  },
  afternoon: {
    sky:    { zenith: 0x3da0e8, mid: 0x72c8ff, horizon: 0xfff8e8, glow: 0xffe8a8 },
    hemi:   { sky: 0xc8e8ff, ground: 0x7ac043, intensity: 1.4 },
    sun:    { color: 0xfff5e0, intensity: 1.6 },
    ambient:{ color: 0xffffff, intensity: 0.6 },
    fog:    { color: 0xc8e8ff, near: 25, far: 90 },
  },
  sunset: {
    sky:    { zenith: 0x2a4a88, mid: 0x884499, horizon: 0xff7722, glow: 0xff4400 },
    hemi:   { sky: 0x8855aa, ground: 0x883322, intensity: 1.1 },
    sun:    { color: 0xff9944, intensity: 1.2 },
    ambient:{ color: 0xffcc88, intensity: 0.45 },
    fog:    { color: 0xff8833, near: 15, far: 60 },
  },
  misty: {
    sky:    { zenith: 0x8899aa, mid: 0xaabbcc, horizon: 0xdddddd, glow: 0xccccdd },
    hemi:   { sky: 0x99aacc, ground: 0x667788, intensity: 0.9 },
    sun:    { color: 0xeeeeff, intensity: 0.75 },
    ambient:{ color: 0xddeeff, intensity: 0.65 },
    fog:    { color: 0xaabbcc, near: 10, far: 42 },
  },
  autumn: {
    sky:    { zenith: 0x4488cc, mid: 0xdd8833, horizon: 0xffcc66, glow: 0xffaa44 },
    hemi:   { sky: 0xddaa44, ground: 0x886622, intensity: 1.2 },
    sun:    { color: 0xffdd88, intensity: 1.5 },
    ambient:{ color: 0xffeecc, intensity: 0.55 },
    fog:    { color: 0xffcc88, near: 20, far: 70 },
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
