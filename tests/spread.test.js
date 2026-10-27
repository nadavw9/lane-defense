// CHAIN REACTION across lanes (src/game/spread.js). Owner, 2026-10-27: "only 3 lanes, no room for
// thinking". A destroyed car now passes one hit to the FRONT car of each neighbouring lane when it
// has the same colour, and a neighbour that explodes passes it on. Order of play matters: clear the
// odd colour in the middle lane first and one shot takes the whole row.
import { describe, it, expect } from 'vitest';
import { Lane } from '../src/models/Lane.js';
import { Car } from '../src/models/Car.js';
import { spreadAcross, SPREAD_FROM, spreadEnabledFor } from '../src/game/spread.js';

function lane(id, ...cars) {
  const l = new Lane({ id });
  cars.forEach(([color, hp, pos, extra = {}], i) => {
    const c = new Car({ color, hp, row: i }); c.position = pos; Object.assign(c, extra); l.addCar(c);
  });
  return l;
}

describe('chain reaction across lanes', () => {
  it('a same-colour front car in the next lane takes one hit; a different colour does not', () => {
    const lanes = [lane(0, ['Red', 1, 80]), lane(1, ['Red', 2, 60]), lane(2, ['Blue', 1, 70])];
    const hits = spreadAcross(lanes, 0, 'Red');
    expect(hits).toEqual([expect.objectContaining({ lane: 1, from: 0, destroyed: false })]);
    expect(lanes[1].frontCar().hp).toBe(1);        // the car shrank one rung, it is still there
    expect(lanes[2].frontCar().hp).toBe(1);        // blue untouched
  });

  it('a neighbour that explodes passes the chain on; a survivor stops it', () => {
    const lanes = [lane(0, ['Red', 1, 80]), lane(1, ['Red', 1, 60]), lane(2, ['Red', 2, 70]), lane(3, ['Red', 1, 50])];
    const hits = spreadAcross(lanes, 0, 'Red');
    expect(hits.map(h => [h.lane, h.from, h.destroyed])).toEqual([[1, 0, true], [2, 1, false]]);
    expect(lanes[1].cars).toHaveLength(0);
    expect(lanes[2].frontCar().hp).toBe(1);
    expect(lanes[3].frontCar().hp).toBe(1);        // the van in lane 2 survived, lane 3 is safe
  });

  it('spreads both ways from the middle lane and only inside the active lanes', () => {
    const lanes = [lane(0, ['Red', 1, 80]), lane(1, ['Red', 1, 60]), lane(2, ['Red', 1, 70]), lane(3, ['Red', 1, 50])];
    const hits = spreadAcross(lanes, 1, 'Red', 3);   // lane 3 is not in play on this level
    expect(hits.map(h => h.lane).sort()).toEqual([0, 2]);
    expect(lanes[3].frontCar().hp).toBe(1);
  });

  it('only the FRONT car of a neighbour counts; armour stops the chain; an empty lane stops it', () => {
    const lanes = [lane(0, ['Red', 1, 80]), lane(1, ['Blue', 1, 70], ['Red', 1, 40]), lane(2, ['Red', 1, 60])];
    expect(spreadAcross(lanes, 0, 'Red')).toEqual([]);           // blue in front shields the red behind
    const armoured = [lane(0, ['Red', 1, 80]), lane(1, ['Red', 1, 60, { armor: 1 }]), lane(2, ['Red', 1, 60])];
    expect(spreadAcross(armoured, 0, 'Red')).toEqual([]);
    expect(armoured[1].frontCar().armor).toBe(1);
    const gap = [lane(0, ['Red', 1, 80]), lane(1), lane(2, ['Red', 1, 60])];
    expect(spreadAcross(gap, 0, 'Red')).toEqual([]);
  });

  it('destroyed neighbours are reported with colour, type and trait for the goals', () => {
    const lanes = [lane(0, ['Red', 1, 80]), lane(1, ['Red', 1, 60, { type: 'small', trait: 'gift' }])];
    const [hit] = spreadAcross(lanes, 0, 'Red');
    expect(hit.destroyed).toBe(true);
    expect(hit.car).toMatchObject({ color: 'Red', type: 'small', trait: 'gift' });
  });

  it('arrives on a fixed level and is on from there (levels are taught, never discovered)', () => {
    expect(SPREAD_FROM).toBe(6);
    expect(spreadEnabledFor({ id: 5 })).toBe(false);
    expect(spreadEnabledFor({ id: 6 })).toBe(true);
    expect(spreadEnabledFor({ id: 6, spread: false })).toBe(false);
    expect(spreadEnabledFor({})).toBe(true);        // daily challenge / generic configs: full rules
  });
});
