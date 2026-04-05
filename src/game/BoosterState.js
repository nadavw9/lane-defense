// BoosterState — tracks booster inventory and active modes.
// Written to by BoosterBar callbacks and DragDrop; read by ShooterRenderer.
// No PixiJS dependencies — pure logic.
export class BoosterState {
  constructor() {
    this.swap = 3;           // remaining swap charges
    this.peek = 3;           // remaining peek charges
    this.swapMode  = false;  // true while waiting for two column taps
    this.swapFirst = -1;     // first column selected in swap mode (-1 = none yet)
    this.peekUntil = -Infinity; // game elapsed time when peek expires
  }

  // Enter swap mode if charges remain.  Returns true on success.
  activateSwap() {
    if (this.swap <= 0) return false;
    this.swapMode  = true;
    this.swapFirst = -1;
    return true;
  }

  // Abort swap mode without consuming a charge (e.g. second tap on same column).
  cancelSwap() {
    this.swapMode  = false;
    this.swapFirst = -1;
  }

  // Called by DragDrop when the user taps column `colIdx` during swap mode.
  // Mutates `columns` array to swap top shooters on the second tap.
  // Returns: 'first' | 'swapped' | 'cancelled'
  tapSwapColumn(colIdx, columns) {
    if (!this.swapMode) return null;

    if (this.swapFirst === -1) {
      // Need a non-empty column for the first selection.
      if (!columns[colIdx]?.top()) return 'cancelled';
      this.swapFirst = colIdx;
      return 'first';
    }

    if (this.swapFirst === colIdx) {
      // Tapped the same column twice — cancel without spending a charge.
      this.cancelSwap();
      return 'cancelled';
    }

    // Second tap on a different column — execute the swap.
    const a = columns[this.swapFirst];
    const b = columns[colIdx];
    if (a.shooters.length > 0 && b.shooters.length > 0) {
      const tmp    = a.shooters[0];
      a.shooters[0] = b.shooters[0];
      b.shooters[0] = tmp;
    }
    this.swap--;
    this.swapMode  = false;
    this.swapFirst = -1;
    return 'swapped';
  }

  // Reveal the next 3 shooters per column for 4 seconds.  Returns true on success.
  activatePeek(elapsed) {
    if (this.peek <= 0) return false;
    this.peek--;
    this.peekUntil = elapsed + 4;
    return true;
  }

  isPeeking(elapsed) {
    return elapsed < this.peekUntil;
  }
}
