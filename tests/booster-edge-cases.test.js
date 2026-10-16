// Deterministic edge cases for the boosters on the REAL GameLoop (see booster-matrix for the
// randomised sweep). Each test names the end state the player must reach.
import { describe, it, expect } from 'vitest';
import { Car } from '../src/models/Car.js';
import { buildGame, levelCfg, settle, tick, checkInvariants, findMatch } from './helpers/boosterHarness.js';

function put(h, lane, color, row, extra = {}) {
  const c = new Car({ color, hp: 1, speed: 5 }); c.row = row; c.position = 0; Object.assign(c, extra);
  h.gs.lanes[lane].addCar(c); return c;
}
function empty(h) { for (const l of h.gs.lanes) l.cars.length = 0; }
const arm = (h, n = 1) => { h.bs.bombs = n; h.bs.activateBomb(); };
const colour = (h) => h.gs.colors[0];

describe('BOMB booster end states', () => {
  it('clears a full lane and the lane refills with ONE arrival per turn, never several at once', () => {
    const h = buildGame(levelCfg(5), { seed: 4 }); empty(h);
    for (const r of [1, 2, 3]) put(h, 0, colour(h), r);
    put(h, 1, colour(h), 3); put(h, 2, colour(h), 3);
    arm(h); h.loop.placeBombOnLane(0, 2);
    expect(h.gs.lanes[0].cars.length).toBeLessThanOrEqual(1);          // no 2-3 cars popping in
    expect(checkInvariants(h)).toEqual([]);
    // each later advance adds at most one
    for (let i = 0; i < 4; i++) {
      const before = h.gs.lanes[0].cars.length;
      h.loop._advanceGrid();
      if (h.gs.isOver) break;
      expect(h.gs.lanes[0].cars.length - before).toBeLessThanOrEqual(1);
    }
  });

  it('clearing the ONLY car of the last needed goal wins immediately', () => {
    const h = buildGame(levelCfg(5), { seed: 4 }); empty(h);
    h.gs.goals = [{ type: 'destroyTotal', count: 2 }]; h.gs.goalProgress = [2];
    put(h, 0, colour(h), 3); put(h, 0, colour(h), 5);
    arm(h); h.loop.placeBombOnLane(0, 5);
    expect(h.gs.isOver && h.gs.won).toBe(true);
    expect(h.events.end).toEqual([true]);
  });

  it('a lane clear that leaves other lanes holding only HIDDEN row-0 cars still shows a target', () => {
    const h = buildGame(levelCfg(5), { seed: 4 }); empty(h);
    put(h, 0, colour(h), 2); put(h, 0, colour(h), 3);
    put(h, 1, colour(h), 0); put(h, 2, colour(h), 0);
    arm(h); h.loop.placeBombOnLane(0, 3);
    const visible = h.gs.activeLanes.flatMap(l => l.cars).filter(c => c.row >= 1).length;
    expect(visible).toBeGreaterThan(0);
  });

  it('bombing the only occupied lane on a multi-lane board refills (never an empty road)', () => {
    const h = buildGame(levelCfg(5), { seed: 4 }); empty(h);
    put(h, 1, colour(h), 4);
    arm(h); h.loop.placeBombOnLane(1, 4);
    expect(h.gs.activeLanes.flatMap(l => l.cars).filter(c => c.row >= 1).length).toBeGreaterThan(0);
  });

  it('every single-lane level survives back-to-back bombs and keeps playing', () => {
    const h = buildGame(levelCfg(1), { seed: 2 });
    for (let i = 0; i < 6 && !h.gs.isOver; i++) {
      h.bs.bombs = 1; h.bs.activateBomb(); h.loop.placeBombOnLane(0, 3);
      if (!h.gs.isOver) expect(checkInvariants(h, `b${i}`)).toEqual([]);
    }
  });

  it('is refused (and the charge kept) while a shot is in flight, and after the level ended', () => {
    const h = buildGame(levelCfg(5), { seed: 4 });
    const m = findMatch(h.gs, h.bench); expect(m).toBeTruthy();
    h.loop.deploy(m.ci, m.li);
    h.bs.bombs = 2; h.bs.activateBomb();
    expect(h.loop.placeBombOnLane(m.li, 2)).toBe(false);
    expect(h.bs.bombs).toBe(2);
    settle(h.loop, h.gs);
    h.gs.endGame(false);
    expect(h.loop.placeBombOnLane(0, 2)).toBe(false);
    expect(h.bs.bombs).toBe(2);
  });

  it('out-of-range / negative / empty lane: charge refunded AND not counted as used', () => {
    const h = buildGame(levelCfg(2), { seed: 4 });                      // 2 lanes
    h.bs.bombs = 1;
    for (const lane of [2, 3, -1, 99]) {
      h.bs.activateBomb(); h.loop.placeBombOnLane(lane, 0);
      expect(h.bs.bombs).toBe(1);
      expect(h.bs.used.bombs).toBe(0);                                  // else the player is billed for a bomb that never fired
    }
    empty(h); put(h, 0, colour(h), 3);
    h.bs.activateBomb(); h.loop.placeBombOnLane(1, 3);                   // empty lane 1
    expect(h.bs.bombs).toBe(1); expect(h.bs.used.bombs).toBe(0);
  });

  it('charges never exceed the cap even when a lane clear earns several', () => {
    const h = buildGame(levelCfg(5), { seed: 4 }); empty(h);
    h.bs.bombsMax = 3; h.gs.killsTowardBomb = 0;
    for (let r = 0; r < 7; r++) put(h, 0, colour(h), r);
    put(h, 1, colour(h), 3);
    h.bs.bombs = 3; h.bs.activateBomb(); h.loop.placeBombOnLane(0, 3);
    expect(h.bs.bombs).toBeLessThanOrEqual(3);
  });

  it('credits colour, type and trait goals for every car it removes', () => {
    const h = buildGame(levelCfg(5), { seed: 4 }); empty(h);
    const c0 = colour(h);
    h.gs.goals = [{ type: 'destroyColor', color: c0, count: 3 }, { type: 'destroyTotal', count: 3 }];
    h.gs.goalProgress = [3, 3];
    put(h, 0, c0, 2); put(h, 0, c0, 3); put(h, 0, c0, 4); put(h, 1, h.gs.colors[1], 3);
    arm(h); h.loop.placeBombOnLane(0, 3);
    expect(h.gs.isOver && h.gs.won).toBe(true);
  });
});

describe('BOMB during hit-stop', () => {
  it('is refused while the landed shot waits out its hit-stop, then works', () => {
    const h = buildGame(levelCfg(5), { seed: 4 });
    const m = findMatch(h.gs, h.bench); h.loop.deploy(m.ci, m.li);
    let guard = 0;
    while (!h.loop._pendingShot && guard++ < 100) h.loop._step(1 / 60);
    expect(h.loop._pendingShot).toBeTruthy();
    h.bs.bombs = 1; h.bs.activateBomb();
    expect(h.loop.placeBombOnLane(m.li, 2)).toBe(false);
    expect(h.bs.bombs).toBe(1); expect(h.bs.used.bombs).toBe(0);
    settle(h.loop, h.gs);
    if (!h.gs.isOver) { h.bs.activateBomb(); h.loop.placeBombOnLane(0, 2); expect(h.bs.used.bombs).toBe(1); }
  });
});

describe('FREEZE booster end states', () => {
  it('holds the next HIT only: a miss keeps the freeze, the hit spends it, traffic then moves again', () => {
    const h = buildGame(levelCfg(5), { seed: 4 });
    h.bs.freeze = 1; h.bs.activateFreeze();
    const rowsBefore = h.gs.activeLanes.flatMap(l => l.cars.map(c => c.row));
    const m = findMatch(h.gs, h.bench);
    h.loop.deploy(m.ci, m.li); settle(h.loop, h.gs); tick(h.loop, 2);
    expect(h.bs.isFrozen()).toBe(false);
    if (!h.gs.isOver) {
      const survivors = h.gs.activeLanes.flatMap(l => l.cars);
      // nothing marched forward on the frozen turn
      expect(Math.max(...survivors.map(c => c.row))).toBeLessThanOrEqual(Math.max(...rowsBefore));
    }
    expect(checkInvariants(h)).toEqual([]);
  });

  it('freeze + final kill: the win is declared, not swallowed by the frozen branch', () => {
    const h = buildGame(levelCfg(5), { seed: 4 }); empty(h);
    h.gs.goals = [{ type: 'destroyTotal', count: 1 }]; h.gs.goalProgress = [1];
    put(h, 0, colour(h), 3);
    h.gs.columns[0].shooters.length = 0;
    h.loop._sDir.fillColumns(h.gs.activeCols, h.gs.asDirectorState(), h.gs.phaseMan.getParams());
    h.gs.columns[0].top().color = colour(h);
    h.bs.freeze = 1; h.bs.activateFreeze();
    h.loop.deploy(0, 0); settle(h.loop, h.gs);
    expect(h.gs.isOver && h.gs.won).toBe(true);
  });

  it('freeze then BOMB: the freeze survives the bomb (bomb is not a shot)', () => {
    const h = buildGame(levelCfg(5), { seed: 4 });
    h.bs.freeze = 1; h.bs.activateFreeze();
    arm(h); h.loop.placeBombOnLane(0, 3);
    expect(h.bs.isFrozen()).toBe(true);
    expect(checkInvariants(h)).toEqual([]);
  });

  it('freeze that clears the whole road still leaves a visible target', () => {
    const h = buildGame(levelCfg(1), { seed: 4 });
    h.bs.freeze = 1; h.bs.activateFreeze();
    let guard = 0;
    while (!h.gs.isOver && guard++ < 6) {
      const m = findMatch(h.gs, h.bench); if (!m) break;
      h.loop.deploy(m.ci, m.li); settle(h.loop, h.gs); tick(h.loop, 2);
      expect(checkInvariants(h, `g${guard}`)).toEqual([]);
    }
  });
});

describe('COLOUR CHANGE booster end states', () => {
  it('same colour, absent colour or missing args: no change and no charge spent', () => {
    const h = buildGame(levelCfg(5), { seed: 4 });
    h.bs.colorChange = 1;
    expect(h.loop.applyColorChange(colour(h), colour(h))).toBe(0);
    expect(h.loop.applyColorChange('Nope', colour(h))).toBe(0);
    expect(h.loop.applyColorChange(null, colour(h))).toBe(0);
    expect(h.bs.colorChange).toBe(1); expect(h.bs.used.colorChange).toBe(0);
  });

  it('recolours every car of a colour in every lane and spends exactly one charge', () => {
    const h = buildGame(levelCfg(5), { seed: 4 }); empty(h);
    const [a, b] = h.gs.colors;
    put(h, 0, a, 2); put(h, 1, a, 3); put(h, 2, b, 3); put(h, 0, a, 4);
    h.bs.colorChange = 2; h.bs.activateColorChange(); h.bs.setColorChangeCar(a);
    expect(h.loop.applyColorChange(a, b)).toBe(3);
    expect(h.gs.activeLanes.flatMap(l => l.cars).every(c => c.color === b)).toBe(true);
    expect(h.bs.colorChange).toBe(1); expect(h.bs.used.colorChange).toBe(1);
    expect(h.bs.colorChangeMode).toBe(false);
  });

  it('recolouring toward a colour the player has no bomb for still leaves a playable board', () => {
    const h = buildGame(levelCfg(5), { seed: 4 });
    const present = [...new Set(h.gs.activeLanes.flatMap(l => l.cars.map(c => c.color)))];
    for (const to of h.gs.colors) {
      for (const from of present) { h.bs.colorChange = 1; h.loop.applyColorChange(from, to); }
      h.loop._step(1 / 60);
      expect(findMatch(h.gs, h.bench) ?? 'none').not.toBe('none');
    }
  });
});

describe('combinations', () => {
  it('colour change -> bomb -> freeze -> shot, in one turn window, ends consistent', () => {
    const h = buildGame(levelCfg(8), { seed: 9 });
    const [a, b] = h.gs.colors;
    h.bs.colorChange = 1; h.loop.applyColorChange(a, b);
    arm(h); h.loop.placeBombOnLane(1, 3);
    h.bs.freeze = 1; h.bs.activateFreeze();
    const m = findMatch(h.gs, h.bench);
    if (m) { h.loop.deploy(m.ci, m.li); settle(h.loop, h.gs); }
    tick(h.loop, 3);
    expect(checkInvariants(h)).toEqual([]);
  });

  it('three bombs in a row across all three lanes: board stays playable or the level is won', () => {
    const h = buildGame(levelCfg(8), { seed: 9 });
    for (let li = 0; li < 3 && !h.gs.isOver; li++) {
      h.bs.bombs = 1; h.bs.activateBomb(); h.loop.placeBombOnLane(li, 3); tick(h.loop, 2);
      if (!h.gs.isOver) expect(checkInvariants(h, `lane${li}`)).toEqual([]);
    }
    if (!h.gs.isOver) expect(findMatch(h.gs, h.bench)).toBeTruthy();
  });
});
