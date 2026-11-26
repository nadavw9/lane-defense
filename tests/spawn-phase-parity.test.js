// The car mix ramps with GOAL PROGRESS in the live game, exactly as in the simulator
// (2026-11-26). The live refill used to spawn every car with phase 'CALM' while the sim used the
// progress phase (CALM -> BUILD -> PRESSURE -> CLIMAX -> RELIEF), so every tuned level was much
// lighter in the real game than the sim measured: far fewer shots per level, real scores below the
// sim's lowest winning score, three stars out of reach (owner: "I always get 1 star"), and
// difficulty bands that the real game did not meet. Wall-clock time must not pick the phase either:
// a fast player and a slow one see the same traffic.
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

const DURATION = 100;

function setup() {
  const lanes    = Array.from({ length: 3 }, (_, id) => new Lane({ id }));
  const columns  = Array.from({ length: 3 }, (_, id) => new Column({ id }));
  const gs = new GameState({
    lanes, columns, colors: ['Red', 'Blue', 'Green'],
    world: { hpMultiplier: 1, heft: 0.5, speed: { base: 5, variance: 0.5 } },
    duration: DURATION, phaseMan: new IntensityPhase(DURATION), laneCount: 3, colCount: 3, gridRows: 5,
    spawnBudget: 20, laneTargetCarCount: 2, levelId: 7,
    goals: [{ type: 'destroyTotal', count: 20 }],
  });
  const rng = new SeededRandom(3);
  const carDir = new CarDirector({}, rng);
  const loop = new GameLoop({
    app: { ticker: { add: vi.fn(), remove: vi.fn() } }, gameState: gs, carDir,
    shooterDir: new ShooterDirector({}, rng, new FairnessArbiter()), combatResolver: new CombatResolver(), rng,
  });
  return { gs, loop, carDir };
}

// The phase the simulator would use at this goal progress (SimulationRunner: elapsed = duration x progress).
function simPhase(progress) {
  const pm = new IntensityPhase(DURATION); pm.update(DURATION * progress); return pm.getCurrentPhase();
}

describe('spawn phase follows goal progress (live = sim)', () => {
  it('a refill late in the level spawns with the progress phase, not CALM', () => {
    const { gs, loop, carDir } = setup();
    gs.goalProgress = [6];                      // 14 of 20 cars done: 70% progress
    const phases = [];
    const orig = carDir.generateCar.bind(carDir);
    carDir.generateCar = (lane, phase, ...rest) => { phases.push(phase); return orig(lane, phase, ...rest); };
    loop._step(0.016);                          // a frame between shots
    loop._refillLanes();
    expect(simPhase(0.7)).not.toBe('CALM');
    expect(phases.length).toBeGreaterThan(0);
    expect(new Set(phases)).toEqual(new Set([simPhase(0.7)]));
  });

  it('the clock does not pick the phase: a long pause at the start is still the opening phase', () => {
    const { gs, loop } = setup();
    gs.goalProgress = [20];                     // nothing destroyed yet
    for (let i = 0; i < 60; i++) loop._step(1);    // a minute of thinking
    expect(gs.phaseMan.getCurrentPhase()).toBe(simPhase(0));
  });
});
