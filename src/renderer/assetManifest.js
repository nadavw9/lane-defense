// assetManifest — single source of truth for every sprite URL the game preloads,
// plus the level→theme selection helpers. Extracted from GameApp.js so headless
// audit tests (tests/audit-assets.test.js) can verify every URL resolves to a real
// file on disk with an EXACT-case match and is not gitignored — the two historical
// causes of production-only 404s on GitHub Pages (case-sensitive host).
//
// Rules:
//  - Every runtime-loaded sprite family must be represented here (renderers may
//    build the same URLs dynamically, but the files are identical).
//  - Always prefix with BASE_URL; never hardcode '/sprites/...'.

const _B = import.meta.env.BASE_URL;   // '' in dev, '/lane-defense/' on GH Pages

export const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];

export const CAR_URLS = [
  ...COLORS.map(c => `${_B}sprites/cars/car-${c}.png`),
  `${_B}sprites/cars/car-boss.png`,
];

export const SHOOTER_URLS = COLORS.flatMap(c => [
  `${_B}sprites/shooters/shooter-${c}-idle.png`,
  `${_B}sprites/shooters/shooter-${c}-fire.png`,
]);

// Three theme building sets, swapped by world (see buildingSetForLevel).
export const BUILDING_SETS = {
  tutorial:   [1, 2, 3, 4, 5].map(i => `${_B}sprites/designed/building-tutorial-${i}.png`),
  industrial: [1, 2, 3, 4, 5].map(i => `${_B}sprites/designed/building-industrial-${i}.png`),
  night:      [1, 2, 3, 4, 5].map(i => `${_B}sprites/designed/building-night-${i}.png`),
};
export const BUILDING_URLS = [...BUILDING_SETS.tutorial, ...BUILDING_SETS.industrial, ...BUILDING_SETS.night];

// World → building set. Tutorial City L1–15, Industrial Zone L16–30, Night Highway L31–40.
// Daily challenge (non-numeric levelId) uses the tutorial set.
export function buildingSetForLevel(levelId) {
  if (typeof levelId !== 'number') return 'tutorial';
  if (levelId <= 15) return 'tutorial';
  if (levelId <= 30) return 'industrial';
  return 'night';
}

// AI world side-panel image, selected by level range (VISION worlds):
//   World 1 (city) L1–13, World 2 (industrial) L14–26, World 3 (night) L27–40.
export function worldPanelForLevel(levelId) {
  if (typeof levelId !== 'number') return 'world1';
  if (levelId <= 13) return 'world1';
  if (levelId <= 26) return 'world2';
  return 'world3';
}

export const TREE_URLS = ['oak', 'elm', 'pine'].map(t => `${_B}sprites/designed/tree-${t}-topdown.png`);

export const ENV_URLS = [
  `${_B}sprites/designed/sidewalk-grass-strip.png`,
  `${_B}sprites/designed/panel-workshop-surface.png`,
  `${_B}sprites/designed/park-grass-tile.png`,
];

// Booster icons — all three have real PNGs (colorchange = rainbow paintbrush);
// preloaded so BoosterBar's _addIconSprite uses the sprite, not the glyph fallback.
export const BOOSTER_URLS = ['colorchange', 'freeze', 'bomb'].map(b => `${_B}sprites/designed/booster-${b}.png`);

// Powerball bomb sprites — filenames are lowercase on disk and the 3D loader
// requests them lowercase too; preload must match or it 404s on case-sensitive
// hosts (Pages). Includes the merged-bomb variants used when isMerged.
export const POWERBALL_URLS = [
  ...COLORS.map(c => `${_B}sprites/designed/powerball-${c.toLowerCase()}.png`),
  ...COLORS.map(c => `${_B}sprites/designed/powerball-merged-${c.toLowerCase()}.png`),
];

// Tutorial screenshots shown in HowToPlayOverlay (real-gameplay captures from L22).
// Cosmetic — the overlay degrades to a blank frame if one fails to load.
export const TUTORIAL_URLS = ['01-goal', '02-shot', '03-merge', '04-boosters']
  .map(n => `${_B}sprites/tutorial/${n}.png`);

// AI-generated background art: full-screen title background + logo, and the three
// world side-panel image pairs (city / industrial / night).
export const TITLE_ART_URLS = [
  `${_B}sprites/designed/title-background.png`,
  `${_B}sprites/designed/title-logo.png`,
];

export const WORLD_PANEL_URLS = [1, 2, 3].flatMap(w => [
  `${_B}sprites/designed/world${w}-left.png`,
  `${_B}sprites/designed/world${w}-right.png`,
]);

// Per-world road tiles — sliced from each world's '-a' scene by
// scripts/process-scenes.mjs, with the lane dash painted programmatically on
// the tile centre-line (Road3D's half-tile offset turns it into the dividers).
export const WORLD_ROAD_URLS = {
  world1: `${_B}sprites/designed/road-world1.png`,
  world2: `${_B}sprites/designed/road-world2.png`,
  world3: `${_B}sprites/designed/road-world3.png`,
};

// Strip-native side panels (Batch S): band aspect == on-screen strip aspect, so
// CityEdges renders them width-fit + vertically tiled — the full band width is
// always shown and buildings can never be sliced. The legacy world*.png panels
// remain as the cover-crop fallback.
export const STRIP_PANEL_URLS = [1, 2, 3].flatMap(w => [
  `${_B}sprites/designed/strip-world${w}-left.png`,
  `${_B}sprites/designed/strip-world${w}-right.png`,
]);

// Full-scene slices (one AI scene per world+variant → 4 unified surfaces).
// Variants a/b/c rotate across levels within a world (sceneVariantForLevel).
export const SCENE_VARIANTS = ['a', 'b', 'c'];
export const SCENE_STRIP_URLS = [1, 2, 3].flatMap(w => SCENE_VARIANTS.flatMap(v => [
  `${_B}sprites/designed/strip-world${w}-${v}-left.png`,
  `${_B}sprites/designed/strip-world${w}-${v}-right.png`,
]));
export const ZONE_FLOOR_URLS = [1, 2, 3].flatMap(w => SCENE_VARIANTS.map(v =>
  `${_B}sprites/designed/zone-world${w}-${v}.png`,
));
// Variant used for a given level within its world (a/b/c cycle).
export function sceneVariantForLevel(levelId) {
  if (typeof levelId !== 'number') return 'a';
  return SCENE_VARIANTS[levelId % SCENE_VARIANTS.length];
}

// UI icon set (Batch 1) — one AI montage sliced by scripts/process-ui-icons.mjs
// into 128×128 transparent PNGs. Replaces the ~120 emoji instances across
// screens via the uiIcon() helper (emoji glyph stays as the fallback, so these
// are NOT critical sprites). Names match the montage grid order exactly.
export const UI_ICON_NAMES = [
  'star-filled', 'star-empty', 'play', 'back', 'heart', 'coin', 'gear',
  'trophy', 'book', 'share', 'chart', 'gift', 'fire', 'timer', 'target',
  'check', 'close', 'shield', 'skull', 'hand',
  // Batch 1b
  'explosion', 'snowflake', 'lightning', 'car', 'speaker',
];
export const UI_ICON_URLS = UI_ICON_NAMES.map(n => `${_B}sprites/ui/icon-${n}.png`);

export const ALL_SPRITE_URLS = [
  ...CAR_URLS, ...SHOOTER_URLS, ...POWERBALL_URLS, ...BUILDING_URLS, ...TREE_URLS,
  ...ENV_URLS, ...BOOSTER_URLS, ...TUTORIAL_URLS, ...TITLE_ART_URLS, ...WORLD_PANEL_URLS,
  ...STRIP_PANEL_URLS, ...SCENE_STRIP_URLS, ...ZONE_FLOOR_URLS, ...UI_ICON_URLS,
  ...Object.values(WORLD_ROAD_URLS),
];

// Critical sprites gate spriteFlags.loaded — gameplay must have its car icons,
// bomb/shooter sprites, and booster icons. Cosmetic sprites (buildings, trees,
// grass) may fail to load and degrade to programmatic fallbacks instead of
// blanking the whole scene. See the resilient loader in GameApp.main().
export const CRITICAL_SPRITE_URLS = new Set([...CAR_URLS, ...SHOOTER_URLS, ...BOOSTER_URLS]);
