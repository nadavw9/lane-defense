// Every per-level "which world is this?" helper must agree with the VISION worlds:
// W1 L1–15, W2 L16–30, W3 L31–45, then worlds 4–7 to L100. worldPanelForLevel drifted to 13/26 while
// buildingSetForLevel and ThemeRegistry stayed on 15/30, so L14–15 showed
// industrial side panels on a misty level and L27–30 night panels on an
// industrial road. One table, three helpers, checked at every level.
import { describe, it, expect } from 'vitest';
import { worldPanelForLevel, buildingSetForLevel } from '../src/renderer/assetManifest.js';
import { levelTheme, THEMES } from '../src/renderer3d/ThemeRegistry.js';

const visionWorld = (id) => (id <= 15 ? 1 : id <= 30 ? 2 : id <= 45 ? 3 : id <= 60 ? 4 : id <= 75 ? 5 : id <= 90 ? 6 : 7);
const PANEL    = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map(w => [w, `world${w}`]));
const BUILDING = { 1: 'tutorial', 2: 'industrial', 3: 'night', 4: 'industrial', 5: 'tutorial', 6: 'night', 7: 'night' };
const THEME_WORLD = (t) =>
  t === THEMES.industrial ? 2 : t === THEMES.nightHighway ? 3 : t === THEMES.desert ? 4
    : t === THEMES.frost ? 5 : t === THEMES.harbor ? 6 : t === THEMES.cosmos ? 7 : 1;

describe('world boundaries agree across helpers (15 / 15 / 15 / 15 / 15 / 15 / 10)', () => {
  for (let id = 1; id <= 100; id++) {
    it(`L${id} is world ${visionWorld(id)} everywhere`, () => {
      const w = visionWorld(id);
      expect(worldPanelForLevel(id)).toBe(PANEL[w]);
      expect(buildingSetForLevel(id)).toBe(BUILDING[w]);
      expect(THEME_WORLD(levelTheme(id))).toBe(w);
    });
  }
});
