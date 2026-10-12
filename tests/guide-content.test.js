import { describe, it, expect } from 'vitest';
import { tourSteps, stepsFor } from '../src/screens/guideContent.js';

const geo = {
  road: () => ({ x: 0, y: 0, w: 1, h: 1 }), breach: () => ({ x: 0, y: 0, w: 1, h: 1 }),
  bombs: () => ({ x: 0, y: 0, w: 1, h: 1 }), goal: () => ({ x: 0, y: 0, w: 1, h: 1 }),
  bench: () => ({ x: 0, y: 0, w: 1, h: 1 }),
};

describe('level-1 tour', () => {
  const steps = tourSteps(geo);
  it('explains the board, the colour rule, and how to win and lose', () => {
    const text = steps.map(s => `${s.title} ${s.text}`).join(' ').toLowerCase();
    for (const word of ['road', 'red line', 'lose', 'bomb', 'colour', 'goal', 'win']) expect(text).toContain(word);
  });
  it('points at real board elements with functions, not cached rects', () => {
    for (const s of steps.filter(s => s.target)) expect(typeof s.target).toBe('function');
  });
  it('ends with a call to action and every card has copy', () => {
    expect(steps.at(-1).cta).toBeTruthy();
    for (const s of steps) { expect(s.title).toBeTruthy(); expect(s.text).toBeTruthy(); }
  });
  it('drag step has both ends', () => {
    const d = steps.find(s => s.hand === 'drag');
    expect(d.handFrom()).toHaveProperty('x');
    expect(d.handTo()).toHaveProperty('y');
  });
});

describe('first-time cards', () => {
  it('known mechanics get a titled card using the shared copy', () => {
    const [s] = stepsFor('mender_heal', 'fallback', geo);
    expect(s.title).toBe('MENDER');
    expect(s.text).toMatch(/grow back/i);
  });
  it('power shot card tells how to use it and points at the bombs', () => {
    const [s] = stepsFor('streak_charged', 'x', geo);
    expect(s.text).toMatch(/hits twice/i);
    expect(s.target).toBe(geo.bombs);
  });
  it('level tips and unknown keys fall back to the call-site text', () => {
    expect(stepsFor('hint_L7', 'Green bombs join the fight', geo)[0]).toMatchObject({ title: 'TIP', text: 'Green bombs join the fight' });
    expect(stepsFor('something_new', 'hello', geo)[0].text).toBe('hello');
  });
  it('folded-in cards are silent', () => {
    expect(stepsFor('combo_hint_L2', 'x', geo)).toBeNull();
    expect(stepsFor('bench_appear', 'x', geo)).toBeNull();
  });
});
