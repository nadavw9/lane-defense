// Goal System — core goal tracking and progression.
// Tests: goal matching logic, progress decrement, isGoalMet() gate, win firing.
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
import { Lane }            from '../src/models/Lane.js';
import { Column }          from '../src/models/Column.js';
import { Car }             from '../src/models/Car.js';
import { Shooter }         from '../src/models/Shooter.js';

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

function addCar(lane, color, hp, position, type = 'small') {
  const c = new Car({ color, hp, speed: 5, row: 5, type });
  c.position = position;
  lane.addCar(c);
}

const shot = (color, damage) => ({ color, damage });

describe('goal-system — core goal tracking', () => {
  it('initializes with goals from constructor', () => {
    const goals = [
      { type: 'destroyTotal', count: 10 },
      { type: 'destroyColor', color: 'Red', count: 5 },
    ];
    const { gs } = makeState({ goals });
    expect(gs.goals).toEqual(goals);
    expect(gs.goalProgress).toEqual([10, 5]);
  });

  it('initializes with empty goals if none provided', () => {
    const { gs } = makeState();
    expect(gs.goals).toEqual([]);
    expect(gs.goalProgress).toEqual([]);
  });

  it('resets goal progress on resetLevel()', () => {
    const goals = [
      { type: 'destroyTotal', count: 5 },
      { type: 'destroyColor', color: 'Blue', count: 3 },
    ];
    const { gs } = makeState({ goals });
    // Manually decrement progress (simulating kills)
    gs.goalProgress[0] = 2;
    gs.goalProgress[1] = 1;
    // Reset
    gs.resetLevel();
    expect(gs.goalProgress).toEqual([5, 3]);
  });
});

describe('goal-system — destroyTotal goal type', () => {
  it('decrements destroyTotal for any destroyed car', () => {
    const goals = [{ type: 'destroyTotal', count: 3 }];
    const { gs } = makeState({ goals });
    // Simulate 3 cars of different colors being destroyed
    gs.applyKillToGoals('Red', 'small');
    expect(gs.goalProgress[0]).toBe(2);
    gs.applyKillToGoals('Blue', 'big');
    expect(gs.goalProgress[0]).toBe(1);
    gs.applyKillToGoals('Green', 'jeep');
    expect(gs.goalProgress[0]).toBe(0);
  });

  it('clamps goalProgress to zero (never negative)', () => {
    const goals = [{ type: 'destroyTotal', count: 2 }];
    const { gs } = makeState({ goals });
    gs.applyKillToGoals('Red', 'small');
    gs.applyKillToGoals('Blue', 'small');
    gs.applyKillToGoals('Green', 'small');  // beyond the goal
    expect(gs.goalProgress[0]).toBe(0);
  });
});

describe('goal-system — destroyColor goal type', () => {
  it('only decrements when car color matches goal color', () => {
    const goals = [{ type: 'destroyColor', color: 'Red', count: 2 }];
    const { gs } = makeState({ goals });
    // Red car → matches, decrements
    gs.applyKillToGoals('Red', 'small');
    expect(gs.goalProgress[0]).toBe(1);
    // Blue car → doesn't match, no change
    gs.applyKillToGoals('Blue', 'small');
    expect(gs.goalProgress[0]).toBe(1);
    // Red car → matches again
    gs.applyKillToGoals('Red', 'big');
    expect(gs.goalProgress[0]).toBe(0);
  });

  it('supports multiple destroyColor goals with different colors', () => {
    const goals = [
      { type: 'destroyColor', color: 'Red', count: 1 },
      { type: 'destroyColor', color: 'Blue', count: 1 },
      { type: 'destroyColor', color: 'Green', count: 1 },
    ];
    const { gs } = makeState({ goals });
    // Destroy in mixed order
    gs.applyKillToGoals('Blue', 'small');
    expect(gs.goalProgress).toEqual([1, 0, 1]);
    gs.applyKillToGoals('Green', 'small');
    expect(gs.goalProgress).toEqual([1, 0, 0]);
    gs.applyKillToGoals('Red', 'small');
    expect(gs.goalProgress).toEqual([0, 0, 0]);
  });
});

describe('goal-system — destroyType goal type', () => {
  it('only decrements when car type matches goal carType', () => {
    const goals = [{ type: 'destroyType', carType: 'tank', count: 2 }];
    const { gs } = makeState({ goals });
    // Truck → doesn't match
    gs.applyKillToGoals('Red', 'truck');
    expect(gs.goalProgress[0]).toBe(2);
    // Tank → matches
    gs.applyKillToGoals('Red', 'tank');
    expect(gs.goalProgress[0]).toBe(1);
    // Another tank
    gs.applyKillToGoals('Blue', 'tank');
    expect(gs.goalProgress[0]).toBe(0);
  });

  it('supports multiple destroyType goals with different types', () => {
    const goals = [
      { type: 'destroyType', carType: 'truck', count: 1 },
      { type: 'destroyType', carType: 'tank', count: 1 },
      { type: 'destroyType', carType: 'bigrig', count: 1 },
    ];
    const { gs } = makeState({ goals });
    gs.applyKillToGoals('Red', 'truck');
    expect(gs.goalProgress).toEqual([0, 1, 1]);
    gs.applyKillToGoals('Blue', 'bigrig');
    expect(gs.goalProgress).toEqual([0, 1, 0]);
    gs.applyKillToGoals('Green', 'tank');
    expect(gs.goalProgress).toEqual([0, 0, 0]);
  });
});

describe('goal-system — mixed goal types', () => {
  it('handles destroyTotal + destroyColor + destroyType together', () => {
    const goals = [
      { type: 'destroyTotal', count: 1 },
      { type: 'destroyColor', color: 'Red', count: 1 },
      { type: 'destroyType', carType: 'tank', count: 1 },
    ];
    const { gs } = makeState({ goals });
    // Destroy a Red tank → matches all 3 goals
    gs.applyKillToGoals('Red', 'tank');
    expect(gs.goalProgress).toEqual([0, 0, 0]);
  });

  it('independent goals are separately tracked', () => {
    const goals = [
      { type: 'destroyColor', color: 'Red', count: 2 },
      { type: 'destroyColor', color: 'Blue', count: 1 },
      { type: 'destroyType', carType: 'truck', count: 1 },
    ];
    const { gs } = makeState({ goals });
    // Destroy Red bike (Red goal, not truck goal)
    gs.applyKillToGoals('Red', 'small');
    expect(gs.goalProgress).toEqual([1, 1, 1]);
    // Destroy Blue truck (Blue goal AND truck goal)
    gs.applyKillToGoals('Blue', 'truck');
    expect(gs.goalProgress).toEqual([1, 0, 0]);
    // Destroy Red truck (Red goal, but truck goal already done)
    gs.applyKillToGoals('Red', 'truck');
    expect(gs.goalProgress).toEqual([0, 0, 0]);
  });
});

describe('goal-system — isGoalMet() predicate', () => {
  it('returns false if no goals exist', () => {
    const { gs } = makeState();
    expect(gs.isGoalMet()).toBe(false);
  });

  it('returns false if any goal progress > 0', () => {
    const goals = [
      { type: 'destroyTotal', count: 2 },
      { type: 'destroyColor', color: 'Red', count: 1 },
    ];
    const { gs } = makeState({ goals });
    expect(gs.isGoalMet()).toBe(false);
    // Fulfill one goal
    gs.applyKillToGoals('Red', 'small');
    expect(gs.isGoalMet()).toBe(false);  // still 1 remaining on Red
  });

  it('returns true only when ALL goal progress is zero', () => {
    const goals = [
      { type: 'destroyTotal', count: 1 },
      { type: 'destroyColor', color: 'Blue', count: 1 },
    ];
    const { gs } = makeState({ goals });
    // Fulfill total goal
    gs.applyKillToGoals('Green', 'small');
    expect(gs.isGoalMet()).toBe(false);  // Blue color goal still pending
    // Fulfill color goal
    gs.applyKillToGoals('Blue', 'big');
    expect(gs.isGoalMet()).toBe(true);   // all goals complete
  });
});

describe('goal-system — win firing via CombatResolver', () => {
  it('fires _onEnd(true) when all goals are met via normal combat', () => {
    const onEnd = vi.fn();
    const goals = [
      { type: 'destroyColor', color: 'Red', count: 1 },
    ];
    const { gs, lanes } = makeState({ goals });
    const loop = makeLoop(gs, { onEnd });
    addCar(lanes[0], 'Red', 2, 80, 'small');
    // Kill the Red car
    loop._resolveShot(shot('Red', 5), 0);
    expect(gs.isGoalMet()).toBe(true);
    expect(onEnd).toHaveBeenCalledWith(true);
  });

  it('does not fire win until all goals are met', () => {
    const onEnd = vi.fn();
    const goals = [
      { type: 'destroyTotal', count: 3 },
    ];
    const { gs, lanes } = makeState({ goals });
    const loop = makeLoop(gs, { onEnd });
    addCar(lanes[0], 'Red', 5, 80, 'small');
    addCar(lanes[1], 'Blue', 5, 80, 'small');
    addCar(lanes[2], 'Green', 5, 80, 'small');
    // Kill 2 cars
    loop._resolveShot(shot('Red', 5), 0);
    loop._resolveShot(shot('Blue', 5), 1);
    expect(onEnd).not.toHaveBeenCalled();
    expect(gs.goalProgress[0]).toBe(1);
    // Kill the 3rd car
    loop._resolveShot(shot('Green', 5), 2);
    expect(onEnd).toHaveBeenCalledWith(true);
  });

  it('does not double-fire the win', () => {
    const onEnd = vi.fn();
    const goals = [{ type: 'destroyTotal', count: 1 }];
    const { gs, lanes } = makeState({ goals });
    const loop = makeLoop(gs, { onEnd });
    addCar(lanes[0], 'Red', 2, 80, 'small');
    // Kill the goal car
    loop._resolveShot(shot('Red', 5), 0);
    expect(onEnd).toHaveBeenCalledTimes(1);
    // Try to resolve another shot after win
    // (empty board, so no actual impact, but _resolveShot is guarded by isOver)
    loop._resolveShot(shot('Blue', 5), 1);
    expect(onEnd).toHaveBeenCalledTimes(1);  // still only once
  });
});

describe('goal-system — color bomb kills apply goals', () => {
  it('applies goal progress when color bomb destroys matching cars', () => {
    const goals = [{ type: 'destroyColor', color: 'Red', count: 2 }];
    const { gs, lanes } = makeState({ goals });
    const loop = makeLoop(gs, { onEnd: vi.fn() });
    // Add 2 Red cars and 1 Blue car
    addCar(lanes[0], 'Red', 5, 80, 'small');
    addCar(lanes[1], 'Red', 5, 70, 'small');
    addCar(lanes[2], 'Blue', 5, 60, 'small');
    // Fire a red color bomb (kills 2 Red cars, not the Blue)
    loop._fireColorBomb('Red');
    expect(gs.goalProgress[0]).toBe(0);  // both red cars destroyed, goal met
    expect(lanes[2].cars.length).toBe(1);  // Blue car survives
    // Note: _fireColorBomb doesn't call _settleAfterClear, so win doesn't fire here.
    // Real game flow: _fireColorBomb is called from _resolveShot, which then calls
    // _advanceGrid which checks the win. But in this direct test, we just verify
    // that goal progress is correctly applied.
  });
});
