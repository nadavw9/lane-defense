// Regression: level-start contracts.
// Verifies every level (1-40) is configured in a valid, playable state, and that
// no car type can appear before the level where it is introduced.
//
// Pure config-level checks — no GameLoop needed. Reads level configs through the
// LevelManager public API (PROGRESSION itself is module-private) and inspects the
// CarTypes weight bands without modifying source: pickCarType() hands its weight
// array to rng.weightedPick(), so a capturing fake rng recovers the exact band.
import { describe, it, expect } from 'vitest';
import { LevelManager, openingCarsForLevel, openingRowsForLevel } from '../src/game/LevelManager.js';
import { pickCarType, CAR_TYPES } from '../src/director/CarTypes.js';

const TOTAL_LEVELS = 40;
const BOSS_LEVELS  = [10, 20, 30, 40];

function cfgFor(levelId) {
  const lm = new LevelManager();
  lm.goToLevel(levelId);
  return lm.current;
}

// ── Per-level start-state contracts ─────────────────────────────────────────────
describe('regression: every level starts in a valid state', () => {
  for (let n = 1; n <= TOTAL_LEVELS; n++) {
    it(`L${n} config is valid`, () => {
      const cfg = cfgFor(n);

      // 1. Finite, positive spawn budget.
      expect(Number.isFinite(cfg.spawnBudget)).toBe(true);
      expect(cfg.spawnBudget).toBeGreaterThan(0);

      // 2. Lane count in range.
      expect(cfg.laneCount).toBeGreaterThanOrEqual(1);
      expect(cfg.laneCount).toBeLessThanOrEqual(4);

      // 3. Columns mirror lanes.
      expect(cfg.colCount).toBe(cfg.laneCount);

      // 4-5. Colour variety.
      expect(cfg.colors.length).toBeGreaterThanOrEqual(1);
      if (cfg.id > 3) expect(cfg.colors.length).toBeGreaterThanOrEqual(2);

      // 6. Grid-rows invariant (post-rebalance, now 16).
      expect(cfg.gridRows).toBe(16);

      // 7. Lane target car count: L1 eases in with 1, bosses crowd to 3, rest 2.
      const expectedTarget = cfg.id === 1 ? 1 : BOSS_LEVELS.includes(cfg.id) ? 3 : 2;
      expect(cfg.laneTargetCarCount).toBe(expectedTarget);

      // 8. At least one car per lane must exist to defeat.
      expect(cfg.spawnBudget).toBeGreaterThanOrEqual(cfg.laneCount);

      // 9. Uniform opening: EVERY level opens with 3 cars per lane filling the top
      //    rows [0,1,2]. The visual gap between them comes from car render size
      //    (SPRITE_SCALE), not row spacing. Difficulty is carried by bomb power + car
      //    count, not the opening geometry — same on every level, never near breach.
      expect(openingCarsForLevel(cfg.id)).toBe(3);
      expect(openingRowsForLevel(cfg.id)).toEqual([0, 1, 2]);
      // Opening cars never start on or past the breach line (row gridRows-1).
      for (const row of openingRowsForLevel(cfg.id)) {
        expect(row).toBeLessThan(cfg.gridRows - 1);
      }
    });
  }
});

// ── Car-type introduction ordering ──────────────────────────────────────────────
// Design contract mirrored from GameApp.LEVEL_INTRO_TYPE (which lives inside a
// pixi-importing module that can't load headlessly). If that map changes, this
// must change with it — that is the point of pinning it here.
const LEVEL_INTRO_TYPE = {
  1:  'small',   // motorbike
  2:  'big',     // sedan
  5:  'jeep',    // van
  9:  'truck',
  13: 'bigrig',
  15: 'tank',
};

const PHASES = ['CALM', 'BUILD', 'PRESSURE', 'CLIMAX', 'RELIEF'];

// Recover the set of car types with non-zero weight at a level, across all phases,
// by capturing the weight array pickCarType() passes to rng.weightedPick().
// No availableRows arg → unfiltered band weights (pure level/phase contract).
function typesAvailableAt(level) {
  const set = new Set();
  for (const phase of PHASES) {
    let captured = null;
    const fakeRng = { weightedPick: (weights) => { captured = weights; return weights[0].value; } };
    pickCarType(fakeRng, level, phase);
    for (const entry of captured) if (entry.weight > 0) set.add(entry.value);
  }
  return set;
}

describe('regression: car-type introduction ordering', () => {
  it('intro types all exist in CAR_TYPES', () => {
    for (const type of Object.values(LEVEL_INTRO_TYPE)) {
      expect(CAR_TYPES).toHaveProperty(type);
    }
  });

  it('intro sequence is strictly ordered by level number', () => {
    const levels = Object.keys(LEVEL_INTRO_TYPE).map(Number);
    const sorted = [...levels].sort((a, b) => a - b);
    expect(levels).toEqual(sorted);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]).toBeGreaterThan(sorted[i - 1]);
    }
  });

  for (const [introLevelStr, type] of Object.entries(LEVEL_INTRO_TYPE)) {
    const introLevel = Number(introLevelStr);
    it(`'${type}' never spawns before its intro at L${introLevel}`, () => {
      for (let L = 1; L < introLevel; L++) {
        expect(
          typesAvailableAt(L).has(type),
          `'${type}' must have zero weight at L${L} (introduced at L${introLevel})`,
        ).toBe(false);
      }
    });

    it(`'${type}' is actually available from L${introLevel} onward (intro is real)`, () => {
      expect(typesAvailableAt(introLevel).has(type)).toBe(true);
    });
  }
});
