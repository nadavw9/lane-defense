// PrimeTestLab report 10510 (S-03): the breach screen should say how many cars were left,
// so the player can judge whether a continue is worth it. It used to name the count only
// when 30% or less of the goal was left.
import { describe, it, expect } from 'vitest';
import { breachLine } from '../src/screens/breachLine.js';

describe('breachLine', () => {
  it('names the cars left even when the goal is far off', () => {
    expect(breachLine(14, 20)).toBe('14 cars left to win. Keep going?');
  });

  it('presses harder when the goal is close', () => {
    expect(breachLine(5, 20)).toBe('Only 5 cars left to win!');
    expect(breachLine(1, 20)).toBe('Just ONE car left to win!');
  });

  it('falls back to a plain question without a goal count', () => {
    expect(breachLine(0, 0)).toBe('Keep going from right here?');
    expect(breachLine(0, 20)).toBe('Keep going from right here?');
  });
});
