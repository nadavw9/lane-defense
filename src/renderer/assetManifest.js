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

import { MAP_WORLDS, worldForLevel } from '../screens/levelMapLayout.js';
import { TRAIT_KEYS, traitSpritePath } from './traitIcons.js';

const _B = import.meta.env.BASE_URL;   // '' in dev, '/lane-defense/' on GH Pages

// Worlds that exist in the campaign right now (derived from the level table, so a
// world's art is preloaded exactly when its levels are). ['world1', ...] / [1, ...]
const WORLD_THEMES = MAP_WORLDS.map(w => w.theme);
const WORLD_NUMS   = WORLD_THEMES.map(t => Number(t.slice(5)));
// Worlds 4+ have no side strips or panels: their baked backdrops cover the whole
// scene (road, verges, depot), so only worlds 1-3 ship the legacy strip art.
const STRIP_NUMS   = WORLD_NUMS.filter(w => w <= 3);

export const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];

export const CAR_URLS = [
  ...COLORS.map(c => `${_B}sprites/cars/car-${c}.png`),
  `${_B}sprites/designed/boss.png`,
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
const BUILDING_SET_BY_THEME = {
  world1: 'tutorial', world2: 'industrial', world3: 'night',
  world4: 'industrial', world5: 'tutorial', world6: 'night', world7: 'night',
};
export function buildingSetForLevel(levelId) {
  if (typeof levelId !== 'number') return 'tutorial';
  return BUILDING_SET_BY_THEME[worldForLevel(levelId).theme] ?? 'night';
}

// AI world side-panel image, selected by level range (VISION worlds):
//   World 1 (city) L1–15, World 2 (industrial) L16–30, World 3 (night) L31–40 —
//   the VISION worlds, matching buildingSetForLevel and ThemeRegistry. (Was 13/26,
//   so L14–15 showed industrial panels on a misty level and L27–30 night panels on
//   an industrial road.)
export function worldPanelForLevel(levelId) {
  if (typeof levelId !== 'number') return 'world1';
  return worldForLevel(levelId).theme;
}

// Cleaned-up top-down car used on the TITLE intro (the cars/ set has rough edges;
// the designed/ '-processed' variant is glossier with a clean cut).
export const TITLE_INTRO_CAR_URL = `${_B}sprites/designed/car-blue-processed.png`;

// Goal-card icons (GoalCounterUI): destroyColor goals show a dedicated stylized
// side-view car icon in the goal's COLOR (Bug D — sliced from goal-cars.png by
// scripts/process-goal-car-sprites.mjs; was the 32px top-down gameplay sprite);
// destroyType goals show the type's red variant. Cosmetic — the UI falls back to
// the old top-down sprite, then a circle / glyph, if one fails to load.
export const GOAL_ICON_URLS = [
  ...COLORS.map(c => `${_B}sprites/designed/goal-car-${c}.png`),
  ...COLORS.map(c => `${_B}sprites/designed/car-${c}-processed.png`),   // fallback tier + title intro car
  ...['bike', 'van', 'truck', 'bigrig', 'tank'].map(t => `${_B}sprites/designed/${t}-red.png`),
];

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
// hosts (Pages).
export const POWERBALL_URLS = [
  ...COLORS.map(c => `${_B}sprites/designed/powerball-${c.toLowerCase()}.png`),
];

// Tutorial screenshots shown in HowToPlayOverlay (real-gameplay captures from L22).
// Cosmetic — the overlay degrades to a blank frame if one fails to load.
export const TUTORIAL_URLS = ['01-goal', '02-shot', '04-boosters']
  .map(n => `${_B}sprites/tutorial/${n}.png`);

// AI-generated background art: full-screen title background + logo, and the three
// world side-panel image pairs (city / industrial / night).
export const TITLE_ART_URLS = [
  `${_B}sprites/designed/title-background.png`,
  `${_B}sprites/designed/title-logo.png`,
];

export const WORLD_PANEL_URLS = STRIP_NUMS.flatMap(w => [
  `${_B}sprites/designed/world${w}-left.png`,
  `${_B}sprites/designed/world${w}-right.png`,
]);

// Per-world road tiles — sliced from each world's '-a' scene by
// scripts/process-scenes.mjs, with the lane dash painted programmatically on
// the tile centre-line (Road3D's half-tile offset turns it into the dividers).
export const WORLD_ROAD_URLS = Object.fromEntries(
  WORLD_THEMES.map(t => [t, `${_B}sprites/designed/road-${t}.png`]));

// Strip-native side panels (Batch S): band aspect == on-screen strip aspect, so
// CityEdges renders them width-fit + vertically tiled — the full band width is
// always shown and buildings can never be sliced. The legacy world*.png panels
// remain as the cover-crop fallback.
export const STRIP_PANEL_URLS = STRIP_NUMS.flatMap(w => [
  `${_B}sprites/designed/strip-world${w}-left.png`,
  `${_B}sprites/designed/strip-world${w}-right.png`,
]);

// Full-scene slices (one AI scene per world+variant → 4 unified surfaces).
// Variants a/b/c rotate across levels within a world (sceneVariantForLevel).
export const SCENE_VARIANTS = ['a', 'b', 'c'];
export const SCENE_STRIP_URLS = STRIP_NUMS.flatMap(w => SCENE_VARIANTS.flatMap(v => [
  `${_B}sprites/designed/strip-world${w}-${v}-left.png`,
  `${_B}sprites/designed/strip-world${w}-${v}-right.png`,
]));
export const ZONE_FLOOR_URLS = WORLD_NUMS.flatMap(w => SCENE_VARIANTS.map(v =>
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

// Batch 2 chrome — 9-slice button plates (green primary + slate secondary).
// Non-critical; TitleScreen keeps its Graphics fallback if a plate 404s.
export const BUTTON_PLATE_URLS = ['button-primary', 'button-secondary'].map(n => `${_B}sprites/ui/${n}.png`);

// Batch 2 chrome — Win/Lose celebration frames (additive art over existing screens).
// win-stars.png exists in the repo but is intentionally UNUSED (a static gold trio
// duplicates/contradicts the animated earned-star row) → not preloaded.
export const FRAME_URLS = ['win-burst', 'lose-frame'].map(n => `${_B}sprites/ui/${n}.png`);

// Level map (2026-09-28): one baked background per world page + the city-repair
// buildings in three states (rubble / scaffold / repaired) × three variants.
export const MAP_URLS = [
  ...WORLD_THEMES.map(t => `${_B}sprites/designed/map-${t}.png`),
  ...WORLD_THEMES.flatMap(t => [0, 1, 2].flatMap(st => [0, 1, 2].map(v => `${_B}sprites/designed/repair-${t}-${st}-${v}.png`))),
];

// V2 intro art shown on the level card.
export const V2_INTRO_URLS = [...new Set(TRAIT_KEYS.map(k => `${_B}${traitSpritePath(k)}`))]
  .filter(u => !u.endsWith('car-purple-processed.png'));   // phantom reuses the sedan, already in CAR_URLS

export const ALL_SPRITE_URLS = [
  ...MAP_URLS, ...V2_INTRO_URLS,
  ...CAR_URLS, ...SHOOTER_URLS, ...POWERBALL_URLS, ...BUILDING_URLS, ...TREE_URLS,
  ...ENV_URLS, ...BOOSTER_URLS, ...TUTORIAL_URLS, ...TITLE_ART_URLS, ...WORLD_PANEL_URLS,
  ...STRIP_PANEL_URLS, ...SCENE_STRIP_URLS, ...ZONE_FLOOR_URLS, ...UI_ICON_URLS,
  ...BUTTON_PLATE_URLS, ...FRAME_URLS, ...GOAL_ICON_URLS,   // GOAL_ICON_URLS includes TITLE_INTRO_CAR_URL (car-blue-processed)
  ...Object.values(WORLD_ROAD_URLS),
];

// Critical sprites gate spriteFlags.loaded — gameplay must have its car icons,
// bomb/shooter sprites, and booster icons. Cosmetic sprites (buildings, trees,
// grass) may fail to load and degrade to programmatic fallbacks instead of
// blanking the whole scene. See the resilient loader in GameApp.main().
export const CRITICAL_SPRITE_URLS = new Set([...CAR_URLS, ...SHOOTER_URLS, ...BOOSTER_URLS]);

// Baked gameplay backdrops (tools/art/studio/backdrop.js, `render-3d-sprites.mjs
// backdrop`): one full-scene image per world × scene variant × lane count,
// rendered from projection.js's geometry. Loaded by Road3D's own THREE loader,
// so they are NOT in the Pixi preload list.
const BACKDROPS = new Set([
  ...WORLD_NUMS.flatMap(w => ['a', 'b', 'c'].map(v => `world${w}-${v}-3`)),
  'world1-b-1', 'world1-c-2',
]);
export function backdropUrlFor(levelId, laneCount) {
  const key = `${worldPanelForLevel(levelId)}-${sceneVariantForLevel(levelId)}-${laneCount}`;
  return BACKDROPS.has(key) ? `${_B}sprites/designed/backdrop-${key}.jpg` : null;
}
export const BACKDROP_KEYS = [...BACKDROPS];
