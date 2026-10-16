// Booster / combo matrix. Plays the REAL GameLoop with a seeded player that mixes BOMB,
// FREEZE, COLOUR CHANGE, bench and hostile inputs, across lane counts, lane car counts,
// levels and seeds, and asserts after EVERY action that the board is healthy and that
// every run reaches a win or a loss (never a stall).
import { describe, it, expect } from 'vitest';
import { buildGame, levelCfg, playOut } from './helpers/boosterHarness.js';
import { DailyChallengeManager, DAILY_CHALLENGES } from '../src/game/DailyChallengeManager.js';

// Default: a spread of levels x 3 seeds (fast, runs in CI). MATRIX_ALL=1 MATRIX_SEEDS=40 sweeps all 100.
const ALL = !!process.env.MATRIX_ALL;
const SEEDS = Array.from({ length: Number(process.env.MATRIX_SEEDS ?? 3) }, (_, i) => i + 1);
const LEVELS = ALL ? Array.from({ length: 100 }, (_, i) => i + 1)
                   : [1, 2, 3, 4, 5, 8, 10, 13, 16, 20, 25, 30, 35, 40, 45, 55, 70, 85, 100];
const MIXES = {
  balanced:   {},
  bombHeavy:  { bomb: 45, deploy: 35 },
  freezeHeavy:{ freeze: 40, deploy: 40 },
  colourHeavy:{ colour: 40, deploy: 40 },
  chaos:      { bomb: 20, freeze: 15, colour: 15, bench: 10, edge: 20, wrong: 10, deploy: 30 },
};

const summary = [];
describe('booster matrix — natural level configs', () => {
  for (const id of LEVELS) for (const [mixName, mix] of Object.entries(MIXES)) {
    it(`L${id} / ${mixName}`, () => {
      const out = [];
      for (const seed of SEEDS) {
        const h = buildGame(levelCfg(id), { seed, bombs: 1, freeze: 1, colorChange: 1 });
        const r = playOut(h, { actions: 500, mix, playSeed: seed * 11 });
        summary.push({ id, mixName, seed, over: r.over, won: r.won, n: r.actions });
        if (h.violations.length || !r.over) out.push(`seed${seed}: over=${r.over} ${h.violations.slice(0, 4).join(' | ')}`);
      }
      expect(out).toEqual([]);
    }, 60000);
  }
});

describe('booster matrix — lane count x cars per lane (overrides)', () => {
  for (const lanes of [1, 2, 3, 4]) for (const target of [1, 2, 3, 4]) {
    it(`${lanes} lanes, ${target} cars/lane (L5 base)`, () => {
      const out = [];
      for (const seed of [1, 2, 3, 4]) {
        const cfg = levelCfg(5, { laneCount: lanes, colCount: lanes, laneTargetCarCount: target });
        const h = buildGame(cfg, { seed, bombs: 2, freeze: 1, colorChange: 1 });
        const r = playOut(h, { actions: 500, mix: MIXES.chaos, playSeed: seed * 5 });
        if (h.violations.length || !r.over) out.push(`seed${seed}: over=${r.over} ${h.violations.slice(0, 4).join(' | ')}`);
      }
      expect(out).toEqual([]);
    }, 60000);
  }
});

describe('booster matrix — forced losses and rescue', () => {
  for (const id of [1, 3, 5, 10, 20, 40, 70, 100]) {
    it(`L${id}: neglect play loses, rescue resumes, run still ends`, () => {
      const out = []; let lost = 0, rescued = 0;
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const h = buildGame(levelCfg(id), { seed, bombs: 0, freeze: 0, colorChange: 0 });
        const r = playOut(h, { actions: 600, mix: { neglect: 80, deploy: 5, bomb: 8, freeze: 4, colour: 3 }, playSeed: seed, rescue: true });
        if (r.over && !r.won) lost++;
        rescued += r.rescued;
        if (h.violations.length || !r.over) out.push(`seed${seed}: over=${r.over} won=${r.won} ${h.violations.slice(0, 4).join(' | ')}`);
      }
      console.log(`L${id} lost=${lost}/6 rescued=${rescued}`);
      expect(out).toEqual([]);
    }, 60000);
  }
});

describe('booster matrix — board depth x step size', () => {
  for (const gridRows of [6, 8, 10, 16]) for (const stepsPerRow of [1, 2]) {
    it(`${gridRows} rows, ${stepsPerRow} step(s)/row`, () => {
      const out = [];
      for (const seed of SEEDS) {
        const cfg = levelCfg(8, { gridRows, stepsPerRow });
        const h = buildGame(cfg, { seed, bombs: 2, freeze: 1, colorChange: 1 });
        const r = playOut(h, { actions: 500, mix: MIXES.chaos, playSeed: seed * 3, rescue: true });
        if (h.violations.length || !r.over) out.push(`seed${seed}: over=${r.over} ${h.violations.slice(0, 3).join(' | ')}`);
      }
      expect(out).toEqual([]);
    }, 60000);
  }
});

describe('booster matrix — every daily challenge (traits: phantom, mender, volatile, plated, chameleon, speeder, armored)', () => {
  DAILY_CHALLENGES.forEach((def) => {
    it(def.name, () => {
      const out = [];
      for (const seed of SEEDS) for (const mix of [MIXES.chaos, MIXES.bombHeavy]) {
        const h = buildGame(DailyChallengeManager.configFor(def), { seed, bombs: 2, freeze: 1, colorChange: 1 });
        const r = playOut(h, { actions: 500, mix, playSeed: seed * 13, rescue: !def.noRescue });
        if (h.violations.length || !r.over) out.push(`seed${seed}: over=${r.over} ${h.violations.slice(0, 3).join(' | ')}`);
      }
      expect(out).toEqual([]);
    }, 60000);
  });
});
