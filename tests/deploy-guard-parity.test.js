// THE INPUT GUARD AND THE GAME-LOOP GUARD MUST AGREE, ALWAYS.
//
// Deploys are refused in two places, and for six weeks they disagreed:
//
//   DragDrop.onPointerUp   asked only `firingSlots[laneIdx]`  — is the TARGET busy?
//   GameLoop.deploy        also refuses while ANY lane is in flight (turn-based)
//
// A drop into a DIFFERENT lane during a shot therefore passed the input guard,
// `_handleLaneDrop` played the whole fly-into-the-lane animation and destroyed the
// ghost, and only then did GameLoop refuse with a bare `return`. The player saw a
// launch that never happened, with the bomb still in the queue — reported as
// "I can't put another one next to him".
//
// The divergence IS the defect. A silent refusal is survivable; a refusal that
// first plays the success animation is not. So this file does not test either
// guard's rule — it tests that they answer identically for every combination of
// drag source, target lane and in-flight board, so they cannot drift again.
//
// The two entry points genuinely differ from each other, and that is deliberate:
//   deploy()          refuses if ANY lane is in flight, or the target is busy
//   deployFromBench() refuses only if the TARGET lane is busy
// so the input guard is source-dependent on purpose. A blanket global check would
// silently make bench drops stricter than the game actually is.
import { describe, it, expect, vi } from 'vitest';
import { DragDrop }         from '../src/input/DragDrop.js';
import { GameLoop }         from '../src/game/GameLoop.js';
import { GameState }        from '../src/game/GameState.js';
import { CombatResolver }   from '../src/game/CombatResolver.js';
import { CarDirector }      from '../src/director/CarDirector.js';
import { ShooterDirector }  from '../src/director/ShooterDirector.js';
import { FairnessArbiter }  from '../src/director/FairnessArbiter.js';
import { IntensityPhase }   from '../src/director/IntensityPhase.js';
import { SeededRandom }     from '../src/utils/SeededRandom.js';
import { Lane }             from '../src/models/Lane.js';
import { Column }           from '../src/models/Column.js';
import { Shooter }          from '../src/models/Shooter.js';

const LANES = 4;
const mockApp = { ticker: { add: vi.fn(), remove: vi.fn() } };

function freshLoop() {
  const lanes   = Array.from({ length: LANES }, (_, id) => new Lane({ id }));
  const columns = Array.from({ length: LANES }, (_, id) => new Column({ id }));
  for (const c of columns) for (let i = 0; i < 3; i++) c.pushBottom(new Shooter({ color: 'Red', damage: 3 }));
  const gs = new GameState({
    lanes, columns, colors: ['Red', 'Blue', 'Green'],
    world: { hpMultiplier: 1, speed: { base: 5, variance: 0.5 } },
    duration: 90, phaseMan: new IntensityPhase(90),
    laneCount: LANES, colCount: LANES, gridRows: 8,
  });
  const rng = new SeededRandom(1);
  const loop = new GameLoop({
    app: mockApp, gameState: gs,
    carDir: new CarDirector({}, rng),
    shooterDir: new ShooterDirector({}, rng, new FairnessArbiter()),
    combatResolver: new CombatResolver(), rng,
  });
  return { gs, loop };
}

// What the INPUT layer predicts, without constructing the whole DragDrop graph.
// The method only reads _firingSlots and _dragSource.
const inputRefuses = (firingSlots, laneIdx, dragSource) =>
  DragDrop.prototype._deployWouldBeRefused.call({ _firingSlots: firingSlots, _dragSource: dragSource }, laneIdx);

// What the GAME actually does, observed rather than re-implemented: a deploy that
// was accepted leaves a firing slot behind.
function loopRefuses(inFlight, laneIdx, dragSource) {
  const { gs, loop } = freshLoop();
  for (const l of inFlight) gs.firingSlots[l] = { shooter: {}, colIdx: 0, timeLeft: 0.18 };
  const before = gs.firingSlots.map((s) => s !== null);
  if (dragSource === 'bench') loop.deployFromBench(new Shooter({ color: 'Red', damage: 3 }), laneIdx);
  else                        loop.deploy(0, laneIdx);
  const after = gs.firingSlots.map((s) => s !== null);
  return before.every((v, i) => v === after[i]);   // nothing changed => refused
}

// Every subset of in-flight lanes.
const subsets = [];
for (let mask = 0; mask < (1 << LANES); mask++)
  subsets.push([...Array(LANES).keys()].filter((i) => mask & (1 << i)));

describe('the input guard and the game-loop guard agree exactly', () => {
  for (const dragSource of ['column', 'bench']) {
    it(`${dragSource} drags: identical verdict for every board and target lane`, () => {
      const mismatches = [];
      for (const inFlight of subsets) {
        for (let lane = 0; lane < LANES; lane++) {
          const slots = Array.from({ length: LANES },
            (_, i) => (inFlight.includes(i) ? { shooter: {}, colIdx: 0, timeLeft: 0.18 } : null));
          const predicted = inputRefuses(slots, lane, dragSource);
          const actual    = loopRefuses(inFlight, lane, dragSource);
          if (predicted !== actual) {
            mismatches.push(`inFlight=[${inFlight}] target=${lane}: `
              + `input says ${predicted ? 'refuse' : 'accept'} but GameLoop ${actual ? 'refuses' : 'accepts'}`);
          }
        }
      }
      expect(mismatches, 'the guards disagree — a drop the input layer accepts but the loop '
        + 'refuses plays the full launch animation and then silently does nothing:\n  '
        + mismatches.join('\n  ')).toEqual([]);
    });
  }

  it('specifically: a column drop into ANOTHER lane during a shot is refused up front', () => {
    // The exact reported case. Before the fix the input guard accepted this.
    const slots = [{ shooter: {}, colIdx: 0, timeLeft: 0.18 }, null, null, null];
    expect(inputRefuses(slots, 1, 'column'),
      'dropping next to an in-flight shot must snap back, not fake a launch').toBe(true);
    expect(loopRefuses([0], 1, 'column')).toBe(true);
  });

  it('does NOT make bench drops stricter than the game itself', () => {
    // deployFromBench has no turn-based rule; the input guard must not invent one.
    const slots = [{ shooter: {}, colIdx: 0, timeLeft: 0.18 }, null, null, null];
    expect(inputRefuses(slots, 1, 'bench'), 'bench drop wrongly blocked').toBe(false);
    expect(loopRefuses([0], 1, 'bench'), 'GameLoop unexpectedly refused a bench drop').toBe(false);
  });

  it('the OLD target-lane-only rule provably disagreed — do not go back to it', () => {
    // This is the shipped bug, expressed as a test. `firingSlots[laneIdx]` alone is
    // the exact predicate DragDrop used; it accepts cases GameLoop refuses. Pinned
    // so that reverting the guard fails here with a readable reason rather than
    // quietly restoring the false-success launch.
    const oldRule = (slots, laneIdx) => !!slots[laneIdx];
    const disagreements = [];
    for (const inFlight of subsets) {
      for (let lane = 0; lane < LANES; lane++) {
        const slots = Array.from({ length: LANES },
          (_, i) => (inFlight.includes(i) ? { shooter: {}, colIdx: 0, timeLeft: 0.18 } : null));
        if (oldRule(slots, lane) !== loopRefuses(inFlight, lane, 'column')) {
          disagreements.push(`inFlight=[${inFlight}] target=${lane}`);
        }
      }
    }
    expect(disagreements.length,
      'the old rule agreed everywhere, so this test no longer describes a real bug')
      .toBeGreaterThan(0);
    // Every disagreement is the same shape: another lane busy, target lane free.
    expect(inputRefuses(
      [{ shooter: {}, colIdx: 0, timeLeft: 0.18 }, null, null, null], 1, 'column'),
      'the current guard must NOT reproduce the old rule').toBe(true);
  });

  it('an idle board accepts from both sources', () => {
    const slots = [null, null, null, null];
    for (const src of ['column', 'bench']) {
      expect(inputRefuses(slots, 2, src)).toBe(false);
      expect(loopRefuses([], 2, src)).toBe(false);
    }
  });
});
