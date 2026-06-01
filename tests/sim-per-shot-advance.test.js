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
    levelId, laneCount: c.laneCount, laneTargetCarCount: c.laneTargetCarCount,
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

  it('the simulator contains no continuous .advance() movement path', () => {
    const src = readFileSync(path.join(__dirname, '..', 'src', 'simulation', 'SimulationRunner.js'), 'utf8');
    src.split('\n').forEach((ln) => {
      const code = ln.split('//')[0];                 // ignore comments
      expect(/\.advance\s*\(/.test(code)).toBe(false); // no lane.advance(DT)-style calls
    });
  });
});
