// DailyChallengeManager — generates today's daily challenge level config.
// The day index is seeded from the date so every player sees the same challenge.
// Challenge configs are full level config objects compatible with applyLevelConfig().

const CHALLENGES = [
  {
    name:        'Speed Round',
    desc:        'Cars move twice as fast — but they have low HP',
    colors:      ['Red', 'Blue', 'Green'],
    worldConfig: { hpMultiplier: 0.35, speed: { base: 9.0, variance: 1.0 } },
    duration:    100,
  },
  {
    name:        'Tank Invasion',
    desc:        'Triple HP — bring your hardest-hitting shooters!',
    colors:      ['Red', 'Blue', 'Green'],
    worldConfig: { hpMultiplier: 1.80, speed: { base: 3.5, variance: 0.3 } },
    duration:    100,
  },
  {
    name:        'Monochrome',
    desc:        'Only red cars — but they never stop coming',
    colors:      ['Red'],
    worldConfig: { hpMultiplier: 1.0, speed: { base: 5.5, variance: 0.5 } },
    duration:    100,
  },
  {
    name:        'Blitz',
    desc:        'Fast and furious — half HP but relentless spawns',
    colors:      ['Red', 'Blue', 'Green'],
    worldConfig: { hpMultiplier: 0.55, speed: { base: 7.5, variance: 1.0 } },
    duration:    100,
  },
  {
    name:        'Endurance',
    desc:        '150 seconds — the longest haul of your life',
    colors:      ['Red', 'Blue', 'Green'],
    worldConfig: { hpMultiplier: 1.0, speed: { base: 4.5, variance: 0.5 } },
    duration:    150,
  },
  {
    name:        'Rainbow Rush',
    desc:        'All six colors at once — stay sharp!',
    colors:      ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
    worldConfig: { hpMultiplier: 0.80, speed: { base: 5.5, variance: 0.6 } },
    duration:    100,
  },
  {
    name:        'Sudden Death',
    desc:        'Harder cars, tighter timer — no rescue if you fail',
    colors:      ['Red', 'Blue', 'Green'],
    worldConfig: { hpMultiplier: 1.15, speed: { base: 5.5, variance: 0.5 } },
    duration:    70,
    noRescue:    true,
  },
];

// Returns 'YYYY-MM-DD' for today's local date.
function todayDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Deterministic day index seeded from days since 2026-01-01.
function dayIndex() {
  const epoch = new Date(2026, 0, 1).getTime();
  return Math.max(0, Math.floor((Date.now() - epoch) / (1000 * 60 * 60 * 24)));
}

export class DailyChallengeManager {
  getTodayKey() {
    return todayDateKey();
  }

  // Returns a full level config object for today's challenge.
  // Merges the challenge definition with standard 4×4 full-board defaults.
  getChallenge() {
    const def = CHALLENGES[dayIndex() % CHALLENGES.length];
    return {
      id:         'daily',
      isDaily:    true,
      laneCount:  4,
      colCount:   4,
      showArrow:  false,
      noRescue:   def.noRescue ?? false,
      hintText:   `DAILY: ${def.name} — ${def.desc}`,
      name:       def.name,
      desc:       def.desc,
      colors:     def.colors,
      worldConfig: def.worldConfig,
      duration:   def.duration,
    };
  }
}
