// Level-config audit (bug class E — unwinnable/broken level configs).
//
// Catches the L19 class of bug (goal color Yellow while the palette was
// [Red, Blue, Green] → level literally unwinnable) and the L30/L40 class
// (destroyType goal for a car type the level band rarely/never spawns).
// Pure config checks — fast, deterministic, no simulation.

import { describe, it, expect } from 'vitest';
import { LevelManager } from '../src/game/LevelManager.js';
import { CAR_TYPES, bandWeights } from '../src/director/CarTypes.js';

const PALETTE = ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'];

function levelConfig(id) {
  const lm = new LevelManager();
  lm.goToLevel(id);
  return lm.current;
}

// Car types spawnable at this level: weight > 0 in ANY intensity phase of its band.
function spawnableTypes(levelId) {
  const band = bandWeights(levelId);
  const types = new Set();
  for (const phase of Object.values(band)) {
    for (const w of phase) if (w.weight > 0) types.add(w.value);
  }
  return types;
}

describe('audit: level configs (all 40)', () => {
  for (let id = 1; id <= 40; id++) {
    describe(`L${id}`, () => {
      const cfg = levelConfig(id);

      it('has sane board geometry', () => {
        expect(cfg.laneCount).toBeGreaterThanOrEqual(1);
        expect(cfg.laneCount).toBeLessThanOrEqual(4);
        expect(cfg.colCount).toBeGreaterThanOrEqual(1);
        expect(cfg.colCount).toBeLessThanOrEqual(4);
        expect(cfg.gridRows ?? 16).toBeGreaterThanOrEqual(8);
        expect(cfg.duration).toBeGreaterThan(0);
        expect(cfg.spawnBudget).toBeGreaterThan(0);
        expect(cfg.laneTargetCarCount ?? 2).toBeGreaterThanOrEqual(1);
        // Ceiling was 3 pre-2026-07-23 (4-lane only). THREE_LANE_REDESIGN_BATCH.md
        // §2a's pilot (L4-L8) verified laneTargetCarCount is the real per-lane
        // density lever for 3-lane levels (spawnBudget has no sim effect) and
        // needs ~2x a 4-lane level's value to hit the same win-rate band — L4-L8
        // land at 4. Raised with headroom for the remaining 3-lane rollout
        // (Phases 3-6) rather than re-tightened to the exact observed max.
        expect(cfg.laneTargetCarCount ?? 2).toBeLessThanOrEqual(6);
      });

      it('palette is a non-empty subset of the 6 game colors', () => {
        expect(cfg.colors.length).toBeGreaterThan(0);
        for (const c of cfg.colors) expect(PALETTE).toContain(c);
      });

      it('worldConfig difficulty knobs are sane', () => {
        expect(cfg.worldConfig.hpMultiplier).toBeGreaterThan(0);
        expect(cfg.worldConfig.hpMultiplier).toBeLessThan(3);
        expect(cfg.worldConfig.speed.base).toBeGreaterThan(0);
      });

      it('has at least one goal with positive counts', () => {
        expect(Array.isArray(cfg.goals)).toBe(true);
        expect(cfg.goals.length).toBeGreaterThan(0);
        for (const g of cfg.goals) expect(g.count).toBeGreaterThanOrEqual(1);
      });

      it('every destroyColor goal color exists in the level palette (L19 bug)', () => {
        for (const g of cfg.goals.filter(g => g.type === 'destroyColor')) {
          expect(cfg.colors, `L${id} goal color ${g.color} not in palette [${cfg.colors}]`)
            .toContain(g.color);
        }
      });

      it('every destroyType goal targets a spawnable car type', () => {
        const spawnable = spawnableTypes(id);
        const rows = (cfg.gridRows ?? 16) - 1;
        for (const g of cfg.goals.filter(g => g.type === 'destroyType')) {
          expect([...spawnable], `L${id} goal carType ${g.carType} never spawns in this band`)
            .toContain(g.carType);
          expect(CAR_TYPES[g.carType].minSpawnRow,
            `L${id} carType ${g.carType} minSpawnRow exceeds grid`).toBeLessThanOrEqual(rows);
        }
      });
    });
  }
});
