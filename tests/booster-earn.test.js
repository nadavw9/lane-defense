// Booster earn conditions, driven through the real shot-resolution path.
//
//   COLOR CHANGE — earned on TWO strictly-consecutive multi-kills (2+ cars/shot).
//   FREEZE       — earned when a SINGLE shot kills 3+ cars.
//   "BOMB"       — the earned RAINBOW color bomb: 3 banked multi-kills
//                  (gs.multiKillCount → _earnColorBomb → _onColorBombEarned).
//                  NOTE: this is what the spec/SESSION_HANDOFF call "3 multi-kills →
//                  BOMB". The separate BOMB *booster* charge (bs.bombs) is earned at
//                  10 total kills (killsTowardBomb), a different mechanism.
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
    duration: 90, phaseMan, laneCount, colCount: 4, gridRows: 11, spawnBudget: 0,
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

function addCar(lane, color, hp, position) {
  const c = new Car({ color, hp, speed: 5, row: 5 });
  c.position = position;
  lane.addCar(c);
}
// Put an N-car same-colour chain in a lane (front-most first).
function chain(lane, color, count) {
  let pos = 90;
  for (let i = 0; i < count; i++) { addCar(lane, color, 2, pos); pos -= 10; }
}
const shot = (color, damage) => ({ color, damage });

describe('booster-earn — COLOR CHANGE (2 consecutive multi-kills)', () => {
  it('earns 1 charge on two consecutive multi-kills', () => {
    const bs = new BoosterState();
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs, { boosterState: bs });
    addCar(lanes[3], 'Blue', 9, 50);           // bystander so the board never empties
    chain(lanes[0], 'Red', 2);
    chain(lanes[1], 'Red', 2);
    loop._resolveShot(shot('Red', 5), 0);       // multi-kill #1
    expect(bs.colorChange).toBe(0);
    loop._resolveShot(shot('Red', 5), 1);       // multi-kill #2 → earn
    expect(bs.colorChange).toBe(1);
  });

  it('multi-kill then single-kill resets the streak (no earn)', () => {
    const bs = new BoosterState();
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs, { boosterState: bs });
    addCar(lanes[3], 'Blue', 9, 50);
    chain(lanes[0], 'Red', 2);
    addCar(lanes[1], 'Red', 2, 80);             // single car
    loop._resolveShot(shot('Red', 5), 0);       // multi-kill
    loop._resolveShot(shot('Red', 5), 1);       // single kill → reset
    expect(bs.colorChange).toBe(0);
  });

  it('single-kill then multi-kill does not earn (streak broken)', () => {
    const bs = new BoosterState();
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs, { boosterState: bs });
    addCar(lanes[3], 'Blue', 9, 50);
    addCar(lanes[0], 'Red', 2, 80);             // single
    chain(lanes[1], 'Red', 2);
    loop._resolveShot(shot('Red', 5), 0);       // single kill
    loop._resolveShot(shot('Red', 5), 1);       // multi-kill (streak = 1)
    expect(bs.colorChange).toBe(0);
  });

  it('three consecutive multi-kills earn exactly once (earn on 2nd, 3rd starts a new streak)', () => {
    const bs = new BoosterState();
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs, { boosterState: bs });
    addCar(lanes[3], 'Blue', 9, 50);
    chain(lanes[0], 'Red', 2);
    chain(lanes[1], 'Red', 2);
    chain(lanes[2], 'Red', 2);
    loop._resolveShot(shot('Red', 5), 0);
    loop._resolveShot(shot('Red', 5), 1);       // earns here
    loop._resolveShot(shot('Red', 5), 2);       // new streak, no second earn
    expect(bs.colorChange).toBe(1);
  });

  it('the consecutive-combo counter is 0 after restart', () => {
    const bs = new BoosterState();
    const { gs, lanes } = makeState({ spawnBudget: 5 });
    const loop = makeLoop(gs, { boosterState: bs });
    chain(lanes[0], 'Red', 2);
    loop._resolveShot(shot('Red', 5), 0);       // streak = 1
    expect(loop._consecutiveComboCount).toBe(1);
    loop.restart();
    expect(loop._consecutiveComboCount).toBe(0);
  });
});

describe('booster-earn — FREEZE (3+ kills in one shot)', () => {
  it('a single shot that kills exactly 3 cars earns a FREEZE charge', () => {
    const bs = new BoosterState();
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs, { boosterState: bs });
    chain(lanes[0], 'Red', 3);
    loop._resolveShot(shot('Red', 8), 0);
    expect(bs.freeze).toBe(1);
  });

  it('a single shot that kills 2 cars does NOT earn FREEZE', () => {
    const bs = new BoosterState();
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs, { boosterState: bs });
    chain(lanes[0], 'Red', 2);
    loop._resolveShot(shot('Red', 5), 0);
    expect(bs.freeze).toBe(0);
  });

  it('a single shot that kills 4 cars earns a FREEZE charge', () => {
    const bs = new BoosterState();
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs, { boosterState: bs });
    chain(lanes[0], 'Red', 4);
    loop._resolveShot(shot('Red', 12), 0);
    expect(bs.freeze).toBe(1);
  });

  it('resetLevel clears freeze-related game state (charge reset itself is GameApp-level)', () => {
    const { gs } = makeState();
    gs.comboFreezeShots = 2;
    gs.freezeArmed = true;
    gs.resetLevel();
    expect(gs.comboFreezeShots).toBe(0);
    expect(gs.freezeArmed).toBe(false);
  });
});

describe('booster-earn — rainbow color bomb (3 banked multi-kills)', () => {
  it('earns after 3 multi-kills across shots', () => {
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs);
    loop._onColorBombEarned = vi.fn();
    addCar(lanes[3], 'Blue', 9, 50);
    chain(lanes[0], 'Red', 2);
    chain(lanes[1], 'Red', 2);
    chain(lanes[2], 'Red', 2);
    loop._resolveShot(shot('Red', 5), 0);
    loop._resolveShot(shot('Red', 5), 1);
    expect(loop._onColorBombEarned).not.toHaveBeenCalled();
    loop._resolveShot(shot('Red', 5), 2);       // 3rd multi-kill → earn
    expect(loop._onColorBombEarned).toHaveBeenCalledTimes(1);
  });

  it('2 multi-kills do not earn yet', () => {
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs);
    loop._onColorBombEarned = vi.fn();
    addCar(lanes[3], 'Blue', 9, 50);
    chain(lanes[0], 'Red', 2);
    chain(lanes[1], 'Red', 2);
    loop._resolveShot(shot('Red', 5), 0);
    loop._resolveShot(shot('Red', 5), 1);
    expect(gs.multiKillCount).toBe(2);
    expect(loop._onColorBombEarned).not.toHaveBeenCalled();
  });

  it('the multi-kill counter resets on level start', () => {
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs);
    addCar(lanes[3], 'Blue', 9, 50);
    chain(lanes[0], 'Red', 2);
    loop._resolveShot(shot('Red', 5), 0);
    expect(gs.multiKillCount).toBe(1);
    gs.resetLevel();
    expect(gs.multiKillCount).toBe(0);
  });

  it('the multi-kill counter resets to 0 immediately after earning', () => {
    const { gs, lanes } = makeState();
    const loop = makeLoop(gs);
    loop._onColorBombEarned = vi.fn();
    addCar(lanes[3], 'Blue', 9, 50);
    chain(lanes[0], 'Red', 2);
    chain(lanes[1], 'Red', 2);
    chain(lanes[2], 'Red', 2);
    loop._resolveShot(shot('Red', 5), 0);
    loop._resolveShot(shot('Red', 5), 1);
    loop._resolveShot(shot('Red', 5), 2);       // earns
    expect(gs.multiKillCount).toBe(0);
  });
});
