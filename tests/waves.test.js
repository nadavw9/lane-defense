// WAVES (2026-10-30, spec §3.2): from WAVES_FROM a level runs as crests and lulls keyed on goal
// progress, replacing the single final rush. One shared profile for CarDirector (live + sim).
import { describe, it, expect } from 'vitest';
import { waveHeft, waveLaneTarget, waveTagAt, wavesFor, WAVES_FROM, FINALE_FROM,
         pushTrafficBack, rescueRowsBack } from '../src/director/TrafficRules.js';
import { LevelManager } from '../src/game/LevelManager.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';

describe('wave profile', () => {
  it('starts calm, crests twice and ends with the heaviest wave (two waves)', () => {
    expect(waveHeft(0.5, 0.10, 2)).toBeCloseTo(0.35, 2);   // calm  -0.15
    expect(waveHeft(0.5, 0.30, 2)).toBeCloseTo(0.60, 2);   // wave 1 +0.10
    expect(waveHeft(0.5, 0.47, 2)).toBeCloseTo(0.40, 2);   // lull  -0.10
    expect(waveHeft(0.5, 0.67, 2)).toBeCloseTo(0.75, 2);   // wave 2 +0.25
    expect(waveHeft(0.5, 0.85, 2)).toBeCloseTo(0.50, 2);   // lull   0
    expect(waveHeft(0.5, 0.97, 2)).toBeCloseTo(0.85, 2);   // final +0.35
  });
  it('three waves on a big-wave level, each heavier than the last', () => {
    const h = (p) => waveHeft(0.4, p, 3);
    expect(h(0.22)).toBeGreaterThan(h(0.05));
    expect(h(0.47)).toBeGreaterThan(h(0.22));
    expect(h(0.72)).toBeGreaterThan(h(0.47));
    expect(h(0.95)).toBeGreaterThan(h(0.72));
    expect(h(0.35)).toBeLessThan(h(0.22));   // a lull between crests
  });
  it('joins are smooth: no jump larger than a hundredth per thousandth of progress', () => {
    for (const n of [2, 3]) {
      let prev = waveHeft(0.5, 0, n);
      for (let i = 1; i <= 1000; i++) {
        const v = waveHeft(0.5, i / 1000, n);
        expect(Math.abs(v - prev)).toBeLessThan(0.011);
        prev = v;
      }
    }
  });
  it('clamps to [0, 1], survives p outside [0, 1] and a null heft', () => {
    expect(waveHeft(0.9, 0.97, 2)).toBe(1);
    expect(waveHeft(0.05, 0.1, 2)).toBe(0);
    expect(waveHeft(0.5, 1.4, 2)).toBeCloseTo(0.85, 2);
    expect(waveHeft(0.5, -1, 2)).toBeCloseTo(0.35, 2);
    expect(Number.isNaN(waveHeft(0.5, NaN, 2))).toBe(false);
    expect(waveHeft(null, 0.5, 2)).toBe(null);
  });
  it('two-deep lanes take one more car on a crest; dense lanes never do', () => {
    expect(waveLaneTarget(2, 0.10, 2)).toBe(2);
    expect(waveLaneTarget(2, 0.30, 2)).toBe(3);
    expect(waveLaneTarget(2, 0.47, 2)).toBe(2);
    expect(waveLaneTarget(2, 0.95, 2)).toBe(3);
    expect(waveLaneTarget(3, 0.95, 2)).toBe(3);
  });
  it('names each crest once, in order', () => {
    const tags = [];
    for (let i = 0; i <= 100; i++) { const t = waveTagAt(i / 100, 2); if (t && t !== tags[tags.length - 1]) tags.push(t); }
    expect(tags).toEqual(['WAVE 1', 'WAVE 2', 'FINAL WAVE']);
    const tags3 = [];
    for (let i = 0; i <= 100; i++) { const t = waveTagAt(i / 100, 3); if (t && t !== tags3[tags3.length - 1]) tags3.push(t); }
    expect(tags3).toEqual(['WAVE 1', 'WAVE 2', 'WAVE 3', 'FINAL WAVE']);
    expect(waveTagAt(0.05, 2)).toBe(null);
  });
  it('levels before WAVES_FROM are flat; big-wave levels get three waves', () => {
    expect(WAVES_FROM).toBe(FINALE_FROM);
    expect(wavesFor({ id: 5 })).toBe(0);
    expect(wavesFor({ id: 12 })).toBe(2);
    expect(wavesFor({ id: 20, milestone: true })).toBe(3);
    expect(wavesFor({ id: 12, waves: 3 })).toBe(3);
    expect(wavesFor({ id: 'daily' })).toBe(0);   // non-numeric ids (daily, probes) stay flat unless they ask
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
    const r0 = SimulationRunner.fromLevel(lm.current, { skill: 'human' });
    const r1 = SimulationRunner.fromLevel(lm.current, { skill: 'human', continues: 1 });
    let losses = 0, saved = 0, prog = 0;
    for (let s = 1; s <= 160; s++) {
      const a = r0.runLevel(s);
      if (a.won) continue;
      losses++; prog += a.progressAtLoss;
      if (r1.runLevel(s).won) saved++;
    }
    expect(losses).toBeGreaterThan(5);
    expect(saved / losses).toBeGreaterThan(0.5);
    expect(prog / losses).toBeGreaterThan(0.5);
  }, 40_000);
});
