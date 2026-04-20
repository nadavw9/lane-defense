// Tests for GameLoop additions:
//   - recordDeploy called on every deploy/deployFromBench
//   - onCrisis callback fires when triggerCrisis returns a result
//   - CRISIS shooter injected at correct column with capacity guard

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
import { Shooter }         from '../src/models/Shooter.js';
import { Car }             from '../src/models/Car.js';

// Minimal PixiJS Application mock — GameLoop only uses app.ticker.add/remove
// when start()/stop() are called. We never call start() in these tests.
const mockApp = { ticker: { add: vi.fn(), remove: vi.fn() } };

function makeState({ laneCount = 4, colCount = 4, duration = 90 } = {}) {
  const lanes   = Array.from({ length: 4 }, (_, id) => new Lane({ id }));
  const columns = Array.from({ length: 4 }, (_, id) => new Column({ id }));
  const phaseMan = new IntensityPhase(duration);
  const gs = new GameState({
    lanes, columns,
    colors:    ['Red', 'Blue'],
    world:     { hpMultiplier: 1, speed: { base: 5, variance: 0.5 } },
    duration,
    phaseMan,
    laneCount,
    colCount,
  });
  return { gs, lanes, columns };
}

function makeLoop(gs, overrides = {}) {
  const rng        = new SeededRandom(1);
  const arbiter    = new FairnessArbiter();
  const carDir     = new CarDirector({}, rng);
  const shooterDir = new ShooterDirector({}, rng, arbiter);
  return {
    loop: new GameLoop({
      app:           mockApp,
      gameState:     gs,
      carDir,
      shooterDir,
      combatResolver: new CombatResolver(),
      rng,
      ...overrides,
    }),
    shooterDir,
  };
}

// ── recordDeploy is called on every player deploy ────────────────────────────

describe('GameLoop.deploy() calls shooterDir.recordDeploy', () => {
  it('recordDeploy is called when deploying from a column', () => {
    const { gs, columns } = makeState();
    const { loop, shooterDir } = makeLoop(gs);

    // Put a shooter in column 0
    columns[0].pushBottom(new Shooter({ color: 'Red', damage: 5, column: 0 }));
    // Put a car in lane 0 (so firingSlot can be occupied)
    gs.lanes[0].addCar(new Car({ color: 'Red', hp: 10, speed: 5 }));

    const spy = vi.spyOn(shooterDir, 'recordDeploy');
    loop.deploy(0, 0);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('recordDeploy receives the current elapsed time', () => {
    const { gs, columns } = makeState();
    const { loop, shooterDir } = makeLoop(gs);

    columns[0].pushBottom(new Shooter({ color: 'Red', damage: 5, column: 0 }));
    gs.elapsed = 42.5;

    const spy = vi.spyOn(shooterDir, 'recordDeploy');
    loop.deploy(0, 0);
    expect(spy).toHaveBeenCalledWith(42.5);
  });

  it('deploy on empty column does not call recordDeploy', () => {
    const { gs } = makeState();
    const { loop, shooterDir } = makeLoop(gs);
    // column 0 is empty

    const spy = vi.spyOn(shooterDir, 'recordDeploy');
    loop.deploy(0, 0);
    expect(spy).not.toHaveBeenCalled();
  });

  it('deployFromBench calls recordDeploy', () => {
    const { gs } = makeState();
    const { loop, shooterDir } = makeLoop(gs);

    const spy = vi.spyOn(shooterDir, 'recordDeploy');
    const shooter = new Shooter({ color: 'Red', damage: 5, column: 0 });
    loop.deployFromBench(shooter, 0);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('deploy is blocked when firing slot is occupied', () => {
    const { gs, columns } = makeState();
    const { loop, shooterDir } = makeLoop(gs);

    columns[0].pushBottom(new Shooter({ color: 'Red', damage: 5, column: 0 }));
    // Occupy slot 0
    gs.firingSlots[0] = { shooter: {}, colIdx: 0, timeLeft: 1 };

    const spy = vi.spyOn(shooterDir, 'recordDeploy');
    loop.deploy(0, 0);
    expect(spy).not.toHaveBeenCalled();
  });
});

// ── onCrisis callback ─────────────────────────────────────────────────────────

describe('GameLoop CRISIS injection via _step()', () => {
  it('onCrisis fires when triggerCrisis returns a result', () => {
    const { gs, columns } = makeState();
    const rng        = new SeededRandom(1);
    const arbiter    = new FairnessArbiter();
    const carDir     = new CarDirector({}, rng);
    const shooterDir = new ShooterDirector({}, rng, arbiter);
    const onCrisis   = vi.fn();

    const loop = new GameLoop({
      app: mockApp, gameState: gs, carDir, shooterDir,
      combatResolver: new CombatResolver(), rng, onCrisis,
    });

    // Stage a car at 85% so CRISIS can trigger (needs car past 70%)
    const car = new Car({ color: 'Red', hp: 10, speed: 5 });
    car.position = 85;
    gs.lanes[0].addCar(car);

    // Fill all columns so viability passes
    for (let i = 0; i < 4; i++) {
      columns[i].pushBottom(new Shooter({ color: 'Red', damage: 6, column: i }));
    }

    // Force triggerCrisis to always return a result
    vi.spyOn(shooterDir, 'triggerCrisis').mockReturnValue({
      shooter: new Shooter({ color: 'Red', damage: 6, column: 0 }),
      lane: gs.lanes[0],
    });

    // Force phase to PRESSURE (eligible for CRISIS)
    vi.spyOn(gs.phaseMan, 'getParams').mockReturnValue({
      spawnCooldownMultiplier: 1, hpMultiplier: 1, speedMultiplier: 1,
      damageSkew: 'standard', crisisEnabled: true,
    });
    vi.spyOn(gs.phaseMan, 'getCurrentPhase').mockReturnValue('PRESSURE');

    loop._step(1 / 60);
    expect(onCrisis).toHaveBeenCalledOnce();
  });

  it('onCrisis not fired when triggerCrisis returns null', () => {
    const { gs, columns } = makeState();
    const rng        = new SeededRandom(1);
    const arbiter    = new FairnessArbiter();
    const carDir     = new CarDirector({}, rng);
    const shooterDir = new ShooterDirector({}, rng, arbiter);
    const onCrisis   = vi.fn();

    const loop = new GameLoop({
      app: mockApp, gameState: gs, carDir, shooterDir,
      combatResolver: new CombatResolver(), rng, onCrisis,
    });

    vi.spyOn(shooterDir, 'triggerCrisis').mockReturnValue(null);
    vi.spyOn(gs.phaseMan, 'getParams').mockReturnValue({
      spawnCooldownMultiplier: 1, hpMultiplier: 1, speedMultiplier: 1,
      damageSkew: 'standard', crisisEnabled: true,
    });
    vi.spyOn(gs.phaseMan, 'getCurrentPhase').mockReturnValue('PRESSURE');

    loop._step(1 / 60);
    expect(onCrisis).not.toHaveBeenCalled();
  });

  it('CRISIS shooter is injected at the correct column index', () => {
    const { gs, columns } = makeState();
    const rng        = new SeededRandom(1);
    const arbiter    = new FairnessArbiter();
    const carDir     = new CarDirector({}, rng);
    const shooterDir = new ShooterDirector({}, rng, arbiter);

    const capturedCols = [];
    const onCrisis = vi.fn((colIdx) => capturedCols.push(colIdx));

    const loop = new GameLoop({
      app: mockApp, gameState: gs, carDir, shooterDir,
      combatResolver: new CombatResolver(), rng, onCrisis,
    });

    const car = new Car({ color: 'Red', hp: 10, speed: 5 });
    car.position = 85;
    gs.lanes[2].addCar(car);  // most dangerous lane is index 2

    for (let i = 0; i < 4; i++) {
      columns[i].pushBottom(new Shooter({ color: 'Red', damage: 6, column: i }));
    }

    vi.spyOn(shooterDir, 'triggerCrisis').mockReturnValue({
      shooter: new Shooter({ color: 'Red', damage: 6, column: 2 }),
      lane: gs.lanes[2],  // laneIdx = 2
    });

    vi.spyOn(gs.phaseMan, 'getParams').mockReturnValue({
      spawnCooldownMultiplier: 1, hpMultiplier: 1, speedMultiplier: 1,
      damageSkew: 'standard', crisisEnabled: true,
    });
    vi.spyOn(gs.phaseMan, 'getCurrentPhase').mockReturnValue('PRESSURE');

    loop._step(1 / 60);
    expect(capturedCols[0]).toBe(2);
  });

  it('CRISIS column capacity never exceeds 6 after injection', () => {
    const { gs, columns } = makeState();
    const rng        = new SeededRandom(1);
    const arbiter    = new FairnessArbiter();
    const carDir     = new CarDirector({}, rng);
    const shooterDir = new ShooterDirector({}, rng, arbiter);

    const loop = new GameLoop({
      app: mockApp, gameState: gs, carDir, shooterDir,
      combatResolver: new CombatResolver(), rng,
    });

    // Fill column 0 to capacity (6)
    for (let i = 0; i < 6; i++) {
      columns[0].pushBottom(new Shooter({ color: 'Red', damage: 5, column: 0 }));
    }

    vi.spyOn(shooterDir, 'triggerCrisis').mockReturnValue({
      shooter: new Shooter({ color: 'Red', damage: 8, column: 0 }),
      lane: gs.lanes[0],
    });
    vi.spyOn(gs.phaseMan, 'getParams').mockReturnValue({
      spawnCooldownMultiplier: 1, hpMultiplier: 1, speedMultiplier: 1,
      damageSkew: 'standard', crisisEnabled: true,
    });
    vi.spyOn(gs.phaseMan, 'getCurrentPhase').mockReturnValue('PRESSURE');

    loop._step(1 / 60);
    expect(columns[0].shooters.length).toBeLessThanOrEqual(6);
  });

  it('CRISIS not attempted when crisisEnabled is false', () => {
    const { gs } = makeState();
    const rng        = new SeededRandom(1);
    const arbiter    = new FairnessArbiter();
    const carDir     = new CarDirector({}, rng);
    const shooterDir = new ShooterDirector({}, rng, arbiter);
    const onCrisis   = vi.fn();

    const loop = new GameLoop({
      app: mockApp, gameState: gs, carDir, shooterDir,
      combatResolver: new CombatResolver(), rng, onCrisis,
    });

    const triggerSpy = vi.spyOn(shooterDir, 'triggerCrisis');
    vi.spyOn(gs.phaseMan, 'getParams').mockReturnValue({
      spawnCooldownMultiplier: 1, hpMultiplier: 1, speedMultiplier: 1,
      damageSkew: 'standard', crisisEnabled: false,  // CALM phase
    });
    vi.spyOn(gs.phaseMan, 'getCurrentPhase').mockReturnValue('CALM');

    loop._step(1 / 60);
    expect(triggerSpy).not.toHaveBeenCalled();
    expect(onCrisis).not.toHaveBeenCalled();
  });
});
