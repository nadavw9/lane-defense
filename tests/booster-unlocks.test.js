// Booster pacing (2026-10-18, owner-approved): BOMB at L1, FREEZE at L8, COLOR SWAP at L12,
// the rainbow bomb from L10. A booster is live on its arrival level (taught there, with free
// ones) and offered before levels only AFTER it. Locked boosters are never earned in play.
import { describe, it, expect, vi } from 'vitest';
import {
  BOOSTER_UNLOCK_LEVEL, RAINBOW_FROM, boosterUnlocked, boosterOffered, unlocksFor,
  filterOffered, arrivingBooster, reachedLevel,
} from '../src/game/boosterUnlocks.js';
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

describe('schedule', () => {
  it('arrives at the agreed levels', () => {
    expect(BOOSTER_UNLOCK_LEVEL).toEqual({ bombs: 1, freeze: 8, colorChange: 12 });
    expect(RAINBOW_FROM).toBe(10);
  });
  it('level 1 has only the bomb, and nothing is offered before it', () => {
    expect(unlocksFor(1, 1)).toEqual({ bombs: true, freeze: false, colorChange: false, rainbow: false });
    for (const k of ['bombs', 'freeze', 'colorChange']) expect(boosterOffered(k, 1, 1), k).toBe(false);
  });
  it('the bomb is offered before L2 on', () => {
    expect(boosterOffered('bombs', 2, 2)).toBe(true);
    expect(boosterOffered('freeze', 2, 2)).toBe(false);
  });
  it('FREEZE is live on L8 but offered only from L9', () => {
    expect(boosterUnlocked('freeze', 7, 7)).toBe(false);
    expect(boosterUnlocked('freeze', 8, 8)).toBe(true);
    expect(boosterOffered('freeze', 8, 8)).toBe(false);
    expect(boosterOffered('freeze', 9, 9)).toBe(true);
  });
  it('COLOR SWAP is live on L12 but offered only from L13', () => {
    expect(boosterUnlocked('colorChange', 11, 11)).toBe(false);
    expect(boosterUnlocked('colorChange', 12, 12)).toBe(true);
    expect(boosterOffered('colorChange', 12, 12)).toBe(false);
    expect(boosterOffered('colorChange', 13, 13)).toBe(true);
  });
  it('a replay of an early level keeps everything the player has reached', () => {
    expect(reachedLevel(3, 20)).toBe(20);
    expect(unlocksFor(3, 20)).toEqual({ bombs: true, freeze: true, colorChange: true, rainbow: true });
    expect(boosterOffered('colorChange', 3, 20)).toBe(true);
  });
  it('the daily challenge uses only how far the player has got', () => {
    expect(unlocksFor('daily', 5).freeze).toBe(false);
    expect(unlocksFor('daily', 30).colorChange).toBe(true);
  });
  it('filterOffered drops what is not offered, and returns null when nothing is left', () => {
    expect(filterOffered({ freeze: 1, colorChange: 1, bombs: 0 }, 9, 9)).toEqual({ freeze: 1, colorChange: 0, bombs: 0 });
    expect(filterOffered({ freeze: 1, colorChange: 0, bombs: 0 }, 5, 5)).toBeNull();
    expect(filterOffered(null, 5, 5)).toBeNull();
  });
  it('FREEZE and COLOR SWAP arrive with free ones on their level; the bomb is earned instead', () => {
    expect(arrivingBooster(8)).toBe('freeze');
    expect(arrivingBooster(12)).toBe('colorChange');
    expect(arrivingBooster(1)).toBeNull();
    expect(arrivingBooster(9)).toBeNull();
    expect(arrivingBooster('daily')).toBeNull();
  });
});

// ── In-play earns respect the schedule (GameLoop reads gs.unlocks) ──────────────
const mockApp = { ticker: { add: vi.fn(), remove: vi.fn() } };
function setup(unlocks) {
  const lanes = Array.from({ length: 4 }, (_, id) => new Lane({ id }));
  const columns = Array.from({ length: 4 }, (_, id) => new Column({ id }));
  const gs = new GameState({
    lanes, columns, colors: ['Red', 'Blue', 'Green', 'Yellow'],
    world: { hpMultiplier: 1, speed: { base: 5, variance: 0.5 } },
    duration: 90, phaseMan: new IntensityPhase(90), laneCount: 4, colCount: 4, gridRows: 11,
    spawnBudget: 0, laneTargetCarCount: 0,
  });
  gs.unlocks = unlocks;
  const rng = new SeededRandom(1);
  const bs = new BoosterState();
  const loop = new GameLoop({
    app: mockApp, gameState: gs, carDir: new CarDirector({}, rng),
    shooterDir: new ShooterDirector({}, rng, new FairnessArbiter()),
    combatResolver: new CombatResolver(), rng, boosterState: bs,
  });
  return { gs, lanes, loop, bs };
}
function lineUp(lane, n) {
  let pos = 90;
  for (let i = 0; i < n; i++) { const c = new Car({ color: 'Red', hp: 2, speed: 5, row: 5 }); c.position = pos; pos -= 10; lane.addCar(c); }
}

describe('earns', () => {
  it('a 3-car shot earns no FREEZE before FREEZE arrives', () => {
    const { lanes, loop, bs } = setup(unlocksFor(5, 5));
    lineUp(lanes[0], 3);
    loop._resolveShot({ color: 'Red', damage: 8 }, 0);
    expect(bs.freeze).toBe(0);
  });
  it('...and earns one once it has', () => {
    const { lanes, loop, bs } = setup(unlocksFor(8, 8));
    lineUp(lanes[0], 3);
    loop._resolveShot({ color: 'Red', damage: 8 }, 0);
    expect(bs.freeze).toBe(1);
  });
  it('two multi-kills in a row earn no COLOR SWAP before L12', () => {
    const { loop, bs } = setup(unlocksFor(11, 11));
    loop._updateColorChangeCombo(2); loop._updateColorChangeCombo(2);
    expect(bs.colorChange).toBe(0);
  });
  it('multi-kills do not charge the rainbow bomb before L10', () => {
    const { gs, lanes, loop } = setup(unlocksFor(9, 9));
    lineUp(lanes[0], 2);
    loop._resolveShot({ color: 'Red', damage: 5 }, 0);
    expect(gs.multiKillCount).toBe(0);
  });
  it('no unlocks set (tests, sim) keeps every earn on', () => {
    const { lanes, loop, bs } = setup(null);
    lineUp(lanes[0], 3);
    loop._resolveShot({ color: 'Red', damage: 8 }, 0);
    expect(bs.freeze).toBe(1);
  });
});
