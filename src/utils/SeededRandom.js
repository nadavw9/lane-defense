// SeededRandom — deterministic PRNG using the mulberry32 algorithm.
// Seed = hash(level_id, attempt_number) so different attempts get different sequences.
export class SeededRandom {
  constructor(seed) {
    this._state = seed >>> 0; // force uint32
  }

  // Returns a float in [0, 1)
  next() {
    this._state += 0x6d2b79f5;
    let t = this._state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  }

  // Returns an integer in [min, max] inclusive
  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  // Returns a float in [min, max)
  nextFloat(min, max) {
    return this.next() * (max - min) + min;
  }

  // Returns a random element from an array
  pick(array) {
    return array[this.nextInt(0, array.length - 1)];
  }

  // Returns a new shuffled copy of array (Fisher-Yates)
  shuffle(array) {
    const out = array.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  // Returns a value from options array of {value, weight}.
  // Higher weight = proportionally higher chance of being picked.
  weightedPick(options) {
    const total = options.reduce((sum, o) => sum + o.weight, 0);
    let r = this.next() * total;
    for (const o of options) {
      r -= o.weight;
      if (r < 0) return o.value;
    }
    // Fallback for floating-point edge case
    return options[options.length - 1].value;
  }
}
