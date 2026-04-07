// BenchStorage — 4 persistent slots for storing shooters between deploys.
// Shooters remain until the player uses them. Cleared at the start of each level.
export class BenchStorage {
  constructor(size = 4) {
    this._size  = size;
    this._slots = new Array(size).fill(null);
  }

  get size() { return this._size; }

  // Returns the shooter in slot i, or null if the slot is empty.
  getSlot(i) { return this._slots[i] ?? null; }

  // Store a shooter in the first empty slot.
  // Returns the slot index used, or -1 if all slots are occupied.
  store(shooter) {
    for (let i = 0; i < this._size; i++) {
      if (!this._slots[i]) {
        this._slots[i] = shooter;
        return i;
      }
    }
    return -1;
  }

  // Remove and return the shooter in slot i, leaving the slot empty.
  // Returns null if the slot was already empty (defensive — callers should check first).
  take(i) {
    const s = this._slots[i] ?? null;
    this._slots[i] = null;
    return s;
  }

  get isFull()  { return this._slots.every(Boolean); }
  get isEmpty() { return !this._slots.some(Boolean); }

  // Clear all slots — call between levels.
  reset() { this._slots.fill(null); }
}
