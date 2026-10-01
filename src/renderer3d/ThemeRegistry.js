// ThemeRegistry — per-level visual themes.
//
// Design principle: ONE dominant background tone per theme. The game's
// saturated bomb/car colors pop against a muted, harmonized backdrop.
// All sky, ground, and environment elements shift toward the dominant
// tone at reduced saturation so hero elements always win visual hierarchy.
//
// Theme mapping:
//   L1-4:   morning    — warm cream-gold, suburban, Tutorial City
//   L5-8:   afternoon  — deep sky blue, vivid, Tutorial City
//   L9-12:  sunset     — indigo-orange, dramatic, Tutorial City
//   L13-15: misty      — cool grey overcast, Tutorial City climax
//   L16-30: industrial — steel grey + orange hazard, World 2 Industrial Zone
//   L31-45: nightHighway — near-black sky, headlight fog, World 3 Night Highway
//   L46-60: desert, L61-75: frost, L76-90: harbor, L91-100: cosmos (Worlds 4-7)

export const THEMES = {
  // Morning: warm cream-gold dominates. Soft sage greenery, hazy horizon.
  morning: {
    sky:       { zenith: 0xfff4d6, mid: 0xf5e8c0, horizon: 0xffd089, glow: 0xffbe50 },
    hemi:      { sky: 0xf5e8c0, ground: 0x8a9d6c, intensity: 1.10 },
    sun:       { color: 0xfff8e0, intensity: 1.45 },
    ambient:   { color: 0xfff8f0, intensity: 0.48 },
    fog:       { color: 0xf0d8a8, near: 30, far: 92 },
    roadColor: 0x1c1c1a,   // very slightly warm grey
  },
  // Afternoon: deep sky blue dominates. Golden warm horizon, vivid greens.
  afternoon: {
    sky:       { zenith: 0x1a88dd, mid: 0x55b8f0, horizon: 0xffd060, glow: 0xffbe40 },
    hemi:      { sky: 0xc8e8ff, ground: 0x90a830, intensity: 1.50 },
    sun:       { color: 0xfffce8, intensity: 1.65 },
    ambient:   { color: 0xffffff, intensity: 0.62 },
    fog:       { color: 0xaad4f8, near: 38, far: 128 },
    roadColor: 0x1c1c1c,   // neutral dark grey
  },
  // Sunset: deep indigo-purple dominates. Warm orange rim, dramatic shadows.
  sunset: {
    sky:       { zenith: 0x1a3a80, mid: 0x703090, horizon: 0xff8820, glow: 0xff5500 },
    hemi:      { sky: 0x773399, ground: 0x7a3320, intensity: 1.00 },
    sun:       { color: 0xff8840, intensity: 1.25 },
    ambient:   { color: 0xff9960, intensity: 0.38 },
    fog:       { color: 0xff7722, near: 24, far: 90 },
    roadColor: 0x1e1c1a,   // warm dark — slightly orange-tinted
  },
  // Misty: cool blue-grey dominates. Light ground haze; cars visible throughout road.
  // near=20 minimum so cars remain visible — do not lower.
  misty: {
    sky:       { zenith: 0x7a8c99, mid: 0xa0b0bb, horizon: 0xd8dede, glow: 0xc8cdd8 },
    hemi:      { sky: 0x8899aa, ground: 0x55687a, intensity: 0.82 },
    sun:       { color: 0xdde8ee, intensity: 0.62 },
    ambient:   { color: 0xd0dde8, intensity: 0.58 },
    fog:       { color: 0xc8d0d8, near: 20, far: 70 },
    roadColor: 0x1a1c1e,   // cool dark — slightly blue-tinted
  },
  // Industrial Zone (World 2, L16-30): steel-grey overcast sky, vivid orange hazard
  // horizon glow from factory flares. Warm smoky fog. Gritty, high-stakes feel.
  industrial: {
    sky:       { zenith: 0x3a3f4a, mid: 0x52596a, horizon: 0xff6a1a, glow: 0xff4400 },
    hemi:      { sky: 0x506070, ground: 0x202820, intensity: 0.75 },
    sun:       { color: 0xffa040, intensity: 0.85 },
    ambient:   { color: 0x8a9aaa, intensity: 0.35 },
    fog:       { color: 0x8a7a6a, near: 18, far: 55 },
    roadColor: 0x1a1510,   // dark warm brown-grey
  },
  // Night Highway (World 3, L31+): near-black sky, deep navy horizon, white-blue
  // headlight scatter fog. Low ambient — car emissives must carry the scene.
  // emissiveBoost is read by Car3D to increase car glow in dark conditions.
  nightHighway: {
    sky:       { zenith: 0x050a18, mid: 0x0a1530, horizon: 0x0a1a3a, glow: 0x1a2a5a },
    hemi:      { sky: 0x0a1a3a, ground: 0x050f1a, intensity: 0.40 },
    sun:       { color: 0x8090d0, intensity: 0.30 },
    ambient:   { color: 0xd0e8ff, intensity: 0.60 },
    fog:       { color: 0xd0e0ff, near: 10, far: 35 },
    roadColor: 0x0d0d14,   // very dark blue-black
    emissiveBoost: 0.4,
  },
  // Desert (World 4, L46-60): hot pale sky, sandy glow, light dust haze.
  desert: {
    sky:       { zenith: 0x4aa8e8, mid: 0xa8d4ee, horizon: 0xffd9a0, glow: 0xffb860 },
    hemi:      { sky: 0xe8dcc0, ground: 0xc89858, intensity: 1.35 },
    sun:       { color: 0xfff0d0, intensity: 1.60 },
    ambient:   { color: 0xfff4e4, intensity: 0.58 },
    fog:       { color: 0xf0d8b0, near: 30, far: 96 },
    roadColor: 0x2a2622,
  },
  // Frost (World 5, L61-75): pale blue overcast, cold white haze. near >= 20.
  frost: {
    sky:       { zenith: 0x7fa6d0, mid: 0xb4d0ea, horizon: 0xeaf4fc, glow: 0xd8ecff },
    hemi:      { sky: 0xd0e4f8, ground: 0x8aa0b8, intensity: 1.10 },
    sun:       { color: 0xeaf4ff, intensity: 0.95 },
    ambient:   { color: 0xdcecff, intensity: 0.60 },
    fog:       { color: 0xdce8f4, near: 22, far: 78 },
    roadColor: 0x20242a,
  },
  // Harbor (World 6, L76-90): late-day teal sky, warm sodium horizon, salt haze.
  harbor: {
    sky:       { zenith: 0x1e5a8a, mid: 0x4a90b0, horizon: 0xffb070, glow: 0xff8a40 },
    hemi:      { sky: 0x9ccce0, ground: 0x4a6068, intensity: 1.05 },
    sun:       { color: 0xffd8a0, intensity: 1.20 },
    ambient:   { color: 0xdcecf4, intensity: 0.50 },
    fog:       { color: 0x9cc0cc, near: 24, far: 84 },
    roadColor: 0x1c2024,
  },
  // Cosmos (World 7, L91-100): deep violet space, neon rim, dark low fog.
  cosmos: {
    sky:       { zenith: 0x0a0420, mid: 0x1c0a48, horizon: 0x4a1a8a, glow: 0xb040ff },
    hemi:      { sky: 0x4a2a8a, ground: 0x120a2a, intensity: 0.55 },
    sun:       { color: 0xb090ff, intensity: 0.40 },
    ambient:   { color: 0xd8c8ff, intensity: 0.58 },
    fog:       { color: 0x2a1458, near: 14, far: 48 },
    roadColor: 0x120c1e,
    emissiveBoost: 0.35,
  },
};

// Map level id to a theme.
export function levelTheme(levelId) {
  if (levelId <= 4)  return THEMES.morning;
  if (levelId <= 8)  return THEMES.afternoon;
  if (levelId <= 12) return THEMES.sunset;
  if (levelId <= 15) return THEMES.misty;
  if (levelId <= 30) return THEMES.industrial;
  if (levelId <= 45) return THEMES.nightHighway;
  if (levelId <= 60) return THEMES.desert;
  if (levelId <= 75) return THEMES.frost;
  if (levelId <= 90) return THEMES.harbor;
  return THEMES.cosmos;
}
