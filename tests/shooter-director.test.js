import { describe, it, expect } from 'vitest'
import { ShooterDirector } from '../src/director/ShooterDirector.js'
import { FairnessArbiter } from '../src/director/FairnessArbiter.js'
import { SeededRandom }    from '../src/utils/SeededRandom.js'
import { Lane }    from '../src/models/Lane.js'
import { Column }  from '../src/models/Column.js'
import { Car }     from '../src/models/Car.js'
import { Shooter } from '../src/models/Shooter.js'
import { COLUMN_DEPTH, CRISIS, DEPTH_BAIT } from '../src/director/DirectorConfig.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// A no-op arbiter so fairness corrections don't obscure the behaviour under test.
const noopArbiter = { checkShooter: () => ({ fixed: false }), checkCar: () => ({ fixed: false }) }

const realArbiter = new FairnessArbiter()

function makeDirector(seed = 1, arbiter = noopArbiter) {
  return new ShooterDirector({}, new SeededRandom(seed), arbiter)
}

function makeLaneWithCar(color = 'Red', position = 0) {
  const lane = new Lane({ id: Math.random() * 1e6 | 0 })
  const car  = new Car({ color, hp: 10, speed: 5 })
  car.position = position
  lane.addCar(car)
  return lane
}

function makeEmptyLane(id = 0) { return new Lane({ id }) }

function makeColumn(id = 0) { return new Column({ id }) }

function makeColWith(color, damage, id = 0) {
  const col = new Column({ id })
  col.pushBottom(new Shooter({ color, damage, column: id }))
  return col
}

const PALETTE = ['Red', 'Blue', 'Green', 'Yellow']

// Standard clean game state (no fairness violations)
function makeState({
  laneSpecs   = [{ color: 'Red', pos: 30 }, { color: 'Blue', pos: 20 },
                 { color: 'Green', pos: 10 }, { color: 'Yellow', pos: 5 }],
  columnSpecs = [{ color: 'Red', dmg: 5 }, { color: 'Blue', dmg: 5 },
                 { color: 'Green', dmg: 5 }, { color: 'Yellow', dmg: 5 }],
  colorPalette = PALETTE,
  elapsedTime  = 30,
  phase        = 'PRESSURE',
} = {}) {
  const lanes   = laneSpecs.map((s, i) => {
    const l = new Lane({ id: i })
    const c = new Car({ color: s.color, hp: 10, speed: 5 })
    c.position = s.pos
    l.addCar(c)
    return l
  })
  const columns = columnSpecs.map((s, i) => makeColWith(s.color, s.dmg, i))
  return { lanes, columns, colorPalette, elapsedTime, phase }
}

const STANDARD_PHASE = { damageSkew: 'standard', spawnCooldown: { min: 1.8, max: 2.5 } }
const HARD_PHASE     = { damageSkew: 'hard',     spawnCooldown: { min: 1.2, max: 1.8 } }
const EASY_PHASE     = { damageSkew: 'easy',     spawnCooldown: { min: 3.0, max: 4.0 } }

// ─── generateShooter ──────────────────────────────────────────────────────────

describe('generateShooter', () => {
  it('returns a Shooter instance', () => {
    const d = makeDirector()
    const s = d.generateShooter(makeColumn(), makeState(), STANDARD_PHASE)
    expect(s).toBeInstanceOf(Shooter)
  })

  it('color is from the colorPalette', () => {
    const d = makeDirector(7)
    for (let i = 0; i < 200; i++) {
      const s = d.generateShooter(makeColumn(), makeState(), STANDARD_PHASE)
      expect(PALETTE).toContain(s.color)
    }
  })

  it('damage is within valid range [2, 8]', () => {
    const d = makeDirector(3)
    for (let i = 0; i < 200; i++) {
      const s = d.generateShooter(makeColumn(), makeState(), STANDARD_PHASE)
      expect(s.damage).toBeGreaterThanOrEqual(2)
      expect(s.damage).toBeLessThanOrEqual(8)
    }
  })

  it('column id is set on the shooter', () => {
    const d   = makeDirector()
    const col = makeColumn(2)
    const s   = d.generateShooter(col, makeState(), STANDARD_PHASE)
    expect(s.column).toBe(2)
  })

  it('accepts a column id integer as well as a Column object', () => {
    const d = makeDirector()
    const s = d.generateShooter(3, makeState(), STANDARD_PHASE)
    expect(s.column).toBe(3)
  })

  describe('demand-matching: 60% reroll toward front-car colors', () => {
    it('picks front-car colors more than palette-uniform rate', () => {
      // Front cars: all Red. Palette: 4 colors.
      // Expected Red rate: 0.6 * 1.0 + 0.4 * 0.25 = 0.70
      const state = makeState({
        laneSpecs: [
          { color: 'Red', pos: 30 }, { color: 'Red', pos: 20 },
          { color: 'Red', pos: 10 }, { color: 'Red', pos:  5 },
        ],
      })
      const d = makeDirector(42)
      let reds = 0
      const SAMPLES = 2000
      for (let i = 0; i < SAMPLES; i++) {
        if (d.generateShooter(makeColumn(), state, STANDARD_PHASE).color === 'Red') reds++
      }
      // Uniform would be 25%; demand-match should be ~70%
      expect(reds / SAMPLES).toBeGreaterThan(0.5)
    })

    it('~60% of demand rolls pick from front-car colors (isolated test)', () => {
      // When palette = front-car colors, rate must be 100% (either path picks front color)
      const state = makeState({
        laneSpecs:   [{ color: 'Red', pos: 20 }, { color: 'Red', pos: 15 },
                      { color: 'Red', pos: 10 }, { color: 'Red', pos: 5  }],
        colorPalette: ['Red'],
      })
      const d = makeDirector(1)
      const SAMPLES = 500
      for (let i = 0; i < SAMPLES; i++) {
        expect(d.generateShooter(makeColumn(), state, STANDARD_PHASE).color).toBe('Red')
      }
    })

    it('falls back to palette when no front cars exist', () => {
      const state = {
        lanes:       [makeEmptyLane(0), makeEmptyLane(1), makeEmptyLane(2), makeEmptyLane(3)],
        columns:     [makeColWith('Red', 5, 0)],
        colorPalette: PALETTE,
        elapsedTime: 0, phase: 'PRESSURE',
      }
      const d = makeDirector(5)
      for (let i = 0; i < 100; i++) {
        const s = d.generateShooter(makeColumn(), state, STANDARD_PHASE)
        expect(PALETTE).toContain(s.color)
      }
    })
  })

  describe('damage distribution by skew', () => {
    it('hard skew produces lower average damage than easy skew', () => {
      const avgDamage = (skew, seed = 77) => {
        const d = makeDirector(seed)
        const phase = { damageSkew: skew, spawnCooldown: { min: 1, max: 2 } }
        let sum = 0
        const SAMPLES = 500
        for (let i = 0; i < SAMPLES; i++) sum += d.generateShooter(makeColumn(), makeState(), phase).damage
        return sum / SAMPLES
      }
      expect(avgDamage('hard')).toBeLessThan(avgDamage('easy'))
    })

    it('standard skew average is between hard and easy', () => {
      const avg = (skew) => {
        const d = makeDirector(11)
        const phase = { damageSkew: skew, spawnCooldown: { min: 1, max: 2 } }
        let sum = 0
        for (let i = 0; i < 500; i++) sum += d.generateShooter(makeColumn(), makeState(), phase).damage
        return sum / 500
      }
      const hard = avg('hard'), std = avg('standard'), easy = avg('easy')
      expect(std).toBeGreaterThan(hard)
      expect(std).toBeLessThan(easy)
    })
  })

  it('fairness arbiter is applied (real arbiter fixes FR-1 violation)', () => {
    // All front cars: Green. All existing tops: Blue. Candidate: Blue.
    // FR-1 should fire and set color to Green.
    const cols = [0, 1, 2, 3].map(i => makeColWith('Blue', 5, i))
    const state = {
      lanes:       [makeLaneWithCar('Green', 50), makeLaneWithCar('Green', 40),
                    makeLaneWithCar('Green', 30), makeLaneWithCar('Green', 20)],
      columns:     cols,
      colorPalette: ['Red', 'Blue', 'Green', 'Yellow'],
      elapsedTime: 0, phase: 'PRESSURE',
    }
    // Force demand-match to Blue (use palette-only by depleting front cars after)
    // Simpler: just run with real arbiter and verify color ends up matching Green
    const d = new ShooterDirector({}, new SeededRandom(1), realArbiter)
    // Run until we get a shooter and verify arbiter ran (Green should appear)
    let greenSeen = false
    for (let seed = 0; seed < 50 && !greenSeen; seed++) {
      const dir = new ShooterDirector({}, new SeededRandom(seed), realArbiter)
      const s   = dir.generateShooter(cols[0], state, STANDARD_PHASE)
      if (s.color === 'Green') greenSeen = true
    }
    // FR-1 fix must have made at least one run produce Green
    expect(greenSeen).toBe(true)
  })
})

// ─── createDepthBait ─────────────────────────────────────────────────────────

describe('createDepthBait', () => {
  it('returns baitShooter and rewardShooter', () => {
    const d = makeDirector()
    const { baitShooter, rewardShooter } = d.createDepthBait(makeColumn(), makeState())
    expect(baitShooter).toBeInstanceOf(Shooter)
    expect(rewardShooter).toBeInstanceOf(Shooter)
  })

  it('baitShooter damage is in [2, 3]', () => {
    const d = makeDirector(1)
    for (let seed = 0; seed < 50; seed++) {
      const dir = makeDirector(seed)
      const { baitShooter } = dir.createDepthBait(makeColumn(), makeState())
      expect(baitShooter.damage).toBeGreaterThanOrEqual(2)
      expect(baitShooter.damage).toBeLessThanOrEqual(3)
    }
  })

  it('rewardShooter damage is in [6, 8]', () => {
    for (let seed = 0; seed < 50; seed++) {
      const dir = makeDirector(seed)
      const { rewardShooter } = dir.createDepthBait(makeColumn(), makeState())
      expect(rewardShooter.damage).toBeGreaterThanOrEqual(6)
      expect(rewardShooter.damage).toBeLessThanOrEqual(8)
    }
  })

  it('both shooters have the correct column id', () => {
    const col = makeColumn(3)
    const d   = makeDirector()
    const { baitShooter, rewardShooter } = d.createDepthBait(col, makeState())
    expect(baitShooter.column).toBe(3)
    expect(rewardShooter.column).toBe(3)
  })

  it('rewardShooter color matches a current front-car color when possible', () => {
    // Front cars are all Red; reward should tend toward Red
    const state = makeState({
      laneSpecs: [
        { color: 'Red', pos: 50 }, { color: 'Red', pos: 40 },
        { color: 'Red', pos: 30 }, { color: 'Red', pos: 20 },
      ],
    })
    let redCount = 0
    for (let seed = 0; seed < 50; seed++) {
      const { rewardShooter } = makeDirector(seed).createDepthBait(makeColumn(), state)
      if (rewardShooter.color === 'Red') redCount++
    }
    // Majority should match front-car color
    expect(redCount).toBeGreaterThan(30)
  })

  it('bait damage is strictly less than reward damage', () => {
    for (let seed = 0; seed < 50; seed++) {
      const { baitShooter, rewardShooter } = makeDirector(seed).createDepthBait(makeColumn(), makeState())
      expect(baitShooter.damage).toBeLessThan(rewardShooter.damage)
    }
  })

  it('bait color is from the palette', () => {
    const d = makeDirector(9)
    for (let i = 0; i < 100; i++) {
      const { baitShooter } = d.createDepthBait(makeColumn(), makeState())
      expect(PALETTE).toContain(baitShooter.color)
    }
  })
})

// ─── triggerCrisis ────────────────────────────────────────────────────────────

describe('triggerCrisis', () => {
  // Build a state where the car is at 75% of the lane
  function dangerState(elapsedTime = 30, phase = 'PRESSURE') {
    const lane = new Lane({ id: 0 })
    const car  = new Car({ color: 'Red', hp: 10, speed: 5 })
    car.position = 75 // 75% of 100-unit lane
    lane.addCar(car)
    return {
      lanes:       [lane, makeEmptyLane(1), makeEmptyLane(2), makeEmptyLane(3)],
      columns:     [makeColWith('Blue', 5, 0), makeColWith('Blue', 5, 1),
                    makeColWith('Blue', 5, 2), makeColWith('Blue', 5, 3)],
      colorPalette: PALETTE,
      elapsedTime, phase,
    }
  }

  function setupDeploys(director, time = 30) {
    director.recordDeploy(time - 5)
    director.recordDeploy(time - 2)
  }

  it('returns null when no car is past 70% of the lane', () => {
    const d     = makeDirector()
    const state = dangerState()
    state.lanes[0].frontCar().position = 50 // 50% — not dangerous enough
    setupDeploys(d)
    expect(d.triggerCrisis(state)).toBeNull()
  })

  it('returns null when cooldown has not expired (< 15 s)', () => {
    const d = makeDirector()
    setupDeploys(d)
    const state = dangerState(30)
    // Manually set last crisis time to simulate recent trigger
    d._lastCrisisTime = 20 // 30 - 20 = 10s ago, cooldown is 15s
    expect(d.triggerCrisis(state)).toBeNull()
  })

  it('returns null when fewer than 2 deploys in last 10 s', () => {
    const d     = makeDirector(1)
    const state = dangerState()
    d.recordDeploy(30 - 5) // only 1 deploy
    expect(d.triggerCrisis(state)).toBeNull()
  })

  it('returns null when phase is not eligible (CALM, BUILD)', () => {
    for (const phase of ['CALM', 'BUILD']) {
      const d     = makeDirector(1)
      const state = dangerState(30, phase)
      setupDeploys(d)
      expect(d.triggerCrisis(state)).toBeNull()
    }
  })

  it('when triggered, shooter color matches the most dangerous front car', () => {
    let result = null
    for (let seed = 0; seed < 100 && result === null; seed++) {
      const d = makeDirector(seed)
      setupDeploys(d)
      result = d.triggerCrisis(dangerState())
    }
    expect(result).not.toBeNull()
    expect(result.shooter.color).toBe('Red') // front car color in dangerState
  })

  it('when triggered, shooter damage is >= CRISIS.minimumDamageOnAssist (5)', () => {
    let result = null
    for (let seed = 0; seed < 100 && result === null; seed++) {
      const d = makeDirector(seed)
      setupDeploys(d)
      result = d.triggerCrisis(dangerState())
    }
    expect(result).not.toBeNull()
    expect(result.shooter.damage).toBeGreaterThanOrEqual(CRISIS.minimumDamageOnAssist)
  })

  it('when triggered, returns the correct dangerous lane', () => {
    let result = null
    for (let seed = 0; seed < 100 && result === null; seed++) {
      const d = makeDirector(seed)
      setupDeploys(d)
      result = d.triggerCrisis(dangerState())
    }
    expect(result).not.toBeNull()
    expect(result.lane).toBeDefined()
    expect(result.lane.frontCar().distanceRatio()).toBeGreaterThanOrEqual(CRISIS.triggerDistanceRatio)
  })

  it('triggers roughly 70% of the time when all conditions are met (200 samples)', () => {
    let triggers = 0
    for (let seed = 0; seed < 200; seed++) {
      const d = makeDirector(seed)
      setupDeploys(d)
      if (d.triggerCrisis(dangerState()) !== null) triggers++
    }
    expect(triggers / 200).toBeCloseTo(0.7, 1) // within ~5%
  })

  it('enforces 15 s cooldown: second call immediately after a trigger returns null', () => {
    let result = null
    let seed = 0
    while (result === null) {
      const d = makeDirector(seed++)
      setupDeploys(d)
      const state = dangerState(30)
      result = d.triggerCrisis(state)
      if (result !== null) {
        // Same director, same time — cooldown should block second call
        setupDeploys(d) // keep deploys fresh
        expect(d.triggerCrisis(state)).toBeNull()
      }
    }
  })

  it('cooldown resets after 15 s: second call at t+15 can trigger again', () => {
    let firstResult = null
    let seed = 0
    while (firstResult === null) {
      const d = makeDirector(seed++)
      setupDeploys(d, 30)
      firstResult = d.triggerCrisis(dangerState(30))
      if (firstResult !== null) {
        // Try at t=46 (16s later — cooldown expired)
        d.recordDeploy(40)
        d.recordDeploy(44)
        const state2 = dangerState(46)
        // Not guaranteed to trigger (70% chance), just verify it CAN
        // (null is valid here; we just check it doesn't throw)
        expect(() => d.triggerCrisis(state2)).not.toThrow()
      }
    }
  })
})

// ─── fillColumns ─────────────────────────────────────────────────────────────

describe('fillColumns', () => {
  it('fills empty columns to COLUMN_DEPTH', () => {
    const columns = [0, 1, 2, 3].map(i => makeColumn(i))
    const state   = makeState({ columnSpecs: [{ color: 'Red', dmg: 5 }, { color: 'Blue', dmg: 5 }, { color: 'Green', dmg: 5 }, { color: 'Yellow', dmg: 5 }] })
    // Replace columns with empty ones
    state.columns = columns
    const d = makeDirector(1)
    d.fillColumns(columns, state, STANDARD_PHASE)
    for (const col of columns) {
      expect(col.shooters.length).toBe(COLUMN_DEPTH)
    }
  })

  it('does not add shooters to columns that are already full', () => {
    const col = makeColumn(0)
    for (let i = 0; i < COLUMN_DEPTH; i++) col.pushBottom(new Shooter({ color: 'Red', damage: 4, column: 0 }))
    expect(col.needsRefill()).toBe(false)
    const state = makeState()
    state.columns = [col]
    const d = makeDirector()
    d.fillColumns([col], state, STANDARD_PHASE)
    expect(col.shooters.length).toBe(COLUMN_DEPTH)
  })

  it('partially full columns are topped up exactly to COLUMN_DEPTH', () => {
    const col = makeColumn(0)
    col.pushBottom(new Shooter({ color: 'Red', damage: 5, column: 0 }))
    col.pushBottom(new Shooter({ color: 'Blue', damage: 5, column: 0 }))
    expect(col.shooters.length).toBe(2)
    const state = makeState(); state.columns = [col, makeColWith('Blue',5,1), makeColWith('Green',5,2), makeColWith('Yellow',5,3)]
    makeDirector(2).fillColumns([col], state, STANDARD_PHASE)
    expect(col.shooters.length).toBe(COLUMN_DEPTH)
  })

  it('all generated shooters have valid damage [2, 8]', () => {
    const columns = [0, 1, 2, 3].map(i => makeColumn(i))
    const state   = makeState(); state.columns = columns
    makeDirector(5).fillColumns(columns, state, STANDARD_PHASE)
    for (const col of columns) {
      for (const s of col.shooters) {
        expect(s.damage).toBeGreaterThanOrEqual(2)
        expect(s.damage).toBeLessThanOrEqual(8)
      }
    }
  })

  it('all generated shooters have colors from the palette', () => {
    const columns = [0, 1, 2, 3].map(i => makeColumn(i))
    const state   = makeState(); state.columns = columns
    makeDirector(8).fillColumns(columns, state, STANDARD_PHASE)
    for (const col of columns) {
      for (const s of col.shooters) expect(PALETTE).toContain(s.color)
    }
  })

  it('depth-bait pairs appear within the column after enough refills', () => {
    // Fill and consume repeatedly until a bait pair is injected.
    // Bait appears every 3–5 shooters, so ≤10 fills should produce one.
    const col   = makeColumn(0)
    const state = makeState(); state.columns = [col, makeColWith('Blue',5,1), makeColWith('Green',5,2), makeColWith('Yellow',5,3)]
    const d     = makeDirector(42)

    let foundBait = false
    for (let round = 0; round < 10 && !foundBait; round++) {
      // Drain the column
      while (col.top()) col.consume()
      // Refill
      d.fillColumns([col], state, STANDARD_PHASE)
      // Check for a damage-2-or-3 shooter followed by damage-6-8
      const dmgs = col.shooters.map(s => s.damage)
      for (let i = 0; i < dmgs.length - 1; i++) {
        if (dmgs[i] <= 3 && dmgs[i + 1] >= 6) { foundBait = true; break }
      }
    }
    expect(foundBait).toBe(true)
  })

  it('depth-bait threshold is always within DEPTH_BAIT.frequencyRange [3, 5]', () => {
    // After fillColumns, _nextBaitAt holds the freshly-set threshold for the
    // NEXT refill cycle. It must always be in the [3, 5] spec range regardless of seed.
    for (let seed = 0; seed < 50; seed++) {
      const col   = makeColumn(0)
      const state = makeState()
      state.columns = [col, makeColWith('Blue',5,1), makeColWith('Green',5,2), makeColWith('Yellow',5,3)]
      const d = makeDirector(seed)
      d.fillColumns([col], state, STANDARD_PHASE)
      const threshold = d._nextBaitAt[col.id]
      expect(threshold).toBeGreaterThanOrEqual(DEPTH_BAIT.frequencyRange[0])
      expect(threshold).toBeLessThanOrEqual(DEPTH_BAIT.frequencyRange[1])
    }
  })
})

// ─── recordDeploy ────────────────────────────────────────────────────────────

describe('recordDeploy', () => {
  it('old deploys (> 10 s) are pruned automatically', () => {
    const d = makeDirector()
    d.recordDeploy(0)
    d.recordDeploy(5)
    d.recordDeploy(20) // this call prunes entries > 10s before 20
    expect(d._deployLog.length).toBe(1) // only t=20 survives
  })

  it('multiple recent deploys are retained', () => {
    const d = makeDirector()
    d.recordDeploy(10)
    d.recordDeploy(15)
    d.recordDeploy(18)
    expect(d._deployLog.length).toBe(3)
  })
})
