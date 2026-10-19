// The viability guard (GameLoop._enforceViableMove) guarantees a playable bomb by recolouring a
// queue top. It used to recolour "the first non-empty column top" — column 0 every time — so the
// player saw a bomb in a column they never touched change colour right after firing elsewhere
// (owner report 2026-10-19; probe: 8 of 8 guard recolours in 97 bot shots hit column 0).
// It must touch only the column the player just fired from, or, with no fresh shot, the column
// under the most dangerous lane, and never any other column.
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

// fronts: [{ color, row }] per lane; tops: per column, top first.
function setup(fronts, tops) {
  const lanes   = Array.from({ length: 4 }, (_, id) => new Lane({ id }));
  const columns = Array.from({ length: 4 }, (_, id) => new Column({ id }));
  const gs = new GameState({
    lanes, columns, colors: ['Red', 'Blue', 'Green'],
    world: { hpMultiplier: 1, speed: { base: 5, variance: 0.3 } },
    duration: 90, phaseMan: new IntensityPhase(90),
    laneCount: 3, colCount: 3, gridRows: 5, spawnBudget: 12, laneTargetCarCount: 2,
  });
  const rng = new SeededRandom(9);
  const loop = new GameLoop({
    app: mockApp, gameState: gs, carDir: new CarDirector({}, rng),
    shooterDir: new ShooterDirector({}, rng, new FairnessArbiter()),
    combatResolver: new CombatResolver(), rng, onEnd: vi.fn(), onAdvance: vi.fn(),
  });
  fronts.forEach((f, l) => { gs.lanes[l].cars = [{ id: l, color: f.color, hp: 2, maxHp: 2, row: f.row, position: 40, type: 'big' }]; });
  tops.forEach((list, c) => {
    gs.columns[c].shooters.length = 0;
    for (const color of list) gs.columns[c].pushBottom(new Shooter({ color, damage: 1, column: c }));
  });
  return { gs, loop };
}
const topColors = (gs) => gs.activeCols.map(c => c.top()?.color);

describe('viability guard touches only the column the player is using', () => {
  it('after a shot from column 2, only column 2 may change', () => {
    const { gs, loop } = setup(
      [{ color: 'Green', row: 3 }, { color: 'Green', row: 3 }, { color: 'Blue', row: 2 }],
      [['Red', 'Red'], ['Red', 'Red'], ['Blue', 'Red', 'Red']],
    );
    expect(loop.deploy(2, 2)).toBe(true);     // fires the Blue top; Red slides up, no top matches now
    loop._enforceViableMove(gs);
    expect(topColors(gs)).toEqual(['Red', 'Red', 'Green']);   // Green = the most dangerous front car
  });

  it('with no fresh shot, the column under the most dangerous lane changes', () => {
    const { gs, loop } = setup(
      [{ color: 'Blue', row: 2 }, { color: 'Green', row: 4 }, { color: 'Blue', row: 1 }],
      [['Red'], ['Red'], ['Red']],
    );
    loop._enforceViableMove(gs);
    expect(topColors(gs)).toEqual(['Red', 'Green', 'Red']);
  });

  it('a bench shot clears the fired column, so the danger rule decides', () => {
    const { gs, loop } = setup(
      [{ color: 'Blue', row: 1 }, { color: 'Blue', row: 1 }, { color: 'Green', row: 4 }],
      [['Red'], ['Blue', 'Red'], ['Red']],
    );
    expect(loop.deploy(1, 1)).toBe(true);
    loop._shotInFlight = () => false;          // the queue shot has resolved
    loop.deployFromBench(new Shooter({ color: 'Blue', damage: 1 }), 0);
    loop._enforceViableMove(gs);
    expect(topColors(gs)).toEqual(['Red', 'Red', 'Green']);
  });

  it('a viable board is left exactly as it is', () => {
    const { gs, loop } = setup(
      [{ color: 'Green', row: 3 }, { color: 'Red', row: 2 }, { color: 'Blue', row: 1 }],
      [['Red'], ['Blue'], ['Blue']],
    );
    loop._enforceViableMove(gs);
    expect(topColors(gs)).toEqual(['Red', 'Blue', 'Blue']);
  });
});
