// Padlock shackles are FILLED half-rings (ToyStyle.shacklePoints), never stroked arcs.
// A stroked arc with round caps/joins drew stray lines from every padlock to the screen centre on
// the owner's phone (2026-10-19, after an earlier beginPath() fix did not hold on device): the
// GPU-side triangulation of stroked arcs is the fragile path, a plain polygon fill is not.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { shacklePoints } from '../src/renderer/ToyStyle.js';

describe('shacklePoints', () => {
  const pts = shacklePoints(10, 20, 8, 3, 12);
  const xy = [];
  for (let i = 0; i < pts.length; i += 2) xy.push([pts[i], pts[i + 1]]);
  it('is a closed band: outer arc out, inner arc back', () => {
    expect(xy.length).toBe(2 * (12 + 1));
    expect(xy[0][0]).toBeCloseTo(10 - 8 - 1.5, 5);          // outer left end
    expect(xy[12][0]).toBeCloseTo(10 + 8 + 1.5, 5);         // outer right end
    expect(xy.at(-1)[0]).toBeCloseTo(10 - 8 + 1.5, 5);      // inner left end, back next to the start
  });
  it('stays on the upper half, inside the band', () => {
    for (const [x, y] of xy) {
      const r = Math.hypot(x - 10, y - 20);
      expect(y).toBeLessThanOrEqual(20 + 1e-9);
      expect(r).toBeGreaterThanOrEqual(8 - 1.5 - 1e-6);
      expect(r).toBeLessThanOrEqual(8 + 1.5 + 1e-6);
    }
  });
});

describe('no stroked padlock arcs left in the UI code', () => {
  const files = [];
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } };
  walk('src');
  it('every half-circle arc in src is filled, not stroked', () => {
    const bad = files.filter(f => /\.arc\([^)]*Math\.PI,\s*0\)\s*\.stroke\(/.test(readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });
});
