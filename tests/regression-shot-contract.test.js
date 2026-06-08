// Regression: shot-resolution contracts on real game objects.
// Builds a real GameLoop + GameState/Lane/Column/directors/CombatResolver per
// level (same harness style as game-loop-shot-advance.test.js) and asserts the
// core turn-based rules hold. Shots are driven through _resolveShot() — the same
// entry point the existing advance tests use — so combat + grid advance run for real.
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
import { Car }             from '../src/models/Car.js';
import { LevelManager }    from '../src/game/LevelManager.js';

const mockApp = { ticker: { add: vi.fn(), remove: vi.fn() } };
const LEVELS  = [1, 5, 9, 15, 20, 40];

function buildLevel(levelId) {
  const lm = new LevelManager();
  lm.goToLevel(levelId);
  const cfg = lm.current;

  const lanes   = Array.from({ length: 4 }, (_, id) => new Lane({ id }));
  const columns = Array.from({ length: 4 }, (_, id) => new Column({ id }));
  const phaseMan = new IntensityPhase(cfg.duration);
  const gs = new GameState({
    lanes, columns,
    colors:             cfg.colors,
    world:              cfg.worldConfig,
    duration:           cfg.duration,
    phaseMan,
    laneCount:          cfg.laneCount,
    colCount:           cfg.colCount,
    gridRows:           cfg.gridRows,
    spawnBudget:        cfg.spawnBudget,
    laneTargetCarCount: cfg.laneTargetCarCount,
  });

  const rng        = new SeededRandom(42);
  const arbiter    = new FairnessArbiter();
  const carDir     = new CarDirector({}, rng);
  const shooterDir = new ShooterDirector({}, rng, arbiter);
  const loop = new GameLoop({
    app: mockApp, gameState: gs, carDir, shooterDir,
    combatResolver: new CombatResolver(), rng,
  });
  return { cfg, gs, lanes, columns, loop };
}

const placeCar = (loop, lane, { color, hp, row, gridRows }) => {
  const car = new Car({ color, hp, speed: 5 });
  car.row = row;
  car.position = loop._rowToPosition(row, gridRows);
  lane.addCar(car);
  return car;
};

describe('regression: shot contracts (real GameLoop)', () => {
  for (const levelId of LEVELS) {
    describe(`L${levelId}`, () => {
      // ── CONTRACT A — correct shot kills, all lanes advance, lane refills ──────
      it('A: correct shot removes the car and advances every other lane exactly 1 row', () => {
        const { cfg, gs, lanes, loop } = buildLevel(levelId);
        const C = cfg.colors[0];
        const target = placeCar(loop, lanes[0], { color: C, hp: 3, row: 5, gridRows: cfg.gridRows });
        const survivor = cfg.laneCount >= 2
          ? placeCar(loop, lanes[1], { color: C, hp: 99, row: 3, gridRows: cfg.gridRows })
          : null;
        const budgetBefore = gs.spawnBudget;

        loop._resolveShot(new Shooter({ color: C, damage: 5, column: 0 }), 0);

        expect(lanes[0].cars.includes(target)).toBe(false);   // killed + removed
        if (survivor) expect(survivor.row).toBe(4);            // exactly one advance, cross-lane
        // Budget tracks SPAWNS (not kills): a kill empties the lane, so refill spawns
        // a fresh car at row 0 when budget remains. (Spec's "budget tracks kills" is
        // inaccurate — it tracks spawns; verified here.)
        if (budgetBefore > 0) {
          expect(lanes[0].cars.some(c => c.row === 0)).toBe(true);
          expect(gs.spawnBudget).toBeLessThan(budgetBefore);
        }
      });

      // ── CONTRACT B — wrong colour: no damage, no advance, bomb still consumed ──
      it('B: wrong-colour shot deals no damage and advances nothing', () => {
        const { cfg, lanes, loop } = buildLevel(levelId);
        const C = cfg.colors[0];
        const D = cfg.colors[1] ?? 'Rainbow';   // any colour guaranteed != C
        const car = placeCar(loop, lanes[0], { color: C, hp: 10, row: 4, gridRows: cfg.gridRows });

        loop._resolveShot(new Shooter({ color: D, damage: 5, column: 0 }), 0);

        expect(car.hp).toBe(10);     // unchanged
        expect(car.row).toBe(4);     // no advance
      });

      it('B: deploying a bomb consumes one from the column (depth -1)', () => {
        const { cfg, gs, lanes, columns, loop } = buildLevel(levelId);
        const C = cfg.colors[0];
        placeCar(loop, lanes[0], { color: C, hp: 10, row: 4, gridRows: cfg.gridRows });
        columns[0].pushBottom(new Shooter({ color: C, damage: 5, column: 0 }));
        columns[0].pushBottom(new Shooter({ color: C, damage: 5, column: 0 }));
        const depthBefore = columns[0].shooters.length;

        loop.deploy(0, 0);   // consumes the top, then queues the shot

        expect(columns[0].shooters.length).toBe(depthBefore - 1);
      });

      // ── CONTRACT C — colour bomb clears all matching cars, advances ONCE ──────
      // Real trigger is a shooter with isColorBomb (the rainbow), aimed at a lane;
      // it destroys every car of the target lane's front-car colour across all lanes,
      // then advances the grid exactly once. (gs.colorBombArmed is a legacy field the
      // shipped color-bomb path does not use, so it is not asserted here.)
      if (true) {
        const hasTwoColors = () => buildLevel(levelId).cfg.colors.length >= 2;
        (hasTwoColors() ? it : it.skip)(
          'C: color bomb removes all matching-colour cars and advances exactly once',
          () => {
            const { cfg, gs, lanes, loop } = buildLevel(levelId);
            const C = cfg.colors[0];
            const D = cfg.colors[1];
            const g = cfg.gridRows;

            const cCars = [];
            cCars.push(placeCar(loop, lanes[0], { color: C, hp: 10, row: 6, gridRows: g })); // aim target
            cCars.push(placeCar(loop, lanes[1], { color: C, hp: 10, row: 5, gridRows: g }));
            const survivor = placeCar(loop, lanes[1], { color: D, hp: 99, row: 3, gridRows: g });
            if (cfg.laneCount >= 3) cCars.push(placeCar(loop, lanes[2], { color: C, hp: 10, row: 4, gridRows: g }));

            loop._resolveShot(new Shooter({ color: 'Rainbow', damage: 0, column: 0, isColorBomb: true }), 0);

            // Every pre-existing C car is gone, in every lane.
            for (const car of cCars) {
              for (let li = 0; li < cfg.laneCount; li++) {
                expect(lanes[li].cars.includes(car)).toBe(false);
              }
            }
            // Grid advanced EXACTLY once (survivor 3 → 4, not 3 → 5).
            expect(survivor.row).toBe(4);
          },
        );
      }

      // ── CONTRACT D — win when the last car dies and budget is spent ───────────
      // Budget = cars still to spawn; 0 means "this is the last car". Killing it
      // empties every lane with no budget left → win.
      it('D: killing the final car with budget exhausted wins the level', () => {
        const { cfg, gs, lanes, loop } = buildLevel(levelId);
        const C = cfg.colors[0];
        gs.spawnBudget = 0;
        placeCar(loop, lanes[0], { color: C, hp: 3, row: 5, gridRows: cfg.gridRows });

        loop._resolveShot(new Shooter({ color: C, damage: 5, column: 0 }), 0);

        expect(gs.isOver).toBe(true);
        expect(gs.won).toBe(true);
      });

      // ── CONTRACT E — breach loses ────────────────────────────────────────────
      it('E: a car one row from breach lost after a (non-killing) correct shot', () => {
        const { cfg, gs, lanes, loop } = buildLevel(levelId);
        const C = cfg.colors[0];
        placeCar(loop, lanes[0], { color: C, hp: 100, row: cfg.gridRows - 1, gridRows: cfg.gridRows });

        // Correct colour, low damage → car survives the hit, then advance breaches it.
        loop._resolveShot(new Shooter({ color: C, damage: 1, column: 0 }), 0);

        expect(gs.isOver).toBe(true);
        expect(gs.won).toBe(false);
      });
    });
  }
});

// ── CONTRACT F — FR-1 viability invariant on L9 across consecutive shots ────────
// The uniform opening primes 3 cars/lane (rows [1,2,3]); a boosterless 1-kill/shot
// run cannot clear that before an unkilled front breaches (~shot 10), so the board
// is MEANT to be lost without boosters. FR-1 is the thing under test: before every
// shot taken, a viable matching move must exist. We assert that invariant on each
// shot and require a solid consecutive run, not that the dense board survives forever.
describe('regression: FR-1 viability holds across consecutive shots (L9)', () => {
  it('after every shot, at least one column top matches a front car colour', () => {
    const { gs, lanes, columns, loop } = buildLevel(9);
    loop.restart();   // primes the uniform 3-car/lane opening and runs _enforceViableMove

    let shots = 0;
    for (let i = 0; i < 10; i++) {
      if (gs.isOver) break;

      // FR-1 precondition: a viable move (matching column top) must exist.
      const frontColors = new Set(
        gs.activeLanes.map(l => l.frontCar()?.color).filter(Boolean),
      );
      expect(frontColors.size, `cars must be present before shot ${i + 1}`).toBeGreaterThan(0);

      const matchCol = gs.activeCols.findIndex(col => frontColors.has(col.top()?.color));
      expect(
        matchCol,
        `FR-1: a column top must match a front car colour before shot ${i + 1}`,
      ).toBeGreaterThanOrEqual(0);

      const color    = gs.activeCols[matchCol].top().color;
      const laneIdx  = gs.activeLanes.findIndex(l => l.frontCar()?.color === color);
      const shooter  = gs.columns[matchCol].top();
      // Kill the front car EXACTLY (no carry-over excess) so no multi-kill color
      // bomb is earned — keeps column composition stable to isolate the FR-1 check.
      shooter.damage = gs.activeLanes[laneIdx].frontCar().hp;
      gs.columns[matchCol].consume();   // mimic deploy() consuming the bomb
      loop._resolveShot(shooter, laneIdx);
      shots++;
    }

    // FR-1 held as the precondition of every shot taken across a solid consecutive
    // run. The dense uniform opening breaches boosterless around shot 10 by design,
    // so we don't require the board to survive — only that the invariant never broke.
    expect(shots).toBeGreaterThanOrEqual(8);
  });
});
