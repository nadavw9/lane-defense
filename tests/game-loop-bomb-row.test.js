// Tests for placeBombOnLane() row-bomb behaviour:
//   - Bomb kills all cars at the same row across all lanes
//   - Bomb on a lane with no front car refunds the bomb
//   - Cars at different rows in other lanes are NOT killed

import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  const phaseMan = new IntensityPhase(90);
  const gs = new GameState({
    lanes, columns,
    colors:    ['Red', 'Blue', 'Green', 'Yellow'],
    world:     { hpMultiplier: 1, speed: { base: 5, variance: 0.5 } },
    duration:  90,
    phaseMan,
    laneCount,
    colCount:  4,
  });
  return { gs, lanes, columns };
}

function makeLoop(gs, overrides = {}) {
  const rng        = new SeededRandom(1);
  const arbiter    = new FairnessArbiter();
  const carDir     = new CarDirector({}, rng);
  const shooterDir = new ShooterDirector({}, rng, arbiter);
  const loop = new GameLoop({
    app:           mockApp,
    gameState:     gs,
    carDir,
    shooterDir,
    combatResolver: new CombatResolver(),
    rng,
    ...overrides,
  });
  return loop;
}

function makeBombState(bombs = 1) {
  return {
    bombs,
    bombsMax: 3,
    consumeBomb() {
      if (this.bombs <= 0) return false;
      this.bombs--;
      return true;
    },
  };
}

// ── Row bomb: kills same-row cars matching the front car's color ──────────────

describe('placeBombOnLane() — row bomb', () => {
  it('kills the front car in the target lane plus same-row same-color cars in other lanes', () => {
    const { gs, lanes } = makeState({ laneCount: 3 });
    const bs = makeBombState(1);
    const loop = makeLoop(gs, { boosterState: bs });
    loop._onBombExplode = vi.fn();

    // Lane 0: front car at row 5 (Red — sets the bomb color)
    const car0 = new Car({ color: 'Red', hp: 5, speed: 5 });
    car0.row = 5; car0.position = 55;
    lanes[0].addCar(car0);

    // Lane 1: also Red at row 5 — color matches, should be killed
    const car1 = new Car({ color: 'Red', hp: 5, speed: 5 });
    car1.row = 5; car1.position = 55;
    lanes[1].addCar(car1);

    // Lane 2: also Red at row 5 — color matches, should be killed
    const car2 = new Car({ color: 'Red', hp: 5, speed: 5 });
    car2.row = 5; car2.position = 55;
    lanes[2].addCar(car2);

    loop.placeBombOnLane(0);

    expect(lanes[0].cars).toHaveLength(0);
    expect(lanes[1].cars).toHaveLength(0);
    expect(lanes[2].cars).toHaveLength(0);
    expect(gs.totalKills).toBe(3);
  });

  it('does NOT kill cars at different rows in other lanes', () => {
    const { gs, lanes } = makeState({ laneCount: 3 });
    const bs = makeBombState(1);
    const loop = makeLoop(gs, { boosterState: bs });
    loop._onBombExplode = vi.fn();

    // Lane 0: front car at row 7
    const car0 = new Car({ color: 'Red', hp: 5, speed: 5 });
    car0.row = 7; car0.position = 77;
    lanes[0].addCar(car0);

    // Lane 1: car at row 3 — different row, should survive
    const car1 = new Car({ color: 'Blue', hp: 5, speed: 5 });
    car1.row = 3; car1.position = 33;
    lanes[1].addCar(car1);

    // Lane 2: car at row 1 — different row, should survive
    const car2 = new Car({ color: 'Green', hp: 5, speed: 5 });
    car2.row = 1; car2.position = 11;
    lanes[2].addCar(car2);

    loop.placeBombOnLane(0);

    expect(lanes[0].cars).toHaveLength(0);  // front car killed
    expect(lanes[1].cars).toHaveLength(1);  // survived (different row)
    expect(lanes[2].cars).toHaveLength(1);  // survived (different row)
    expect(gs.totalKills).toBe(1);
  });

  it('refunds the bomb when the target lane has no car', () => {
    const { gs, lanes } = makeState({ laneCount: 3 });
    const bs = makeBombState(1);
    const loop = makeLoop(gs, { boosterState: bs });

    // Lane 0 is empty — no front car
    // Lane 1 has a car at row 5 — should NOT be killed (no front car in target lane)
    const car1 = new Car({ color: 'Blue', hp: 5, speed: 5 });
    car1.row = 5; car1.position = 55;
    lanes[1].addCar(car1);

    loop.placeBombOnLane(0);

    // Bomb should have been refunded
    expect(bs.bombs).toBe(1);
    // Car in lane 1 untouched
    expect(lanes[1].cars).toHaveLength(1);
    expect(gs.totalKills).toBe(0);
  });

  it('calls onBombExplode once for each killed car', () => {
    const { gs, lanes } = makeState({ laneCount: 2 });
    const bs = makeBombState(1);
    const onBombExplode = vi.fn();
    const loop = makeLoop(gs, { boosterState: bs });
    loop._onBombExplode = onBombExplode;

    const car0 = new Car({ color: 'Red', hp: 5, speed: 5 });
    car0.row = 4; car0.position = 44;
    lanes[0].addCar(car0);

    // Same color as car0 so it matches the bomb color and gets killed
    const car1 = new Car({ color: 'Red', hp: 5, speed: 5 });
    car1.row = 4; car1.position = 44;
    lanes[1].addCar(car1);

    loop.placeBombOnLane(0);

    expect(onBombExplode).toHaveBeenCalledTimes(2);
  });

  it('bomb freeze is applied after row kill', () => {
    const { gs, lanes } = makeState({ laneCount: 1 });
    const bs = makeBombState(1);
    const loop = makeLoop(gs, { boosterState: bs });
    loop._onBombExplode = vi.fn();

    const car = new Car({ color: 'Red', hp: 5, speed: 5 });
    car.row = 3; car.position = 33;
    lanes[0].addCar(car);

    gs.elapsed = 10;
    loop.placeBombOnLane(0);

    // bombFreezeUntil should be set to elapsed + BOMB_FREEZE_DURATION (2.0)
    expect(gs.bombFreezeUntil).toBeGreaterThan(10);
  });

  it('row bomb hits 3 red cars in same row, ignores blue car in same row', () => {
    const { gs, lanes } = makeState({ laneCount: 4 });
    const bs = makeBombState(1);
    const loop = makeLoop(gs, { boosterState: bs });
    loop._onBombExplode = vi.fn();

    // Lane 0: Red front car — sets the bomb color
    const car0 = new Car({ color: 'Red', hp: 5, speed: 5 });
    car0.row = 4; car0.position = 44;
    lanes[0].addCar(car0);

    // Lane 1: Red same row — matches, killed
    const car1 = new Car({ color: 'Red', hp: 5, speed: 5 });
    car1.row = 4; car1.position = 44;
    lanes[1].addCar(car1);

    // Lane 2: Blue same row — mismatch, survives
    const car2 = new Car({ color: 'Blue', hp: 5, speed: 5 });
    car2.row = 4; car2.position = 44;
    lanes[2].addCar(car2);

    // Lane 3: Red same row — matches, killed
    const car3 = new Car({ color: 'Red', hp: 5, speed: 5 });
    car3.row = 4; car3.position = 44;
    lanes[3].addCar(car3);

    loop.placeBombOnLane(0);

    expect(lanes[0].cars).toHaveLength(0);   // Red killed
    expect(lanes[1].cars).toHaveLength(0);   // Red killed
    expect(lanes[2].cars).toHaveLength(1);   // Blue survived
    expect(lanes[3].cars).toHaveLength(0);   // Red killed
    expect(gs.totalKills).toBe(3);
  });

  it('row bomb kills only the front car when no other lane has matching color in that row', () => {
    const { gs, lanes } = makeState({ laneCount: 3 });
    const bs = makeBombState(1);
    const loop = makeLoop(gs, { boosterState: bs });
    loop._onBombExplode = vi.fn();

    // Lane 0: Red front car — sets the bomb color
    const car0 = new Car({ color: 'Red', hp: 5, speed: 5 });
    car0.row = 4; car0.position = 44;
    lanes[0].addCar(car0);

    // Lane 1: Blue same row — mismatch, survives
    const car1 = new Car({ color: 'Blue', hp: 5, speed: 5 });
    car1.row = 4; car1.position = 44;
    lanes[1].addCar(car1);

    // Lane 2: Green same row — mismatch, survives
    const car2 = new Car({ color: 'Green', hp: 5, speed: 5 });
    car2.row = 4; car2.position = 44;
    lanes[2].addCar(car2);

    loop.placeBombOnLane(0);

    // Only the Red front car is killed; no refund since front car was valid
    expect(lanes[0].cars).toHaveLength(0);
    expect(lanes[1].cars).toHaveLength(1);
    expect(lanes[2].cars).toHaveLength(1);
    expect(gs.totalKills).toBe(1);
    expect(bs.bombs).toBe(0);   // bomb was spent (1 kill still warrants the cost)
  });
});
