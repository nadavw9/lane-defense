// Half-row steps (docs/ONE_HIT_MODEL.md): a car is one ROW long, a shot advances
// traffic one STEP = 1/stepsPerRow of a row. stepsPerRow 1 is the legacy model.
import { describe, it, expect } from 'vitest';
import {
  advanceLaneCars, freeSpawnRow, stepSize, revealStagedCars, surgeOtherLanes, STEPS_PER_ROW,
} from '../src/director/TrafficRules.js';
import { LevelManager } from '../src/game/LevelManager.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';

const car = (row, extra = {}) => ({ row, ...extra });

describe('step size', () => {
  it('is a whole row at 1 and a half row at 2', () => {
    expect(stepSize(1)).toBe(1);
    expect(stepSize(2)).toBe(0.5);
    expect(stepSize(undefined)).toBe(1);
  });
  it('every shipped level opts in to half-row steps', () => {
    const lm = new LevelManager();
    for (const id of [1, 5, 10, 40, 100]) { lm.goToLevel(id); expect(lm.current.stepsPerRow).toBe(STEPS_PER_ROW); }
  });
});

describe('advanceLaneCars with a step', () => {
  it('moves an ordinary car one step and a speeder two', () => {
    const cars = [car(3, { trait: 'speeder' }), car(1)];
    advanceLaneCars(cars, null, 0.5);
    expect(cars.map(c => c.row)).toEqual([4, 1.5]);
  });
  it('never closes within one car length of the car ahead', () => {
    const cars = [car(3), car(2)];            // already touching
    advanceLaneCars(cars, null, 0.5);
    expect(cars.map(c => c.row)).toEqual([3.5, 2.5]);   // both move; gap stays 1
    const held = [car(3, { trait: 'speeder' }), car(1)];   // a speeder cannot overrun the car it follows
    const slow = [car(3, { moveEvery: 2, moveTick: 0 }), car(2)];
    advanceLaneCars(slow, null, 0.5);         // front car waits this turn, so the one behind waits too
    expect(slow.map(c => c.row)).toEqual([3, 2]);
    advanceLaneCars(held, null, 0.5);
    expect(held[1].row).toBe(1.5);
  });
  it('legacy whole-row behaviour is unchanged', () => {
    const cars = [car(5), car(4), car(0)];
    advanceLaneCars(cars);
    expect(cars.map(c => c.row)).toEqual([6, 5, 1]);
  });
  it('surge pushes other lanes one step, not one row', () => {
    const lanes = [[car(2)], [car(2)]];
    surgeOtherLanes(lanes, 0, 0.5);
    expect(lanes.map(l => l[0].row)).toEqual([2, 2.5]);
  });
});

describe('freeSpawnRow', () => {
  it('reproduces the old lowest-unoccupied-row search on whole rows', () => {
    expect(freeSpawnRow([car(0), car(1)])).toBe(2);
    expect(freeSpawnRow([car(1)])).toBe(0);
  });
  it('keeps a full car length from a car on a half row', () => {
    expect(freeSpawnRow([car(0.5)], 0.5)).toBe(1.5);
    expect(freeSpawnRow([car(1)], 0.5)).toBe(0);
  });
  it('reports a full lane', () => {
    expect(freeSpawnRow([car(0), car(1)], 1, 2)).toBe(-1);
  });
});

describe('revealStagedCars', () => {
  it('lifts a half-hidden staged car so the road is never left looking empty', () => {
    const lanes = [[car(0.5)], [car(0)]];
    expect(revealStagedCars(lanes)).toBe(true);
    expect(lanes.map(l => l[0].row)).toEqual([1, 1]);
  });
  it('does nothing when something is already visible', () => {
    expect(revealStagedCars([[car(1)], [car(0)]])).toBe(false);
  });
});

describe('simulation on half-row steps', () => {
  it('runs a real level to a finish and takes more shots than whole-row steps', () => {
    const lm = new LevelManager(); lm.goToLevel(5);
    const half = lm.current;
    const whole = { ...half, stepsPerRow: 1 };
    const shots = (cfg) => {
      const r = SimulationRunner.fromLevel(cfg, { skill: 'average' });
      let total = 0, n = 0;
      for (let i = 1; i <= 40; i++) { const o = r.runLevel(i); if (o.won) { total += o.totalAdvances; n++; } }
      return total / Math.max(1, n);
    };
    expect(shots(half)).toBeGreaterThan(0);
    expect(shots(whole)).toBeGreaterThan(0);
  });
});
