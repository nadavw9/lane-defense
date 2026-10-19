import { describe, it, expect } from 'vitest';
import { laneHeld, lightState, advanceLaneCars } from '../src/director/TrafficRules.js';
import { identityFor, GIFT_FROM, LIGHT_FROM, CONVOY_FROM } from '../src/game/levelDsl.js';
import { CarDirector } from '../src/director/CarDirector.js';
import { SeededRandom } from '../src/utils/SeededRandom.js';
import { GameState } from '../src/game/GameState.js';
import { LevelManager, levelDifficulty, LEVEL_COUNT } from '../src/game/LevelManager.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';

const L = (lane, phase = 0) => ({ lane, green: 3, red: 2, phase });

describe('traffic lights', () => {
  it('a light drives 3 moves then holds 2, and an unlit lane always drives', () => {
    const lights = [L(1)];
    expect([0, 1, 2, 3, 4, 5].map(m => laneHeld(lights, 1, m))).toEqual([false, false, false, true, true, false]);
    expect(laneHeld(lights, 0, 3)).toBe(false);
    expect(laneHeld(null, 1, 3)).toBe(false);
  });
  it('lightState counts the moves until the light changes', () => {
    const lights = [L(1)];
    expect(lightState(lights, 1, 0)).toEqual({ red: false, movesLeft: 3 });
    expect(lightState(lights, 1, 3)).toEqual({ red: true, movesLeft: 2 });
    expect(lightState(lights, 0, 0)).toBeNull();
  });
  it('two-light levels are never red on both lights at once', () => {
    for (let id = 35; id <= LEVEL_COUNT; id++) {
      const lights = identityFor(id).lights;
      if (!lights || lights.length < 2) continue;
      for (let m = 0; m < 10; m++) expect(lights.every(l => laneHeld(lights, l.lane, m))).toBe(false);
    }
  });
  it('the simulator holds a red lane (same rule as the game)', () => {
    const lm = new LevelManager(); lm.goToLevel(LIGHT_FROM);
    const cfg = lm.current;
    expect(cfg.lights).toBeTruthy();
    // Over several seeds: one short run can end before the light has turned red at all.
    const runs = (c) => Array.from({ length: 8 }, (_, i) => SimulationRunner.fromLevel(c).runLevel(i + 1));
    expect(runs(cfg)).not.toEqual(runs({ ...cfg, lights: null }));
  });
});

describe('convoy and gift cars', () => {
  it('a convoy lane spawns only motorbikes', () => {
    const d = new CarDirector({}, new SeededRandom(5));
    d.setConvoy([1]);
    const world = { heft: 1, hpMultiplier: 1, speed: { base: 5, variance: 0 } };
    for (let i = 0; i < 20; i++) expect(d.generateCar({ id: 1 }, 'CALM', world, ['Red', 'Blue'], 5).type).toBe('small');
  });
  it('destroying a gift car queues one payout, whatever killed it', () => {
    const gs = new GameState({ lanes: [], columns: [], colors: ['Red'], world: {}, duration: 60, phaseMan: { getParams: () => ({}) } });
    gs.applyKillToGoals('Red', 'big', 'gift');
    gs.applyKillToGoals('Red', 'big', null);
    expect(gs.giftsPending).toBe(1);
  });
  it('each element is introduced on its own level and then recurs', () => {
    expect(identityFor(GIFT_FROM - 1).gift).toBe(0);
    expect(identityFor(GIFT_FROM).gift).toBeGreaterThan(0);
    expect(identityFor(LIGHT_FROM).lights).toHaveLength(1);
    expect(identityFor(CONVOY_FROM).convoy).toEqual([1]);
    const lightLevels = Array.from({ length: 100 }, (_, i) => i + 1).filter(id => identityFor(id).lights);
    expect(lightLevels.length).toBeGreaterThan(15);
  });
  it('difficulty tiers: hard on x5 from L15, big waves hard to L40, super hard from L50', () => {
    expect(levelDifficulty(14)).toBe('normal');
    expect(levelDifficulty(15)).toBe('hard');
    expect(levelDifficulty(10)).toBe('hard');
    expect(levelDifficulty(30)).toBe('hard');
    expect(levelDifficulty(40)).toBe('hard');
    expect(levelDifficulty(50)).toBe('superhard');
  });
});
