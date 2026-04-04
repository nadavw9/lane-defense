import { describe, it, expect } from 'vitest'
import { CarDirector }   from '../src/director/CarDirector.js'
import { SeededRandom }  from '../src/utils/SeededRandom.js'
import { Lane }          from '../src/models/Lane.js'
import { WORLD_CONFIG, PHASE_CONFIG, HP_MINIMUM, HP_BASE } from '../src/director/DirectorConfig.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDirector(seed = 1) {
  return new CarDirector({}, new SeededRandom(seed))
}

function makeLane(id = 0) {
  return new Lane({ id })
}

const W1 = WORLD_CONFIG[1]  // hpMultiplier:1.0, speed:{base:5,variance:0.5}
const W5 = WORLD_CONFIG[5]  // hpMultiplier:1.7, speed:{base:9,variance:1.0}

const PALETTE   = ['Red', 'Blue', 'Green', 'Yellow']
const CALM_CFG  = PHASE_CONFIG.CALM
const BUILD_CFG = PHASE_CONFIG.BUILD
const CLIMAX_CFG = PHASE_CONFIG.CLIMAX
const PRESSURE_CFG = PHASE_CONFIG.PRESSURE

// ─── generateCar — HP formula ─────────────────────────────────────────────────

describe('generateCar — HP formula', () => {
  it('returns a Car with a color from the palette', () => {
    const d   = makeDirector()
    const car = d.generateCar(makeLane(), 'BUILD', W1, PALETTE)
    expect(PALETTE).toContain(car.color)
  })

  it('HP is always within [HP_MINIMUM, HP_BASE.max] for W1 CALM (many samples)', () => {
    const d = makeDirector(42)
    for (let i = 0; i < 500; i++) {
      const car = d.generateCar(makeLane(), 'CALM', W1, PALETTE)
      expect(car.hp).toBeGreaterThanOrEqual(HP_MINIMUM)
      expect(car.hp).toBeLessThanOrEqual(HP_BASE.max)
    }
  })

  it('HP is always within [HP_MINIMUM, HP_BASE.max] for W5 CLIMAX (many samples)', () => {
    const d = makeDirector(7)
    for (let i = 0; i < 500; i++) {
      const car = d.generateCar(makeLane(), 'CLIMAX', W5, PALETTE)
      expect(car.hp).toBeGreaterThanOrEqual(HP_MINIMUM)
      expect(car.hp).toBeLessThanOrEqual(HP_BASE.max)
    }
  })

  it('maxHp equals hp at construction', () => {
    const car = makeDirector().generateCar(makeLane(), 'PRESSURE', W1, PALETTE)
    expect(car.maxHp).toBe(car.hp)
  })

  it('CLIMAX produces higher average HP than CALM for the same world', () => {
    const SAMPLES = 400
    const avgHp = (phase) => {
      const d = makeDirector(99)
      let sum = 0
      for (let i = 0; i < SAMPLES; i++) sum += d.generateCar(makeLane(), phase, W1, PALETTE).hp
      return sum / SAMPLES
    }
    expect(avgHp('CLIMAX')).toBeGreaterThan(avgHp('CALM'))
  })

  it('W5 produces higher average HP than W1 for the same phase', () => {
    const SAMPLES = 400
    const avgHp = (world) => {
      const d = makeDirector(55)
      let sum = 0
      for (let i = 0; i < SAMPLES; i++) {
        sum += d.generateCar(makeLane(), 'PRESSURE', WORLD_CONFIG[world], PALETTE).hp
      }
      return sum / SAMPLES
    }
    expect(avgHp(5)).toBeGreaterThan(avgHp(1))
  })

  it('formula: average HP is close to BASE_HP × worldMult × phaseMult over many samples', () => {
    // E[variance] = 1.0, so E[HP] ≈ BASE_HP × 1.0 × 1.0 ≈ 7.2 for W1+PRESSURE
    const SAMPLES = 2000
    const d = makeDirector(123)
    let sum = 0
    for (let i = 0; i < SAMPLES; i++) sum += d.generateCar(makeLane(), 'PRESSURE', W1, PALETTE).hp
    const avg = sum / SAMPLES
    // Expected ~7.2; allow ±1.5 for rounding and variance
    expect(avg).toBeGreaterThan(5.7)
    expect(avg).toBeLessThan(8.7)
  })

  it('speed is within worldConfig.speed.base ± variance', () => {
    const d = makeDirector(33)
    for (let i = 0; i < 200; i++) {
      const car = d.generateCar(makeLane(), 'PRESSURE', W1, PALETTE)
      expect(car.speed).toBeGreaterThanOrEqual(W1.speed.base - W1.speed.variance)
      expect(car.speed).toBeLessThan(W1.speed.base + W1.speed.variance)
    }
  })
})

// ─── HP clamping ──────────────────────────────────────────────────────────────

describe('HP clamping', () => {
  it('clamps to HP_MINIMUM (4) when formula would produce less', () => {
    // worldConfig.hpMultiplier = 0.05 forces rawHp ≈ 7.2 × 0.05 × 0.7 ≈ 0.25 → clamped.
    // Carry-over pair cars bypass the formula and can have HP 4–5, so every car is
    // still ≥ HP_MINIMUM.  Normal (formula) cars all land exactly at HP_MINIMUM.
    const tinyWorld = { hpMultiplier: 0.05, speed: { base: 5, variance: 0.5 } }
    const d = makeDirector(1)
    const cars = []
    for (let i = 0; i < 100; i++) {
      const car = d.generateCar(makeLane(), 'CALM', tinyWorld, PALETTE)
      cars.push(car)
      expect(car.hp).toBeGreaterThanOrEqual(HP_MINIMUM)
    }
    // At least the non-carry-over-pair cars should be exactly HP_MINIMUM.
    expect(cars.some(c => c.hp === HP_MINIMUM)).toBe(true)
  })

  it('clamps to HP_BASE.max (20) when formula would exceed it', () => {
    // hpMultiplier = 10 forces rawHp ≈ 7.2 × 10 × 1.2 ≈ 86 → clamped to HP_BASE.max.
    // Carry-over pair cars bypass the formula and have low HP, but no car exceeds max.
    const hugeWorld = { hpMultiplier: 10, speed: { base: 5, variance: 0.5 } }
    const d = makeDirector(1)
    const cars = []
    for (let i = 0; i < 100; i++) {
      const car = d.generateCar(makeLane(), 'CLIMAX', hugeWorld, PALETTE)
      cars.push(car)
      expect(car.hp).toBeLessThanOrEqual(HP_BASE.max)
    }
    // At least the non-carry-over-pair cars should be exactly HP_BASE.max.
    expect(cars.some(c => c.hp === HP_BASE.max)).toBe(true)
  })

  it('HP is always an integer', () => {
    const d = makeDirector(77)
    for (let i = 0; i < 300; i++) {
      expect(Number.isInteger(d.generateCar(makeLane(), 'BUILD', W1, PALETTE).hp)).toBe(true)
    }
  })
})

// ─── assignColor — distribution ───────────────────────────────────────────────

describe('assignColor — color distribution', () => {
  it('with no colorBudget, all palette colors appear over many samples', () => {
    const d = makeDirector(5)
    const counts = {}
    for (let i = 0; i < 2000; i++) {
      const c = d.assignColor(PALETTE, null)
      counts[c] = (counts[c] || 0) + 1
    }
    for (const color of PALETTE) {
      expect(counts[color]).toBeGreaterThan(0)
    }
  })

  it('uniform distribution: each color appears within 5% of 1/N over 2000 samples', () => {
    const d = makeDirector(13)
    const N = PALETTE.length
    const SAMPLES = 2000
    const counts = {}
    for (let i = 0; i < SAMPLES; i++) {
      const c = d.assignColor(PALETTE, null)
      counts[c] = (counts[c] || 0) + 1
    }
    const expected = SAMPLES / N
    for (const color of PALETTE) {
      expect(counts[color] / SAMPLES).toBeCloseTo(1 / N, 1) // within ~5%
    }
  })

  it('weighted colorBudget skews distribution toward heavier color', () => {
    const budget = [
      { value: 'Red',  weight: 8 },
      { value: 'Blue', weight: 2 },
    ]
    const palette = ['Red', 'Blue']
    const d = makeDirector(21)
    let reds = 0
    const SAMPLES = 2000
    for (let i = 0; i < SAMPLES; i++) {
      if (d.assignColor(palette, budget) === 'Red') reds++
    }
    // Expected ~80% Red
    expect(reds / SAMPLES).toBeCloseTo(0.8, 1)
  })

  it('colorBudget entries not in palette are ignored (falls back to uniform)', () => {
    const budget = [{ value: 'Purple', weight: 100 }] // Purple not in palette
    const d = makeDirector(9)
    const results = Array.from({ length: 200 }, () => d.assignColor(['Red', 'Blue'], budget))
    expect(results.every(c => c === 'Red' || c === 'Blue')).toBe(true)
  })

  it('single-color palette always returns that color', () => {
    const d = makeDirector(3)
    for (let i = 0; i < 100; i++) {
      expect(d.assignColor(['Red'], null)).toBe('Red')
    }
  })
})

// ─── generateBatch — no 3+ consecutive same color ────────────────────────────

describe('generateBatch — consecutive color constraint', () => {
  const batchParams = {
    phase:       'PRESSURE',
    worldConfig: W1,
    colorPalette: PALETTE,
  }

  function maxRun(cars) {
    let max = 1, run = 1
    for (let i = 1; i < cars.length; i++) {
      run = cars[i].color === cars[i - 1].color ? run + 1 : 1
      if (run > max) max = run
    }
    return max
  }

  it('generates exactly count cars', () => {
    const d = makeDirector(1)
    expect(d.generateBatch(makeLane(), 5, batchParams).length).toBe(5)
  })

  it('no 3 consecutive same-color cars in a single batch', () => {
    const d = makeDirector(2)
    for (let trial = 0; trial < 200; trial++) {
      const cars = d.generateBatch(makeLane(), 6, batchParams)
      expect(maxRun(cars)).toBeLessThanOrEqual(2)
    }
  })

  it('no 3 consecutive across 500 batches of varying sizes', () => {
    const d = makeDirector(42)
    for (let trial = 0; trial < 500; trial++) {
      const count = 4 + (trial % 3) // 4, 5, or 6
      const cars  = d.generateBatch(makeLane(), count, batchParams)
      expect(maxRun(cars)).toBeLessThanOrEqual(2)
    }
  })

  it('allows up to 2 consecutive same-color cars', () => {
    // Run many batches; with a 4-color palette, pairs naturally occur
    const d = makeDirector(77)
    let foundPair = false
    for (let trial = 0; trial < 500 && !foundPair; trial++) {
      const cars = d.generateBatch(makeLane(), 6, batchParams)
      if (maxRun(cars) === 2) foundPair = true
    }
    expect(foundPair).toBe(true)
  })

  it('all batch cars have a color from the palette', () => {
    const d = makeDirector(11)
    for (let trial = 0; trial < 100; trial++) {
      const cars = d.generateBatch(makeLane(), 5, batchParams)
      for (const car of cars) expect(PALETTE).toContain(car.color)
    }
  })

  it('colorBudget is respected within batch', () => {
    const heavyRed = [
      { value: 'Red', weight: 9 }, { value: 'Blue', weight: 1 },
    ]
    const params = { ...batchParams, colorPalette: ['Red', 'Blue'], colorBudget: heavyRed }
    const d = makeDirector(8)
    let reds = 0, total = 0
    for (let trial = 0; trial < 200; trial++) {
      const cars = d.generateBatch(makeLane(), 4, params)
      for (const c of cars) { if (c.color === 'Red') reds++; total++ }
    }
    // ~90% Red expected; constraint breaks it up so actual is somewhat lower
    expect(reds / total).toBeGreaterThan(0.5)
  })

  it('with single-color palette, batch is all that color (constraint cannot apply)', () => {
    const params = { ...batchParams, colorPalette: ['Red'] }
    const d = makeDirector(1)
    const cars = d.generateBatch(makeLane(), 6, params)
    expect(cars.every(c => c.color === 'Red')).toBe(true)
  })

  it('HP and speed are valid for every car in batch', () => {
    const d = makeDirector(99)
    const cars = d.generateBatch(makeLane(), 6, batchParams)
    for (const car of cars) {
      expect(car.hp).toBeGreaterThanOrEqual(HP_MINIMUM)
      expect(car.hp).toBeLessThanOrEqual(HP_BASE.max)
      expect(car.speed).toBeGreaterThan(0)
    }
  })
})

// ─── carry-over pair injection ────────────────────────────────────────────────

describe('carry-over pair injection', () => {
  it('injects a same-color pair within the first 12 cars', () => {
    const d    = makeDirector(1)
    const lane = makeLane(0)
    let pairFound = false
    let lastColor = null
    // Pairs arrive every 8–12 cars; sample 20 to guarantee at least one.
    for (let i = 0; i < 20; i++) {
      const car = d.generateCar(lane, 'PRESSURE', W1, PALETTE)
      if (lastColor !== null && car.color === lastColor && car.hp <= 5) {
        pairFound = true
      }
      lastColor = car.color
    }
    expect(pairFound).toBe(true)
  })

  it('both cars in the pair have HP in [4,5]', () => {
    const d    = makeDirector(1)
    const lane = makeLane(0)
    const cars = []
    for (let i = 0; i < 30; i++) {
      cars.push(d.generateCar(lane, 'CLIMAX', W1, PALETTE))
    }
    // Find any consecutive same-color pair where both cars have HP ≤ 5.
    // That is a carry-over pair (bait + reward).
    let foundPair = false
    for (let i = 1; i < cars.length; i++) {
      if (cars[i].color === cars[i - 1].color &&
          cars[i].hp     <= 5 &&
          cars[i - 1].hp <= 5) {
        foundPair = true
        expect(cars[i - 1].hp).toBeGreaterThanOrEqual(4)
        expect(cars[i].hp).toBeGreaterThanOrEqual(4)
      }
    }
    expect(foundPair).toBe(true)
  })

  it('pair cars always have a color from the palette', () => {
    const d    = makeDirector(7)
    const lane = makeLane(0)
    for (let i = 0; i < 50; i++) {
      const car = d.generateCar(lane, 'PRESSURE', W1, PALETTE)
      expect(PALETTE).toContain(car.color)
    }
  })

  it('independent lanes get independent carry-over cycles', () => {
    const d  = makeDirector(3)
    const l0 = makeLane(0)
    const l1 = makeLane(1)
    // Run both lanes for 30 spawns each — counters are independent so both
    // should produce at least one pair within their 20-sample window.
    const check = (lane) => {
      let pairFound = false, lastColor = null
      for (let i = 0; i < 30; i++) {
        const car = d.generateCar(lane, 'PRESSURE', W1, PALETTE)
        if (lastColor !== null && car.color === lastColor && car.hp <= 5) pairFound = true
        lastColor = car.color
      }
      return pairFound
    }
    expect(check(l0)).toBe(true)
    expect(check(l1)).toBe(true)
  })
})

// ─── updateSpawnTimers — phase cooldowns ──────────────────────────────────────

describe('updateSpawnTimers — spawn cooldowns', () => {
  it('initialises a timer for a new lane on first call', () => {
    const d    = makeDirector(1)
    const lane = makeLane(0)
    d.updateSpawnTimers([lane], 0, PRESSURE_CFG)
    const t = d.getSpawnTimer(lane)
    expect(t).toBeGreaterThanOrEqual(PRESSURE_CFG.spawnCooldown.min)
    expect(t).toBeLessThan(PRESSURE_CFG.spawnCooldown.max)
  })

  it('decrements the timer by deltaTime', () => {
    const d    = makeDirector(1)
    const lane = makeLane(0)
    d.updateSpawnTimers([lane], 0, CALM_CFG) // initialise
    const initial = d.getSpawnTimer(lane)
    d.updateSpawnTimers([lane], 1.0, CALM_CFG)
    expect(d.getSpawnTimer(lane)).toBeCloseTo(initial - 1.0)
  })

  it('timer never goes below 0', () => {
    const d    = makeDirector(1)
    const lane = makeLane(0)
    d.updateSpawnTimers([lane], 0, BUILD_CFG)
    d.updateSpawnTimers([lane], 999, BUILD_CFG)
    expect(d.getSpawnTimer(lane)).toBe(0)
  })

  it('isReadyToSpawn returns false while timer > 0', () => {
    const d    = makeDirector(1)
    const lane = makeLane(0)
    d.updateSpawnTimers([lane], 0, PRESSURE_CFG) // min cooldown 1.8s
    expect(d.isReadyToSpawn(lane)).toBe(false)
  })

  it('isReadyToSpawn returns true after timer expires', () => {
    const d    = makeDirector(1)
    const lane = makeLane(0)
    d.updateSpawnTimers([lane], 0, PRESSURE_CFG)
    d.updateSpawnTimers([lane], 100, PRESSURE_CFG) // exhaust timer
    expect(d.isReadyToSpawn(lane)).toBe(true)
  })

  it('CLIMAX initialises shorter timers than CALM on average', () => {
    const SAMPLES = 300
    const avgTimer = (phase) => {
      let sum = 0
      for (let seed = 0; seed < SAMPLES; seed++) {
        const d    = new CarDirector({}, new SeededRandom(seed))
        const lane = makeLane(0)
        d.updateSpawnTimers([lane], 0, PHASE_CONFIG[phase])
        sum += d.getSpawnTimer(lane)
      }
      return sum / SAMPLES
    }
    expect(avgTimer('CLIMAX')).toBeLessThan(avgTimer('CALM'))
  })

  it('handles multiple lanes independently', () => {
    const d  = makeDirector(5)
    const l0 = makeLane(0)
    const l1 = makeLane(1)
    d.updateSpawnTimers([l0, l1], 0, BUILD_CFG) // initialise both
    const t0 = d.getSpawnTimer(l0)
    const t1 = d.getSpawnTimer(l1)
    // Each lane got its own random cooldown from the same phase range
    expect(t0).toBeGreaterThanOrEqual(BUILD_CFG.spawnCooldown.min)
    expect(t1).toBeGreaterThanOrEqual(BUILD_CFG.spawnCooldown.min)
    d.updateSpawnTimers([l0, l1], 1.5, BUILD_CFG)
    expect(d.getSpawnTimer(l0)).toBeCloseTo(t0 - 1.5)
    expect(d.getSpawnTimer(l1)).toBeCloseTo(t1 - 1.5)
  })

  it('resetSpawnTimer sets a new cooldown within the phase range', () => {
    const d    = makeDirector(3)
    const lane = makeLane(0)
    d.updateSpawnTimers([lane], 0, PRESSURE_CFG)
    d.updateSpawnTimers([lane], 999, PRESSURE_CFG) // exhaust
    expect(d.isReadyToSpawn(lane)).toBe(true)
    d.resetSpawnTimer(lane, CLIMAX_CFG)
    expect(d.isReadyToSpawn(lane)).toBe(false)
    const t = d.getSpawnTimer(lane)
    expect(t).toBeGreaterThanOrEqual(CLIMAX_CFG.spawnCooldown.min)
    expect(t).toBeLessThan(CLIMAX_CFG.spawnCooldown.max)
  })

  it('timer cooldown range is respected across 500 fresh directors', () => {
    for (let seed = 0; seed < 500; seed++) {
      const d    = new CarDirector({}, new SeededRandom(seed))
      const lane = makeLane(0)
      d.updateSpawnTimers([lane], 0, PRESSURE_CFG)
      const t = d.getSpawnTimer(lane)
      expect(t).toBeGreaterThanOrEqual(PRESSURE_CFG.spawnCooldown.min)
      expect(t).toBeLessThan(PRESSURE_CFG.spawnCooldown.max)
    }
  })
})
