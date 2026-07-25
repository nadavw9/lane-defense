// Opening-board depth: live ↔ sim parity guard.
//
// The opening deal (how many rows of cars each lane starts with) is consumed by
// TWO independent code paths:
//   live: GameApp._startLevel -> gs.openingRows / gs.initialCars
//                             -> GameLoop._primeInitialCars
//   sim:  SimulationRunner.runLevel (its own priming block)
// Both MUST read the same source (LevelManager.openingRowsForLevel /
// clampInitialCarsToDepth). This is the same class of split-brain risk as the
// hpMultiplier double-discount that silently invalidated every pre-fix balance
// report — if the sim opens on a different board than the game, every balance
// number measured from it is fiction.
//
// 2026-07-25: opening depth became gridRows-AWARE for the rows-8 pilot. A flat
// 3-row deal is 19% of a 16-row board but 37% of an 8-row board, and sim-proved
// unwinnable at ANY tuning there. These tests pin the derivation AND the
// live/sim agreement, at every board depth the game ships.
import { describe, it, expect } from 'vitest';
import {
  openingRowsForLevel, openingCarsForLevel, clampInitialCarsToDepth, LevelManager,
} from '../src/game/LevelManager.js';

describe('opening depth — derivation', () => {
  it('is a NO-OP at the shipped 16-row depth (every level keeps rows [0,1,2])', () => {
    for (let id = 1; id <= 40; id++) {
      expect(openingRowsForLevel(id, 16), `L${id} @16`).toEqual([0, 1, 2]);
      expect(openingCarsForLevel(id, 16), `L${id} @16`).toBe(3);
    }
  });

  it('defaults to the 16-row behaviour when gridRows is omitted (back-compat)', () => {
    expect(openingRowsForLevel(5)).toEqual([0, 1, 2]);
    expect(openingCarsForLevel(5)).toBe(3);
  });

  it('shallows to 2 rows at or below the shallow threshold (gridRows <= 10)', () => {
    for (const rows of [10, 9, 8, 7, 6]) {
      expect(openingRowsForLevel(5, rows), `@${rows}`).toEqual([0, 1]);
      expect(openingCarsForLevel(5, rows), `@${rows}`).toBe(2);
    }
  });

  it('keeps 3 rows on deep boards (gridRows > 10)', () => {
    for (const rows of [11, 12, 16]) {
      expect(openingRowsForLevel(5, rows), `@${rows}`).toEqual([0, 1, 2]);
    }
  });

  it('generic/daily (non-numeric id) configs keep their light single-car probe opening', () => {
    expect(openingRowsForLevel('daily', 16)).toEqual([2]);
    expect(openingRowsForLevel('daily', 8)).toEqual([2]);
  });

  it('opening rows never reach the breach row, at any shipped depth', () => {
    for (const rows of [8, 9, 10, 12, 16]) {
      for (const row of openingRowsForLevel(5, rows)) {
        expect(row, `row ${row} @${rows} rows`).toBeLessThan(rows - 1);
      }
    }
  });
});

describe('opening depth — scripted initialCars (L10/L40) obey the SAME rule', () => {
  const scripted = [
    { lane: 0, row: 0 }, { lane: 0, row: 1 }, { lane: 0, row: 2 },
    { lane: 1, row: 0 }, { lane: 1, row: 1 }, { lane: 1, row: 2 },
  ];

  it('is a no-op on deep boards', () => {
    expect(clampInitialCarsToDepth(scripted, 16)).toEqual(scripted);
    expect(clampInitialCarsToDepth(scripted, 12)).toEqual(scripted);
  });

  it('drops rows past the shallow opening depth on shallow boards', () => {
    const clamped = clampInitialCarsToDepth(scripted, 8);
    expect(clamped).toHaveLength(4);
    for (const def of clamped) expect(def.row).toBeLessThanOrEqual(1);
  });

  it('handles null/empty without throwing (levels with no scripted opening)', () => {
    expect(clampInitialCarsToDepth(null, 8)).toBeNull();
    expect(clampInitialCarsToDepth([], 8)).toEqual([]);
  });

  it('the real scripted-boss levels (L10/L40) clamp on a shallow board', () => {
    for (const id of [10, 40]) {
      const lm = new LevelManager(); lm.goToLevel(id);
      const ic = lm.current.initialCars;
      expect(ic?.length, `L${id} should have a scripted opening`).toBeGreaterThan(0);
      // No-op at their shipped depth...
      expect(clampInitialCarsToDepth(ic, 16)).toEqual(ic);
      // ...but clamped if they were ever converted to a shallow board.
      const clamped = clampInitialCarsToDepth(ic, 8);
      expect(clamped.length).toBeLessThan(ic.length);
      for (const def of clamped) expect(def.row ?? 0).toBeLessThanOrEqual(1);
    }
  });
});

describe('opening depth — live ↔ sim parity (both paths, same answer)', () => {
  // Mirrors GameApp._startLevel's two assignments verbatim.
  function liveOpening(cfg, gridRows) {
    return {
      openingRows: openingRowsForLevel(cfg.id, gridRows),
      initialCars: clampInitialCarsToDepth(cfg.initialCars ?? null, gridRows),
    };
  }
  // Mirrors SimulationRunner.runLevel's priming block verbatim.
  function simOpening(cfg, gridRows) {
    const initialCars = clampInitialCarsToDepth(cfg.initialCars, gridRows);
    return (initialCars && initialCars.length > 0)
      ? { openingRows: null, initialCars }
      : { openingRows: openingRowsForLevel(cfg.levelId ?? cfg.id, gridRows), initialCars: null };
  }

  for (const gridRows of [8, 10, 16]) {
    it(`every level opens identically in live and sim @ gridRows ${gridRows}`, () => {
      for (let id = 1; id <= 40; id++) {
        const lm = new LevelManager(); lm.goToLevel(id);
        const cfg = lm.current;
        const live = liveOpening(cfg, gridRows);
        const sim  = simOpening(cfg, gridRows);

        if (cfg.initialCars?.length) {
          // Scripted level: both must use the same clamped scripted board.
          expect(sim.initialCars, `L${id} @${gridRows} scripted`).toEqual(live.initialCars);
        } else {
          // Uniform level: both must use the same opening rows...
          expect(sim.openingRows, `L${id} @${gridRows} uniform`).toEqual(live.openingRows);
          // ...and the live path must not carry a scripted board.
          expect(live.initialCars).toBeFalsy();
        }
      }
    });
  }

  it('cars-per-lane at level start agrees between live and sim, every level, every depth', () => {
    for (const gridRows of [8, 10, 16]) {
      for (let id = 1; id <= 40; id++) {
        const lm = new LevelManager(); lm.goToLevel(id);
        const cfg = lm.current;
        const lanes = cfg.laneCount;
        const liveCars = cfg.initialCars?.length
          ? clampInitialCarsToDepth(cfg.initialCars, gridRows).length
          : openingRowsForLevel(cfg.id, gridRows).length * lanes;
        const simCars = cfg.initialCars?.length
          ? clampInitialCarsToDepth(cfg.initialCars, gridRows).length
          : openingRowsForLevel(cfg.id, gridRows).length * lanes;
        expect(simCars, `L${id} @${gridRows}`).toBe(liveCars);
      }
    }
  });
});
