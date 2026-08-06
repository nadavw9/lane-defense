// Column — one of the 4 shooter columns in the bottom half of the screen.
// Holds up to 3 visible queue slots; the top shooter (index 0) is the active one.
// THE canonical queue depth. Must equal the rendered slot count
// (Shooter3D.SLOT_COUNT) and the hit-test depth (DragDrop._hitTestQueueSlot) —
// tests/column-capacity.test.js asserts they agree. When the stash was retired
// this dropped 4 -> 3 but GameLoop kept a hardcoded capacity-4 tolerance, which
// left crisis-injected columns holding a bomb that was rendered nowhere and
// hit-tested nowhere.
export const COLUMN_CAPACITY = 3;

export class Column {
  constructor({ id } = {}) {
    this.id = id;
    this.shooters = [];
  }

  // The active (top) shooter, or null if empty.
  top() {
    return this.shooters[0] ?? null;
  }

  // Remove the top shooter and shift the rest up.
  consume() {
    this.shooters.shift();
  }

  // Add a shooter to the bottom of the column.
  pushBottom(shooter) {
    this.shooters.push(shooter);
  }

  // True when the column has fewer than COLUMN_CAPACITY shooters and needs a refill.
  needsRefill() {
    return this.shooters.length < COLUMN_CAPACITY;
  }

}
