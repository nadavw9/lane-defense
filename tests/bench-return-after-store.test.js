// A bomb can come back from the bench in the same turn another one went in (owner, 2026-11-12:
// "i think he can"). A store used to mark the free queue action as used, so a return after it
// snapped back. The return itself stays one per turn (no endless shuffling between lane fires).
import { describe, it, expect } from 'vitest';
import { DragDrop } from '../src/input/DragDrop.js';
import { BoosterState } from '../src/game/BoosterState.js';
import { BenchStorage } from '../src/game/BenchStorage.js';
import { Column } from '../src/models/Column.js';
import { Shooter } from '../src/models/Shooter.js';

function setup() {
  const bs = new BoosterState();
  const bench = new BenchStorage();
  const cols = [new Column({ id: 0 }), new Column({ id: 1 })];
  for (const c of ['Red', 'Blue', 'Green']) cols[0].pushBottom(new Shooter({ color: c, damage: 1, column: 0 }));
  cols[1].pushBottom(new Shooter({ color: 'Yellow', damage: 1, column: 1 }));
  bench.store(new Shooter({ color: 'Purple', damage: 1, column: 1 }), 3);
  const dd = Object.create(DragDrop.prototype);
  Object.assign(dd, {
    _boosterState: bs, _benchStorage: bench, _columns: cols, _dragSourceIdx: 0, _dragShooter: cols[0].top(),
    _benchRenderer: { getSlotCenter: () => ({ x: 0, y: 0 }), draggingSlot: -1 },
    _shooterRenderer: { getQueueSlotCenter: () => ({ x: 0, y: 0 }), draggingColumn: -1 },
    _ghost: { x: 0, y: 0, scale: { set() {} } },
    _onBenchStore: () => {}, _onBenchFull: () => {},
    _snapBack: () => { dd.snaps = (dd.snaps ?? 0) + 1; }, _startAnim: () => {}, _destroyGhost: () => {},
  });
  return { dd, bench, cols };
}

describe('bench return in the same turn as a store', () => {
  it('returns a bench bomb right after a store', () => {
    const { dd, bench, cols } = setup();
    dd._handleBenchDrop(0);                          // Red goes to the bench
    expect(bench.getSlot(0)?.color).toBe('Red');
    dd._handleBenchToQueueReturn(3, 1);              // Purple comes back to column 1
    expect(dd.snaps).toBeUndefined();
    expect(bench.getSlot(3)).toBeFalsy();
    expect(cols[1].shooters.map(s => s.color)).toEqual(['Yellow', 'Purple']);
  });

  it('still allows only one return per turn', () => {
    const { dd, bench, cols } = setup();
    bench.store(new Shooter({ color: 'Orange', damage: 1, column: 1 }), 2);
    dd._handleBenchToQueueReturn(3, 1);
    dd._handleBenchToQueueReturn(2, 1);
    expect(dd.snaps).toBe(1);
    expect(bench.getSlot(2)?.color).toBe('Orange');
    expect(cols[1].shooters.map(s => s.color)).toEqual(['Yellow', 'Purple']);
  });
});
