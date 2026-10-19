// StepRuler: one glowing marker for the most advanced car instead of a column of numbers
// (owner, 2026-10-19: "crowded and not understandable ... the most progressive number bold or
// shining"). nearestMovesLeft is the number that marker shows.
import { describe, it, expect } from 'vitest';
import { nearestMovesLeft } from '../src/renderer/StepRuler.js';

const lanes = (...rows) => rows.map(r => ({ cars: r == null ? [] : [{ row: r }] }));

describe('nearestMovesLeft', () => {
  it('counts the moves the front-most car has before it crosses the red line', () => {
    // 5-row board (maxRow 4), 4 steps per row: a car at row 3 has 1 row = 4 steps + 1 move left.
    expect(nearestMovesLeft(lanes(3, 2, 1), 3, 4, 4)).toBe(5);
  });
  it('takes the closest car over all lanes', () => {
    expect(nearestMovesLeft(lanes(1, 3.75, 2), 3, 4, 4)).toBe(2);
  });
  it('ignores staged cars (row < 1) and empty lanes; null when nothing is on the road', () => {
    expect(nearestMovesLeft(lanes(0.5, null, 0), 3, 4, 4)).toBeNull();
    expect(nearestMovesLeft(lanes(0.5, 2), 2, 4, 4)).toBe(9);
  });
  it('only reads the active lanes', () => {
    expect(nearestMovesLeft(lanes(1, 2, 3.5), 2, 4, 4)).toBe(9);
  });
});
