// THE BOMB BOOSTER TOUCHES ONE LANE. NOTHING ELSE.
//
// 2026-08-01 device report: "i used a bomb combo and it affected cars both in the
// lane and in the column". The BOMB was a ROW clear until 2026-07-30, so the
// obvious suspicion was that the row path survived the switch and both now run.
//
// It did not: `placeBombOnRow` exists nowhere in src/, and a live probe fired at
// lane 1 of a 3-lane board with cars at rows 1-4 in EVERY lane killed 4/4 in the
// target lane and 0 outside it. These tests pin that so the row shape cannot creep
// back in — the failure mode is silent, because a bomb that clears too much still
// looks like it "worked".
//
// NOTE on the report itself: the only mechanic in the game that kills across lanes
// is the COLOUR bomb (_fireColorBomb), which removes every car of one colour
// board-wide. That is designed behaviour and it is earned from combos, so it is the
// leading explanation for what was seen — but it was NOT reproduced, so nothing was
// changed on the strength of it.
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

function build({ laneCount = 3, rows = 4 } = {}) {
  const lanes   = Array.from({ length: laneCount }, (_, id) => new Lane({ id }));
  const columns = Array.from({ length: laneCount }, (_, id) => new Column({ id }));
  const gs = new GameState({
    lanes, columns, colors: ['Red', 'Blue', 'Green'],
    world: { hpMultiplier: 1, speed: { base: 5, variance: 0.5 } },
    duration: 90, phaseMan: new IntensityPhase(90),
    laneCount, colCount: laneCount, gridRows: 8,
  });
  // A car in EVERY lane at EVERY row — so a row clear, a column clear, a colour
  // clear and a lane clear all produce visibly different survivor sets.
  for (let l = 0; l < laneCount; l++) {
    for (let r = 1; r <= rows; r++) {
      const car = new Car({ color: ['Red', 'Blue', 'Green'][(l + r) % 3], hp: 3, speed: 5 });
      car.hp = 3; car.row = r; car.position = r * 12; car.__tag = `L${l}R${r}`;
      lanes[l].addCar(car);
    }
  }
  const rng = new SeededRandom(1);
  const bs = { bombs: 3, bombsMax: 3, consumeBomb() { if (this.bombs <= 0) return false; this.bombs--; return true; } };
  const loop = new GameLoop({
    app: mockApp, gameState: gs,
    carDir: new CarDirector({}, rng),
    shooterDir: new ShooterDirector({}, rng, new FairnessArbiter()),
    combatResolver: new CombatResolver(), rng, boosterState: bs,
  });
  loop._onBombExplode = vi.fn();
  return { gs, lanes, loop, bs };
}
const tagsIn = (lane) => lane.cars.map((c) => c.__tag);

describe('BOMB booster affects the target lane and nothing else', () => {
  it('clears the whole target lane and leaves every other lane INTACT', () => {
    const { lanes, loop } = build();
    loop.placeBombOnLane(1, 3);

    expect(tagsIn(lanes[1]), 'target lane must be emptied').toEqual([]);
    // Compared as SETS: Lane.addCar front-inserts, so list order is not part of
    // the contract being asserted here — membership is.
    // The regression this exists for: a row clear would take L0R3 and L2R3.
    expect(new Set(tagsIn(lanes[0])), 'lane 0 lost cars — BOMB is hitting a row, not a lane')
      .toEqual(new Set(['L0R1', 'L0R2', 'L0R3', 'L0R4']));
    expect(new Set(tagsIn(lanes[2])), 'lane 2 lost cars — BOMB is hitting a row, not a lane')
      .toEqual(new Set(['L2R1', 'L2R2', 'L2R3', 'L2R4']));
  });

  it('kills exactly the target lane count — no more, no fewer', () => {
    const { gs, lanes, loop } = build();
    const before = lanes.reduce((n, l) => n + l.cars.length, 0);
    const inTarget = lanes[1].cars.length;
    loop.placeBombOnLane(1, 2);
    const after = lanes.reduce((n, l) => n + l.cars.length, 0);
    expect(before - after, 'total cars removed must equal the target lane size').toBe(inTarget);
    expect(gs.totalKills).toBe(inTarget);
  });

  it('is colour-agnostic WITHIN the lane and colour-blind OUTSIDE it', () => {
    // Distinguishes a lane clear from a colour clear: same-coloured cars in other
    // lanes must survive.
    const { lanes, loop } = build();
    const targetColours = new Set(lanes[1].cars.map((c) => c.color));
    loop.placeBombOnLane(1, 1);
    expect(lanes[1].cars).toHaveLength(0);
    const survivorsSharingColour = [...lanes[0].cars, ...lanes[2].cars]
      .filter((c) => targetColours.has(c.color));
    expect(survivorsSharingColour.length,
      'cars sharing the target lane\'s colours died elsewhere — this is a COLOUR clear, not a lane clear')
      .toBeGreaterThan(0);
  });

  it('holds at every lane count and for every target lane', () => {
    for (const laneCount of [2, 3, 4]) {
      for (let target = 0; target < laneCount; target++) {
        const { lanes, loop } = build({ laneCount });
        loop.placeBombOnLane(target, 2);
        for (let l = 0; l < laneCount; l++) {
          if (l === target) expect(lanes[l].cars, `lanes=${laneCount} target=${target}`).toHaveLength(0);
          else expect(lanes[l].cars.length, `lanes=${laneCount}: lane ${l} damaged by a bomb aimed at ${target}`).toBe(4);
        }
      }
    }
  });

  it('an AMBIGUOUS tap between two cars still clears exactly one lane', () => {
    // The reported condition: "pressed exactly between two cars in the same lane".
    // tapRow only selects the blast's travel target; it must never change WHICH
    // lane dies, nor leak into a neighbour.
    for (const tapRow of [2, 3, 4, 2.5, 3.5, 99, -5]) {
      const { lanes, loop } = build();
      loop.placeBombOnLane(1, tapRow);
      expect(lanes[1].cars, `tapRow=${tapRow}: target lane not cleared`).toHaveLength(0);
      expect(lanes[0].cars.length, `tapRow=${tapRow}: leaked into lane 0`).toBe(4);
      expect(lanes[2].cars.length, `tapRow=${tapRow}: leaked into lane 2`).toBe(4);
    }
  });

  it('a tap on EMPTY ROAD in a lane with cars still clears that lane', () => {
    // Empty road between rows is a real tap target now that cars are 2x with
    // ~half-car gaps. A row with no car under the finger must not abort the bomb.
    const { lanes, loop, bs } = build();
    const before = bs.bombs;
    loop.placeBombOnLane(2, 7);          // row 7 holds no car; the LANE is the payload
    expect(lanes[2].cars, 'empty-row tap failed to clear the lane').toHaveLength(0);
    expect(bs.bombs, 'charge should be spent, not refunded').toBe(before - 1);
  });

  it('DragDrop clamps Y into the road before resolving the lane', () => {
    // The reproduced defect: onPointerDown accepts taps up to
    // ROAD_BOTTOM_Y + frontRowTapMargin (31px at gridRows 8) so the frontmost row
    // is tappable, but _hitTestLane returns -1 above ROAD_BOTTOM_Y — so the whole
    // margin was a dead zone over the most urgent cars.
    const src = require('fs').readFileSync('src/input/DragDrop.js', 'utf8');
    const branch = src.slice(src.indexOf('bombMode'), src.indexOf('bombMode') + 1400);
    expect(branch, 'bomb lane lookup must clamp Y into the road, or the front-row margin is dead')
      .toMatch(/_hitTestLane\(\s*x\s*,\s*Math\.min\(\s*y\s*,\s*ROAD_BOTTOM_Y\s*\)\s*\)/);
  });

  it('an out-of-play lane index is refunded, never silently eaten', () => {
    const { lanes, loop, bs } = build();
    const before = bs.bombs;
    loop.placeBombOnLane(-1, 3);
    expect(bs.bombs, 'a missed tap must refund the charge').toBe(before);
    expect(lanes.reduce((n, l) => n + l.cars.length, 0), 'nothing should die on a missed tap').toBe(12);
  });

  it('no row-clear entry point exists in the codebase', () => {
    // The 2026-07-30 switch removed placeBombOnRow. If it ever returns alongside
    // placeBombOnLane, both could run and reproduce the reported cross shape.
    const src = require('fs').readFileSync('src/game/GameLoop.js', 'utf8');
    expect(src, 'placeBombOnRow is back — the BOMB can clear a row again').not.toMatch(/placeBombOnRow/);
    const app = require('fs').readFileSync('src/renderer/GameApp.js', 'utf8');
    expect(app, 'GameApp routes a bomb tap to a row clear').not.toMatch(/placeBombOnRow/);
  });
});
