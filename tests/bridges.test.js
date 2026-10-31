// BRIDGES (src/game/bridges.js). Owner, 2026-10-31: "for two cars to be hit you must create a link
// between them: two adjacent lanes whose cars are the same colour; then hitting one hits the other;
// a triple bridge is allowed; a speeder on one side breaks it." Pure rules shared by GameLoop and
// the simulator. Replaces the automatic chain reaction (spread.js).
import { describe, it, expect } from 'vitest';
import { Lane } from '../src/models/Lane.js';
import { Car } from '../src/models/Car.js';
import {
  BRIDGES_FROM, bridgesEnabledFor, eligiblePairs, canBridge, addBridge, connected, pruneBridges,
  bridgeHits, bridgeBetween,
} from '../src/game/bridges.js';

// lane(id, [color, hp, row, extra]...) — rows as the game keeps them (0 = far, higher = nearer).
function lane(id, ...cars) {
  const l = new Lane({ id });
  for (const [color, hp, row, extra = {}] of cars) {
    const c = new Car({ color, hp, row }); c.position = row * 25; Object.assign(c, extra); l.addCar(c);
  }
  return l;
}
const at = (lanes, li, row) => lanes[li].cars.find(c => Math.abs(c.row - row) < 1e-6);

describe('bridges — when a pair is eligible', () => {
  it('is on from L6, off before, overridable per level, on for the daily', () => {
    expect(BRIDGES_FROM).toBe(6);
    expect(bridgesEnabledFor({ id: 5 })).toBe(false);
    expect(bridgesEnabledFor({ id: 6 })).toBe(true);
    expect(bridgesEnabledFor({ id: 3, bridges: true })).toBe(true);
    expect(bridgesEnabledFor({ id: 'daily' })).toBe(true);
  });

  it('adjacent lanes, same colour, side by side, on the visible road', () => {
    const lanes = [lane(0, ['Red', 2, 2]), lane(1, ['Red', 1, 2]), lane(2, ['Red', 1, 3])];
    const pairs = eligiblePairs(lanes, 3);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].a.lane).toBe(0); expect(pairs[0].b.lane).toBe(1);
    expect(pairs[0].a.car).toBe(at(lanes, 0, 2)); expect(pairs[0].b.car).toBe(at(lanes, 1, 2));
  });

  it('not across a lane, not a different colour, not a staged car, not an armoured car', () => {
    const lanes = [lane(0, ['Red', 1, 2]), lane(1, ['Blue', 1, 2]), lane(2, ['Red', 1, 2])];
    expect(eligiblePairs(lanes, 3)).toHaveLength(0);                       // lanes 0 and 2 are not adjacent
    const staged = [lane(0, ['Red', 1, 0.5]), lane(1, ['Red', 1, 0.5])];
    expect(eligiblePairs(staged, 2)).toHaveLength(0);                      // row < 1 is behind the goal band
    const armoured = [lane(0, ['Red', 1, 2, { trait: 'armored', armor: 1 }]), lane(1, ['Red', 1, 2])];
    expect(eligiblePairs(armoured, 2)).toHaveLength(0);
    armoured[0].cars[0].armor = 0;                                           // stripped: eligible again
    expect(eligiblePairs(armoured, 2)).toHaveLength(1);
  });

  it('only inside the active lanes and only cars at the same row (deep rows count too)', () => {
    const lanes = [lane(0, ['Red', 1, 3], ['Blue', 1, 1.5]), lane(1, ['Red', 1, 3], ['Blue', 1, 1.5]), lane(2, ['Red', 1, 3])];
    expect(eligiblePairs(lanes, 2).map(p => [p.a.car.color, p.a.car.row])).toEqual([['Red', 3], ['Blue', 1.5]]);
    expect(eligiblePairs(lanes, 3)).toHaveLength(3);
  });

  it('canBridge answers for one specific pair of cars', () => {
    const lanes = [lane(0, ['Red', 1, 2]), lane(1, ['Red', 1, 2]), lane(2, ['Green', 1, 2])];
    expect(canBridge(lanes, 2, at(lanes, 0, 2), at(lanes, 1, 2))).toBe(true);
    expect(canBridge(lanes, 2, at(lanes, 1, 2), at(lanes, 0, 2))).toBe(true);   // either direction
    expect(canBridge(lanes, 3, at(lanes, 1, 2), at(lanes, 2, 2))).toBe(false);
    expect(canBridge(lanes, 3, at(lanes, 0, 2), at(lanes, 2, 2))).toBe(false);
  });
});

describe('bridges — making, chaining, breaking', () => {
  it('addBridge is idempotent and bridgeBetween finds it either way round', () => {
    const lanes = [lane(0, ['Red', 1, 2]), lane(1, ['Red', 1, 2])];
    const bridges = [];
    const a = at(lanes, 0, 2), b = at(lanes, 1, 2);
    expect(addBridge(bridges, 0, a, 1, b)).toBe(true);
    expect(addBridge(bridges, 1, b, 0, a)).toBe(false);
    expect(bridges).toHaveLength(1);
    expect(bridgeBetween(bridges, a, b)).toBe(bridges[0]);
    expect(bridgeBetween(bridges, b, a)).toBe(bridges[0]);
  });

  it('connected() walks the whole chain (a triple bridge)', () => {
    const lanes = [lane(0, ['Red', 1, 2]), lane(1, ['Red', 1, 2]), lane(2, ['Red', 1, 2])];
    const bridges = [];
    addBridge(bridges, 0, at(lanes, 0, 2), 1, at(lanes, 1, 2));
    addBridge(bridges, 1, at(lanes, 1, 2), 2, at(lanes, 2, 2));
    const set = connected(bridges, at(lanes, 2, 2));
    expect(set.size).toBe(3);
    expect(set.has(at(lanes, 0, 2))).toBe(true);
  });

  it('prune removes a bridge whose cars are no longer side by side (a speeder moved on)', () => {
    const lanes = [lane(0, ['Red', 1, 2, { trait: 'speeder' }]), lane(1, ['Red', 1, 2])];
    const bridges = [];
    addBridge(bridges, 0, at(lanes, 0, 2), 1, at(lanes, 1, 2));
    at(lanes, 0, 2).row = 2.5; at(lanes, 1, 2).row = 2.25;        // the speeder took two steps
    const removed = pruneBridges(lanes, bridges);
    expect(removed).toHaveLength(1);
    expect(bridges).toHaveLength(0);
  });

  it('prune removes a bridge when a car changed colour or left the lane; keeps a healthy one', () => {
    const lanes = [lane(0, ['Red', 1, 2]), lane(1, ['Red', 1, 2]), lane(2, ['Red', 1, 2])];
    const bridges = [];
    addBridge(bridges, 0, at(lanes, 0, 2), 1, at(lanes, 1, 2));
    addBridge(bridges, 1, at(lanes, 1, 2), 2, at(lanes, 2, 2));
    at(lanes, 2, 2).color = 'Blue';                                    // chameleon flipped
    expect(pruneBridges(lanes, bridges)).toHaveLength(1);
    expect(bridges).toHaveLength(1);
    lanes[0].cars = [];                                                 // destroyed by the BOMB booster
    expect(pruneBridges(lanes, bridges)).toHaveLength(1);
    expect(bridges).toHaveLength(0);
  });
});

describe('bridges — the shared hit', () => {
  it('a hit on one bridged car hits every connected car, removing the dead ones from their lanes', () => {
    const lanes = [lane(0, ['Red', 1, 3]), lane(1, ['Red', 2, 3]), lane(2, ['Red', 1, 3])];
    const bridges = [];
    addBridge(bridges, 0, at(lanes, 0, 3), 1, at(lanes, 1, 3));
    addBridge(bridges, 1, at(lanes, 1, 3), 2, at(lanes, 2, 3));
    const hits = bridgeHits(lanes, bridges, at(lanes, 0, 3), 1);     // the shot itself hit lane 0
    expect(hits.map(h => [h.lane, h.destroyed])).toEqual([[1, false], [2, true]]);
    expect(lanes[1].frontCar().hp).toBe(1);                            // the van shrank, still there
    expect(lanes[2].cars).toHaveLength(0);
    expect(pruneBridges(lanes, bridges)).toHaveLength(1);              // the bridge to the dead car is gone
    expect(bridges).toHaveLength(1);                                   // the shrunk van stays bridged
  });

  it('reaches a bridged car that is NOT the front car of its lane', () => {
    const lanes = [lane(0, ['Red', 1, 3]), lane(1, ['Blue', 1, 4], ['Red', 1, 3])];
    const bridges = [];
    addBridge(bridges, 0, at(lanes, 0, 3), 1, at(lanes, 1, 3));
    const hits = bridgeHits(lanes, bridges, at(lanes, 0, 3), 1);
    expect(hits).toEqual([expect.objectContaining({ lane: 1, destroyed: true })]);
    expect(lanes[1].cars.map(c => c.color)).toEqual(['Blue']);          // the blue front car is untouched
  });

  it('a charged shot passes both of its hits; an unbridged car gets nothing', () => {
    const lanes = [lane(0, ['Red', 1, 3]), lane(1, ['Red', 2, 3]), lane(2, ['Red', 1, 3])];
    const bridges = [];
    addBridge(bridges, 0, at(lanes, 0, 3), 1, at(lanes, 1, 3));
    const hits = bridgeHits(lanes, bridges, at(lanes, 0, 3), 2);
    expect(hits).toEqual([expect.objectContaining({ lane: 1, destroyed: true })]);
    expect(lanes[2].frontCar().hp).toBe(1);
  });

  it('returns nothing for a car with no bridge', () => {
    const lanes = [lane(0, ['Red', 1, 3]), lane(1, ['Red', 1, 3])];
    expect(bridgeHits(lanes, [], at(lanes, 0, 3), 1)).toEqual([]);
  });
});
