import { describe, it, expect } from 'vitest';
import { finaleHeft, finaleLaneTarget, pushTrafficBack, rescueRowsBack } from '../src/director/TrafficRules.js';
import { LevelManager } from '../src/game/LevelManager.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';

describe('final rush', () => {
  it('heft is eased at the start and heavier at the end', () => {
    expect(finaleHeft(0.5, 0)).toBeLessThan(0.5);
    expect(finaleHeft(0.5, 1)).toBeGreaterThan(0.5);
    expect(finaleHeft(0.9, 1)).toBeLessThanOrEqual(1);
  });
  it('two-deep lanes take one more car in the last quarter; dense lanes never do', () => {
    expect(finaleLaneTarget(2, 0.5)).toBe(2);
    expect(finaleLaneTarget(2, 0.8)).toBe(3);
    expect(finaleLaneTarget(3, 0.9)).toBe(3);
  });
});

describe('continue', () => {
  it('pushes traffic back 40% of the road, keeping lane order', () => {
    const cars = [{ row: 4 }, { row: 3 }, { row: 1 }];
    const kept = pushTrafficBack(cars, rescueRowsBack(5));
    expect(kept.map(c => c.row)).toEqual([2, 1]);
  });
  it('in the sim, a continue turns most losses on a hard level into wins, and losses come late', () => {
    const lm = new LevelManager(); lm.goToLevel(35);
    const r0 = SimulationRunner.fromLevel(lm.current, { skill: 'average' });
    const r1 = SimulationRunner.fromLevel(lm.current, { skill: 'average', continues: 1 });
    let losses = 0, saved = 0, prog = 0;
    for (let s = 1; s <= 120; s++) {
      const a = r0.runLevel(s);
      if (a.won) continue;
      losses++; prog += a.progressAtLoss;
      if (r1.runLevel(s).won) saved++;
    }
    expect(losses).toBeGreaterThan(10);
    expect(saved / losses).toBeGreaterThan(0.5);
    expect(prog / losses).toBeGreaterThan(0.5);
  }, 30_000);
});
