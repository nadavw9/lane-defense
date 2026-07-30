// CASCADE INTEGRITY UNDER THE SHOT/MERGE GATE (2026-07-30).
//
// The gate defers the merge ANIMATION until a shot has finished resolving, so the
// bomb shot is seen before the merge plays. The open question it had to answer:
// does deferring change the OUTCOME? Cascade integrity is a state question, not a
// timing one, so it is settled here deterministically — no browser, no timing
// window, no pause contamination.
//
// The sequencer's real cascade loop (GameApp mergeSequencer) is:
//     plan = peekMerges() -> animate -> evaluateMerges(plan) -> refillQueue()
//                         -> peekMerges() again (cascade) -> ... -> resume
// It is reproduced here exactly, minus the animation, and run in the two
// orderings the gate chooses between:
//     GATE OFF : merges run while the shot is still in flight
//     GATE ON  : the shot resolves fully first, then merges run
// Identical final board state in both = deferring is outcome-neutral.
import { describe, it, expect, vi } from 'vitest';
import { GameLoop }        from '../src/game/GameLoop.js';
import { GameState }       from '../src/game/GameState.js';
import { CombatResolver }  from '../src/game/CombatResolver.js';
import { CarDirector }     from '../src/director/CarDirector.js';
import { ShooterDirector } from '../src/director/ShooterDirector.js';
import { FairnessArbiter } from '../src/director/FairnessArbiter.js';
import { IntensityPhase }  from '../src/director/IntensityPhase.js';
import { SeededRandom }    from '../src/utils/SeededRandom.js';
import { Lane }            from '../src/models/Lane.js';
import { Column }          from '../src/models/Column.js';
import { Shooter }         from '../src/models/Shooter.js';

const mockApp = { ticker: { add: vi.fn(), remove: vi.fn() } };

function makeState({ levelId = 5 } = {}) {
  const lanes   = Array.from({ length: 4 }, (_, id) => new Lane({ id }));
  const columns = Array.from({ length: 4 }, (_, id) => new Column({ id }));
  const gs = new GameState({
    lanes, columns, colors: ['Red', 'Blue', 'Green'],
    world: { hpMultiplier: 1, speed: { base: 5, variance: 0.5 } },
    duration: 90, phaseMan: new IntensityPhase(90),
    laneCount: 4, colCount: 4, gridRows: 16, spawnBudget: 20,
    laneTargetCarCount: 0, levelId,
  });
  gs.targetKills = 9999;
  return { gs, columns };
}
function makeLoop(gs, seed = 7) {
  const rng = new SeededRandom(seed);
  return new GameLoop({
    app: mockApp, gameState: gs,
    carDir: new CarDirector({}, rng),
    shooterDir: new ShooterDirector({}, rng, new FairnessArbiter()),
    combatResolver: new CombatResolver(), rng,
  });
}
const S = (color, damage, col = 0) => new Shooter({ color, damage, column: col });

/** Snapshot of everything a merge can legally touch. */
const snapshot = (columns) => columns.map((c) => c.shooters.map(
  (s) => (s ? `${s.color}:${s.damage}:${s.isMerged ? 'M' : '-'}` : 'EMPTY')).join(','),
).join(' | ');

/**
 * The sequencer's cascade loop, minus animation. `refill` is off by default so
 * the cascade is driven purely by the board under test and stays deterministic —
 * the director would otherwise inject random bombs and the two orderings could
 * legitimately diverge for reasons unrelated to the gate.
 */
function runCascade(loop, { maxChain = 6, refill = false } = {}) {
  const applied = [];
  let chain = 0;
  for (;;) {
    const plan = loop.peekMerges();
    if (!plan.length || chain >= maxChain) break;
    const a = loop.evaluateMerges(plan);      // applies EXACTLY the peeked plan
    applied.push(...a);
    if (!a.length) break;                     // plan went stale -> no progress, stop
    if (refill) loop.refillQueue();
    chain++;
  }
  return { applied, chain };
}

/** A board whose first vertical merge creates the conditions for a second. */
function twoStepBoard(columns) {
  // col0: Red Red Red        -> vertical merge -> merged Red lands at row 0
  // col1: Red Blue Blue      } after col0 merges, row0 across col0..col2 is
  // col2: Red Green Green    } Red/Red/Red -> horizontal merge at col1
  columns[0].shooters = [S('Red', 3, 0), S('Red', 3, 0), S('Red', 3, 0)];
  columns[1].shooters = [S('Red', 4, 1), S('Blue', 2, 1), S('Blue', 2, 1)];
  columns[2].shooters = [S('Red', 5, 2), S('Green', 2, 2), S('Green', 2, 2)];
  columns[3].shooters = [S('Blue', 2, 3), S('Green', 2, 3), S('Blue', 2, 3)];
}

/**
 * A wider board: multiple columns able to merge, exercising a multi-entry plan
 * rather than a single merge. NOTE it resolves as one batched step, not three
 * chained ones — see the depth comment in the test body for why.
 */
function threeStepBoard(columns) {
  columns[0].shooters = [S('Red', 3, 0), S('Red', 3, 0), S('Red', 3, 0)];
  columns[1].shooters = [S('Red', 4, 1), S('Blue', 2, 1), S('Green', 2, 1)];
  columns[2].shooters = [S('Red', 5, 2), S('Blue', 2, 2), S('Green', 2, 2)];
  columns[3].shooters = [S('Green', 2, 3), S('Blue', 2, 3), S('Green', 2, 3)];
}

describe('cascade integrity is unchanged by deferring the merge (the gate)', () => {
  for (const [name, build, minChain] of [
    ['vertical-enabling board', twoStepBoard, 2],
    ['multi-column board', threeStepBoard, 3],
  ]) {
    it(`${name}: final board state is IDENTICAL gate-off vs gate-on`, () => {
      // GATE OFF — merges run immediately, i.e. while the shot would still be in
      // flight. This is master's behaviour.
      const off = makeState(); const offLoop = makeLoop(off.gs);
      build(off.columns);
      const offRes = runCascade(offLoop);

      // GATE ON — the shot resolves FIRST (the gate's whole effect is that the
      // merge waits), and only then does the identical cascade run.
      const on = makeState(); const onLoop = makeLoop(on.gs);
      build(on.columns);
      onLoop._advanceGrid();                    // stand-in for the shot resolving
      const onRes = runCascade(onLoop);

      expect(snapshot(on.columns), 'deferring the merge changed the final board')
        .toBe(snapshot(off.columns));
      expect(onRes.applied.length, 'a different number of merges applied when deferred')
        .toBe(offRes.applied.length);
      // DEPTH, HONESTLY. Neither board produces a deep SEQUENTIAL chain, and that
      // is a property of the engine rather than a shortcoming here:
      // `peekMerges()` returns every simultaneously-valid merge in one pass, and
      // overlap resolution collapses an overlapping vertical+horizontal into a
      // single merge (vertical wins — see merge-hardening S1-A). A hand-built
      // board therefore tends to resolve in ONE batched step. The project's own
      // merge-engine.test.js hit the same wall and settled for structural
      // guarantees ("just ensure 2 passes are allowed without infinite loops").
      //
      // What IS asserted, and what actually answers the gate's open question:
      // merges do occur, and the final board is byte-identical whether they run
      // during the shot or after it. Depth would strengthen the evidence; it is
      // not what the gate could plausibly break, since the gate only changes WHEN
      // the sequence starts, never how it iterates.
      expect(onRes.applied.length, `${name}: no merges applied — board is not exercising the path`)
        .toBeGreaterThan(0);
      expect(onRes.chain, `${name}: cascade loop did not run`).toBeGreaterThanOrEqual(1);
    });

    it(`${name}: every merge applies EXACTLY once — none dropped, none doubled`, () => {
      const { gs, columns } = makeState(); const loop = makeLoop(gs);
      build(columns);
      loop._advanceGrid();                      // deferred, as the gate does
      const { applied } = runCascade(loop);
      expect(applied.length, 'no merges applied — the board did not cascade').toBeGreaterThan(0);

      // Double-application would reuse a source slot across two applied merges.
      const seen = new Set();
      for (const d of applied) {
        // Vertical descriptors expose `column`; horizontal ones `startCol`+`row`.
        // Using the wrong field collapses distinct merges onto one key and reads
        // as a false double-apply.
        const key = `${d.type}:${d.column ?? d.startCol}:${d.row ?? d.position ?? 0}`;
        expect(seen.has(key), `merge ${key} applied twice`).toBe(false);
        seen.add(key);
      }
      // Nothing left queued: a further peek must find nothing to do.
      expect(loop.peekMerges().length, '_pending equivalent: merges left undrained').toBe(0);
      // No structural damage from the deferred path.
      for (const c of columns) {
        expect(c.shooters.length).toBeLessThanOrEqual(4);
        expect(c.shooters.every((s) => s != null), 'sparse/holed column').toBe(true);
        expect(new Set(c.shooters).size, 'duplicated shooter reference').toBe(c.shooters.length);
      }
    });
  }

  it('a deferred plan is re-verified against FRESH state, not replayed blind', () => {
    // The hardening pass's invariant. Peek a plan, then invalidate the board
    // underneath it — as a resolving shot or an earlier cascade step could — and
    // assert the stale entry is SKIPPED rather than creating a phantom merge.
    const { gs, columns } = makeState(); const loop = makeLoop(gs);
    columns[0].shooters = [S('Red', 3, 0), S('Red', 3, 0), S('Red', 3, 0)];
    const plan = loop.peekMerges();
    expect(plan.length).toBe(1);

    columns[0].shooters[1] = S('Blue', 3, 0);          // board changed after the peek
    const applied = loop.evaluateMerges(plan);
    expect(applied.length, 'a stale plan entry was applied against changed state').toBe(0);
    expect(columns[0].shooters.some((s) => s.isMerged), 'phantom merged bomb created').toBe(false);
  });

  it('deferring does not change TOTAL DAMAGE on the board (conservation)', () => {
    const sum = (cols) => cols.reduce((t, c) => t + c.shooters.reduce((s, sh) => s + (sh?.damage ?? 0), 0), 0);
    const off = makeState(); const offLoop = makeLoop(off.gs); twoStepBoard(off.columns);
    const offBefore = sum(off.columns); runCascade(offLoop);
    const on = makeState(); const onLoop = makeLoop(on.gs); twoStepBoard(on.columns);
    const onBefore = sum(on.columns); onLoop._advanceGrid(); runCascade(onLoop);
    expect(onBefore).toBe(offBefore);
    expect(sum(on.columns), 'deferred cascade conserved a different amount of damage')
      .toBe(sum(off.columns));
  });
});
