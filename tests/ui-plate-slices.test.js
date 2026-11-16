// The green button plate must keep the art's own corner shape at any size
// (PrimeTestLab report 10510, M-01: a 58px card button drew pointed ends with
// spikes because the plate was sliced at screen scale, not at the art's scale).
import { describe, it, expect } from 'vitest';
import { plateSlices, PLATE_CORNER } from '../src/renderer/UIIcon.js';

const ART = { w: 640, h: 180 };   // public/sprites/ui/button-primary.png

describe('uiPlate slicing', () => {
  it('scales the plate evenly: the drawn height is the target height', () => {
    for (const h of [40, 58, 70, 88]) {
      const k = plateSlices(ART.w, ART.h, 190, h);
      expect(k.geoH * k.s).toBeCloseTo(h, 6);
      expect(k.geoW * k.s).toBeCloseTo(190, 6);
    }
  });

  it('keeps the whole corner for card buttons (no squeezed middle band)', () => {
    const k = plateSlices(ART.w, ART.h, 190, 58);   // GOT IT / NICE! size
    expect(k.inset).toBe(PLATE_CORNER);
    expect(k.side).toBe(PLATE_CORNER);
    // The middle band keeps the same share of the height as in the art.
    expect(k.geoH - 2 * k.inset).toBe(ART.h - 2 * PLATE_CORNER);
  });

  it('never lets the left and right corners overlap on a narrow plate', () => {
    const k = plateSlices(ART.w, ART.h, 30, 58);
    expect(2 * k.side).toBeLessThan(k.geoW);
  });
});
