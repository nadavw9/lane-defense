import { describe, it, expect } from 'vitest'
import { IntensityPhase } from '../src/director/IntensityPhase.js'
import { PHASE_CONFIG, PHASE_TRANSITION_DURATION, CRISIS } from '../src/director/DirectorConfig.js'

// With levelDuration=100 and the proportions [0.16, 0.22, 0.25, 0.18, 0.19]:
//   CALM:     0  – 16
//   BUILD:    16 – 38
//   PRESSURE: 38 – 63
//   CLIMAX:   63 – 81
//   RELIEF:   81 – 100
const DURATION = 100

function make(duration = DURATION) {
  return new IntensityPhase(duration)
}

// ─── Phase Timeline ──────────────────────────────────────────────────────────

describe('Phase timeline', () => {
  it('starts in CALM at t=0', () => {
    const ip = make()
    ip.update(0)
    expect(ip.getCurrentPhase()).toBe('CALM')
  })

  it('stays CALM well into the first segment', () => {
    const ip = make()
    ip.update(10)
    expect(ip.getCurrentPhase()).toBe('CALM')
  })

  it('enters BUILD at the CALM boundary (t=16)', () => {
    const ip = make()
    ip.update(16)
    expect(ip.getCurrentPhase()).toBe('BUILD')
  })

  it('stays BUILD mid-segment (t=25)', () => {
    const ip = make()
    ip.update(25)
    expect(ip.getCurrentPhase()).toBe('BUILD')
  })

  it('enters PRESSURE at t=38', () => {
    const ip = make()
    ip.update(38)
    expect(ip.getCurrentPhase()).toBe('PRESSURE')
  })

  it('enters CLIMAX at t=63', () => {
    const ip = make()
    ip.update(63)
    expect(ip.getCurrentPhase()).toBe('CLIMAX')
  })

  it('enters RELIEF at t=81', () => {
    const ip = make()
    ip.update(81)
    expect(ip.getCurrentPhase()).toBe('RELIEF')
  })

  it('stays RELIEF at end of level (t=100)', () => {
    const ip = make()
    ip.update(100)
    expect(ip.getCurrentPhase()).toBe('RELIEF')
  })

  it('clamps to last phase beyond levelDuration', () => {
    const ip = make()
    ip.update(999)
    expect(ip.getCurrentPhase()).toBe('RELIEF')
  })

  it('clamps to CALM before t=0', () => {
    const ip = make()
    ip.update(-5)
    expect(ip.getCurrentPhase()).toBe('CALM')
  })

  it('phases advance in correct sequence when updated sequentially', () => {
    const ip = make()
    const seen = []
    const checkpoints = [0, 16, 38, 63, 81]
    for (const t of checkpoints) {
      ip.update(t)
      seen.push(ip.getCurrentPhase())
    }
    expect(seen).toEqual(['CALM', 'BUILD', 'PRESSURE', 'CLIMAX', 'RELIEF'])
  })
})

// ─── getParams — steady state (outside transition window) ────────────────────

describe('getParams — steady state', () => {
  // Helper: get params well inside a phase (past the 3s transition window)
  function steadyParams(t) {
    const ip = make()
    ip.update(t)
    return ip.getParams()
  }

  it('CALM: spawnCooldownMultiplier = 1.4', () => {
    expect(steadyParams(5).spawnCooldownMultiplier).toBeCloseTo(1.4)
  })

  it('CALM: hpMultiplier = 0.7', () => {
    expect(steadyParams(5).hpMultiplier).toBeCloseTo(0.7)
  })

  it('CALM: speedMultiplier = 0.85', () => {
    expect(steadyParams(5).speedMultiplier).toBeCloseTo(0.85)
  })

  it('CALM: damageSkew = "easy"', () => {
    expect(steadyParams(5).damageSkew).toBe('easy')
  })

  it('CALM: crisisEnabled = false', () => {
    expect(steadyParams(5).crisisEnabled).toBe(false)
  })

  it('BUILD: spawnCooldownMultiplier = 1.0 (baseline)', () => {
    expect(steadyParams(20).spawnCooldownMultiplier).toBeCloseTo(1.0)
  })

  it('BUILD: damageSkew = "standard"', () => {
    expect(steadyParams(20).damageSkew).toBe('standard')
  })

  it('BUILD: crisisEnabled = false', () => {
    expect(steadyParams(20).crisisEnabled).toBe(false)
  })

  it('PRESSURE: hpMultiplier = 1.0', () => {
    expect(steadyParams(45).hpMultiplier).toBeCloseTo(1.0)
  })

  it('PRESSURE: spawnCooldownMultiplier = 0.75', () => {
    expect(steadyParams(45).spawnCooldownMultiplier).toBeCloseTo(0.75)
  })

  it('PRESSURE: crisisEnabled = true', () => {
    expect(steadyParams(45).crisisEnabled).toBe(true)
  })

  it('CLIMAX: spawnCooldownMultiplier = 0.55 (most aggressive)', () => {
    expect(steadyParams(68).spawnCooldownMultiplier).toBeCloseTo(0.55)
  })

  it('CLIMAX: hpMultiplier = 1.2 (highest)', () => {
    expect(steadyParams(68).hpMultiplier).toBeCloseTo(1.2)
  })

  it('CLIMAX: damageSkew = "hard"', () => {
    expect(steadyParams(68).damageSkew).toBe('hard')
  })

  it('CLIMAX: crisisEnabled = true', () => {
    expect(steadyParams(68).crisisEnabled).toBe(true)
  })

  it('RELIEF: spawnCooldownMultiplier = 1.2', () => {
    expect(steadyParams(90).spawnCooldownMultiplier).toBeCloseTo(1.2)
  })

  it('RELIEF: hpMultiplier = 0.8', () => {
    expect(steadyParams(90).hpMultiplier).toBeCloseTo(0.8)
  })

  it('RELIEF: damageSkew = "easy"', () => {
    expect(steadyParams(90).damageSkew).toBe('easy')
  })

  it('RELIEF: crisisEnabled = true', () => {
    expect(steadyParams(90).crisisEnabled).toBe(true)
  })

  it('params match PHASE_CONFIG values exactly in steady state', () => {
    // Spot-check all phases
    const checks = [
      { t: 5,  phase: 'CALM'     },
      { t: 20, phase: 'BUILD'    },
      { t: 45, phase: 'PRESSURE' },
      { t: 68, phase: 'CLIMAX'   },
      { t: 90, phase: 'RELIEF'   },
    ]
    for (const { t, phase } of checks) {
      const ip = make()
      ip.update(t)
      const cfg = PHASE_CONFIG[phase]
      const p = ip.getParams()
      expect(p.spawnCooldownMultiplier).toBeCloseTo(cfg.spawnMultiplier)
      expect(p.hpMultiplier).toBeCloseTo(cfg.hpMultiplier)
      expect(p.speedMultiplier).toBeCloseTo(cfg.speedMultiplier)
      expect(p.damageSkew).toBe(cfg.damageSkew)
    }
  })
})

// ─── Transition Interpolation ─────────────────────────────────────────────────

describe('Transition interpolation (CALM → BUILD at t=16)', () => {
  it('at transition start (t=16) params are near CALM values', () => {
    const ip = make()
    ip.update(16)
    const p = ip.getParams()
    const calm  = PHASE_CONFIG.CALM
    const build = PHASE_CONFIG.BUILD
    // t=0 of transition: should equal CALM values exactly
    expect(p.spawnCooldownMultiplier).toBeCloseTo(calm.spawnMultiplier)
    expect(p.hpMultiplier).toBeCloseTo(calm.hpMultiplier)
    expect(p.speedMultiplier).toBeCloseTo(calm.speedMultiplier)
  })

  it('at transition end (t=19) params are near BUILD values', () => {
    const ip = make()
    ip.update(16 + PHASE_TRANSITION_DURATION) // t=19
    const p = ip.getParams()
    const build = PHASE_CONFIG.BUILD
    expect(p.spawnCooldownMultiplier).toBeCloseTo(build.spawnMultiplier)
    expect(p.hpMultiplier).toBeCloseTo(build.hpMultiplier)
    expect(p.speedMultiplier).toBeCloseTo(build.speedMultiplier)
  })

  it('at transition midpoint (t=17.5) params are halfway between phases', () => {
    const ip = make()
    ip.update(16 + PHASE_TRANSITION_DURATION / 2) // t=17.5
    const p = ip.getParams()
    const calm  = PHASE_CONFIG.CALM
    const build = PHASE_CONFIG.BUILD
    const mid = (a, b) => (a + b) / 2
    expect(p.spawnCooldownMultiplier).toBeCloseTo(mid(calm.spawnMultiplier, build.spawnMultiplier))
    expect(p.hpMultiplier).toBeCloseTo(mid(calm.hpMultiplier, build.hpMultiplier))
    expect(p.speedMultiplier).toBeCloseTo(mid(calm.speedMultiplier, build.speedMultiplier))
  })

  it('just after transition window (t=19.1) params fully equal BUILD', () => {
    const ip = make()
    ip.update(19.1)
    const p = ip.getParams()
    const build = PHASE_CONFIG.BUILD
    expect(p.spawnCooldownMultiplier).toBeCloseTo(build.spawnMultiplier)
    expect(p.hpMultiplier).toBeCloseTo(build.hpMultiplier)
  })

  it('numeric params change monotonically through the transition', () => {
    const samples = []
    for (let dt = 0; dt <= PHASE_TRANSITION_DURATION; dt += 0.5) {
      const ip = make()
      ip.update(16 + dt)
      samples.push(ip.getParams().hpMultiplier)
    }
    // CALM hpMultiplier(0.7) < BUILD hpMultiplier(0.85) → should increase
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1] - 0.001)
    }
  })
})

describe('Transition interpolation (BUILD → PRESSURE at t=38)', () => {
  it('crisisEnabled becomes true immediately on entering PRESSURE', () => {
    const ip = make()
    ip.update(38) // just entered PRESSURE
    expect(ip.getParams().crisisEnabled).toBe(true)
  })

  it('crisisEnabled is false just before PRESSURE (t=37.9)', () => {
    const ip = make()
    ip.update(37.9)
    expect(ip.getParams().crisisEnabled).toBe(false)
  })
})

describe('Transition interpolation (PRESSURE → CLIMAX at t=63)', () => {
  it('at midpoint damageSkew switches from source to target', () => {
    // PRESSURE=standard, CLIMAX=hard; switch at midpoint (t=63+1.5=64.5)
    const before = make(); before.update(63 + PHASE_TRANSITION_DURATION * 0.4)
    const after  = make(); after.update(63 + PHASE_TRANSITION_DURATION * 0.6)
    expect(before.getParams().damageSkew).toBe('standard')
    expect(after.getParams().damageSkew).toBe('hard')
  })
})

describe('Transition interpolation (CLIMAX → RELIEF at t=81)', () => {
  it('hpMultiplier decreases from CLIMAX(1.2) to RELIEF(0.8) through transition', () => {
    const start = make(); start.update(81)
    const end   = make(); end.update(81 + PHASE_TRANSITION_DURATION)
    expect(start.getParams().hpMultiplier).toBeCloseTo(PHASE_CONFIG.CLIMAX.hpMultiplier)
    expect(end.getParams().hpMultiplier).toBeCloseTo(PHASE_CONFIG.RELIEF.hpMultiplier)
  })
})

// ─── getParams shape ─────────────────────────────────────────────────────────

describe('getParams return shape', () => {
  it('always contains all required keys', () => {
    const ip = make()
    const requiredKeys = [
      'spawnCooldownMultiplier',
      'hpMultiplier',
      'speedMultiplier',
      'damageSkew',
      'crisisEnabled',
    ]
    for (const t of [0, 15, 16, 37, 62, 80, 100]) {
      ip.update(t)
      const p = ip.getParams()
      for (const key of requiredKeys) {
        expect(p).toHaveProperty(key)
      }
    }
  })

  it('crisisEnabled is boolean', () => {
    const ip = make()
    for (const t of [0, 37, 62, 80]) {
      ip.update(t)
      expect(typeof ip.getParams().crisisEnabled).toBe('boolean')
    }
  })

  it('numeric params are always positive numbers', () => {
    const ip = make()
    for (let t = 0; t <= 100; t += 2) {
      ip.update(t)
      const p = ip.getParams()
      expect(p.spawnCooldownMultiplier).toBeGreaterThan(0)
      expect(p.hpMultiplier).toBeGreaterThan(0)
      expect(p.speedMultiplier).toBeGreaterThan(0)
    }
  })
})

// ─── update() idempotency ────────────────────────────────────────────────────

describe('update()', () => {
  it('calling update twice with same time gives same result', () => {
    const ip = make()
    ip.update(45)
    const p1 = ip.getParams()
    ip.update(45)
    const p2 = ip.getParams()
    expect(p1).toEqual(p2)
  })

  it('moving forward in time changes phase correctly', () => {
    const ip = make()
    ip.update(10)
    expect(ip.getCurrentPhase()).toBe('CALM')
    ip.update(50)
    expect(ip.getCurrentPhase()).toBe('PRESSURE')
  })
})
