import { describe, it, expect } from 'vitest'
import { Car } from '../src/models/Car.js'
import { Shooter } from '../src/models/Shooter.js'

describe('Car', () => {
  function makeCar(overrides = {}) {
    return new Car({ color: 'red', hp: 10, speed: 5, ...overrides })
  }

  describe('construction', () => {
    it('sets all fields correctly', () => {
      const car = makeCar({ color: 'blue', hp: 12, speed: 7, type: 'fast' })
      expect(car.color).toBe('blue')
      expect(car.hp).toBe(12)
      expect(car.maxHp).toBe(12)
      expect(car.speed).toBe(7)
      expect(car.position).toBe(0)
      expect(car.type).toBe('fast')
    })

    it('defaults type to "standard"', () => {
      expect(makeCar().type).toBe('standard')
    })

    it('position starts at 0', () => {
      expect(makeCar().position).toBe(0)
    })

    it('maxHp equals hp at construction', () => {
      const car = makeCar({ hp: 15 })
      expect(car.maxHp).toBe(15)
    })
  })

  describe('takeDamage(amount)', () => {
    it('reduces hp by the given amount', () => {
      const car = makeCar({ hp: 10 })
      car.takeDamage(3)
      expect(car.hp).toBe(7)
    })

    it('does not reduce hp below 0', () => {
      const car = makeCar({ hp: 5 })
      car.takeDamage(100)
      expect(car.hp).toBe(0)
    })

    it('does not change maxHp', () => {
      const car = makeCar({ hp: 10 })
      car.takeDamage(4)
      expect(car.maxHp).toBe(10)
    })

    it('accumulates across multiple hits', () => {
      const car = makeCar({ hp: 10 })
      car.takeDamage(3)
      car.takeDamage(3)
      expect(car.hp).toBe(4)
    })

    it('accepts 0 damage without changing hp', () => {
      const car = makeCar({ hp: 10 })
      car.takeDamage(0)
      expect(car.hp).toBe(10)
    })
  })

  describe('isDead()', () => {
    it('returns false when hp > 0', () => {
      expect(makeCar({ hp: 1 }).isDead()).toBe(false)
    })

    it('returns true when hp reaches 0', () => {
      const car = makeCar({ hp: 5 })
      car.takeDamage(5)
      expect(car.isDead()).toBe(true)
    })

    it('returns true when damage exceeds hp', () => {
      const car = makeCar({ hp: 5 })
      car.takeDamage(99)
      expect(car.isDead()).toBe(true)
    })
  })

  describe('distanceRatio()', () => {
    it('returns 0 at start', () => {
      expect(makeCar().distanceRatio()).toBe(0)
    })

    it('returns 0.5 at position 50', () => {
      const car = makeCar()
      car.position = 50
      expect(car.distanceRatio()).toBe(0.5)
    })

    it('returns 1 at position 100 (breach)', () => {
      const car = makeCar()
      car.position = 100
      expect(car.distanceRatio()).toBe(1)
    })

    it('returns correct ratio at arbitrary position', () => {
      const car = makeCar()
      car.position = 37
      expect(car.distanceRatio()).toBeCloseTo(0.37)
    })
  })
})

describe('Shooter', () => {
  function makeShooter(overrides = {}) {
    return new Shooter({ color: 'green', damage: 4, column: 0, ...overrides })
  }

  describe('construction', () => {
    it('sets color, damage, and column', () => {
      const s = makeShooter({ color: 'purple', damage: 6, column: 3 })
      expect(s.color).toBe('purple')
      expect(s.damage).toBe(6)
      expect(s.column).toBe(3)
    })
  })

  describe('fireDuration derived from damage', () => {
    const table = [
      [2, 1.5],
      [3, 1.7],
      [4, 1.9],
      [5, 2.0],
      [6, 2.2],
      [7, 2.3],
      [8, 2.5],
    ]

    for (const [damage, expectedDuration] of table) {
      it(`damage ${damage} → fireDuration ${expectedDuration}s`, () => {
        const s = makeShooter({ damage })
        expect(s.fireDuration).toBe(expectedDuration)
      })
    }
  })

  describe('fireDuration range', () => {
    it('minimum damage (2) gives shortest fire duration (1.5s)', () => {
      expect(makeShooter({ damage: 2 }).fireDuration).toBe(1.5)
    })

    it('maximum damage (8) gives longest fire duration (2.5s)', () => {
      expect(makeShooter({ damage: 8 }).fireDuration).toBe(2.5)
    })

    it('all fire durations fall within 1.5–2.5s', () => {
      for (let d = 2; d <= 8; d++) {
        const { fireDuration } = makeShooter({ damage: d })
        expect(fireDuration).toBeGreaterThanOrEqual(1.5)
        expect(fireDuration).toBeLessThanOrEqual(2.5)
      }
    })
  })
})
