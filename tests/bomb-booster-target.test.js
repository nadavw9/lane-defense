// BOMB booster row targeting. The booster destroys every car in the TAPPED car's
// row matching its colour (the caller resolves the tapped car from the release Y).
// When no target is supplied it falls back to the front car (highest row).
// Headless — real GameLoop/GameState/BoosterState/models.

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

// lane 0 holds a front car (Red, row 5 — closest to breach) and a back car
// (Blue, row 2). Fresh state per case since placeBombOnLane mutates the board.
function setup() {
  const lanes   = Array.from({ length: 4 }, (_, id) => new Lane({ id }));
  const columns = Array.from({ length: 4 }, (_, id) => new Column({ id }));
  const gs = new GameState({
    lanes, columns, colors: ['Red', 'Blue', 'Green', 'Yellow'],
    world: { hpMultiplier: 1, speed: { base: 5, variance: 0.5 } },
    duration: 90, phaseMan: new IntensityPhase(90), laneCount: 4, colCount: 4,
    gridRows: 11, spawnBudget: 0,
  });
  const bs  = new BoosterState(); bs.bombs = 5;
  const rng = new SeededRandom(1);
  const loop = new GameLoop({
    app: mockApp, gameState: gs,
    carDir:     new CarDirector({}, rng),
    shooterDir: new ShooterDirector({}, rng, new FairnessArbiter()),
    combatResolver: new CombatResolver(), rng, boosterState: bs,
  });
  const front = new Car({ color: 'Red',  hp: 5, speed: 5, row: 5 }); front.position = 50;
  const back  = new Car({ color: 'Blue', hp: 5, speed: 5, row: 2 }); back.position  = 20;
  lanes[0].addCar(front); lanes[0].addCar(back);
  return { lanes, loop, front, back };
}

describe('BOMB booster — row targeting', () => {
  it('targets the tapped car row (not always the front car)', () => {
    // Case 1: tapped the back car → destroys Blue (row 2); front Red survives.
    {
      const { lanes, loop, back } = setup();
      loop.placeBombOnLane(0, back);
      expect(lanes[0].cars.map(c => c.color)).toEqual(['Red']);
    }
    // Case 2: no target → front-car fallback destroys Red (row 5); back Blue survives.
    {
      const { lanes, loop } = setup();
      loop.placeBombOnLane(0);
      expect(lanes[0].cars.map(c => c.color)).toEqual(['Blue']);
    }
  });
});
