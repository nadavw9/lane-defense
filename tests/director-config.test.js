import { describe, it, expect } from 'vitest'
import {
  COLORS,
  COLOR_UNLOCK_SCHEDULE,
  FIRE_DURATION_BY_DAMAGE,
  DAMAGE_WEIGHTS,
  PHASES,
  PHASE_CONFIG,
  PHASE_TRANSITION_DURATION,
  WORLD_CONFIG,
  HP_BASE,
  HP_VARIANCE,
  HP_MINIMUM,
  LANE_COUNT,
  LANE_LENGTH,
  CAR_GAP,
  SPAWN_QUEUE,
  LANE_PERSONALITIES,
  COLUMN_COUNT,
  COLUMN_DEPTH,
  CRISIS,
  SDR_LEVELS,
  COMBO_TIERS,
  COMBO_WINDOW,
  CARRYOVER_COIN_BONUS,
  DEPLOY_DILATION,
  ENDPOINT_SLOWDOWN,
  SPECIAL_CARS,
  MAX_SIMULTANEOUS_SPECIAL_CARS,
  WRONG_COLOR_INTERFERENCE,
  BOSS,
  RESCUE_TIME_BONUS,
  FAIRNESS,
  DEPTH_BAIT,
  SPECIAL_LEVEL_MODES,
  SIMULATION_TARGETS,
} from '../src/director/DirectorConfig.js'

// ─── Color Palette ────────────────────────────────────────────────────────────

describe('Color palette', () => {
  it('defines exactly 6 colors', () => {
    expect(COLORS.length).toBe(6)
  })

  it('includes Red and Blue as starter colors (unlock level 1)', () => {
    expect(COLOR_UNLOCK_SCHEDULE.Red).toBe(1)
    expect(COLOR_UNLOCK_SCHEDULE.Blue).toBe(1)
  })

  it('unlocks Green at level 8', () => {
    expect(COLOR_UNLOCK_SCHEDULE.Green).toBe(8)
  })

  it('unlocks Yellow at level 20', () => {
    expect(COLOR_UNLOCK_SCHEDULE.Yellow).toBe(20)
  })

  it('unlocks Orange at level 30', () => {
    expect(COLOR_UNLOCK_SCHEDULE.Orange).toBe(30)
  })

  it('every color in COLORS has an entry in COLOR_UNLOCK_SCHEDULE', () => {
    for (const color of COLORS) {
      expect(COLOR_UNLOCK_SCHEDULE).toHaveProperty(color)
    }
  })
})

// ─── Fire Duration Table ──────────────────────────────────────────────────────

describe('Fire duration table', () => {
  const expected = [
    [2, 1.5],
    [3, 1.7],
    [4, 1.9],
    [5, 2.0],
    [6, 2.2],
    [7, 2.3],
    [8, 2.5],
  ]

  for (const [damage, duration] of expected) {
    it(`damage ${damage} → ${duration}s`, () => {
      expect(FIRE_DURATION_BY_DAMAGE[damage]).toBe(duration)
    })
  }

  it('covers exactly damage values 2–8', () => {
    const keys = Object.keys(FIRE_DURATION_BY_DAMAGE).map(Number).sort((a, b) => a - b)
    expect(keys).toEqual([2, 3, 4, 5, 6, 7, 8])
  })

  it('all durations fall in the 1.5–2.5s spec range', () => {
    for (const d of Object.values(FIRE_DURATION_BY_DAMAGE)) {
      expect(d).toBeGreaterThanOrEqual(1.5)
      expect(d).toBeLessThanOrEqual(2.5)
    }
  })

  it('durations are monotonically increasing with damage', () => {
    const sorted = [2, 3, 4, 5, 6, 7, 8]
    for (let i = 1; i < sorted.length; i++) {
      expect(FIRE_DURATION_BY_DAMAGE[sorted[i]])
        .toBeGreaterThan(FIRE_DURATION_BY_DAMAGE[sorted[i - 1]])
    }
  })
})

// ─── Damage Weights ───────────────────────────────────────────────────────────

describe('Damage weights', () => {
  const modes = ['standard', 'hard', 'easy']

  for (const mode of modes) {
    describe(mode, () => {
      it('exists', () => {
        expect(DAMAGE_WEIGHTS[mode]).toBeDefined()
      })

      it('all values are valid damage tiers (2–8)', () => {
        for (const { value } of DAMAGE_WEIGHTS[mode]) {
          expect(value).toBeGreaterThanOrEqual(2)
          expect(value).toBeLessThanOrEqual(8)
        }
      })

      it('all weights are positive', () => {
        for (const { weight } of DAMAGE_WEIGHTS[mode]) {
          expect(weight).toBeGreaterThan(0)
        }
      })

      it('covers all 7 damage tiers', () => {
        const values = DAMAGE_WEIGHTS[mode].map(o => o.value).sort((a, b) => a - b)
        expect(values).toEqual([2, 3, 4, 5, 6, 7, 8])
      })
    })
  }

  it('hard mode skews lower (damage 2–3 weight sum > easy mode)', () => {
    const lowSum = (mode) =>
      DAMAGE_WEIGHTS[mode]
        .filter(o => o.value <= 3)
        .reduce((s, o) => s + o.weight, 0) /
      DAMAGE_WEIGHTS[mode].reduce((s, o) => s + o.weight, 0)
    expect(lowSum('hard')).toBeGreaterThan(lowSum('easy'))
  })

  it('easy mode skews higher (damage 6–8 weight sum > hard mode)', () => {
    const highSum = (mode) =>
      DAMAGE_WEIGHTS[mode]
        .filter(o => o.value >= 6)
        .reduce((s, o) => s + o.weight, 0) /
      DAMAGE_WEIGHTS[mode].reduce((s, o) => s + o.weight, 0)
    expect(highSum('easy')).toBeGreaterThan(highSum('hard'))
  })
})

// ─── Intensity Phases ─────────────────────────────────────────────────────────

describe('Intensity phases', () => {
  it('defines exactly 5 phases in correct order', () => {
    expect(PHASES).toEqual(['CALM', 'BUILD', 'PRESSURE', 'CLIMAX', 'RELIEF'])
  })

  it('every phase has a config entry', () => {
    for (const phase of PHASES) {
      expect(PHASE_CONFIG[phase]).toBeDefined()
    }
  })

  it('transition duration is 3 seconds', () => {
    expect(PHASE_TRANSITION_DURATION).toBe(3)
  })

  describe('spawn cooldowns', () => {
    it('CALM average cooldown is 4.2s', () => {
      expect(PHASE_CONFIG.CALM.spawnCooldown.average).toBe(4.2)
    })
    it('BUILD average cooldown is 3.0s (baseline)', () => {
      expect(PHASE_CONFIG.BUILD.spawnCooldown.average).toBe(3.0)
    })
    it('PRESSURE average cooldown is 2.1s', () => {
      expect(PHASE_CONFIG.PRESSURE.spawnCooldown.average).toBe(2.1)
    })
    it('CLIMAX average cooldown is 1.5s (fastest)', () => {
      expect(PHASE_CONFIG.CLIMAX.spawnCooldown.average).toBe(1.5)
    })
    it('RELIEF average cooldown is 3.5s', () => {
      expect(PHASE_CONFIG.RELIEF.spawnCooldown.average).toBe(3.5)
    })
    it('CLIMAX spawns fastest (lowest average cooldown)', () => {
      const averages = PHASES.map(p => PHASE_CONFIG[p].spawnCooldown.average)
      const min = Math.min(...averages)
      expect(PHASE_CONFIG.CLIMAX.spawnCooldown.average).toBe(min)
    })
    it('CALM spawns slowest (highest average cooldown)', () => {
      const averages = PHASES.map(p => PHASE_CONFIG[p].spawnCooldown.average)
      const max = Math.max(...averages)
      expect(PHASE_CONFIG.CALM.spawnCooldown.average).toBe(max)
    })
    it('min is always less than max for every phase', () => {
      for (const phase of PHASES) {
        const { min, max } = PHASE_CONFIG[phase].spawnCooldown
        expect(min).toBeLessThan(max)
      }
    })
  })

  describe('HP multipliers', () => {
    it('CLIMAX has the highest HP multiplier (1.2)', () => {
      expect(PHASE_CONFIG.CLIMAX.hpMultiplier).toBe(1.2)
    })
    it('CALM has the lowest HP multiplier (0.7)', () => {
      expect(PHASE_CONFIG.CALM.hpMultiplier).toBe(0.7)
    })
    it('BUILD HP multiplier is 0.85', () => {
      expect(PHASE_CONFIG.BUILD.hpMultiplier).toBe(0.85)
    })
    it('PRESSURE HP multiplier is 1.0 (baseline)', () => {
      expect(PHASE_CONFIG.PRESSURE.hpMultiplier).toBe(1.0)
    })
    it('RELIEF HP multiplier is 0.8', () => {
      expect(PHASE_CONFIG.RELIEF.hpMultiplier).toBe(0.8)
    })
  })

  describe('spawn multipliers', () => {
    it('BUILD is 1.0 (baseline)', () => {
      expect(PHASE_CONFIG.BUILD.spawnMultiplier).toBe(1.0)
    })
    it('CLIMAX is most aggressive (0.55)', () => {
      expect(PHASE_CONFIG.CLIMAX.spawnMultiplier).toBe(0.55)
    })
    it('CALM is most lenient (1.4)', () => {
      expect(PHASE_CONFIG.CALM.spawnMultiplier).toBe(1.4)
    })
  })

  describe('damage skew', () => {
    it('CALM and RELIEF use easy skew', () => {
      expect(PHASE_CONFIG.CALM.damageSkew).toBe('easy')
      expect(PHASE_CONFIG.RELIEF.damageSkew).toBe('easy')
    })
    it('CLIMAX uses hard skew', () => {
      expect(PHASE_CONFIG.CLIMAX.damageSkew).toBe('hard')
    })
    it('BUILD and PRESSURE use standard skew', () => {
      expect(PHASE_CONFIG.BUILD.damageSkew).toBe('standard')
      expect(PHASE_CONFIG.PRESSURE.damageSkew).toBe('standard')
    })
  })
})

// ─── World Config ─────────────────────────────────────────────────────────────

describe('World config', () => {
  it('defines exactly 5 worlds', () => {
    expect(Object.keys(WORLD_CONFIG).length).toBe(5)
  })

  const worldData = [
    [1, 1.0,  5.0, 0.5],
    [2, 1.15, 6.0, 0.5],
    [3, 1.3,  7.0, 0.7],
    [4, 1.5,  8.0, 0.8],
    [5, 1.7,  9.0, 1.0],
  ]

  for (const [world, hp, speed, variance] of worldData) {
    it(`world ${world}: hpMultiplier=${hp}, base speed=${speed}, variance=±${variance}`, () => {
      expect(WORLD_CONFIG[world].hpMultiplier).toBe(hp)
      expect(WORLD_CONFIG[world].speed.base).toBe(speed)
      expect(WORLD_CONFIG[world].speed.variance).toBe(variance)
    })
  }

  it('HP multipliers increase with each world', () => {
    for (let w = 2; w <= 5; w++) {
      expect(WORLD_CONFIG[w].hpMultiplier).toBeGreaterThan(WORLD_CONFIG[w - 1].hpMultiplier)
    }
  })

  it('base speeds increase with each world', () => {
    for (let w = 2; w <= 5; w++) {
      expect(WORLD_CONFIG[w].speed.base).toBeGreaterThan(WORLD_CONFIG[w - 1].speed.base)
    }
  })

  it('world base speeds span 5–9 units/sec across worlds (spec range)', () => {
    // The spec says speeds are 5–9 units/sec by world — world 1 base is 5, world 5 base is 9.
    expect(WORLD_CONFIG[1].speed.base).toBe(5)
    expect(WORLD_CONFIG[5].speed.base).toBe(9)
  })
})

// ─── HP Generation ────────────────────────────────────────────────────────────

describe('HP generation constants', () => {
  it('minimum HP is 2 (typed small cars have HP=2)', () => {
    expect(HP_MINIMUM).toBe(2)
    expect(HP_BASE.min).toBe(2)
  })

  it('maximum HP is 20', () => {
    expect(HP_BASE.max).toBe(20)
  })

  it('variance range is 0.85–1.15', () => {
    expect(HP_VARIANCE.min).toBe(0.85)
    expect(HP_VARIANCE.max).toBe(1.15)
  })
})

// ─── Lane / Column Constants ─────────────────────────────────────────────────

describe('Lane and column constants', () => {
  it('4 lanes', () => { expect(LANE_COUNT).toBe(4) })
  it('lane length is 100 units', () => { expect(LANE_LENGTH).toBe(100) })
  it('car gap is 8 units', () => { expect(CAR_GAP).toBe(8) })
  it('4 columns', () => { expect(COLUMN_COUNT).toBe(4) })
  it('column depth is 6 shooters', () => { expect(COLUMN_DEPTH).toBe(6) })
  it('spawn queue refills when below 4', () => { expect(SPAWN_QUEUE.refillThreshold).toBe(4) })
  it('spawn queue capacity range is 8–12', () => {
    expect(SPAWN_QUEUE.capacity.min).toBe(8)
    expect(SPAWN_QUEUE.capacity.max).toBe(12)
  })
  it('generation batch size is 4–6', () => {
    expect(SPAWN_QUEUE.batchSize.min).toBe(4)
    expect(SPAWN_QUEUE.batchSize.max).toBe(6)
  })
})

// ─── Lane Personalities ───────────────────────────────────────────────────────

describe('Lane personalities', () => {
  it('standard is always available (world 1)', () => {
    expect(LANE_PERSONALITIES.standard.unlocksWorld).toBe(1)
  })
  it('express: 1.3x speed, 0.7x HP, unlocks world 2', () => {
    expect(LANE_PERSONALITIES.express.speedMultiplier).toBe(1.3)
    expect(LANE_PERSONALITIES.express.hpMultiplier).toBe(0.7)
    expect(LANE_PERSONALITIES.express.unlocksWorld).toBe(2)
  })
  it('heavy: 0.7x speed, 1.4x HP, unlocks world 2', () => {
    expect(LANE_PERSONALITIES.heavy.speedMultiplier).toBe(0.7)
    expect(LANE_PERSONALITIES.heavy.hpMultiplier).toBe(1.4)
    expect(LANE_PERSONALITIES.heavy.unlocksWorld).toBe(2)
  })
  it('convoy unlocks world 3', () => {
    expect(LANE_PERSONALITIES.convoy.unlocksWorld).toBe(3)
  })
  it('vip unlocks world 4 with 3x coin multiplier', () => {
    expect(LANE_PERSONALITIES.vip.unlocksWorld).toBe(4)
    expect(LANE_PERSONALITIES.vip.coinMultiplier).toBe(3)
  })
})

// ─── CRISIS Assist ────────────────────────────────────────────────────────────

describe('CRISIS assist', () => {
  it('activation probability is 70%', () => {
    expect(CRISIS.probability).toBe(0.70)
  })
  it('cooldown is 15 seconds', () => {
    expect(CRISIS.cooldown).toBe(15)
  })
  it('SDR level 3 cooldown is 10 seconds', () => {
    expect(CRISIS.cooldownSdrLevel3).toBe(10)
  })
  it('triggers when car is at ≥70% distance', () => {
    expect(CRISIS.triggerDistanceRatio).toBe(0.70)
  })
  it('requires 2+ deploys within 10 seconds', () => {
    expect(CRISIS.requiredDeploysWindow).toBe(2)
    expect(CRISIS.deployWindowSeconds).toBe(10)
  })
  it('eligible in PRESSURE, CLIMAX, RELIEF phases', () => {
    expect(CRISIS.eligiblePhases).toContain('PRESSURE')
    expect(CRISIS.eligiblePhases).toContain('CLIMAX')
    expect(CRISIS.eligiblePhases).toContain('RELIEF')
    expect(CRISIS.eligiblePhases).not.toContain('CALM')
    expect(CRISIS.eligiblePhases).not.toContain('BUILD')
  })
  it('minimum damage on assist is 5', () => {
    expect(CRISIS.minimumDamageOnAssist).toBe(5)
  })
})

// ─── SDR Levels ───────────────────────────────────────────────────────────────

describe('Silent Difficulty Reduction', () => {
  it('defines 3 SDR levels', () => {
    expect(SDR_LEVELS.length).toBe(3)
  })

  const expected = [
    { failsRequired: 3,  hpMultiplier: 0.9, cooldownMultiplier: 1.1, damageBias: 0.10 },
    { failsRequired: 5,  hpMultiplier: 0.8, cooldownMultiplier: 1.2, damageBias: 0.20 },
    { failsRequired: 8,  hpMultiplier: 0.7, cooldownMultiplier: 1.3, damageBias: 0.30 },
  ]

  for (let i = 0; i < expected.length; i++) {
    const e = expected[i]
    it(`SDR level ${i + 1}: triggers at ${e.failsRequired} fails, ${e.hpMultiplier}x HP, ${e.cooldownMultiplier}x cooldown, +${e.damageBias * 100}% damage bias`, () => {
      expect(SDR_LEVELS[i].failsRequired).toBe(e.failsRequired)
      expect(SDR_LEVELS[i].hpMultiplier).toBe(e.hpMultiplier)
      expect(SDR_LEVELS[i].cooldownMultiplier).toBe(e.cooldownMultiplier)
      expect(SDR_LEVELS[i].damageBias).toBeCloseTo(e.damageBias)
    })
  }

  it('SDR level 3 overrides CRISIS cooldown to 10s', () => {
    expect(SDR_LEVELS[2].crisisCooldownOverride).toBe(10)
  })
})

// ─── Combo System ─────────────────────────────────────────────────────────────

describe('Combo system', () => {
  it('defines 4 combo tiers', () => {
    expect(COMBO_TIERS.length).toBe(4)
  })

  const expected = [
    { threshold: 3,  fireSpeedMultiplier: 1.2, coinBonus: 3,  duration: 4 },
    { threshold: 5,  fireSpeedMultiplier: 1.4, coinBonus: 8,  duration: 5 },
    { threshold: 8,  fireSpeedMultiplier: 1.6, coinBonus: 15, duration: 6 },
    { threshold: 12, fireSpeedMultiplier: 2.0, coinBonus: 25, duration: 8 },
  ]

  for (let i = 0; i < expected.length; i++) {
    const e = expected[i]
    it(`${e.threshold}-combo: ${e.fireSpeedMultiplier}x fire speed, +${e.coinBonus} coins, ${e.duration}s`, () => {
      expect(COMBO_TIERS[i].threshold).toBe(e.threshold)
      expect(COMBO_TIERS[i].fireSpeedMultiplier).toBe(e.fireSpeedMultiplier)
      expect(COMBO_TIERS[i].coinBonus).toBe(e.coinBonus)
      expect(COMBO_TIERS[i].duration).toBe(e.duration)
    })
  }

  it('combo window is 5 seconds', () => {
    expect(COMBO_WINDOW).toBe(5)
  })

  it('carry-over coin bonus is 5', () => {
    expect(CARRYOVER_COIN_BONUS).toBe(5)
  })

  it('fire speed multipliers increase with combo tier', () => {
    for (let i = 1; i < COMBO_TIERS.length; i++) {
      expect(COMBO_TIERS[i].fireSpeedMultiplier)
        .toBeGreaterThan(COMBO_TIERS[i - 1].fireSpeedMultiplier)
    }
  })
})

// ─── Deploy Time Dilation ─────────────────────────────────────────────────────

describe('Deploy time dilation', () => {
  it('all cars slow to 60% speed on deploy', () => {
    expect(DEPLOY_DILATION.speedMultiplier).toBe(0.60)
  })
  it('dilation lasts 0.3 seconds', () => {
    expect(DEPLOY_DILATION.duration).toBe(0.3)
  })
})

describe('Endpoint slowdown', () => {
  it('triggers at 85% distance', () => {
    expect(ENDPOINT_SLOWDOWN.triggerDistanceRatio).toBe(0.85)
  })
  it('applies 15% speed reduction (0.85x)', () => {
    expect(ENDPOINT_SLOWDOWN.speedMultiplier).toBe(0.85)
  })
})

// ─── Special Cars ─────────────────────────────────────────────────────────────

describe('Special cars', () => {
  it('shield and speedBurst unlock at world 3', () => {
    expect(SPECIAL_CARS.shield.unlocksWorld).toBe(3)
    expect(SPECIAL_CARS.speedBurst.unlocksWorld).toBe(3)
  })
  it('splitter unlocks at world 4', () => {
    expect(SPECIAL_CARS.splitter.unlocksWorld).toBe(4)
  })
  it('armored unlocks at world 5', () => {
    expect(SPECIAL_CARS.armored.unlocksWorld).toBe(5)
  })
  it('max 2 special cars visible simultaneously', () => {
    expect(MAX_SIMULTANEOUS_SPECIAL_CARS).toBe(2)
  })
  it('all spawn rate ranges have min < max', () => {
    for (const car of Object.values(SPECIAL_CARS)) {
      if (car.spawnRateRange) {
        expect(car.spawnRateRange[0]).toBeLessThan(car.spawnRateRange[1])
      }
    }
  })
})

// ─── Wrong-Color Interference ─────────────────────────────────────────────────

describe('Wrong-color interference', () => {
  it('deals 0 damage', () => {
    expect(WRONG_COLOR_INTERFERENCE.damage).toBe(0)
  })
  it('applies 20% speed reduction (0.8x)', () => {
    expect(WRONG_COLOR_INTERFERENCE.slowMultiplier).toBe(0.80)
  })
  it('slow lasts 2 seconds', () => {
    expect(WRONG_COLOR_INTERFERENCE.slowDuration).toBe(2)
  })
  it('unlocks at world 3', () => {
    expect(WRONG_COLOR_INTERFERENCE.unlocksWorld).toBe(3)
  })
})

// ─── Boss Config ─────────────────────────────────────────────────────────────

describe('Boss config', () => {
  it('boss level lasts 180 seconds', () => {
    expect(BOSS.levelDuration).toBe(180)
  })
  it('boss spawns at 60% mark (108s)', () => {
    expect(BOSS.spawnAtSeconds).toBe(108)
    expect(BOSS.spawnAtSeconds / BOSS.levelDuration).toBeCloseTo(0.6)
  })
  it('boss has 5x HP multiplier', () => {
    expect(BOSS.hpMultiplier).toBe(5)
  })
  it('boss base speed is 0.5x', () => {
    expect(BOSS.speedMultiplier).toBe(0.5)
  })
  it('rage triggers at 85% mark (153s)', () => {
    expect(BOSS.rageTriggerSeconds).toBe(153)
    expect(BOSS.rageTriggerSeconds / BOSS.levelDuration).toBeCloseTo(0.85)
  })
  it('color cycle is 6s normal, 3s rage', () => {
    expect(BOSS.colorCycleDuration).toBe(6)
    expect(BOSS.colorCycleRageDuration).toBe(3)
  })
  it('boss rescue adds 15 seconds', () => {
    expect(BOSS.rescueTimeBonus).toBe(15)
  })
  it('standard rescue adds 10 seconds', () => {
    expect(RESCUE_TIME_BONUS).toBe(10)
  })
})

// ─── Fairness Thresholds ──────────────────────────────────────────────────────

describe('Fairness thresholds', () => {
  it('FR-3: average damage must be ≥50% of average car HP', () => {
    expect(FAIRNESS.minDamageToHpRatio).toBe(0.50)
  })
  it('FR-4: no car HP exceeds 2.5x highest shooter damage', () => {
    expect(FAIRNESS.maxHpToDamageRatio).toBe(2.50)
  })
  it('FR-2: at most 3 of 4 front cars share same color', () => {
    expect(FAIRNESS.maxSameColorFrontCars).toBe(3)
  })
  it('FR-5: at least 2 distinct colors in top shooter row', () => {
    expect(FAIRNESS.minTopShooterColors).toBe(2)
  })
})

// ─── Simulation Targets ───────────────────────────────────────────────────────

describe('Simulation targets', () => {
  it('perfect play win rate: 95–100%', () => {
    expect(SIMULATION_TARGETS.winRatePerfectPlay.min).toBe(0.95)
    expect(SIMULATION_TARGETS.winRatePerfectPlay.max).toBe(1.00)
  })
  it('average play win rate: 70–80%', () => {
    expect(SIMULATION_TARGETS.winRateAveragePlay.min).toBe(0.70)
    expect(SIMULATION_TARGETS.winRateAveragePlay.max).toBe(0.80)
  })
  it('hard fairness violation rate: 0%', () => {
    expect(SIMULATION_TARGETS.fairnessViolationRate).toBe(0)
  })
  it('carry-over rate: 15–25%', () => {
    expect(SIMULATION_TARGETS.carryoverRate.min).toBe(0.15)
    expect(SIMULATION_TARGETS.carryoverRate.max).toBe(0.25)
  })
  it('CRISIS triggers 1–3 times per level', () => {
    expect(SIMULATION_TARGETS.crisisPerLevel.min).toBe(1)
    expect(SIMULATION_TARGETS.crisisPerLevel.max).toBe(3)
  })
  it('average combo length: 3–5 kills', () => {
    expect(SIMULATION_TARGETS.avgComboLength.min).toBe(3)
    expect(SIMULATION_TARGETS.avgComboLength.max).toBe(5)
  })
})
