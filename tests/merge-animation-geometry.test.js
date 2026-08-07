// A BALL IS EITHER SEATED IN A SOCKET, OR NOT DRAWN. NEVER BETWEEN.
//
// Bomb sockets are Pixi circles at fixed screen positions; bomb balls are Three
// meshes. The two renderers do not move together, so ANY visible ball position
// that is not a socket position is wrong — not "slightly off", wrong, because the
// socket it belongs to is still drawn empty somewhere else on screen.
//
// The merge sequencer's 'travel' phase used to lerp the two outer bombs across the
// queue to the destination slot over 150ms. Measured on the live build via a
// per-frame trace (scripts/_ball-timeseries.mjs): a visible ball reached 2.00 SLOT
// PITCHES — two entire sockets — from its own socket, for ~120ms per merge.
//
// This is the third fix for "balls outside their sockets". The first two
// (e7b4720 _baseZ live-read, c35d40f drop travel derived from pitch) both targeted
// the refill DROP and both shipped and were confirmed live while the bug persisted,
// because the merge was never the suspect. Re-tuning a travel curve cannot fix this
// class: every point along a path between two sockets is outside both.
//
// So the invariant is structural rather than numeric, and this test guards the
// structure: nothing in the merge sequence may move a slot's world position.
import { describe, it, expect } from 'vitest';
import fs from 'fs';

const SRC = fs.readFileSync('src/renderer/GameApp.js', 'utf8');

// The merge sequencer's phases, sliced out of the source by their phase guards.
function phaseBlock(name, next) {
  const start = SRC.indexOf(`this.phase === '${name}'`);
  const end   = SRC.indexOf(`this.phase === '${next}'`);
  expect(start, `merge phase '${name}' not found — did the sequencer get renamed?`).toBeGreaterThan(-1);
  expect(end,   `merge phase '${next}' not found`).toBeGreaterThan(start);
  return SRC.slice(start, end);
}

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('merge animation never renders a ball between sockets', () => {
  it("the 'travel' phase does not move any slot's world position", () => {
    const travel = stripComments(phaseBlock('travel', 'pop'));
    expect(travel, 'travel moves bombs across slots again — a ball drawn between two '
      + 'sockets is outside both, and no easing curve makes that correct')
      .not.toMatch(/setBombSlotWorld\s*\(/);
  });

  it("the 'highlight' and 'pop' phases only scale, never translate", () => {
    for (const [name, next] of [['highlight', 'travel'], ['pop', 'fill']]) {
      const block = stripComments(phaseBlock(name, next));
      expect(block, `merge phase '${name}' moved a slot`).not.toMatch(/setBombSlotWorld\s*\(/);
    }
  });

  it('the only slot translation left in GameApp is the refill drop', () => {
    // The drop is a legitimate translation: it lands a bomb INTO its own socket
    // from directly above, and tests/drop-animation-geometry.test.js bounds it.
    const calls = stripComments(SRC).match(/setBombSlotWorld\s*\(/g) ?? [];
    expect(calls, 'a new slot-translation appeared; if it is a real drop-in, bound it '
      + 'in tests/drop-animation-geometry.test.js and list it here').toHaveLength(1);
  });

  it('the cross-slot interpolation caches are gone, not just unused', () => {
    // _destW / tr._w existed solely to interpolate between two slots. Leaving them
    // populated would invite exactly this animation to be rebuilt on top of them —
    // dead state that still looks live is how the stash caused two later bugs.
    const code = stripComments(SRC);
    expect(code, 'the merge destination-world cache is back').not.toMatch(/_destW/);
    expect(code, 'the traveler world-position cache is back').not.toMatch(/\btr\._w\b/);
  });
});
