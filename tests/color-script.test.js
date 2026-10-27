// firstColors: a level's opening cars take scripted colours, in generation order, before the
// palette takes over (L1: a run of reds, then the first blue — the moment the match rule is
// taught, see introSchedule second_colour). Both GameLoop and SimulationRunner spawn through
// the same CarDirector, so the script is honoured in both by construction.
import { describe, it, expect, vi } from 'vitest';
import { CarDirector }  from '../src/director/CarDirector.js';
import { SeededRandom } from '../src/utils/SeededRandom.js';
import { Lane }         from '../src/models/Lane.js';
import { WORLD_CONFIG } from '../src/director/DirectorConfig.js';
import { LevelManager } from '../src/game/LevelManager.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';

const W1 = WORLD_CONFIG[1];
const gen = (d, n, palette = ['Red', 'Blue']) =>
  Array.from({ length: n }, () => d.generateCar(new Lane({ id: 0 }), 'CALM', W1, palette, 5).color);

describe('CarDirector.setColorScript', () => {
  it('deals the scripted colours in order, then the palette', () => {
    const d = new CarDirector({}, new SeededRandom(3));
    d.setColorScript(['Red', 'Red', 'Red', 'Blue']);
    expect(gen(d, 4)).toEqual(['Red', 'Red', 'Red', 'Blue']);
    const rest = gen(d, 40);
    expect(rest.every(c => c === 'Red' || c === 'Blue')).toBe(true);
    expect(new Set(rest).size).toBe(2);   // the palette is random again
  });
  it('restarts from the top when set again (every level start sets it)', () => {
    const d = new CarDirector({}, new SeededRandom(3));
    d.setColorScript(['Red', 'Blue']);
    gen(d, 2);
    d.setColorScript(['Red', 'Blue']);
    expect(gen(d, 2)).toEqual(['Red', 'Blue']);
  });
  it('null clears it; a scripted colour outside the palette falls back to the palette', () => {
    const d = new CarDirector({}, new SeededRandom(3));
    d.setColorScript(['Yellow']);
    expect(gen(d, 1)[0]).not.toBe('Yellow');
    d.setColorScript(['Red', 'Red']);
    d.setColorScript(null);
    expect(new Set(gen(d, 40)).size).toBe(2);
  });
});

describe('L1 opening: a run of one colour, then the second colour', () => {
  const cfg = (() => { const lm = new LevelManager(); lm.goToLevel(1); return lm.current; })();
  it('has two bomb columns for its single lane and a scripted lead colour', () => {
    expect(cfg.laneCount).toBe(1);
    expect(cfg.colCount).toBe(2);
    expect(cfg.colors).toEqual(['Red', 'Blue']);
    expect(cfg.firstColors.slice(0, -1).every(c => c === 'Red')).toBe(true);
    expect(cfg.firstColors.slice(0, -1).length).toBeGreaterThanOrEqual(4);
    expect(cfg.firstColors[cfg.firstColors.length - 1]).toBe('Blue');
  });
  it('the sim spawns the scripted run first (parity with the live GameLoop)', () => {
    const spy = vi.spyOn(CarDirector.prototype, 'generateCar');
    try {
      SimulationRunner.fromLevel(cfg).runLevel(7);
      const seen = spy.mock.results.map(r => r.value.color);
      expect(seen.length).toBeGreaterThan(cfg.firstColors.length);
      expect(seen.slice(0, cfg.firstColors.length)).toEqual(cfg.firstColors);
    } finally { spy.mockRestore(); }
  });
});
