// Column — one of the 4 shooter columns in the bottom half of the screen.
// Holds up to 6 shooters; the top shooter (index 0) is the active one.
const COLUMN_CAPACITY = 6;

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

  // True when the column has fewer than 6 shooters and needs a refill.
  needsRefill() {
    return this.shooters.length < COLUMN_CAPACITY;
  }
}
