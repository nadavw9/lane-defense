// Bench storage mechanics. BenchStorage owns 4 persistent slots; the queue
// interaction (store removes the column top, retrieve returns it to the queue
// front) mirrors DragDrop's bench handlers, exercised here with the real Column
// model. Bench unlock (L4+) is a GameApp inline gate — covered by a contract test.
// Headless — no Pixi/Three/DOM.

import { describe, it, expect } from 'vitest';
import { BenchStorage } from '../src/game/BenchStorage.js';
import { Column }       from '../src/models/Column.js';
import { Shooter }      from '../src/models/Shooter.js';

const bomb = (color, damage = 3) => new Shooter({ color, damage, column: 0 });

// Mirror of DragDrop._handleBenchDrop: pull the column top and store it.
function storeFromColumn(bench, col) {
  if (bench.isFull) return -1;          // DragDrop checks isFull before consuming
  const shooter = col.top();
  col.consume();
  return bench.store(shooter);
}
// Mirror of bench → lane/queue retrieve: take from a slot, push to queue front.
function retrieveToColumn(bench, col, slot) {
  const shooter = bench.take(slot);
  if (shooter) col.shooters.unshift(shooter);
  return shooter;
}

describe('bench — slot storage', () => {
  it('has 4 slots, all empty initially', () => {
    const bench = new BenchStorage();
    expect(bench.size).toBe(4);
    expect(bench.isEmpty).toBe(true);
    for (let i = 0; i < 4; i++) expect(bench.getSlot(i)).toBe(null);
  });

  it('storing a bomb occupies slot 0 and removes it from the queue', () => {
    const bench = new BenchStorage();
    const col   = new Column({ id: 0 });
    col.pushBottom(bomb('Red'));
    col.pushBottom(bomb('Blue'));
    const queueLenBefore = col.shooters.length;

    const slot = storeFromColumn(bench, col);
    expect(slot).toBe(0);
    expect(bench.getSlot(0).color).toBe('Red');
    expect(col.shooters.length).toBe(queueLenBefore - 1);   // removed from queue
    expect(col.top().color).toBe('Blue');                   // next bomb advanced up
  });

  it('storing 4 bombs fills all slots', () => {
    const bench = new BenchStorage();
    ['Red', 'Blue', 'Green', 'Yellow'].forEach(c => bench.store(bomb(c)));
    expect(bench.isFull).toBe(true);
    for (let i = 0; i < 4; i++) expect(bench.getSlot(i)).not.toBe(null);
  });

  it('storing when full is rejected and the bomb stays in the queue', () => {
    const bench = new BenchStorage();
    ['Red', 'Blue', 'Green', 'Yellow'].forEach(c => bench.store(bomb(c)));
    const col = new Column({ id: 0 });
    col.pushBottom(bomb('Purple'));
    const queueLenBefore = col.shooters.length;

    const slot = storeFromColumn(bench, col);
    expect(slot).toBe(-1);                                  // rejected
    expect(col.shooters.length).toBe(queueLenBefore);       // bomb untouched in queue
    expect(col.top().color).toBe('Purple');
  });

  it('retrieving from slot 0 returns the bomb to the queue front and empties the slot', () => {
    const bench = new BenchStorage();
    bench.store(bomb('Green'));
    const col = new Column({ id: 0 });
    col.pushBottom(bomb('Red'));

    const got = retrieveToColumn(bench, col, 0);
    expect(got.color).toBe('Green');
    expect(bench.getSlot(0)).toBe(null);     // slot now empty
    expect(col.top().color).toBe('Green');   // entered the front of the queue
  });

  it('retrieving from an empty slot is a no-op', () => {
    const bench = new BenchStorage();
    const col = new Column({ id: 0 });
    col.pushBottom(bomb('Red'));
    const got = retrieveToColumn(bench, col, 2);   // slot 2 is empty
    expect(got).toBe(null);
    expect(col.shooters.length).toBe(1);           // queue unchanged
  });
});

describe('bench — reset', () => {
  it('resets to empty on level start', () => {
    const bench = new BenchStorage();
    bench.store(bomb('Red'));
    bench.store(bomb('Blue'));
    bench.reset();   // GameApp calls benchStorage.reset() at the start of each level
    expect(bench.isEmpty).toBe(true);
    for (let i = 0; i < 4; i++) expect(bench.getSlot(i)).toBe(null);
  });

  it('resets to empty on retry/restart', () => {
    const bench = new BenchStorage();
    ['Red', 'Blue'].forEach(c => bench.store(bomb(c)));
    bench.reset();   // RETRY re-enters _startLevel, which resets the bench the same way
    expect(bench.isEmpty).toBe(true);
  });
});

describe('bench — unlock gate (contract test)', () => {
  // The canonical gate lives in GameApp._startLevel and is not headless-importable:
  //   const benchUnlocked = currentLevelIsDaily || levelId >= 4;
  // This pins the documented unlock threshold (bench first appears at L4).
  const benchUnlocked = (levelId) => levelId >= 4;

  it('is hidden (locked) on L1, L2, L3', () => {
    expect(benchUnlocked(1)).toBe(false);
    expect(benchUnlocked(2)).toBe(false);
    expect(benchUnlocked(3)).toBe(false);
  });

  it('is visible (unlocked) on L4 and above', () => {
    expect(benchUnlocked(4)).toBe(true);
    expect(benchUnlocked(5)).toBe(true);
    expect(benchUnlocked(10)).toBe(true);
  });
});

describe('bench → queue return (L5+ feature)', () => {
  // Mirrors DragDrop._handleBenchToQueueReturn: take from bench, push to column bottom
  // Returns the shooter if successful, null if the column is full
  function returnBenchToQueue(bench, col, benchSlotIdx) {
    // Check if target column is full (3 bombs max)
    if (col.shooters.length >= 3) {
      return null;  // Reject — column is full
    }

    const shooter = bench.take(benchSlotIdx);
    if (shooter) col.pushBottom(shooter);
    return shooter;
  }

  it('returns a bench bomb to a non-full queue column', () => {
    const bench = new BenchStorage();
    const col = new Column({ id: 0 });

    // Setup: store a bomb in bench, queue has 2 bombs
    bench.store(bomb('Red', 3));
    col.pushBottom(bomb('Blue', 2));
    col.pushBottom(bomb('Green', 2));

    expect(bench.getSlot(0).color).toBe('Red');
    expect(col.shooters.length).toBe(2);

    // Return the bench bomb to the column
    const got = returnBenchToQueue(bench, col, 0);

    expect(got.color).toBe('Red');
    expect(bench.getSlot(0)).toBe(null);        // bench slot now empty
    expect(col.shooters.length).toBe(3);        // queue now has 3
    expect(col.shooters[2].color).toBe('Red'); // returned bomb is at the bottom
  });

  it('rejects a return to a full queue column (3 bombs)', () => {
    const bench = new BenchStorage();
    const col = new Column({ id: 0 });

    // Setup: bench has a bomb, column is full (3 bombs)
    bench.store(bomb('Red', 3));
    col.pushBottom(bomb('Blue', 2));
    col.pushBottom(bomb('Green', 2));
    col.pushBottom(bomb('Yellow', 2));

    expect(col.shooters.length).toBe(3);
    expect(bench.getSlot(0).color).toBe('Red');

    // Attempt to return to full column: should not modify state
    const got = returnBenchToQueue(bench, col, 0);

    // After rejection, state is unchanged
    expect(got).toBe(null);          // bench.take() returns null for empty slot (already removed)
    expect(col.shooters.length).toBe(3);    // column unchanged
  });

  it('returns a bench bomb to a column with only 1 bomb', () => {
    const bench = new BenchStorage();
    const col = new Column({ id: 0 });

    bench.store(bomb('Purple', 4));
    col.pushBottom(bomb('Red', 2));

    const got = returnBenchToQueue(bench, col, 0);

    expect(got.color).toBe('Purple');
    expect(col.shooters.length).toBe(2);
    expect(col.shooters[1].color).toBe('Purple');
  });

  it('returns a bench bomb to an empty column', () => {
    const bench = new BenchStorage();
    const col = new Column({ id: 0 });

    bench.store(bomb('Orange', 2));
    expect(col.shooters.length).toBe(0);

    const got = returnBenchToQueue(bench, col, 0);

    expect(got.color).toBe('Orange');
    expect(col.shooters.length).toBe(1);
    expect(col.shooters[0].color).toBe('Orange');
  });

  it('returns from different bench slots to the same column', () => {
    const bench = new BenchStorage();
    const col = new Column({ id: 0 });

    bench.store(bomb('Red', 3));
    bench.store(bomb('Blue', 2));
    bench.store(bomb('Green', 2));

    col.pushBottom(bomb('Yellow', 1));

    // Return slot 1 (Blue) to the column
    const got1 = returnBenchToQueue(bench, col, 1);
    expect(got1.color).toBe('Blue');
    expect(col.shooters.length).toBe(2);

    // Return slot 2 (Green) to the column
    const got2 = returnBenchToQueue(bench, col, 2);
    expect(got2.color).toBe('Green');
    expect(col.shooters.length).toBe(3);

    // Column now has [Yellow, Blue, Green] (bottom to top)
    expect(col.shooters[0].color).toBe('Yellow');
    expect(col.shooters[1].color).toBe('Blue');
    expect(col.shooters[2].color).toBe('Green');
  });

  it('merge gate: bench → queue return only allowed on L5+', () => {
    // The canonical merge gate lives in GameApp._startLevel and is not headless-importable:
    //   dragDrop.setMergeEnabled((typeof levelId === 'number' ? levelId : 99) >= 5);
    // This pins the gate: bench → queue return available on L5+ and daily challenges.
    const mergeEnabled = (levelId) => (typeof levelId === 'number' ? levelId : 99) >= 5;

    // L1–L4: disabled
    expect(mergeEnabled(1)).toBe(false);
    expect(mergeEnabled(2)).toBe(false);
    expect(mergeEnabled(3)).toBe(false);
    expect(mergeEnabled(4)).toBe(false);

    // L5+: enabled
    expect(mergeEnabled(5)).toBe(true);
    expect(mergeEnabled(6)).toBe(true);
    expect(mergeEnabled(10)).toBe(true);

    // Daily challenge (levelId not a number): enabled
    expect(mergeEnabled('daily')).toBe(true);
    expect(mergeEnabled(null)).toBe(true);  // null defaults to 99
  });
});
