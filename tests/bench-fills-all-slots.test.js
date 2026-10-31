// The bench takes a bomb into EVERY empty slot in the same turn (owner, 2026-10-31: "there is a
// bug: only two bombs go into the slots"). The one-free-queue-action-per-turn gate used to refuse
// the second store until a lane fire; the bench's only limit is now its four slots.
import { describe, it, expect } from 'vitest';
import { DragDrop } from '../src/input/DragDrop.js';
import { BoosterState } from '../src/game/BoosterState.js';
import { BenchStorage } from '../src/game/BenchStorage.js';
import { Column } from '../src/models/Column.js';
import { Shooter } from '../src/models/Shooter.js';

describe('bench store is not gated by the free queue action', () => {
  it('stores a top bomb while the flag says the action was used', () => {
    const bs = new BoosterState();
    bs.queueActionUsed = true;            // a store already happened this turn
    const bench = new BenchStorage();
    const col = new Column({ id: 0 });
    for (const c of ['Red', 'Blue', 'Green']) col.pushBottom(new Shooter({ color: c, damage: 1, column: 0 }));
    const stored = [];
    const dd = Object.create(DragDrop.prototype);
    Object.assign(dd, {
      _boosterState: bs, _benchStorage: bench, _columns: [col], _dragSourceIdx: 0, _dragShooter: col.top(),
      _benchRenderer: { getSlotCenter: () => ({ x: 0, y: 0 }) },
      _shooterRenderer: {}, _ghost: { x: 0, y: 0 },
      _onBenchStore: (i) => stored.push(i), _onBenchFull: () => {},
      _snapBack: () => { dd.snapped = true; }, _startAnim: () => {}, _destroyGhost: () => {},
    });
    dd._handleBenchDrop(0);
    expect(dd.snapped).not.toBe(true);
    expect(stored).toEqual([0]);
    expect(bench.getSlot(0)?.color).toBe('Red');
  });

  it('fills all four slots one after another', () => {
    const bs = new BoosterState();
    const bench = new BenchStorage();
    const col = new Column({ id: 0 });
    for (const c of ['Red', 'Blue', 'Green', 'Yellow', 'Red']) col.pushBottom(new Shooter({ color: c, damage: 1, column: 0 }));
    const dd = Object.create(DragDrop.prototype);
    Object.assign(dd, {
      _boosterState: bs, _benchStorage: bench, _columns: [col], _dragSourceIdx: 0,
      _benchRenderer: { getSlotCenter: () => ({ x: 0, y: 0 }) },
      _shooterRenderer: {}, _ghost: { x: 0, y: 0 },
      _onBenchStore: () => {}, _onBenchFull: () => {},
      _snapBack: () => {}, _startAnim: () => {}, _destroyGhost: () => {},
    });
    for (let i = 0; i < 4; i++) { dd._dragShooter = col.top(); dd._handleBenchDrop(0); }
    expect(Array.from({ length: 4 }, (_, i) => bench.getSlot(i)?.color)).toEqual(['Red', 'Blue', 'Green', 'Yellow']);
    expect(bench.isFull).toBe(true);
  });
});
