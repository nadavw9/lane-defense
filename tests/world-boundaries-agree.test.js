// Every per-level "which world is this?" helper must agree with the VISION worlds:
// W1 L1–15, W2 L16–30, W3 L31–40. worldPanelForLevel drifted to 13/26 while
// buildingSetForLevel and ThemeRegistry stayed on 15/30, so L14–15 showed
// industrial side panels on a misty level and L27–30 night panels on an
// industrial road. One table, three helpers, checked at every level.
import { describe, it, expect } from 'vitest';
import { worldPanelForLevel, buildingSetForLevel } from '../src/renderer/assetManifest.js';
import { levelTheme, THEMES } from '../src/renderer3d/ThemeRegistry.js';

const visionWorld = (id) => (id <= 15 ? 1 : id <= 30 ? 2 : 3);
const PANEL    = { 1: 'world1',   2: 'world2',     3: 'world3' };
const BUILDING = { 1: 'tutorial', 2: 'industrial', 3: 'night' };
const THEME_WORLD = (t) =>
  t === THEMES.industrial ? 2 : t === THEMES.nightHighway ? 3 : 1;

describe('world boundaries agree across helpers (VISION 15 / 15 / 10)', () => {
  for (let id = 1; id <= 40; id++) {
    it(`L${id} is world ${visionWorld(id)} everywhere`, () => {
      const w = visionWorld(id);
      expect(worldPanelForLevel(id)).toBe(PANEL[w]);
      expect(buildingSetForLevel(id)).toBe(BUILDING[w]);
      expect(THEME_WORLD(levelTheme(id))).toBe(w);
    });
  }
});
