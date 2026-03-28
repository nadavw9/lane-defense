import { describe, it, expect } from 'vitest'
import { SeededRandom } from '../src/utils/SeededRandom.js'

describe('SeededRandom', () => {
  describe('determinism', () => {
    it('same seed produces same sequence', () => {
      const a = new SeededRandom(42)
      const b = new SeededRandom(42)
      for (let i = 0; i < 100; i++) {
        expect(a.next()).toBe(b.next())
      }
    })

    it('different seeds produce different sequences', () => {
      const a = new SeededRandom(1)
      const b = new SeededRandom(2)
      const results = Array.from({ length: 20 }, () => [a.next(), b.next()])
      // At least some values must differ (near-impossible to all match)
      const allMatch = results.every(([x, y]) => x === y)
      expect(allMatch).toBe(false)
    })
  })

  describe('next()', () => {
    it('always returns values in [0, 1)', () => {
      const rng = new SeededRandom(999)
      for (let i = 0; i < 10000; i++) {
        const v = rng.next()
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThan(1)
      }
    })
  })

  describe('nextInt(min, max)', () => {
    it('always returns values within [min, max] inclusive', () => {
      const rng = new SeededRandom(7)
      for (let i = 0; i < 10000; i++) {
        const v = rng.nextInt(3, 9)
        expect(v).toBeGreaterThanOrEqual(3)
        expect(v).toBeLessThanOrEqual(9)
      }
    })

    it('returns integers only', () => {
      const rng = new SeededRandom(13)
      for (let i = 0; i < 1000; i++) {
        expect(Number.isInteger(rng.nextInt(0, 100))).toBe(true)
      }
    })

    it('covers all values in range across 10000 samples', () => {
      const rng = new SeededRandom(21)
      const counts = {}
      for (let i = 0; i < 10000; i++) {
        const v = rng.nextInt(1, 6)
        counts[v] = (counts[v] ?? 0) + 1
      }
      // Every value from 1 to 6 must appear
      for (let v = 1; v <= 6; v++) {
        expect(counts[v]).toBeGreaterThan(0)
      }
    })

    it('works when min === max', () => {
      const rng = new SeededRandom(5)
      for (let i = 0; i < 100; i++) {
        expect(rng.nextInt(4, 4)).toBe(4)
      }
    })
  })

  describe('nextFloat(min, max)', () => {
    it('always returns values in [min, max)', () => {
      const rng = new SeededRandom(8)
      for (let i = 0; i < 10000; i++) {
        const v = rng.nextFloat(1.5, 2.5)
        expect(v).toBeGreaterThanOrEqual(1.5)
        expect(v).toBeLessThan(2.5)
      }
    })
  })

  describe('pick(array)', () => {
    it('always returns an element that exists in the array', () => {
      const rng = new SeededRandom(3)
      const arr = ['red', 'blue', 'green', 'yellow']
      for (let i = 0; i < 1000; i++) {
        expect(arr).toContain(rng.pick(arr))
      }
    })

    it('is deterministic with same seed', () => {
      const arr = [10, 20, 30, 40, 50]
      const a = new SeededRandom(77)
      const b = new SeededRandom(77)
      for (let i = 0; i < 50; i++) {
        expect(a.pick(arr)).toBe(b.pick(arr))
      }
    })
  })

  describe('shuffle(array)', () => {
    it('returns a new array (does not mutate original)', () => {
      const rng = new SeededRandom(6)
      const original = [1, 2, 3, 4, 5]
      const frozen = [...original]
      rng.shuffle(original)
      expect(original).toEqual(frozen)
    })

    it('preserves all elements (same elements, possibly different order)', () => {
      const rng = new SeededRandom(6)
      const original = [1, 2, 3, 4, 5, 6, 7, 8]
      const shuffled = rng.shuffle(original)
      expect(shuffled.length).toBe(original.length)
      expect([...shuffled].sort((a, b) => a - b)).toEqual([...original].sort((a, b) => a - b))
    })

    it('produces different orderings across different seeds', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      const results = new Set()
      for (let seed = 0; seed < 20; seed++) {
        results.add(new SeededRandom(seed).shuffle(arr).join(','))
      }
      // Very unlikely all 20 seeds produce the same ordering
      expect(results.size).toBeGreaterThan(1)
    })

    it('is deterministic with same seed', () => {
      const arr = ['a', 'b', 'c', 'd', 'e']
      const a = new SeededRandom(99)
      const b = new SeededRandom(99)
      expect(a.shuffle(arr)).toEqual(b.shuffle(arr))
    })
  })

  describe('weightedPick(options)', () => {
    it('only returns values that exist in options', () => {
      const rng = new SeededRandom(11)
      const options = [
        { value: 'A', weight: 1 },
        { value: 'B', weight: 2 },
        { value: 'C', weight: 7 },
      ]
      const valid = new Set(options.map(o => o.value))
      for (let i = 0; i < 1000; i++) {
        expect(valid.has(rng.weightedPick(options))).toBe(true)
      }
    })

    it('respects weight distribution within 5% tolerance over 10000 samples', () => {
      const rng = new SeededRandom(42)
      const options = [
        { value: 'A', weight: 1 },  // expected ~10%
        { value: 'B', weight: 2 },  // expected ~20%
        { value: 'C', weight: 7 },  // expected ~70%
      ]
      const counts = { A: 0, B: 0, C: 0 }
      const N = 10000
      for (let i = 0; i < N; i++) {
        counts[rng.weightedPick(options)]++
      }
      expect(counts.A / N).toBeCloseTo(0.10, 1) // within ~5%
      expect(counts.B / N).toBeCloseTo(0.20, 1)
      expect(counts.C / N).toBeCloseTo(0.70, 1)
    })

    it('works with a single option', () => {
      const rng = new SeededRandom(1)
      const options = [{ value: 'only', weight: 1 }]
      for (let i = 0; i < 100; i++) {
        expect(rng.weightedPick(options)).toBe('only')
      }
    })

    it('is deterministic with same seed', () => {
      const options = [
        { value: 'X', weight: 3 },
        { value: 'Y', weight: 7 },
      ]
      const a = new SeededRandom(55)
      const b = new SeededRandom(55)
      for (let i = 0; i < 100; i++) {
        expect(a.weightedPick(options)).toBe(b.weightedPick(options))
      }
    })
  })
})
