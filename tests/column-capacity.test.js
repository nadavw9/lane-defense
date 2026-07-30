// COLUMN CAPACITY MUST EQUAL RENDERED SLOT COUNT.
//
// The 2026-07-30 "bombs out of the grid" defect was pure drift, not a design
// tradeoff. SLOT_COUNT was 4 when slot 3 was the stash. The stash was retired
// (the bench became sole storage) and the rendered depth dropped to 3 — but
// GameLoop's crisis inject kept a hardcoded "tolerate 4" capacity. The result was
// a bomb that existed in state but was:
//   - rendered nowhere      (Shooter3D.SLOT_COUNT = 3)
//   - hit-tested nowhere    (DragDrop._hitTestQueueSlot loops row < 3)
//   - merge-ineligible      (the merge window is the 3 visible rows)
// On the band-600 pilot, where the queue is compressed and the bench sits at its
// 28px floor, it visibly clipped through the bench strip.
//
// Three independent numbers had to agree and nothing checked that they did.
// These tests make disagreement fail loudly.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { COLUMN_CAPACITY } from '../src/models/Column.js';

const read = (p) => fs.readFileSync(p, 'utf8');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('column capacity agrees with every consumer', () => {
  it('is a single exported constant, not a literal repeated per call site', () => {
    expect(COLUMN_CAPACITY).toBe(3);
  });

  it('equals the 3D renderer\'s visible slot count', () => {
    const src = read('src/renderer3d/Shooter3D.js');
    const m = src.match(/const SLOT_COUNT\s*=\s*(\d+)/);
    expect(m, 'Shooter3D.SLOT_COUNT not found').not.toBeNull();
    expect(Number(m[1]), 'a bomb beyond the rendered slots is invisible to the player')
      .toBe(COLUMN_CAPACITY);
  });

  it('equals the drag hit-test depth', () => {
    // A bomb past this depth cannot be picked up, dragged, fired or benched.
    const src = read('src/input/DragDrop.js');
    const fn = src.slice(src.indexOf('_hitTestQueueSlot(x, y) {'));
    const m = fn.slice(0, 900).match(/row\s*<\s*(\d+)/);
    expect(m, 'hit-test row bound not found').not.toBeNull();
    expect(Number(m[1]), 'a bomb beyond the hit-test depth is unreachable').toBe(COLUMN_CAPACITY);
  });

  it('GameLoop no longer tolerates an over-capacity column', () => {
    // The exact regression: a hardcoded capacity that outlived the stash.
    const code = stripComments(read('src/game/GameLoop.js'));
    expect(code, 'a hardcoded capacity-4 tolerance is back')
      .not.toMatch(/shooters\.length\s*>\s*4/);
    expect(code, 'GameLoop must bound the crisis inject by the canonical constant')
      .toMatch(/COLUMN_CAPACITY/);
  });

  it('the crisis inject displaces to the BENCH rather than dropping or hiding a bomb', () => {
    const code = stripComments(read('src/game/GameLoop.js'));
    const crisis = code.slice(code.indexOf('crisisEnabled'), code.indexOf('crisisEnabled') + 1400);
    expect(crisis, 'displaced bomb must go to the bench, not be truncated away')
      .toMatch(/bench[\s\S]{0,200}store\(/);
    expect(crisis, 'a full bench must skip the inject rather than lose a playable bomb')
      .toMatch(/isFull/);
  });
});
