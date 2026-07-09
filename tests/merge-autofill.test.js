// Tests for the MID-GAME AUTO-FILL merge fix (DEFECT 1 + the _onAutoFill signal).
//
// Bug: merge evaluation ran on player actions + level-start settle, but NOT after the
// queue auto-fills mid-game (post-fire refill, bench refill) — so a 3-same-colour line
// formed by an auto-fill sat unmerged until the next player action.
//
// Fix: GameLoop fires _onAutoFill?.() after any refill that ADDED bombs (once per shot
// from _advanceGrid; once per bench/crisis growth from _step, never on steady-state
// ticks). GameApp routes it through the same mergeSequencer as player-action merges.
//
// These are headless director-level tests of the SIGNAL + the merge-on-auto-fill
// contract (wiring _onAutoFill → evaluateMerges mirrors what GameApp does). The visible
// drop-in cascade (DEFECT 2) is verified by the visual screenshot, not here.
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
    colors:    ['Red', 'Blue', 'Green', 'Yellow'],
    world:     { hpMultiplier: 1, speed: { base: 5, variance: 0.5 } },
    duration:  90, phaseMan: new IntensityPhase(90),
    laneCount, colCount: 4, gridRows: 11, spawnBudget: 0, laneTargetCarCount: 0, levelId,
  });
  gs.targetKills = 999;   // avoid the _advanceGrid win-check early-return (no goals set)
  return { gs, lanes, columns };
}

function makeLoop(gs) {
  const rng = new SeededRandom(1);
  return new GameLoop({
    app: mockApp, gameState: gs,
    carDir:     new CarDirector({}, rng),
    shooterDir: new ShooterDirector({}, rng, new FairnessArbiter()),
    combatResolver: new CombatResolver(), rng,
  });
}

const addCar = (lane, color, row, hp = 5) => {
  const c = new Car({ color, hp, speed: 5 });
  c.row = row; c.position = row * 10;
  lane.addCar(c);
  return c;
};
const threeReds = (col) => [
  new Shooter({ color: 'Red', damage: 2, column: col }),
  new Shooter({ color: 'Red', damage: 3, column: col }),
  new Shooter({ color: 'Red', damage: 2, column: col }),
];
const hasRawRedTriple = (shooters) =>
  shooters.length >= 3 && shooters.slice(0, 3).every(s => s.color === 'Red' && !s.isMerged);

describe('auto-fill merge — _onAutoFill signal fires on a shot refill', () => {
  it('fires _onAutoFill after _advanceGrid refills the queue (once per shot)', () => {
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs);
    const spy = vi.fn();
    loop._onAutoFill = spy;
    addCar(lanes[0], 'Red', 2);        // a car so the advance is safe (no breach/win)

    loop._advanceGrid();               // simulates a resolved shot's grid advance + refill

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire _onAutoFill on a steady-state _step tick (queue already full)', () => {
    const { gs, lanes, columns } = makeState();
    const loop = makeLoop(gs);
    // Every column full with a non-mergeable mix → fillColumns adds nothing.
    for (let c = 0; c < 4; c++) columns[c].shooters = [
      new Shooter({ color: 'Red',   damage: 2, column: c }),
      new Shooter({ color: 'Blue',  damage: 2, column: c }),
      new Shooter({ color: 'Green', damage: 2, column: c }),
    ];
    addCar(lanes[0], 'Red', 2);
    const spy = vi.fn();
    loop._onAutoFill = spy;

    loop._step(1 / 60);

    expect(spy).not.toHaveBeenCalled();
  });

  it('fires _onAutoFill from _step when a queue GAP is refilled (bench-store path)', () => {
    const { gs, lanes, columns } = makeState();
    const loop = makeLoop(gs);
    // Column 0 has a gap (as if a bomb was benched); others full.
    columns[0].shooters = [new Shooter({ color: 'Blue', damage: 2, column: 0 })];
    for (let c = 1; c < 4; c++) columns[c].shooters = [
      new Shooter({ color: 'Red',   damage: 2, column: c }),
      new Shooter({ color: 'Blue',  damage: 2, column: c }),
      new Shooter({ color: 'Green', damage: 2, column: c }),
    ];
    addCar(lanes[0], 'Blue', 2);
    const spy = vi.fn();
    loop._onAutoFill = spy;

    loop._step(1 / 60);                // fillColumns tops column 0 back to capacity → queue grew

    expect(spy).toHaveBeenCalled();
  });
});

describe('auto-fill merge — DEFECT 1: a fill-formed 3-line merges with no player action', () => {
  it('BUG REPRO: without the _onAutoFill wiring, an auto-fill 3-line stays UNMERGED', () => {
    const { gs, lanes, columns } = makeState();
    const loop = makeLoop(gs);
    loop._onAutoFill = null;           // the pre-fix state — no post-refill merge trigger
    columns[0].shooters = threeReds(0);
    addCar(lanes[0], 'Red', 2);

    loop._advanceGrid();               // refills, but nothing re-checks merges

    expect(hasRawRedTriple(columns[0].shooters)).toBe(true);   // 3 Reds sit unmerged (the bug)
  });

  it('FIX: with _onAutoFill → evaluateMerges, the fill-formed 3-line merges immediately', () => {
    const { gs, lanes, columns } = makeState();
    const loop = makeLoop(gs);
    loop._onAutoFill = () => loop.evaluateMerges();   // mirrors GameApp routing to the sequencer
    loop._onMerge = vi.fn();
    columns[0].shooters = threeReds(0);
    addCar(lanes[0], 'Red', 2);

    loop._advanceGrid();               // refill → _onAutoFill → evaluateMerges → merge

    expect(hasRawRedTriple(columns[0].shooters)).toBe(false);
    expect(columns[0].shooters.some(s => s.isMerged)).toBe(true);
    expect(columns[0].shooters[0].isMerged).toBe(true);        // vertical → merged bomb at TOP
    expect(loop._onMerge).toHaveBeenCalled();
  });

  it('CASCADE: multiple fill-formed lines all resolve in one auto-fill evaluation', () => {
    const { gs, lanes, columns } = makeState();
    const loop = makeLoop(gs);
    loop._onAutoFill = () => loop.evaluateMerges();
    for (let c = 0; c < 3; c++) columns[c].shooters = threeReds(c);   // 3 full Red columns
    addCar(lanes[0], 'Red', 2);

    loop._advanceGrid();

    for (let c = 0; c < 3; c++) {
      expect(columns[c].shooters.some(s => s.isMerged)).toBe(true);
      expect(hasRawRedTriple(columns[c].shooters)).toBe(false);
    }
  });

  it('does NOT re-merge an already-merged bomb on the auto-fill path (isMerged excluded)', () => {
    const { gs, lanes, columns } = makeState();
    const loop = makeLoop(gs);
    loop._onAutoFill = () => loop.evaluateMerges();
    // A merged bomb + 2 raw Reds — must NOT form a new merge (merge-stacking excluded).
    columns[0].shooters = [
      new Shooter({ color: 'Red', damage: 7, column: 0, isMerged: true, isColorBomb: true }),
      new Shooter({ color: 'Red', damage: 2, column: 0 }),
      new Shooter({ color: 'Red', damage: 2, column: 0 }),
    ];
    addCar(lanes[0], 'Red', 2);

    loop._advanceGrid();

    expect(columns[0].shooters.filter(s => s.isMerged)).toHaveLength(1);   // still exactly one
  });
});
