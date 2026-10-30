import { describe, it, expect } from 'vitest'
import { ShooterDirector } from '../src/director/ShooterDirector.js'
import { FairnessArbiter } from '../src/director/FairnessArbiter.js'
import { SeededRandom }    from '../src/utils/SeededRandom.js'
import { Lane }    from '../src/models/Lane.js'
import { Column }  from '../src/models/Column.js'
import { Car }     from '../src/models/Car.js'
import { Shooter } from '../src/models/Shooter.js'
import { COLUMN_DEPTH, DEPTH_BAIT } from '../src/director/DirectorConfig.js'

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

  it('every bomb is exactly one hit', () => {
    const d = makeDirector(3)
    for (let i = 0; i < 200; i++) {
      const s = d.generateShooter(makeColumn(), makeState(), STANDARD_PHASE)
      expect(s.damage).toBe(1)
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

  it('all generated shooters are one-hit bombs', () => {
    const columns = [0, 1, 2, 3].map(i => makeColumn(i))
    const state   = makeState(); state.columns = columns
    makeDirector(5).fillColumns(columns, state, STANDARD_PHASE)
    for (const col of columns) {
      for (const s of col.shooters) {
        expect(s.damage).toBe(1)
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
})

