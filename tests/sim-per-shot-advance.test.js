import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LevelManager }     from '../src/game/LevelManager.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function cfgFor(levelId) {
  const lm = new LevelManager();
  lm.goToLevel(levelId);
  const c = lm.current;
  return {
    duration: c.duration, colors: c.colors, worldConfig: c.worldConfig,
    levelId, laneCount: c.laneCount, colCount: c.colCount,
    laneTargetCarCount: c.laneTargetCarCount,
    spawnBudget: c.spawnBudget, gridRows: c.gridRows,
  };
}

describe('SimulationRunner — per-shot advance fidelity', () => {
  it('every correct-color shot advances the grid exactly once (correctShots === totalAdvances)', () => {
    // Run several levels across skill profiles; the invariant must hold in all.
    for (const levelId of [1, 8, 20, 40]) {
      for (const skill of ['beginner', 'average', 'skilled', 'optimal']) {
        const r = new SimulationRunner({ ...cfgFor(levelId), skill });
        // Inspect 25 individual level runs (not just aggregate) for the invariant.
        for (let seed = 1; seed <= 25; seed++) {
          const res = r.runLevel(seed);
          expect(res.totalAdvances).toBe(res.correctShots);
        }
      }
    }
  });

  it('a multi-lane turn produces MULTIPLE advances (not one) — the fidelity fix', () => {
    // 4-lane level, fast/perfect play → several lanes fire in a single tick.
    // With the per-shot model, that tick must advance more than once.
    const r = new SimulationRunner({ ...cfgFor(20), skill: 'optimal' });
    let sawMultiAdvanceTurn = false;
    for (let seed = 1; seed <= 30 && !sawMultiAdvanceTurn; seed++) {
      const res = r.runLevel(seed);
      if (res.maxAdvPerTick >= 2) sawMultiAdvanceTurn = true;
    }
    expect(sawMultiAdvanceTurn).toBe(true);
  });

  it('win rate is independent of speed.base (3.0 / 5.0 / 8.0 give identical results)', () => {
    // speed.base is vestigial in the turn-based game; the sim must not read it.
    // With the same seed and no speed dependence, results are bit-identical.
    for (const levelId of [5, 9, 16, 32]) {
      const base = cfgFor(levelId);
      const rate = (sb) => {
        const wc = { ...base.worldConfig, speed: { ...base.worldConfig.speed, base: sb } };
        return new SimulationRunner({ ...base, worldConfig: wc, skill: 'average' }).runBatch(150, 1).winRate;
      };
      const r3 = rate(3.0), r5 = rate(5.0), r8 = rate(8.0);
      expect(r3).toBe(r5);
      expect(r5).toBe(r8);
    }
  });

  it('the simulator contains no continuous .advance() movement path', () => {
    const src = readFileSync(path.join(__dirname, '..', 'src', 'simulation', 'SimulationRunner.js'), 'utf8');
    src.split('\n').forEach((ln) => {
      const code = ln.split('//')[0];                 // ignore comments
      expect(/\.advance\s*\(/.test(code)).toBe(false); // no lane.advance(DT)-style calls
    });
  });
});
