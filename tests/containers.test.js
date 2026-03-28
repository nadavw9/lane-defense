import { describe, it, expect } from 'vitest'
import { Lane } from '../src/models/Lane.js'
import { Column } from '../src/models/Column.js'
import { Car } from '../src/models/Car.js'
import { Shooter } from '../src/models/Shooter.js'

function makeCar(overrides = {}) {
  return new Car({ color: 'red', hp: 10, speed: 5, ...overrides })
}

function makeShooter(overrides = {}) {
  return new Shooter({ color: 'red', damage: 4, column: 0, ...overrides })
}

function makeLane(overrides = {}) {
  return new Lane({ id: 0, ...overrides })
}

// ─── Lane ────────────────────────────────────────────────────────────────────

describe('Lane', () => {
  describe('construction', () => {
    it('sets id and defaults personality to "standard"', () => {
      const lane = makeLane({ id: 2 })
      expect(lane.id).toBe(2)
      expect(lane.personality).toBe('standard')
      expect(lane.cars).toEqual([])
    })

    it('accepts a custom personality', () => {
      const lane = new Lane({ id: 0, personality: 'aggressive' })
      expect(lane.personality).toBe('aggressive')
    })
  })

  describe('addCar(car)', () => {
    it('adds a car to the lane', () => {
      const lane = makeLane()
      lane.addCar(makeCar())
      expect(lane.cars.length).toBe(1)
    })

    it('keeps cars sorted by position descending (most advanced at index 0)', () => {
      const lane = makeLane()
      const slow = makeCar({ speed: 3 })
      const fast = makeCar({ speed: 7 })
      slow.position = 10
      fast.position = 40
      lane.addCar(slow)
      lane.addCar(fast)
      expect(lane.cars[0]).toBe(fast)
      expect(lane.cars[1]).toBe(slow)
    })
  })

  describe('frontCar()', () => {
    it('returns null when empty', () => {
      expect(makeLane().frontCar()).toBeNull()
    })

    it('returns the car with the highest position', () => {
      const lane = makeLane()
      const a = makeCar(); a.position = 20
      const b = makeCar(); b.position = 50
      lane.addCar(a)
      lane.addCar(b)
      expect(lane.frontCar()).toBe(b)
    })
  })

  describe('removeFrontCar()', () => {
    it('removes the most advanced car', () => {
      const lane = makeLane()
      const a = makeCar(); a.position = 10
      const b = makeCar(); b.position = 30
      lane.addCar(a)
      lane.addCar(b)
      lane.removeFrontCar()
      expect(lane.cars.length).toBe(1)
      expect(lane.frontCar()).toBe(a)
    })

    it('leaves an empty array when last car is removed', () => {
      const lane = makeLane()
      lane.addCar(makeCar())
      lane.removeFrontCar()
      expect(lane.cars).toEqual([])
    })
  })

  describe('isBreached()', () => {
    it('returns false when no cars are at position >= 100', () => {
      const lane = makeLane()
      const car = makeCar(); car.position = 99
      lane.addCar(car)
      expect(lane.isBreached()).toBe(false)
    })

    it('returns true when a car reaches position 100', () => {
      const lane = makeLane()
      const car = makeCar(); car.position = 100
      lane.addCar(car)
      expect(lane.isBreached()).toBe(true)
    })

    it('returns true when a car exceeds position 100', () => {
      const lane = makeLane()
      const car = makeCar(); car.position = 110
      lane.addCar(car)
      expect(lane.isBreached()).toBe(true)
    })

    it('returns false on empty lane', () => {
      expect(makeLane().isBreached()).toBe(false)
    })
  })

  describe('mostAdvancedCar()', () => {
    it('returns null when empty', () => {
      expect(makeLane().mostAdvancedCar()).toBeNull()
    })

    it('returns the car with the highest position', () => {
      const lane = makeLane()
      const a = makeCar(); a.position = 5
      const b = makeCar(); b.position = 80
      const c = makeCar(); c.position = 40
      lane.addCar(a); lane.addCar(b); lane.addCar(c)
      expect(lane.mostAdvancedCar()).toBe(b)
    })
  })

  describe('advance(deltaTime)', () => {
    it('moves a single car by speed * deltaTime', () => {
      const lane = makeLane()
      const car = makeCar({ speed: 5 })
      lane.addCar(car)
      lane.advance(2)
      expect(car.position).toBeCloseTo(10)
    })

    it('moves multiple cars forward', () => {
      const lane = makeLane()
      const a = makeCar({ speed: 5 }); a.position = 0
      const b = makeCar({ speed: 3 }); b.position = 20
      lane.addCar(a); lane.addCar(b)
      lane.advance(1)
      // b was ahead; a moved 5, b moved 3 → b at 23, a at 5 — no overlap
      expect(b.position).toBeCloseTo(23)
      expect(a.position).toBeCloseTo(5)
    })

    it('enforces 8-unit gap when a faster car would catch a slower one', () => {
      const lane = makeLane()
      const front = makeCar({ speed: 1 }); front.position = 20
      const back  = makeCar({ speed: 9 }); back.position = 10
      lane.addCar(front); lane.addCar(back)
      // After 2s: front→22, back would be 28 — but must stay at 22-8=14
      lane.advance(2)
      expect(front.position).toBeCloseTo(22)
      expect(back.position).toBeCloseTo(14)
    })

    it('gap is exactly 8 units when follower is bumper-to-bumper', () => {
      const lane = makeLane()
      const front = makeCar({ speed: 1 }); front.position = 50
      const back  = makeCar({ speed: 9 }); back.position = 42
      lane.addCar(front); lane.addCar(back)
      lane.advance(1)
      // front→51, back would be 51 — capped at 51-8=43
      expect(front.position - back.position).toBeGreaterThanOrEqual(8)
    })

    it('gap constraint propagates through a chain of 3 cars', () => {
      const lane = makeLane()
      const c1 = makeCar({ speed: 1 }); c1.position = 50
      const c2 = makeCar({ speed: 9 }); c2.position = 30
      const c3 = makeCar({ speed: 9 }); c3.position = 10
      lane.addCar(c1); lane.addCar(c2); lane.addCar(c3)
      lane.advance(5)
      // All gaps must be >= 8
      const sorted = [...lane.cars].sort((a, b) => b.position - a.position)
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i - 1].position - sorted[i].position).toBeGreaterThanOrEqual(8)
      }
    })

    it('cars moving at equal speed maintain their existing gap', () => {
      const lane = makeLane()
      const front = makeCar({ speed: 5 }); front.position = 30
      const back  = makeCar({ speed: 5 }); back.position = 10
      lane.addCar(front); lane.addCar(back)
      lane.advance(2)
      // Both move +10, gap stays at 20
      expect(front.position).toBeCloseTo(40)
      expect(back.position).toBeCloseTo(20)
      expect(front.position - back.position).toBeCloseTo(20)
    })
  })
})

// ─── Column ──────────────────────────────────────────────────────────────────

describe('Column', () => {
  describe('construction', () => {
    it('sets id and starts with empty shooters array', () => {
      const col = new Column({ id: 3 })
      expect(col.id).toBe(3)
      expect(col.shooters).toEqual([])
    })
  })

  describe('top()', () => {
    it('returns null when empty', () => {
      expect(new Column({ id: 0 }).top()).toBeNull()
    })

    it('returns the first shooter (index 0)', () => {
      const col = new Column({ id: 0 })
      const s1 = makeShooter({ color: 'red' })
      const s2 = makeShooter({ color: 'blue' })
      col.pushBottom(s1)
      col.pushBottom(s2)
      expect(col.top()).toBe(s1)
    })
  })

  describe('consume()', () => {
    it('removes the top shooter', () => {
      const col = new Column({ id: 0 })
      const s1 = makeShooter({ color: 'red' })
      const s2 = makeShooter({ color: 'blue' })
      col.pushBottom(s1)
      col.pushBottom(s2)
      col.consume()
      expect(col.top()).toBe(s2)
      expect(col.shooters.length).toBe(1)
    })

    it('leaves empty array after consuming last shooter', () => {
      const col = new Column({ id: 0 })
      col.pushBottom(makeShooter())
      col.consume()
      expect(col.shooters).toEqual([])
    })

    it('shifts remaining shooters up after consume', () => {
      const col = new Column({ id: 0 })
      const shooters = ['red', 'blue', 'green'].map(color => makeShooter({ color }))
      shooters.forEach(s => col.pushBottom(s))
      col.consume()
      expect(col.shooters[0].color).toBe('blue')
      expect(col.shooters[1].color).toBe('green')
    })
  })

  describe('pushBottom(shooter)', () => {
    it('appends a shooter to the end', () => {
      const col = new Column({ id: 0 })
      const s1 = makeShooter({ color: 'red' })
      const s2 = makeShooter({ color: 'blue' })
      col.pushBottom(s1)
      col.pushBottom(s2)
      expect(col.shooters[col.shooters.length - 1]).toBe(s2)
    })

    it('does not affect the current top', () => {
      const col = new Column({ id: 0 })
      const s1 = makeShooter({ color: 'red' })
      col.pushBottom(s1)
      col.pushBottom(makeShooter({ color: 'blue' }))
      expect(col.top()).toBe(s1)
    })
  })

  describe('needsRefill()', () => {
    it('returns true when column has fewer than 6 shooters', () => {
      const col = new Column({ id: 0 })
      expect(col.needsRefill()).toBe(true)
      col.pushBottom(makeShooter())
      expect(col.needsRefill()).toBe(true)
    })

    it('returns false when column has exactly 6 shooters', () => {
      const col = new Column({ id: 0 })
      for (let i = 0; i < 6; i++) col.pushBottom(makeShooter())
      expect(col.needsRefill()).toBe(false)
    })

    it('returns true again after consuming from a full column', () => {
      const col = new Column({ id: 0 })
      for (let i = 0; i < 6; i++) col.pushBottom(makeShooter())
      col.consume()
      expect(col.needsRefill()).toBe(true)
    })
  })
})
