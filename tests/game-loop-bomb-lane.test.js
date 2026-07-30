// Tests for placeBombOnLane() — the BOMB booster LANE clear:
//   - Destroys EVERY car in the tapped car's lane, regardless of colour or row
//   - Other lanes are untouched (this is the row-clear regression these guard)
//   - Refunds the bomb when the lane is empty or out of play
//   - One onBombExplode per killed car; bomb freeze applied after the clear
//
// BEHAVIOUR CHANGE 2026-07-30: this was a ROW clear (a horizontal band across all
// lanes). On device it read as "a vertical left-to-right line, not a car lane" and
// never matched what the player is tracking — the lane about to breach.
//
// NOTE: docs/VISION.md item 8 still records the ROW behaviour. VISION.md is locked,
// so this branch is NOT merged until its owner amends that line. These tests
// describe the branch's behaviour, not shipped master.
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

const mockApp = { ticker: { add: vi.fn(), remove: vi.fn() } };

function makeState({ laneCount = 4 } = {}) {
  const lanes   = Array.from({ length: laneCount }, (_, id) => new Lane({ id }));
  const columns = Array.from({ length: 4 }, (_, id) => new Column({ id }));
  const gs = new GameState({
    lanes, columns,
    colors:    ['Red', 'Blue', 'Green', 'Yellow'],
    world:     { hpMultiplier: 1, speed: { base: 5, variance: 0.5 } },
    duration:  90, phaseMan: new IntensityPhase(90),
    laneCount, colCount: 4, gridRows: 11,
  });
  return { gs, lanes, columns };
}

function makeLoop(gs, overrides = {}) {
  const rng = new SeededRandom(1);
  return new GameLoop({
    app: mockApp, gameState: gs,
    carDir:     new CarDirector({}, rng),
    shooterDir: new ShooterDirector({}, rng, new FairnessArbiter()),
    combatResolver: new CombatResolver(), rng, ...overrides,
  });
}

function makeBombState(bombs = 1) {
  return {
    bombs, bombsMax: 3,
    consumeBomb() { if (this.bombs <= 0) return false; this.bombs--; return true; },
  };
}

function addCar(lane, color, row, hp = 5) {
  const c = new Car({ color, hp, speed: 5 });
  c.row = row; c.position = row * 10;
  lane.addCar(c);
  return c;
}

describe('placeBombOnLane() — BOMB booster lane clear', () => {
  it('destroys every car in the target lane regardless of colour or row', () => {
    const { gs, lanes } = makeState({ laneCount: 4 });
    const bs = makeBombState(1);
    const loop = makeLoop(gs, { boosterState: bs });
    loop._onBombExplode = vi.fn();
    addCar(lanes[1], 'Red',   2);
    addCar(lanes[1], 'Blue',  5);   // different colour AND row — STILL destroyed
    addCar(lanes[1], 'Green', 9);

    loop.placeBombOnLane(1, 5);

    expect(lanes[1].cars).toHaveLength(0);
    expect(gs.totalKills).toBe(3);
  });

  it('does NOT touch other lanes — the row-clear regression guard', () => {
    // The exact defect: a row clear took one car out of EVERY lane. If this ever
    // goes back to row semantics, lanes 0/2/3 lose their row-4 cars and this fails.
    const { gs, lanes } = makeState({ laneCount: 4 });
    const bs = makeBombState(1);
    const loop = makeLoop(gs, { boosterState: bs });
    loop._onBombExplode = vi.fn();
    addCar(lanes[0], 'Red',  4);
    addCar(lanes[1], 'Red',  4);   // target lane, same row as the others
    addCar(lanes[2], 'Blue', 4);
    addCar(lanes[3], 'Red',  4);

    loop.placeBombOnLane(1, 4);

    expect(lanes[1].cars).toHaveLength(0);   // target lane cleared
    expect(lanes[0].cars).toHaveLength(1);   // neighbours survive
    expect(lanes[2].cars).toHaveLength(1);
    expect(lanes[3].cars).toHaveLength(1);
    expect(gs.totalKills).toBe(1);
  });

  it('clears the whole lane even when the tap row holds no car', () => {
    const { gs, lanes } = makeState({ laneCount: 3 });
    const bs = makeBombState(1);
    const loop = makeLoop(gs, { boosterState: bs });
    loop._onBombExplode = vi.fn();
    addCar(lanes[2], 'Red',  1);
    addCar(lanes[2], 'Blue', 8);

    loop.placeBombOnLane(2, 5);    // row 5 is empty; the LANE is the payload

    expect(lanes[2].cars).toHaveLength(0);
    expect(gs.totalKills).toBe(2);
  });

  it('refunds the bomb when the target lane is empty', () => {
    const { gs, lanes } = makeState({ laneCount: 3 });
    const bs = makeBombState(1);
    const loop = makeLoop(gs, { boosterState: bs });
    addCar(lanes[0], 'Red', 2);    // only lane 0 has a car

    loop.placeBombOnLane(1, 2);    // lane 1 is empty

    expect(bs.bombs).toBe(1);              // consumed then refunded → net unchanged
    expect(lanes[0].cars).toHaveLength(1); // nothing destroyed
    expect(gs.totalKills).toBe(0);
  });

  it('refunds the bomb when the lane index is out of play', () => {
    // A tap outside the active lanes must not silently eat a charge. Lane 3 exists
    // in the array but sits beyond activeLaneCount on a 2-lane board.
    const { gs, lanes } = makeState({ laneCount: 4 });
    gs.activeLaneCount = 2;
    const bs = makeBombState(1);
    const loop = makeLoop(gs, { boosterState: bs });
    addCar(lanes[3], 'Red', 4);

    loop.placeBombOnLane(3, 4);
    expect(bs.bombs).toBe(1);
    expect(lanes[3].cars).toHaveLength(1);

    loop.placeBombOnLane(-1, 4);           // no lane hit at all
    expect(bs.bombs).toBe(1);
  });

  it('calls onBombExplode once for each killed car', () => {
    const { gs, lanes } = makeState({ laneCount: 2 });
    const bs = makeBombState(1);
    const onBombExplode = vi.fn();
    const loop = makeLoop(gs, { boosterState: bs });
    loop._onBombExplode = onBombExplode;
    addCar(lanes[0], 'Red',  4);
    addCar(lanes[0], 'Blue', 6);

    loop.placeBombOnLane(0, 4);

    expect(onBombExplode).toHaveBeenCalledTimes(2);
  });

  it('explodes outward from the tapped car, not in list order', () => {
    // The tapped car is the travel target, so its blast lands first.
    const { gs, lanes } = makeState({ laneCount: 2 });
    const bs = makeBombState(1);
    const seen = [];
    const loop = makeLoop(gs, { boosterState: bs });
    loop._onBombExplode = (pos) => seen.push(pos);
    addCar(lanes[0], 'Red',   1);   // added first, but far from the tap
    addCar(lanes[0], 'Blue',  9);   // tapped
    addCar(lanes[0], 'Green', 8);

    loop.placeBombOnLane(0, 9);

    expect(seen[0]).toBe(90);       // row 9 car (position = row * 10) blows first
  });

  it('applies the bomb freeze after the lane kill', () => {
    const { gs, lanes } = makeState({ laneCount: 1 });
    const bs = makeBombState(1);
    const loop = makeLoop(gs, { boosterState: bs });
    loop._onBombExplode = vi.fn();
    addCar(lanes[0], 'Red', 3);
    gs.elapsed = 10;

    loop.placeBombOnLane(0, 3);

    expect(gs.bombFreezeUntil).toBeGreaterThan(10);
  });

  it('consumes one bomb charge on a valid clear', () => {
    const { gs, lanes } = makeState({ laneCount: 1 });
    const bs = makeBombState(2);
    const loop = makeLoop(gs, { boosterState: bs });
    loop._onBombExplode = vi.fn();
    addCar(lanes[0], 'Red', 4);

    loop.placeBombOnLane(0, 4);

    expect(bs.bombs).toBe(1);   // 2 → 1
  });
});
