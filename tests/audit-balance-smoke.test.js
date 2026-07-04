// Balance smoke audit (bug class E — accidentally unwinnable or trivial levels).
//
// NOT a tuning gate — the full 500-run sweep (tools/balance-sim.js) owns tuning.
// This is a cheap per-commit tripwire with deliberately WIDE bands, catching only
// gross regressions: a level that became (nearly) unwinnable or (for non-FTUE
// levels) trivially auto-won after a config/sim change. Deterministic: fixed
// seeds → identical results per code state, zero flake.

import { describe, it, expect } from 'vitest';
import { LevelManager } from '../src/game/LevelManager.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';

const RUNS = 60;   // ~10-15s total for 40 levels; bands sized for this sample count

function winRate(id) {
  const lm = new LevelManager();
  lm.goToLevel(id);
  const cfg = lm.current;
  const runner = new SimulationRunner({
    duration: cfg.duration, colors: cfg.colors, worldConfig: cfg.worldConfig,
    levelId: id, skill: 'average', laneCount: cfg.laneCount, colCount: cfg.colCount,
    laneTargetCarCount: cfg.laneTargetCarCount, spawnBudget: cfg.spawnBudget,
    gridRows: cfg.gridRows, goals: cfg.goals,
  });
  let wins = 0;
  for (let s = 0; s < RUNS; s++) if (runner.runLevel(1 + s).won) wins++;
  return (wins / RUNS) * 100;
}

describe(`audit: balance smoke (${RUNS} deterministic runs/level, wide bands)`, () => {
  for (let id = 1; id <= 40; id++) {
    it(`L${id} is winnable and not degenerate`, () => {
      const win = winRate(id);
      // Unwinnable tripwire — every level must be winnable by an average player
      // at least occasionally. Designed bosses sit ~20-30%, so 5% is far below
      // any intended difficulty.
      expect(win, `L${id} win rate ${win.toFixed(1)}% — level may be unwinnable`)
        .toBeGreaterThanOrEqual(5);
      // FTUE levels must stay genuinely easy (a hard L1-L5 breaks onboarding).
      if (id <= 5) {
        expect(win, `L${id} is FTUE but win rate is only ${win.toFixed(1)}%`)
          .toBeGreaterThanOrEqual(60);
      }
    });
  }
});
