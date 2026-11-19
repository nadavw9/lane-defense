// PrimeTestLab report 10510 (M-02): on a Redmi Note 12 Pro+ (393 x 873 CSS px) the
// 390x844 stage was letterboxed into the safe area and left plum strips down both
// sides. When filling the width needs only a few px more height than the safe
// area, the stage borrows them from the top/bottom inset bands instead.
import { describe, it, expect } from 'vitest';
import { fitBox, BORROW_PX } from '../src/renderer/SafeArea.js';

const W = 390, H = 844;
const none = { top: 0, right: 0, bottom: 0, left: 0 };

describe('fitBox', () => {
  it('fills the width when the safe area is only slightly short (cutout band, bars hidden)', () => {
    const b = fitBox(393, 873, { ...none, top: 35 }, W, H);
    expect(b.width).toBeCloseTo(393, 5);           // no side strips
    expect(b.y + b.height / 2).toBeLessThanOrEqual(873 + 1e-9);  // stays inside the window
    expect(b.y - b.height / 2).toBeGreaterThanOrEqual(35 - BORROW_PX - 1e-9); // borrows at most BORROW_PX
  });

  it('keeps the letterbox when filling the width would cover much more of the bars', () => {
    // iPhone-like: 59 top, 34 bottom. Width fill would need ~90 px more height.
    const b = fitBox(393, 852, { ...none, top: 59, bottom: 34 }, W, H);
    expect(b.height).toBeCloseTo(852 - 59 - 34, 5);
    expect(b.width).toBeLessThan(393);
    expect(b.y).toBeCloseTo(59 + (852 - 59 - 34) / 2, 5);
  });

  it('never borrows from a window that has no insets', () => {
    const b = fitBox(500, 844, none, W, H);       // a wide desktop window: height-limited
    expect(b.height).toBeCloseTo(844, 5);
    expect(b.width).toBeCloseTo(390, 5);
  });

  it('is unchanged when the stage already fills the width', () => {
    const b = fitBox(390, 900, none, W, H);
    expect(b.width).toBeCloseTo(390, 5);
    expect(b.y).toBeCloseTo(450, 5);
  });
});
