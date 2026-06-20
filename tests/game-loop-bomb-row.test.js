// Tests for placeBombOnRow() — the BOMB booster row clear:
//   - Destroys EVERY car in the targeted row across all lanes, regardless of colour
//   - Cars at other rows are untouched
//   - Clears the row even when some lanes are empty at that row
//   - Refunds the bomb when no car occupies the target row
//   - One onBombExplode per killed car; bomb freeze applied after the clear
// (BOMB booster is row-clear, colour-agnostic — see VISION.md item 8.)

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

describe('placeBombOnRow() — BOMB booster row clear', () => {
  it('destroys every car in the target row regardless of colour', () => {
    const { gs, lanes } = makeState({ laneCount: 4 });
    const bs = makeBombState(1);
    const loop = makeLoop(gs, { boosterState: bs });
    loop._onBombExplode = vi.fn();
    addCar(lanes[0], 'Red',  4);
    addCar(lanes[1], 'Red',  4);
    addCar(lanes[2], 'Blue', 4);   // different colour — STILL destroyed
    addCar(lanes[3], 'Red',  4);

    loop.placeBombOnRow(4);

    expect(lanes[0].cars).toHaveLength(0);
    expect(lanes[1].cars).toHaveLength(0);
    expect(lanes[2].cars).toHaveLength(0);   // Blue destroyed too — no colour filter
    expect(lanes[3].cars).toHaveLength(0);
    expect(gs.totalKills).toBe(4);
  });

  it('does NOT kill cars at other rows', () => {
    const { gs, lanes } = makeState({ laneCount: 3 });
    const bs = makeBombState(1);
    const loop = makeLoop(gs, { boosterState: bs });
    loop._onBombExplode = vi.fn();
    addCar(lanes[0], 'Red',   7);
    addCar(lanes[1], 'Blue',  3);
    addCar(lanes[2], 'Green', 1);

    loop.placeBombOnRow(7);

    expect(lanes[0].cars).toHaveLength(0);   // row 7 cleared
    expect(lanes[1].cars).toHaveLength(1);   // row 3 survives
    expect(lanes[2].cars).toHaveLength(1);   // row 1 survives
    expect(gs.totalKills).toBe(1);
  });

  it('clears the entire row even when some lanes are empty at that row', () => {
    const { gs, lanes } = makeState({ laneCount: 4 });
    const bs = makeBombState(1);
    const loop = makeLoop(gs, { boosterState: bs });
    loop._onBombExplode = vi.fn();
    addCar(lanes[1], 'Red',  4);   // lanes 0 and 2 are empty at row 4
    addCar(lanes[3], 'Blue', 4);

    loop.placeBombOnRow(4);

    expect(lanes[1].cars).toHaveLength(0);
    expect(lanes[3].cars).toHaveLength(0);
    expect(gs.totalKills).toBe(2);
  });

  it('refunds the bomb when no car occupies the target row', () => {
    const { gs, lanes } = makeState({ laneCount: 3 });
    const bs = makeBombState(1);
    const loop = makeLoop(gs, { boosterState: bs });
    addCar(lanes[0], 'Red', 2);    // only row 2 has a car

    loop.placeBombOnRow(7);        // row 7 is empty

    expect(bs.bombs).toBe(1);              // consumed then refunded → net unchanged
    expect(lanes[0].cars).toHaveLength(1); // nothing destroyed
    expect(gs.totalKills).toBe(0);
  });

  it('calls onBombExplode once for each killed car', () => {
    const { gs, lanes } = makeState({ laneCount: 2 });
    const bs = makeBombState(1);
    const onBombExplode = vi.fn();
    const loop = makeLoop(gs, { boosterState: bs });
    loop._onBombExplode = onBombExplode;
    addCar(lanes[0], 'Red',  4);
    addCar(lanes[1], 'Blue', 4);

    loop.placeBombOnRow(4);

    expect(onBombExplode).toHaveBeenCalledTimes(2);
  });

  it('applies the bomb freeze after the row kill', () => {
    const { gs, lanes } = makeState({ laneCount: 1 });
    const bs = makeBombState(1);
    const loop = makeLoop(gs, { boosterState: bs });
    loop._onBombExplode = vi.fn();
    addCar(lanes[0], 'Red', 3);
    gs.elapsed = 10;

    loop.placeBombOnRow(3);

    expect(gs.bombFreezeUntil).toBeGreaterThan(10);
  });

  it('registers each destroyed car toward totalKills', () => {
    const { gs, lanes } = makeState({ laneCount: 3 });
    const bs = makeBombState(1);
    const loop = makeLoop(gs, { boosterState: bs });
    loop._onBombExplode = vi.fn();
    addCar(lanes[0], 'Red',   5);
    addCar(lanes[1], 'Blue',  5);
    addCar(lanes[2], 'Green', 5);

    loop.placeBombOnRow(5);

    expect(gs.totalKills).toBe(3);
  });

  it('consumes one bomb charge on a valid clear', () => {
    const { gs, lanes } = makeState({ laneCount: 1 });
    const bs = makeBombState(2);
    const loop = makeLoop(gs, { boosterState: bs });
    loop._onBombExplode = vi.fn();
    addCar(lanes[0], 'Red', 4);

    loop.placeBombOnRow(4);

    expect(bs.bombs).toBe(1);   // 2 → 1
  });
});
