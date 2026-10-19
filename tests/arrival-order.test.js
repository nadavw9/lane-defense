// A refill car arrives at the BACK of its lane (TrafficRules.placeArrival), Candy-Crush style:
// the cars behind the gap move forward into it and the new car takes the rearmost slot, entering
// from behind the top edge. freeSpawnRow alone dropped the new car into the first free row, which
// with a car already staged at the top was a VISIBLE gap mid-road: the new car popped into
// existence in front of a car the player had already seen (owner report 2026-10-19).
// Same occupied rows either way, so spacing and density are unchanged; only which car sits where.
import { describe, it, expect } from 'vitest';
import { freeSpawnRow, placeArrival } from '../src/director/TrafficRules.js';

const car = (name, row) => ({ name, row });
const rowsOf = (cars) => Object.fromEntries(cars.map(c => [c.name, c.row]));

describe('placeArrival', () => {
  it('a gap below a staged car: the staged car drives into it, the new car takes the back', () => {
    const cars = [car('front', 3), car('staged', 0.5)];
    const r = freeSpawnRow(cars, 0.25, 5);
    expect(r).toBe(1.5);                         // the old rule: a visible mid-road slot
    const nu = car('new', null);
    placeArrival(cars, nu, r);
    expect(rowsOf([...cars, nu])).toEqual({ front: 3, staged: 1.5, new: 0.5 });
  });

  it('an empty back of the lane: the new car simply goes there', () => {
    const cars = [car('front', 2)];
    const nu = car('new', null);
    placeArrival(cars, nu, freeSpawnRow(cars, 0.25, 5));
    expect(rowsOf([...cars, nu])).toEqual({ front: 2, new: 0 });
  });

  it('several cars behind the gap each move forward one slot', () => {
    const cars = [car('front', 3.5), car('b', 1), car('a', 0)];
    const r = freeSpawnRow(cars, 0.25, 5);
    expect(r).toBe(2);
    const nu = car('new', null);
    placeArrival(cars, nu, r);
    expect(rowsOf([...cars, nu])).toEqual({ front: 3.5, b: 2, a: 1, new: 0 });
  });

  it('keeps the set of occupied rows exactly as the old rule had it', () => {
    const cars = [car('f', 4), car('m', 2.25), car('s', 0.75)];
    const r = freeSpawnRow(cars, 0.25, 5);
    const before = [...cars.map(c => c.row), r].sort((x, y) => x - y);
    const nu = car('new', null);
    placeArrival(cars, nu, r);
    expect([...cars, nu].map(c => c.row).sort((x, y) => x - y)).toEqual(before);
  });
});
