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

// ─── FR-4: no car HP exceeds 2.5× highest shooter damage ────────────────────

describe('FR-4 — no car HP exceeds 2.5× max shooter damage', () => {
  it('passes when HP is exactly at the cap (2.5× damage = 10 for damage 4)', () => {
    const state = makeState({ topDamages: [4, 4, 4, 4] })
    const car   = makeCar({ hp: 10 }) // 4 × 2.5 = 10 exactly
    const result = arbiter.checkCar(car, state)
    expect(result.fixed).toBe(false)
    expect(car.hp).toBe(10)
  })

  it('passes when HP is below the cap', () => {
    const state = makeState({ topDamages: [8, 8, 8, 8] })
    const car   = makeCar({ hp: 10 }) // cap = 20
    expect(arbiter.checkCar(car, state).fixed).toBe(false)
  })

  it('fixes when HP exceeds 2.5× max damage', () => {
    const state = makeState({ topDamages: [4, 4, 4, 4] }) // max=4, cap=10
    const car   = makeCar({ hp: 18 })
    const result = arbiter.checkCar(car, state)
    expect(result.fixed).toBe(true)
    const fix = result.fixes.find(f => f.rule === 'FR-4')
    expect(fix).toBeDefined()
    expect(car.hp).toBe(10)
    expect(car.maxHp).toBe(10)
  })

  it('uses the globally highest shooter damage (not just top)', () => {
    // Column 0 top is damage 2, but column 0 also has a damage-8 shooter deeper down.
    const state = makeState()
    const deepCol = new Column({ id: 0 })
    deepCol.pushBottom(makeShooter({ color: 'Blue', damage: 2, column: 0 }))
    deepCol.pushBottom(makeShooter({ color: 'Blue', damage: 8, column: 0 }))
    state.columns[0] = deepCol
    // cap = floor(2.5 × 8) = 20
    const car = makeCar({ hp: 20 })
    expect(arbiter.checkCar(car, state).fixed).toBe(false)
  })

  it('capped HP never goes below HP_MINIMUM (2)', () => {
    // damage=2, cap=floor(2.5×2)=5; HP=5 is above min so just caps to 5
    const state = makeState({ topDamages: [2, 2, 2, 2] })
    const car   = makeCar({ hp: 20 })
    arbiter.checkCar(car, state)
    expect(car.hp).toBeGreaterThanOrEqual(2)
  })

  it('also updates maxHp to match the fixed hp', () => {
    const state = makeState({ topDamages: [4, 4, 4, 4] })
    const car   = makeCar({ hp: 20 })
    arbiter.checkCar(car, state)
    expect(car.maxHp).toBe(car.hp)
  })

  it('records original and corrected values', () => {
    const state = makeState({ topDamages: [4, 4, 4, 4] }) // cap=10
    const car   = makeCar({ hp: 20 })
    const result = arbiter.checkCar(car, state)
    const fix = result.fixes.find(f => f.rule === 'FR-4')
    expect(fix.original).toBe(20)
    expect(fix.corrected).toBe(10)
  })

  it('skips check when no shooters exist (max damage = 0)', () => {
    const state = {
      lanes: [laneWith('Red')],
      columns: [emptyCol(0), emptyCol(1), emptyCol(2), emptyCol(3)],
      colorPalette: ['Red', 'Blue'],
    }
    const car = makeCar({ hp: 999 })
    expect(arbiter.checkCar(car, state).fixed).toBe(false)
  })
})

// ─── FR-1: at least 1 top shooter color-matches a front car ──────────────────

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

// ─── FR-3: average shooter damage ≥ 50% of average front car HP ──────────────

describe('FR-3 — average shooter damage ≥ 50% of average front car HP', () => {
  it('passes when ratio is exactly satisfied', () => {
    // avgHp=10, required avgDamage=5; all top shooters damage=5
    const state = makeState({
      laneColors: ['Red', 'Red', 'Red', 'Red'], laneHps: [10, 10, 10, 10],
      topColors:  ['Red', 'Red', 'Red', 'Red'], topDamages: [5, 5, 5, 5],
    })
    const shooter = makeShooter({ color: 'Blue', damage: 5, column: 0 })
    expect(arbiter.checkShooter(shooter, state).fixed).toBe(false)
  })

  it('passes when average damage exceeds the threshold', () => {
    const state = makeState({
      laneHps: [10, 10, 10, 10], topDamages: [8, 8, 8, 8],
    })
    const shooter = makeShooter({ damage: 8, column: 0 })
    expect(arbiter.checkShooter(shooter, state).fixed).toBe(false)
  })

  it('fixes when candidate damage is too low', () => {
    // avgHp=20, required avgDamage=10; other 3 tops are damage=4 (avg would be 4)
    const state = makeState({
      laneHps: [20, 20, 20, 20], topDamages: [4, 4, 4, 4],
    })
    const shooter = makeShooter({ damage: 2, column: 0 })
    const result  = arbiter.checkShooter(shooter, state)
    expect(result.fixed).toBe(true)
    const fix = result.fixes.find(f => f.rule === 'FR-3')
    expect(fix).toBeDefined()
    expect(shooter.damage).toBeGreaterThan(2)
  })

  it('sets damage to the minimum needed to satisfy the ratio', () => {
    // avgHp=8, required=4; other tops = [4,4,4], count=4
    // required*4 - 12 = 16 - 12 = 4 → min candidate damage = 4
    const state = makeState({
      laneHps: [8, 8, 8, 8], topDamages: [4, 4, 4, 4],
    })
    const shooter = makeShooter({ damage: 2, column: 0 })
    arbiter.checkShooter(shooter, state)
    // After fix: (shooter.damage + 4+4+4)/4 >= 4
    const topRow = [shooter.damage, 4, 4, 4]
    const avg = topRow.reduce((a, b) => a + b) / topRow.length
    expect(avg).toBeGreaterThanOrEqual(4)
  })

  it('caps fixed damage at 8 when impossible to fully fix', () => {
    // avgHp=20, required=10; other tops=[2,2,2]; min=(10*4-6)=34 → clamped to 8
    const state = makeState({
      laneHps: [20, 20, 20, 20], topDamages: [2, 2, 2, 2],
    })
    const shooter = makeShooter({ damage: 2, column: 0 })
    arbiter.checkShooter(shooter, state)
    expect(shooter.damage).toBe(8)
  })

  it('does not lower damage that already satisfies the rule', () => {
    const state = makeState({ laneHps: [4, 4, 4, 4], topDamages: [8, 8, 8, 8] })
    const shooter = makeShooter({ damage: 8, column: 0 })
    arbiter.checkShooter(shooter, state)
    expect(shooter.damage).toBe(8)
  })

  it('trivially passes when no front cars exist', () => {
    // Use distinct column colors so FR-5 stays clean while we focus on FR-3.
    const state = {
      lanes:       [emptyLane(0), emptyLane(1), emptyLane(2), emptyLane(3)],
      columns:     [colWith('Red', 2, 0), colWith('Blue', 2, 1),
                    colWith('Green', 2, 2), colWith('Yellow', 2, 3)],
      colorPalette: ['Red', 'Blue', 'Green', 'Yellow'],
    }
    const shooter = makeShooter({ color: 'Red', damage: 2, column: 0 })
    expect(arbiter.checkShooter(shooter, state).fixed).toBe(false)
  })

  it('records original and corrected damage values', () => {
    const state = makeState({ laneHps: [20, 20, 20, 20], topDamages: [4, 4, 4, 4] })
    const shooter = makeShooter({ damage: 2, column: 0 })
    const result  = arbiter.checkShooter(shooter, state)
    const fix = result.fixes.find(f => f.rule === 'FR-3')
    expect(fix.original).toBe(2)
    expect(fix.corrected).toBe(shooter.damage)
    expect(fix.corrected).toBeGreaterThan(2)
  })
})

// ─── FR-5: at least 2 distinct colors in the top shooter row ─────────────────

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
  it('checkCar fixes FR-2 and FR-4 in the same call', () => {
    // 4 Red front cars (FR-2) + HP 20 with max shooter damage 4 (FR-4 cap=10)
    const state = makeState({
      laneColors: ['Red', 'Red', 'Red', 'Red'],
      topDamages: [4, 4, 4, 4],
    })
    const car    = makeCar({ color: 'Red', hp: 20 })
    const result = arbiter.checkCar(car, state)
    expect(result.fixed).toBe(true)
    const rules = result.fixes.map(f => f.rule)
    expect(rules).toContain('FR-2')
    expect(rules).toContain('FR-4')
    expect(car.color).not.toBe('Red')
    expect(car.hp).toBe(10)
  })

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

  it('after FR-4 fix: car HP ≤ 2.5× max shooter damage', () => {
    const state = makeState({ topDamages: [4, 4, 4, 4] })
    const car   = makeCar({ hp: 99 })
    arbiter.checkCar(car, state)
    expect(car.hp).toBeLessThanOrEqual(4 * 2.5)
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
