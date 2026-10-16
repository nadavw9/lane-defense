import { describe, it, expect } from 'vitest'
import { FairnessArbiter } from '../src/director/FairnessArbiter.js'
import { Car }     from '../src/models/Car.js'
import { Shooter } from '../src/models/Shooter.js'
import { Lane }    from '../src/models/Lane.js'
import { Column }  from '../src/models/Column.js'

// ─── Factories ────────────────────────────────────────────────────────────────

function makeCar({ color = 'Red', hp = 10, speed = 5 } = {}) {
  return new Car({ color, hp, speed })
}

function makeShooter({ color = 'Red', damage = 4, column = 0 } = {}) {
  return new Shooter({ color, damage, column })
}

// Lane with one front car at an advanced position.
function laneWith(color, hp = 10) {
  const lane = new Lane({ id: 0 })
  const car = makeCar({ color, hp })
  car.position = 50
  lane.addCar(car)
  return lane
}

// Column with one shooter as its top.
function colWith(color, damage, colId = 0) {
  const col = new Column({ id: colId })
  col.pushBottom(makeShooter({ color, damage, column: colId }))
  return col
}

function emptyCol(id) { return new Column({ id }) }
function emptyLane(id) { return new Lane({ id }) }

// Four-lane, four-column game state (easily customisable).
// Defaults are "clean": no rule fires unless the test deliberately breaks one.
// • laneColors all different  → FR-2 safe (≤1 of each colour among front cars)
// • laneHps=8, topDamages=4  → avgDamage(4) == 0.5*avgHp(8) → FR-3 exactly satisfied
// • topColors all different   → FR-5 safe; each matches its lane → FR-1 safe
// • car default hp=10 ≤ 2.5*4=10 cap → FR-4 safe
function makeState({
  laneColors   = ['Red', 'Blue', 'Green', 'Yellow'],
  laneHps      = [8, 8, 8, 8],
  topColors    = ['Red', 'Blue', 'Green', 'Yellow'],
  topDamages   = [4, 4, 4, 4],
  colorPalette = ['Red', 'Blue', 'Green', 'Yellow'],
} = {}) {
  const lanes   = laneColors.map((c, i) => laneWith(c, laneHps[i]))
  const columns = topColors.map((c, i) => colWith(c, topDamages[i], i))
  return { lanes, columns, colorPalette }
}

const arbiter = new FairnessArbiter()

// ─── FR-2: at most 3 front cars share a color ────────────────────────────────

describe('FR-2 — at most 3 front cars share a color', () => {
  it('passes when only 2 front cars share the car color', () => {
    const state = makeState({ laneColors: ['Red', 'Red', 'Blue', 'Green'] })
    const car   = makeCar({ color: 'Red' })
    const result = arbiter.checkCar(car, state)
    expect(result.fixed).toBe(false)
    expect(car.color).toBe('Red')
  })

  it('passes when exactly 3 front cars share the color (limit is 3, car would be 4th)', () => {
    // 3 existing Red front cars + this Red car = 4 total → should fix
    const state = makeState({ laneColors: ['Red', 'Red', 'Red', 'Blue'] })
    const car   = makeCar({ color: 'Red' })
    const result = arbiter.checkCar(car, state)
    expect(result.fixed).toBe(true)
    const fix = result.fixes.find(f => f.rule === 'FR-2')
    expect(fix).toBeDefined()
    expect(fix.original).toBe('Red')
    expect(car.color).not.toBe('Red')
  })

  it('fixes when all 4 front cars would be the same color', () => {
    const state = makeState({ laneColors: ['Red', 'Red', 'Red', 'Red'] })
    const car   = makeCar({ color: 'Red' })
    arbiter.checkCar(car, state)
    expect(car.color).not.toBe('Red')
  })

  it('chooses the palette color with fewest existing front cars', () => {
    // Blue has 0 front cars, Green has 0 — either is valid; just not Red
    const state = makeState({ laneColors: ['Red', 'Red', 'Red', 'Red'] })
    const car   = makeCar({ color: 'Red' })
    arbiter.checkCar(car, state)
    expect(['Blue', 'Green', 'Yellow']).toContain(car.color)
  })

  it('corrected color satisfies FR-2 (at most 3 matching front cars)', () => {
    const state = makeState({ laneColors: ['Red', 'Red', 'Red', 'Blue'] })
    const car   = makeCar({ color: 'Red' })
    arbiter.checkCar(car, state)
    const frontColors = state.lanes.map(l => l.frontCar()?.color).filter(Boolean)
    const count = frontColors.filter(c => c === car.color).length
    expect(count).toBeLessThan(3) // after fix, fewer than 3 existing match
  })

  it('records original and corrected values', () => {
    const state = makeState({ laneColors: ['Red', 'Red', 'Red', 'Red'] })
    const car   = makeCar({ color: 'Red' })
    const result = arbiter.checkCar(car, state)
    const fix = result.fixes.find(f => f.rule === 'FR-2')
    expect(fix.original).toBe('Red')
    expect(fix.corrected).toBe(car.color)
    expect(fix.corrected).not.toBe('Red')
  })

  it('passes when front cars are spread across colors', () => {
    const state = makeState({ laneColors: ['Red', 'Blue', 'Green', 'Yellow'] })
    const car   = makeCar({ color: 'Red' })
    const result = arbiter.checkCar(car, state)
    expect(result.fixed).toBe(false)
  })
})


describe('FR-1 — at least 1 top shooter must match a front car color', () => {
  it('passes when the candidate shooter matches a front car', () => {
    const state = makeState({
      laneColors: ['Red', 'Blue', 'Green', 'Yellow'],
      topColors:  ['Blue', 'Blue', 'Blue', 'Blue'],
    })
    const shooter = makeShooter({ color: 'Red', column: 0 })
    expect(arbiter.checkShooter(shooter, state).fixed).toBe(false)
  })

  it('passes when another column top already matches a front car', () => {
    const state = makeState({
      laneColors: ['Red', 'Blue', 'Green', 'Yellow'],
      topColors:  ['Red', 'Blue', 'Green', 'Yellow'],
    })
    const shooter = makeShooter({ color: 'Purple', column: 0 })
    // column 1 top is Blue which matches lane 1 front — rule satisfied even with Purple
    expect(arbiter.checkShooter(shooter, state).fixed).toBe(false)
  })

  it('fixes when no top shooter matches any front car', () => {
    const state = makeState({
      laneColors: ['Red', 'Red', 'Red', 'Red'],
      topColors:  ['Blue', 'Blue', 'Blue', 'Blue'],
    })
    const shooter = makeShooter({ color: 'Blue', column: 0 })
    const result  = arbiter.checkShooter(shooter, state)
    expect(result.fixed).toBe(true)
    const fix = result.fixes.find(f => f.rule === 'FR-1')
    expect(fix).toBeDefined()
    expect(shooter.color).toBe('Red')
  })

  it('fixes when front cars are Green and all top shooters are Red', () => {
    const state = makeState({
      laneColors: ['Green', 'Green', 'Green', 'Green'],
      topColors:  ['Red', 'Red', 'Red', 'Red'],
    })
    const shooter = makeShooter({ color: 'Red', column: 0 })
    arbiter.checkShooter(shooter, state)
    expect(shooter.color).toBe('Green')
  })

  it('trivially passes when no lanes have front cars', () => {
    const state = {
      lanes:       [emptyLane(0), emptyLane(1), emptyLane(2), emptyLane(3)],
      columns:     [colWith('Blue', 4, 0), colWith('Blue', 4, 1),
                    colWith('Blue', 4, 2), colWith('Blue', 4, 3)],
      colorPalette: ['Red', 'Blue'],
    }
    const shooter = makeShooter({ color: 'Purple', column: 0 })
    expect(arbiter.checkShooter(shooter, state).fixed).toBe(false)
  })

  it('records original and corrected values', () => {
    const state = makeState({
      laneColors: ['Green', 'Green', 'Green', 'Green'],
      topColors:  ['Red',   'Red',   'Red',   'Red'],
    })
    const shooter = makeShooter({ color: 'Red', column: 0 })
    const result  = arbiter.checkShooter(shooter, state)
    const fix = result.fixes.find(f => f.rule === 'FR-1')
    expect(fix.original).toBe('Red')
    expect(fix.corrected).toBe('Green')
  })
})


describe('FR-5 — at least 2 distinct colors in the top shooter row', () => {
  it('passes when top row already has 2 distinct colors', () => {
    const state = makeState({
      laneColors: ['Red', 'Blue', 'Red', 'Blue'],
      topColors:  ['Blue', 'Red', 'Blue', 'Red'],
    })
    const shooter = makeShooter({ color: 'Blue', column: 0 })
    expect(arbiter.checkShooter(shooter, state).fixed).toBe(false)
  })

  it('passes when top row has 3+ distinct colors', () => {
    const state = makeState({
      laneColors: ['Red', 'Blue', 'Green', 'Yellow'],
      topColors:  ['Red', 'Blue', 'Green', 'Yellow'],
    })
    const shooter = makeShooter({ color: 'Red', column: 0 })
    expect(arbiter.checkShooter(shooter, state).fixed).toBe(false)
  })

  it('fixes when all top shooters would be same color', () => {
    const state = makeState({
      laneColors: ['Red', 'Blue', 'Green', 'Yellow'],
      topColors:  ['Red', 'Red', 'Red', 'Red'],
    })
    const shooter = makeShooter({ color: 'Red', column: 0 })
    const result  = arbiter.checkShooter(shooter, state)
    expect(result.fixed).toBe(true)
    const fix = result.fixes.find(f => f.rule === 'FR-5')
    expect(fix).toBeDefined()
    expect(shooter.color).not.toBe('Red')
  })

  it('fixed color is different from the other top shooters color', () => {
    const state = makeState({
      topColors: ['Blue', 'Blue', 'Blue', 'Blue'],
    })
    const shooter = makeShooter({ color: 'Blue', column: 0 })
    arbiter.checkShooter(shooter, state)
    expect(shooter.color).not.toBe('Blue')
  })

  it('prefers a color that matches a front car (preserves FR-1)', () => {
    // Front cars include 'Green'; other top shooters are all 'Blue'.
    // FR-5 fix should pick 'Green' so FR-1 is also satisfied.
    const state = makeState({
      laneColors: ['Green', 'Green', 'Green', 'Green'],
      topColors:  ['Blue',  'Blue',  'Blue',  'Blue'],
      colorPalette: ['Red', 'Blue', 'Green', 'Yellow'],
    })
    const shooter = makeShooter({ color: 'Blue', column: 0 })
    arbiter.checkShooter(shooter, state)
    expect(shooter.color).toBe('Green')
  })

  it('skips when only 1 top shooter exists (cannot have 2 colors)', () => {
    const state = {
      lanes:  [laneWith('Red')],
      columns: [emptyCol(0), emptyCol(1), emptyCol(2), emptyCol(3)],
      colorPalette: ['Red', 'Blue'],
    }
    const shooter = makeShooter({ color: 'Red', column: 0 })
    const result  = arbiter.checkShooter(shooter, state)
    const fix = result.fixes?.find(f => f.rule === 'FR-5')
    expect(fix).toBeUndefined()
  })

  it('records original and corrected color values', () => {
    const state = makeState({
      laneColors: ['Red', 'Blue', 'Red', 'Blue'],
      topColors:  ['Red', 'Red', 'Red', 'Red'],
    })
    const shooter = makeShooter({ color: 'Red', column: 0 })
    const result  = arbiter.checkShooter(shooter, state)
    const fix = result.fixes.find(f => f.rule === 'FR-5')
    expect(fix.original).toBe('Red')
    expect(fix.corrected).not.toBe('Red')
    expect(fix.corrected).toBe(shooter.color)
  })
})

// ─── No violations ────────────────────────────────────────────────────────────

describe('No violations — passes through unchanged', () => {
  it('checkCar returns fixed:false when no rules are violated', () => {
    const state = makeState()
    const car   = makeCar({ color: 'Green', hp: 8 })
    expect(arbiter.checkCar(car, state).fixed).toBe(false)
  })

  it('checkShooter returns fixed:false when no rules are violated', () => {
    // Front cars: Red, Blue, Green, Yellow — top row includes Red (candidate)
    const state = makeState({
      laneColors: ['Red', 'Blue', 'Green', 'Yellow'],
      topColors:  ['Blue', 'Green', 'Yellow', 'Red'],
      topDamages: [5, 5, 5, 5],
      laneHps:    [8, 8, 8, 8],
    })
    const shooter = makeShooter({ color: 'Red', damage: 5, column: 0 })
    expect(arbiter.checkShooter(shooter, state).fixed).toBe(false)
  })
})

// ─── Multiple violations ──────────────────────────────────────────────────────

describe('Multiple simultaneous violations', () => {
  it('checkShooter can fix FR-1 and FR-5 together', () => {
    // Front cars: all Green. Other tops: all Red. Candidate: Red.
    // FR-1 violated (no match with Green). All tops Red (FR-5 violated if we stay Red).
    const state = makeState({
      laneColors: ['Green', 'Green', 'Green', 'Green'],
      topColors:  ['Red',   'Red',   'Red',   'Red'],
    })
    const shooter = makeShooter({ color: 'Red', column: 0 })
    const result  = arbiter.checkShooter(shooter, state)
    expect(result.fixed).toBe(true)
    // After fix: color should match a front car (Green) to satisfy FR-1
    expect(shooter.color).toBe('Green')
    // And top row now has Green + Red (other 3 columns), satisfying FR-5
  })
})

// ─── Post-fix rule satisfaction ───────────────────────────────────────────────

describe('Post-fix invariant checks', () => {
  it('after FR-2 fix: corrected car color appears ≤ 3 times among front cars', () => {
    const state = makeState({ laneColors: ['Red', 'Red', 'Red', 'Red'] })
    const car   = makeCar({ color: 'Red' })
    arbiter.checkCar(car, state)
    const frontColors = state.lanes.map(l => l.frontCar()?.color).filter(Boolean)
    expect(frontColors.filter(c => c === car.color).length).toBeLessThanOrEqual(3)
  })

  it('after FR-1 fix: the top row contains a color matching a front car', () => {
    const state = makeState({
      laneColors: ['Yellow', 'Yellow', 'Yellow', 'Yellow'],
      topColors:  ['Blue',   'Blue',   'Blue',   'Blue'],
    })
    const shooter = makeShooter({ color: 'Blue', column: 0 })
    arbiter.checkShooter(shooter, state)
    // Build the top row the arbiter would see
    const tops = state.columns.map((col, i) => i === 0 ? shooter : col.top()).filter(Boolean)
    const topColors  = tops.map(s => s.color)
    const frontColors = state.lanes.map(l => l.frontCar()?.color).filter(Boolean)
    expect(topColors.some(c => frontColors.includes(c))).toBe(true)
  })

  it('after FR-5 fix: top row has ≥ 2 distinct colors', () => {
    const state = makeState({
      laneColors: ['Red', 'Blue', 'Green', 'Yellow'],
      topColors:  ['Blue', 'Blue', 'Blue', 'Blue'],
    })
    const shooter = makeShooter({ color: 'Blue', column: 0 })
    arbiter.checkShooter(shooter, state)
    const tops = state.columns.map((col, i) => i === 0 ? shooter : col.top()).filter(Boolean)
    const distinct = new Set(tops.map(s => s.color))
    expect(distinct.size).toBeGreaterThanOrEqual(2)
  })
})
