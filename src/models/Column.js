// Column — one of the 4 shooter columns in the bottom half of the screen.
// Holds up to 3 visible queue slots; the top shooter (index 0) is the active one.
// One stash slot per column holds a temporarily set-aside bomb.
const COLUMN_CAPACITY = 3;

export class Column {
  constructor({ id } = {}) {
    this.id = id;
    this.shooters = [];
    this.stash = null;
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

  // Move the top shooter into the stash slot.
  // Returns false if the stash is already occupied or the queue is empty.
  stashBomb() {
    if (this.stash !== null || this.shooters.length === 0) return false;
    this.stash = this.shooters.shift();
    return true;
  }

  // Return the stashed bomb to the front of the queue.
  // Returns false if there is nothing in the stash.
  retrieveStash() {
    if (this.stash === null) return false;
    this.shooters.unshift(this.stash);
    this.stash = null;
    return true;
  }
}
