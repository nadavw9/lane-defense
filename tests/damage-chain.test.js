// Carry-over damage and multi-kill chains. CombatResolver cascades a shot's damage
// through consecutive same-colour front cars; a chain that kills 2+ is a multi-kill
// and a single shot that kills 3+ earns a FREEZE charge.
// Headless — real GameLoop/GameState/CombatResolver/models.

import { describe, it, expect, vi } from 'vitest';
import { GameLoop }        from '../src/game/GameLoop.js';
import { GameState }       from '../src/game/GameState.js';
import { CombatResolver }  from '../src/game/CombatResolver.js';
import { CarDirector }     from '../src/director/CarDirector.js';
import { ShooterDirector } from '../src/director/ShooterDirector.js';
import { FairnessArbiter } from '../src/director/FairnessArbiter.js';
import { IntensityPhase }  from '../src/director/IntensityPhase.js';
import { SeededRandom }    from '../src/utils/SeededRandom.js';
import { BoosterState }    from '../src/game/BoosterState.js';
import { Lane }            from '../src/models/Lane.js';
import { Column }          from '../src/models/Column.js';
import { Car }             from '../src/models/Car.js';

const mockApp = { ticker: { add: vi.fn(), remove: vi.fn() } };

function makeState(opts = {}) {
  const { laneCount = 4, ...rest } = opts;
  const lanes    = Array.from({ length: laneCount }, (_, id) => new Lane({ id }));
  const columns  = Array.from({ length: 4 }, (_, id) => new Column({ id }));
  const phaseMan = new IntensityPhase(90);
  const gs = new GameState({
    lanes, columns,
    colors:   ['Red', 'Blue', 'Green', 'Yellow'],
    world:    { hpMultiplier: 1, speed: { base: 5, variance: 0.5 } },
    duration: 90, phaseMan, laneCount, colCount: 4, gridRows: 11,
    spawnBudget: 0, laneTargetCarCount: 0,  // disable refills for headless tests
    ...rest,
  });
  return { gs, lanes, columns };
}

function makeLoop(gs, overrides = {}) {
  const rng     = new SeededRandom(1);
  const arbiter = new FairnessArbiter();
  return new GameLoop({
    app: mockApp, gameState: gs,
    carDir:     new CarDirector({}, rng),
    shooterDir: new ShooterDirector({}, rng, arbiter),
    combatResolver: new CombatResolver(),
    rng, ...overrides,
  });
}

// Cars are placed at descending positions so the lane order (front = index 0)
// matches the order they're added.
function lineUp(lane, defs) {
  let pos = 90;
  for (const [color, hp] of defs) {
    const c = new Car({ color, hp, speed: 5, row: 5 });
    c.position = pos; pos -= 10;
    lane.addCar(c);
  }
}
const shot = (color, damage) => ({ color, damage });

describe('damage-chain — carry-over', () => {
  it('overflow damage carries from a killed car to the next car in the lane', () => {
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs);
    lineUp(lanes[0], [['Red', 2], ['Red', 10]]);   // front hp2, next hp10
    loop._resolveShot(shot('Red', 5), 0);           // 5 dmg: kills front (2), overflow 3
    expect(lanes[0].cars.length).toBe(1);
    expect(lanes[0].cars[0].hp).toBe(7);            // next car took the overflow (10-3)
  });

  it('a carry-over that kills the 2nd car registers a 2-kill chain', () => {
    const onHit = vi.fn();
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs, { onHit });
    lineUp(lanes[0], [['Red', 2], ['Red', 2]]);
    loop._resolveShot(shot('Red', 5), 0);
    expect(onHit).toHaveBeenCalled();
    expect(onHit.mock.calls[0][4]).toBe(2);   // kills arg
    expect(gs.maxSingleShotKills).toBe(2);
    expect(gs.carryOvers).toBe(1);
  });

  it('a 3-car chain kill earns one FREEZE charge', () => {
    const bs = new BoosterState();
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs, { boosterState: bs });
    loop._onFreezeEarned = vi.fn();
    lineUp(lanes[0], [['Red', 2], ['Red', 2], ['Red', 2]]);
    loop._resolveShot(shot('Red', 8), 0);     // kills all 3
    expect(gs.maxSingleShotKills).toBe(3);
    expect(bs.freeze).toBe(1);
    expect(loop._onFreezeEarned).toHaveBeenCalledWith(3);
  });

  it('damage exactly equal to HP destroys the car with no carry-over', () => {
    const onHit = vi.fn();
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs, { onHit });
    lineUp(lanes[0], [['Red', 5], ['Red', 5]]);
    loop._resolveShot(shot('Red', 5), 0);     // exactly kills front, 0 overflow
    expect(onHit.mock.calls[0][4]).toBe(1);   // only 1 kill
    expect(gs.carryOvers).toBe(0);
    expect(lanes[0].cars.length).toBe(1);     // 2nd car untouched
    expect(lanes[0].cars[0].hp).toBe(5);
  });

  it('damage less than HP leaves the car alive with reduced HP', () => {
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs);
    lineUp(lanes[0], [['Red', 10]]);
    loop._resolveShot(shot('Red', 3), 0);
    expect(lanes[0].cars.length).toBe(1);
    expect(lanes[0].cars[0].hp).toBe(7);
  });

  it('a color bomb clears all matching-color cars, ignoring other-color cars between them', () => {
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs);
    lineUp(lanes[0], [['Red', 5], ['Blue', 5], ['Red', 5]]);   // Red, Blue, Red
    loop._resolveShot({ color: 'Rainbow', damage: 0, isColorBomb: true }, 0);
    expect(lanes[0].cars.length).toBe(1);
    expect(lanes[0].cars[0].color).toBe('Blue');   // both Reds gone, Blue survived
  });

  it('a chain through 4 cars registers a 4-kill multi', () => {
    const onHit = vi.fn();
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs, { onHit });
    lineUp(lanes[0], [['Red', 1], ['Red', 1], ['Red', 1], ['Red', 1]]);
    loop._resolveShot(shot('Red', 10), 0);
    expect(onHit.mock.calls[0][4]).toBe(4);
    expect(gs.maxSingleShotKills).toBe(4);
    expect(gs.carryOvers).toBe(3);
  });
});
