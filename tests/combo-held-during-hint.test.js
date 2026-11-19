// PrimeTestLab report 10510 (S-01): during the bridge tutorial the "×4 COMBO" text was
// drawn over the highlighted cars. The combo stays hidden while a tutorial hint is up.
import { describe, it, expect } from 'vitest';
import { comboVisible } from '../src/renderer/comboVisibility.js';

describe('comboVisible', () => {
  it('shows a combo of two or more', () => {
    expect(comboVisible(1, false)).toBe(false);
    expect(comboVisible(2, false)).toBe(true);
    expect(comboVisible(4, false)).toBe(true);
  });

  it('holds the combo back while a tutorial hint is showing', () => {
    expect(comboVisible(4, true)).toBe(false);
  });
});
