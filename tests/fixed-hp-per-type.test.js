// A car type has the SAME HP on every level: difficulty comes from which cars
// spawn (worldConfig.heft tilts the mix), never from scaling HP.
import { describe, it, expect } from 'vitest';
import { LevelManager } from '../src/game/LevelManager.js';
import { CAR_TYPES, carHpFor, heftWeights } from '../src/director/CarTypes.js';
import { DAILY_CHALLENGES, DailyChallengeManager } from '../src/game/DailyChallengeManager.js';

describe('car HP is fixed per type', () => {
  it('every level and daily challenge runs at hpMultiplier 1', () => {
    const lm = new LevelManager();
    for (let id = 1; id <= 40; id++) { lm.goToLevel(id); expect(lm.current.worldConfig.hpMultiplier, `L${id}`).toBe(1); }
    for (const def of DAILY_CHALLENGES) expect(DailyChallengeManager.configFor(def).worldConfig.hpMultiplier, def.name).toBe(1);
  });
  it('a type spawns with its table HP regardless of level', () => {
    for (const [t, v] of Object.entries(CAR_TYPES)) expect(carHpFor(t, 1), t).toBe(v.hp);
  });
  it('every level has a heft in [0,1]', () => {
    const lm = new LevelManager();
    for (let id = 1; id <= 40; id++) { lm.goToLevel(id); const h = lm.current.worldConfig.heft; expect(h >= 0 && h <= 1, `L${id}`).toBe(true); }
  });
});

describe('heft tilts the mix, only among allowed types', () => {
  const w = [{ value: 'small', weight: 1 }, { value: 'big', weight: 1 }, { value: 'truck', weight: 1 }];
  const share = (ws, t) => ws.find(x => x.value === t).weight / ws.reduce((a, x) => a + x.weight, 0);
  it('0.5 is the table as written', () => expect(heftWeights(w, 0.5)).toBe(w));
  it('high heft favours heavy types, low heft light ones', () => {
    expect(share(heftWeights(w, 1), 'truck')).toBeGreaterThan(share(heftWeights(w, 0.5), 'truck'));
    expect(share(heftWeights(w, 0), 'small')).toBeGreaterThan(share(heftWeights(w, 0.5), 'small'));
  });
  it('never introduces a type the band did not list', () => {
    expect(heftWeights(w, 1).map(x => x.value)).toEqual(['small', 'big', 'truck']);
  });
});
