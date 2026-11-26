// Lane barriers are gone (2026-11-26, owner: "a first car passing the finish doesn't fail the
// level, that seems weird and not clear ... I thought I was going to lose"). The rule is now the
// plain one: the first car past the breach line ends the level. CONTINUE (ad or coins) is the only
// second chance. These tests keep the barrier out of the game, the simulator and the screens.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { resolveBreach } from '../src/director/TrafficRules.js';
import { GameState } from '../src/game/GameState.js';

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

describe('no lane barriers', () => {
  it('the first car past the last row is the breach', () => {
    const cars = [{ row: 6 }, { row: 2 }];
    const { breached } = resolveBreach(cars, 5);
    expect(breached).toEqual([cars[0]]);
  });

  it('nothing crashes: resolveBreach returns no crashed car', () => {
    const res = resolveBreach([{ row: 9 }], 5);
    expect(res.crashed).toBeUndefined();
  });

  it('GameState carries no barrier state', () => {
    const gs = new GameState({ lanes: [], columns: [], duration: 0, spawnBudget: 0, laneTargetCarCount: 0, levelId: 1, goals: [] });
    expect('barriers' in gs).toBe(false);
    expect('barriersLost' in gs).toBe(false);
  });

  // "barrier" alone also names the roadside concrete walls (Road3D, LaneRenderer), which stay.
  it('no source file carries the lane-barrier rule, card or visuals', () => {
    const LANE_BARRIER = /lane barrier|barrier_down|BarrierIntroCard|BarrierSmash|barriersLost|barriersEnabled|setLaneBlocks|hasBarrier|\.barriers\b|barriers:/i;
    const hits = walk('src').filter(p => LANE_BARRIER.test(readFileSync(p, 'utf8')));
    expect(hits).toEqual([]);
  });
});
