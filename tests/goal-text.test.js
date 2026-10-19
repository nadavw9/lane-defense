// The level card says the goal in words under its tiles (owner 2026-10-20: "Not clear what this
// goal means" about L5's three-car tile and a 9).
import { describe, it, expect } from 'vitest';
import { goalSentence } from '../src/screens/goalText.js';

describe('goal sentence on the level card', () => {
  it('a total goal says any color', () => {
    expect(goalSentence([{ type: 'destroyTotal', count: 9 }])).toBe('Destroy 9 cars of any color');
    expect(goalSentence([{ type: 'destroyTotal', count: 1 }])).toBe('Destroy 1 car of any color');
  });
  it('color goals name the colors', () => {
    expect(goalSentence([{ type: 'destroyColor', color: 'Blue', count: 3 }, { type: 'destroyColor', color: 'Green', count: 3 }]))
      .toBe('Destroy 3 blue cars + 3 green cars');
  });
  it('vehicle and special-car goals name the vehicle', () => {
    expect(goalSentence([{ type: 'destroyType', carType: 'jeep', count: 4 }])).toBe('Destroy 4 vans');
    expect(goalSentence([{ type: 'destroyTrait', trait: 'speeder', count: 2 }])).toBe('Destroy 2 speeders');
    expect(goalSentence([{ type: 'destroyTrait', trait: 'armored', count: 1 }])).toBe('Destroy 1 armored car');
  });
  it('no goals, no sentence', () => {
    expect(goalSentence([])).toBe('');
  });
});
