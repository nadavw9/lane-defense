// MERGE HARDENING tests (2026-07-10 audit) — one repro+fix test per bug found:
//   S1-A  peek/apply divergence: overlap resolution now lives IN _findMerges, so the
//         animation plan and the application are the same set by construction.
//   PLAN  evaluateMerges(plan) applies EXACTLY the animated plan, re-verified
//         against fresh state (stale entries skipped — no phantom merged bombs).
//   D-1   crisis 4th bomb preserved through a vertical apply (never deleted).
//   D-1b  horizontal apply never truncates a crisis-oversized middle column.
//   D-2   (design, documented): merge window = 3 visible rows; a 4-bomb column
//         does not vertical-merge until it returns to 3.
//   STRESS seeded randomized interleaving of deploy/reorder/bench/auto-fill ops,
//         asserting after EVERY op: no sparse arrays, no duplicated shooter refs,
//         sane lengths, and damage conservation across every merge.
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
import { Car }             from '../src/models/Car.js';
import { Shooter }         from '../src/models/Shooter.js';

const mockApp = { ticker: { add: vi.fn(), remove: vi.fn() } };

function makeState({ laneCount = 4, levelId = 5 } = {}) {
  const lanes   = Array.from({ length: laneCount }, (_, id) => new Lane({ id }));
  const columns = Array.from({ length: 4 }, (_, id) => new Column({ id }));
  const gs = new GameState({
    lanes, columns,
    colors:    ['Red', 'Blue', 'Green'],
    world:     { hpMultiplier: 1, speed: { base: 5, variance: 0.5 } },
    duration:  90, phaseMan: new IntensityPhase(90),
    laneCount, colCount: 4, gridRows: 16, spawnBudget: 20, laneTargetCarCount: 0, levelId,
  });
  gs.targetKills = 9999;
  return { gs, lanes, columns };
}
function makeLoop(gs, seed = 1) {
  const rng = new SeededRandom(seed);
  return new GameLoop({
    app: mockApp, gameState: gs,
    carDir:     new CarDirector({}, rng),
    shooterDir: new ShooterDirector({}, rng, new FairnessArbiter()),
    combatResolver: new CombatResolver(), rng,
  });
}
const S = (color, damage, col = 0, extra = {}) => new Shooter({ color, damage, column: col, ...extra });
const sumDamage = (columns) => columns.reduce((t, c) => t + c.shooters.reduce((s, sh) => s + (sh?.damage ?? 0), 0), 0);

describe('S1-A — overlap resolution in detection (plan == apply)', () => {
  it('an overlapping vertical+horizontal is detected as ONE merge (vertical wins), and peek matches apply', () => {
    const { gs, columns } = makeState();
    const loop = makeLoop(gs);
    columns[0].shooters = [S('Red', 3), S('Red', 3), S('Red', 3)];        // vertical triple
    columns[1].shooters = [S('Red', 4), S('Blue', 2), S('Blue', 2)];      // row0 Red …
    columns[2].shooters = [S('Red', 5), S('Green', 2), S('Green', 2)];    // … completing a horizontal at row0

    const plan = loop.peekMerges();
    expect(plan).toHaveLength(1);                       // OLD peek returned 2 → phantom animation
    expect(plan[0].type).toBe('vertical');

    const applied = loop.evaluateMerges(plan);
    expect(applied).toHaveLength(1);                    // exactly the plan, nothing silently skipped
    expect(columns[1].shooters[0].color).toBe('Red');   // horizontal sources untouched
    expect(columns[2].shooters[0].color).toBe('Red');
  });

  it('two horizontal windows sharing columns detect as ONE merge (first window claims the slots)', () => {
    const { gs, columns } = makeState();
    const loop = makeLoop(gs);
    for (let c = 0; c < 4; c++) columns[c].shooters = [S('Red', 2, c), S('Blue', 2, c), S('Green', 2, c)];

    const found = loop.peekMerges().filter(m => m.src.row === 0);
    expect(found).toHaveLength(1);
    expect(found[0].src.startCol).toBe(0);              // window (1,2,3) skipped — cols 1,2 claimed
  });
});

describe('evaluateMerges(plan) — applies exactly the animated plan, verified fresh', () => {
  it('applies each planned merge and fires _onMerge per entry', () => {
    const { gs, columns } = makeState();
    const loop = makeLoop(gs);
    loop._onMerge = vi.fn();
    columns[0].shooters = [S('Red', 2), S('Red', 3), S('Red', 4)];

    const plan = loop.peekMerges();
    const applied = loop.evaluateMerges(plan);

    expect(applied).toHaveLength(1);
    expect(applied[0].planEntry).toBe(plan[0]);         // aligned with the animated entry
    expect(columns[0].shooters[0].isMerged).toBe(true); // vertical → merged at TOP
    expect(columns[0].shooters[0].damage).toBe(9);
    expect(loop._onMerge).toHaveBeenCalledTimes(1);
  });

  it('SKIPS a stale plan entry (state changed after peek) — no phantom merge, state untouched', () => {
    const { gs, columns } = makeState();
    const loop = makeLoop(gs);
    loop._onMerge = vi.fn();
    columns[0].shooters = [S('Red', 2), S('Red', 3), S('Red', 4)];

    const plan = loop.peekMerges();
    columns[0].shooters[1].color = 'Blue';              // board changed between peek and burst

    const applied = loop.evaluateMerges(plan);
    expect(applied).toHaveLength(0);                    // verified against FRESH state → skipped
    expect(columns[0].shooters).toHaveLength(3);        // nothing consumed
    expect(columns[0].shooters.every(s => !s.isMerged)).toBe(true);
    expect(loop._onMerge).not.toHaveBeenCalled();       // no effect without result
  });
});

describe('D-1 — crisis 4th bomb is never deleted by a merge', () => {
  it('vertical apply preserves shooters beyond index 2', () => {
    const { gs, columns } = makeState();
    const loop = makeLoop(gs);
    const extra = S('Blue', 7);                          // the crisis-injected 4th bomb
    columns[0].shooters = [S('Red', 2), S('Red', 3), S('Red', 4), extra];

    // D-2 (design): a 4-bomb column is NOT detected for vertical merge…
    expect(loop.peekMerges()).toHaveLength(0);
    // …but if an apply ever reaches it (planned/stale paths), extras are preserved.
    const before = sumDamage(columns);
    loop._applyMerge({ type: 'vertical', col: 0 });
    expect(columns[0].shooters).toHaveLength(2);
    expect(columns[0].shooters[0].isMerged).toBe(true);
    expect(columns[0].shooters[1]).toBe(extra);          // same reference — never deleted
    expect(sumDamage(columns)).toBe(before);             // damage conserved
  });

  it('horizontal apply does not truncate a crisis-oversized middle column', () => {
    const { gs, columns } = makeState();
    const loop = makeLoop(gs);
    const extra = S('Green', 9, 1);
    columns[0].shooters = [S('Red', 2, 0), S('Blue', 2, 0)];
    columns[1].shooters = [S('Red', 3, 1), S('Blue', 2, 1), S('Green', 2, 1), extra];  // 4 bombs (crisis)
    columns[2].shooters = [S('Red', 4, 2), S('Blue', 2, 2)];

    const before = sumDamage(columns);
    loop._applyMerge({ type: 'horizontal', row: 0, startCol: 0 });
    expect(columns[1].shooters[0].isMerged).toBe(true);  // merged at middle column front
    expect(columns[1].shooters).toContain(extra);        // 4th bomb survived (no length=3 truncation)
    expect(sumDamage(columns)).toBe(before);             // damage conserved
  });
});

describe('STRESS — randomized interleaved ops, invariants after every op', () => {
  it('400 seeded ops: no sparse arrays, no duplicate refs, damage conserved through merges', () => {
    const { gs, lanes, columns } = makeState();
    const loop = makeLoop(gs, 42);
    const rng  = new SeededRandom(1337);
    // Headless mimic of the renderer wiring: auto-fill → evaluate (the sequencer's job).
    loop._onAutoFill = () => loop.evaluateMerges();
    const bench = [];                                     // BenchStorage stand-in (cap 3)
    const mergedSeen = [];
    loop._onMerge = (d) => mergedSeen.push(d);

    const assertInvariants = (opName, opIdx) => {
      const seen = new Set();
      for (const col of columns) {
        // 1. Dense arrays — no holes (undefined.color is the crash class).
        expect(col.shooters.includes(undefined), `${opName}#${opIdx}: sparse array`).toBe(false);
        expect(col.shooters.length, `${opName}#${opIdx}: column overflow`).toBeLessThanOrEqual(4);
        // 2. No duplicated shooter references anywhere.
        for (const s of col.shooters) {
          expect(seen.has(s), `${opName}#${opIdx}: duplicated shooter ref`).toBe(false);
          seen.add(s);
        }
      }
      for (const s of bench) {
        expect(seen.has(s), `${opName}#${opIdx}: bench duplicates a queue ref`).toBe(false);
        seen.add(s);
      }
    };

    // Keep the board alive: one row-0 car per lane, reset every op (no breach/win).
    const resetLanes = () => {
      for (const lane of lanes) {
        lane.cars.length = 0;
        const c = new Car({ color: 'Red', hp: 999, speed: 5 });
        c.row = 0; c.position = 0;
        lane.addCar(c);
      }
    };
    resetLanes();
    loop.refillQueue();                                   // prime the queue

    const OPS = ['deploy', 'reorder', 'benchStore', 'benchReturn', 'autoFill', 'plannedMerge'];
    for (let i = 0; i < 400; i++) {
      resetLanes();
      const op = OPS[Math.floor(rng.nextFloat(0, 1) * OPS.length)];
      const c  = Math.floor(rng.nextFloat(0, 1) * 4);
      const col = columns[c];

      if (op === 'deploy' && col.shooters.length > 0) {
        col.consume();                                    // fire the top bomb…
        loop._advanceGrid();                              // …advance + refill + _onAutoFill (merge)
      } else if (op === 'reorder') {
        // Mirror DragDrop._handleQueueReorder's guarded swap/move on valid live indices.
        const tc = Math.floor(rng.nextFloat(0, 1) * 4);
        const sr = Math.floor(rng.nextFloat(0, 1) * 3);
        const tr = Math.floor(rng.nextFloat(0, 1) * 3);
        const src = columns[c], tgt = columns[tc];
        const dragged = src.shooters[sr];
        if (dragged && !(c === tc && sr === tr)) {
          if (tgt.shooters[tr] !== undefined) {
            src.shooters[sr] = tgt.shooters[tr];
            tgt.shooters[tr] = dragged;
          } else {
            src.shooters.splice(sr, 1);
            tgt.shooters.push(dragged);
          }
          loop.evaluateMerges();                          // the onReorder trigger
        }
      } else if (op === 'benchStore' && col.shooters.length > 0 && bench.length < 3) {
        bench.push(col.shooters.shift());                 // consume top → bench
        loop._step(1 / 60);                               // bench refill path (+ _onAutoFill on growth)
      } else if (op === 'benchReturn' && bench.length > 0 && col.shooters.length < 3) {
        col.pushBottom(bench.pop());
        loop.evaluateMerges();                            // bench-return trigger
      } else if (op === 'autoFill') {
        loop._step(1 / 60);                               // steady-state / growth tick
      } else if (op === 'plannedMerge') {
        const before = sumDamage(columns);
        const plan = loop.peekMerges();
        const applied = loop.evaluateMerges(plan);        // the sequencer's exact call
        expect(applied.length).toBe(plan.length);         // plan == apply (no interleaving here)
        expect(sumDamage(columns)).toBe(before);          // merges only ever conserve damage
      }

      // Damage conservation is asserted inside plannedMerge; here assert structure.
      assertInvariants(op, i);
      // Every merge that fired put a real merged bomb at the front of its column.
      for (const d of mergedSeen.splice(0)) {
        const target = d.type === 'vertical' ? columns[d.column] : columns[d.midCol];
        expect(target.shooters[0]?.isMerged, `merge ${d.type} left no merged bomb`).toBe(true);
      }
    }
  });
});
