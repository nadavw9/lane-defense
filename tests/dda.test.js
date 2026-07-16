// §3d DDA (fail-streak mercy) — the invisible assist for a struggling player.
//
// THE CONSTRAINT (FABLE_EXIT_BRIEF §1): DDA is applied ONLY to the Director's
// COPY of the level config; it must NEVER mutate LevelManager's configs, and the
// sim must NEVER see it (the sim models BASE difficulty — if it saw DDA every
// tuned number this project relies on would be meaningless). These tests pin the
// schedule, prove the copy aliases nothing, and statically prevent the sim from
// ever reaching DDA.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ddaFactor, applyDda } from '../src/game/dda.js';
import { LevelManager } from '../src/game/LevelManager.js';
import { ProgressManager } from '../src/game/ProgressManager.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';

// ── The schedule ────────────────────────────────────────────────────────────

describe('ddaFactor schedule', () => {
  it('is 1.0 below the mercy threshold, compounds ×0.9 from streak 2, floors at 0.73', () => {
    const table = { 0: 1, 1: 1, 2: 0.9, 3: 0.81, 4: 0.73, 5: 0.73, 9: 0.73 };
    for (const [streak, expected] of Object.entries(table)) {
      expect(ddaFactor(Number(streak)), `streak ${streak}`).toBeCloseTo(expected, 10);
    }
  });

  it('is monotonic non-increasing and never below the floor', () => {
    let prev = Infinity;
    for (let s = 0; s <= 20; s++) {
      const f = ddaFactor(s);
      expect(f).toBeLessThanOrEqual(prev);
      expect(f).toBeGreaterThanOrEqual(0.73);
      prev = f;
    }
  });

  it('tolerates junk input (null/negative/float) without throwing', () => {
    expect(ddaFactor(null)).toBe(1);
    expect(ddaFactor(undefined)).toBe(1);
    expect(ddaFactor(-3)).toBe(1);
    expect(ddaFactor(2.9)).toBeCloseTo(0.9, 10);   // floored to streak 2
  });
});

// ── applyDda never aliases or mutates the source ────────────────────────────

describe('applyDda produces a non-aliasing copy', () => {
  it('returns a fresh object sharing NO reference with the source (incl. nested speed)', () => {
    const src = Object.freeze({ hpMultiplier: 0.6, speed: Object.freeze({ base: 5.5, variance: 0.3 }) });
    const copy = applyDda(src, 5);
    expect(copy).not.toBe(src);
    expect(copy.speed).not.toBe(src.speed);          // shallow spread would alias this
    expect(copy.hpMultiplier).toBeCloseTo(0.6 * 0.73, 10);
    expect(copy.speed).toEqual({ base: 5.5, variance: 0.3 });   // speed carried, unscaled
    // Source frozen — a mutation attempt would have thrown above; confirm intact.
    expect(src.hpMultiplier).toBe(0.6);
  });

  it('at streak 0-1 the copy is an exact-value clone (factor 1.0), still a distinct object', () => {
    const src = { hpMultiplier: 0.9, speed: { base: 4, variance: 0.5 } };
    for (const streak of [0, 1]) {
      const copy = applyDda(src, streak);
      expect(copy).not.toBe(src);
      expect(copy.hpMultiplier).toBe(0.9);
    }
  });
});

// ── LevelManager configs are untouched (real inline + preset-backed levels) ──

describe('LevelManager configs survive DDA untouched', () => {
  // Snapshot ALL 40 configs; apply DDA to representative levels; re-snapshot.
  const snapshotAll = () => {
    const lm = new LevelManager();
    const out = {};
    for (let id = 1; id <= 40; id++) { lm.goToLevel(id); out[id] = JSON.stringify(lm.current); }
    return out;
  };

  it('applying DDA to an inline level (L10) and a preset-backed level (L6) changes NO config', () => {
    const before = snapshotAll();
    const lm = new LevelManager();

    // L10 — inline worldConfig. L6 — shares the R_2C_MED_100 preset object.
    lm.goToLevel(10); const l10 = lm.current.worldConfig;
    lm.goToLevel(6);  const l6  = lm.current.worldConfig;

    // Exercise the real ship path at max streak.
    const c10 = applyDda(l10, 5);
    const c6  = applyDda(l6, 5);

    // Copies are mercy-scaled and non-aliasing…
    expect(c10.hpMultiplier).toBeCloseTo(l10.hpMultiplier * 0.73, 10);
    expect(c6.hpMultiplier).toBeCloseTo(l6.hpMultiplier * 0.73, 10);
    expect(c6).not.toBe(l6);
    expect(c6.speed).not.toBe(l6.speed);

    // …and the source configs — all 40 — are byte-identical afterward.
    expect(snapshotAll()).toEqual(before);
  });

  it('a shared preset object is protected: DDA on one sibling leaves the other siblings\' view intact', () => {
    // Synthetic re-shared preset (presets EXIST to be shared; this is the
    // catastrophic case the copy must guard even though no two shipped levels
    // currently point at the same preset object after the 3c un-sharing).
    const preset = { hpMultiplier: 0.5, speed: { base: 5, variance: 0.4 } };
    const siblingA = { id: 100, worldConfig: preset };
    const siblingB = { id: 101, worldConfig: preset };
    const presetSnapshot = JSON.stringify(preset);

    const copy = applyDda(siblingA.worldConfig, 5);   // A struggles → mercy

    expect(copy.hpMultiplier).toBeCloseTo(0.5 * 0.73, 10);
    expect(JSON.stringify(preset)).toBe(presetSnapshot);        // preset byte-identical
    expect(siblingA.worldConfig.hpMultiplier).toBe(0.5);        // A's base untouched
    expect(siblingB.worldConfig.hpMultiplier).toBe(0.5);        // B (sibling) unaffected
    expect(siblingA.worldConfig).toBe(preset);                 // still the same object
    expect(siblingB.worldConfig).toBe(preset);
  });
});

// ── ProgressManager fail-streak lifecycle ───────────────────────────────────

describe('ProgressManager fail-streak', () => {
  // jsdom localStorage is shared across tests; use unique level ids per test.
  it('recordLoss increments per level, recordWin resets, getFailStreak reads', () => {
    const p = new ProgressManager();
    expect(p.getFailStreak(201)).toBe(0);
    p.recordLoss(201); p.recordLoss(201);
    expect(p.getFailStreak(201)).toBe(2);
    expect(p.getFailStreak(202)).toBe(0);   // independent per level
    p.recordWin(201, 1);
    expect(p.getFailStreak(201)).toBe(0);   // win clears the streak
  });

  it('recordLoss ignores non-numeric level ids (daily challenge excluded)', () => {
    const p = new ProgressManager();
    p.recordLoss('daily-2026-07-16');
    expect(p.getFailStreak('daily-2026-07-16')).toBe(0);
  });

  it('the streak → mercy pipeline: 2 losses on a base-0.6 level yields a 0.54 director copy', () => {
    const p = new ProgressManager();
    p.recordLoss(203); p.recordLoss(203);
    const src = { hpMultiplier: 0.6, speed: { base: 5, variance: 0.3 } };
    const copy = applyDda(src, p.getFailStreak(203));
    expect(copy.hpMultiplier).toBeCloseTo(0.54, 10);   // 0.6 × 0.9
    expect(src.hpMultiplier).toBe(0.6);
  });
});

// ── Sim-blindness tripwire (the load-bearing guarantee) ─────────────────────

describe('AUDIT: the sim can never see DDA', () => {
  // Static audit in the WS1 style (like the HP re-multiplication guard): the sim
  // models BASE difficulty. There must be NO code path from the sim to DDA — not
  // failStreak, not ddaFactor/applyDda, not getFailStreak. If a future edit wires
  // one in, this fails loudly instead of silently invalidating every tuned number.
  const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');

  it('SimulationRunner.js references nothing from the DDA subsystem', () => {
    const src = read('../src/simulation/SimulationRunner.js');
    expect(src).not.toMatch(/failStreak|ddaFactor|applyDda|getFailStreak|\bdda\b/i);
  });

  it('tools/balance-sim.js references nothing from the DDA subsystem', () => {
    const src = read('../tools/balance-sim.js');
    expect(src).not.toMatch(/failStreak|ddaFactor|applyDda|getFailStreak|\bdda\b/i);
  });

  it('a fresh sim run reads BASE hpMultiplier regardless of any recorded streak', () => {
    // The sim instantiates from LevelManager configs and never consults
    // ProgressManager — so a recorded streak cannot reach it. Prove L10 sims at
    // its base 0.60 (§3c v2 value), the number the balance band was tuned to.
    const lm = new LevelManager(); lm.goToLevel(10);
    const cfg = lm.current;
    expect(cfg.worldConfig.hpMultiplier).toBe(0.60);
    const runner = new SimulationRunner({
      duration: cfg.duration, colors: cfg.colors, worldConfig: cfg.worldConfig,
      levelId: 10, skill: 'average', laneCount: cfg.laneCount, colCount: cfg.colCount,
      laneTargetCarCount: cfg.laneTargetCarCount, spawnBudget: cfg.spawnBudget,
      gridRows: cfg.gridRows, goals: cfg.goals, initialCars: cfg.initialCars,
      shooterColorWeights: cfg.shooterColorWeights,
    });
    // The runner copies its config; the base hpMultiplier it holds is unchanged.
    expect(runner._cfg.worldConfig.hpMultiplier).toBe(0.60);
    expect(runner.runLevel(1)).toHaveProperty('won');   // and it still runs
  });
});
