// Merge animation must not start while a bomb is still in flight.
//
// User-reported 2026-07-27: "when there is both a bomb shooting and a merge
// following it, the bomb shot should appear first on the screen, and only then
// all the merge." Firing consumes a bomb; the refill that follows fires
// _onAutoFill -> requestCheck() while the bomb is still travelling.
//
// Measured with an EDGE-TRIGGERED instrument (sampling inFlight() at the instant
// start() fires, before pause() can freeze anything — a polling sampler cannot
// tell "began mid-flight" from "began legitimately then froze a later shot"):
//   before: 2 of 2 merges began mid-flight
//   after:  0 of 6, with cascade depths [1,2,2,1,1,2] intact
//
// The fix reuses the EXISTING _pending deferral gate. These tests pin the
// properties that make that safe.
import { describe, it, expect } from 'vitest';
import fs from 'fs';

const SRC = fs.readFileSync('src/renderer/GameApp.js', 'utf8');
const SEQ = SRC.slice(SRC.indexOf('const mergeSequencer = {'), SRC.indexOf('gameLoop._onAutoFill'));
// Anchor on the declaration brace — prose in comments also contains the name.
const between = (a, b) => SEQ.slice(SEQ.indexOf(a), SEQ.indexOf(b));

describe('merge animation is gated behind bomb flight', () => {
  it('requestCheck defers while a shot is in flight, via the existing _pending gate', () => {
    const fn = between('requestCheck() {', 'start() {');
    expect(fn).toMatch(/_shotInFlight\(\)/);
    expect(fn, 'must reuse _pending, not invent a second mechanism').toMatch(/_pending\s*=\s*true/);
    expect(fn, 'must still defer for an active sequence and for a drag')
      .toMatch(/this\.active[\s\S]{0,60}isDragging\(\)/);
  });

  it('the update() drain mirrors the same condition (no early release, no deadlock)', () => {
    const drain = between('update(dt) {', 'this.t += dt');
    expect(drain, 'drain must gate on the shot').toMatch(/_shotInFlight\(\)/);
    expect(drain, 'drain must still gate on the drag').toMatch(/isDragging\(\)/);
    expect(drain, 'drain must clear _pending and start').toMatch(/_pending\s*=\s*false[\s\S]{0,60}start\(\)/);
  });

  it('_shotInFlight is a pure read of firingSlots', () => {
    const fn = between('_shotInFlight() {', 'requestCheck() {');
    expect(fn).toMatch(/firingSlots/);
    // A gate that mutated state would be a state-write change, which this work
    // is explicitly not permitted to make.
    expect(fn, 'the gate must not assign to game state').not.toMatch(/gs\.[A-Za-z_]+\s*=[^=]/);
  });

  it('start() still re-peeks fresh state — a deferred merge never replays a snapshot', () => {
    const fn = between('start() {', '_beginBatch(plan) {');
    expect(fn, 'must re-read merges at execution time').toMatch(/peekMerges\(\)/);
    expect(fn, 'and bail cleanly if the board no longer has a merge')
      .toMatch(/if\s*\(!plan\.length\)\s*return/);
  });

  it('state-write ordering is untouched — the animator never applies merges', () => {
    // gameLoop owns the writes (plan==apply atomicity from the hardening pass).
    // An apply call appearing in the sequencer would mean that was broken.
    expect(SEQ).not.toMatch(/applyMerges/);
  });
});
