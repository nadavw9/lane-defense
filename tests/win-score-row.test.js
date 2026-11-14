// PrimeTestLab report 10454 (S-02): the win screen's "6,725 / 7,275" did not say what 7,275 was.
// The row now names the next star: label "SCORE · 3★ AT 7,275", value "6,725".
import { describe, it, expect } from 'vitest';
import { scoreRow } from '../src/game/score.js';

describe('scoreRow', () => {
  it('names the next star target when short of three stars', () => {
    expect(scoreRow(6725, [2000, 5000, 7275], 2)).toEqual({ label: 'SCORE · 3★ AT 7,275', value: '6,725' });
    expect(scoreRow(1500, [2000, 5000, 7275], 0)).toEqual({ label: 'SCORE · 1★ AT 2,000', value: '1,500' });
  });

  it('shows the score alone at three stars or without targets', () => {
    expect(scoreRow(8000, [2000, 5000, 7275], 3)).toEqual({ label: 'SCORE', value: '8,000' });
    expect(scoreRow(400, null, 1)).toEqual({ label: 'SCORE', value: '400' });
  });
});
