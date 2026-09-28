// The viability guard and the rescue shuffle must never recolour an earned
// RAINBOW bomb: it matches any car, and recolouring it produced a 0-damage
// "purple" bomb on the queue (seen by the autoplay bot on L29/L30).
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
import { Shooter }         from '../src/models/Shooter.js';

const mockApp = { ticker: { add: vi.fn(), remove: vi.fn() } };

function setup() {
  const lanes   = Array.from({ length: 4 }, (_, id) => new Lane({ id }));
  const columns = Array.from({ length: 4 }, (_, id) => new Column({ id }));
  const gs = new GameState({
    lanes, columns, colors: ['Red', 'Blue', 'Green'],
    world: { hpMultiplier: 1, speed: { base: 5, variance: 0.3 } },
    duration: 90, phaseMan: new IntensityPhase(90),
    laneCount: 3, colCount: 3, gridRows: 8, spawnBudget: 12, laneTargetCarCount: 2,
  });
  const rng = new SeededRandom(9);
  const loop = new GameLoop({
    app: mockApp, gameState: gs, carDir: new CarDirector({}, rng),
    shooterDir: new ShooterDirector({}, rng, new FairnessArbiter()),
    combatResolver: new CombatResolver(), rng, onEnd: vi.fn(), onAdvance: vi.fn(),
  });
  // Every front car is Green; no queue top is Green; column 0's top is a rainbow.
  for (let l = 0; l < 3; l++) gs.lanes[l].cars = [{ id: l, color: 'Green', hp: 3, maxHp: 3, row: 3, position: 40, type: 'big' }];
  for (let c = 0; c < 3; c++) { gs.columns[c].shooters.length = 0; gs.columns[c].pushBottom(new Shooter({ color: 'Red', damage: 4, column: c })); }
  gs.columns[0].shooters.unshift(new Shooter({ color: 'Rainbow', damage: 0, column: 0, isColorBomb: true }));
  return { gs, loop };
}

describe('rainbow bombs are never recoloured', () => {
  it('viability guard treats a rainbow top as a viable move', () => {
    const { gs, loop } = setup();
    loop._enforceViableMove(gs);
    expect(gs.columns[0].top().color).toBe('Rainbow');
    expect(gs.columns[0].top().isColorBomb).toBe(true);
  });
  it('rescue shuffle skips a rainbow top', () => {
    const { gs, loop } = setup();
    loop.shuffleForRescue();
    expect(gs.columns[0].top().color).toBe('Rainbow');
  });
});
