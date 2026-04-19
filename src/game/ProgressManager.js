// ProgressManager — read/write player progress to localStorage.
//
// Added fields (v1.1):
//   hearts               — current life count (0-5)
//   heartsLastDepleted   — ms timestamp when hearts were last below max (null = full)
//   colorblindMode       — bool; shape-symbol overlay enabled
//   hapticsEnabled       — bool; haptic feedback enabled
//   sfxVolume            — 0.0–1.0
//   musicVolume          — 0.0–1.0
//   loginStreak          — { count: N, lastLogin: 'YYYY-MM-DD' }
//   ratingPromptShown    — bool; one-time app-rate prompt flag
const STORAGE_KEY = 'lane-defense-v1';

// 7-day reward sequence.  Exported so DailyRewardScreen can render labels.
export const DAILY_REWARDS = [
  { type: 'coins', amount: 10 },   // Day 1
  { type: 'coins', amount: 15 },   // Day 2
  { type: 'coins', amount: 20 },   // Day 3
  { type: 'swap',  amount: 1  },   // Day 4
  { type: 'coins', amount: 30 },   // Day 5
  { type: 'peek',  amount: 1  },   // Day 6
  { type: 'coins', amount: 50 },   // Day 7
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function defaults() {
  return {
    unlockedLevel:          1,
    stars:                  {},
    coins:                  0,
    boosters:               { swap: 3, peek: 3, freeze: 0 },
    dailyReward:            { day: 0, lastClaim: null },
    seenComboTip:           false,
    seenUnlocks:            {},
    achievements:           {},
    totalCoinsEarned:       0,
    totalBenchUses:         0,
    totalBoostersPurchased: 0,
    totalDailyClaims:       0,
    dailyChallenge:         { date: '', completed: false },
    totalCarsDestroyed:     0,
    longestCombo:           0,
    totalAccurateShots:     0,
    totalShots:             0,
    boosterUseCounts:       { swap: 0, peek: 0, freeze: 0 },
    // v1.1 additions
    hearts:              5,
    heartsLastDepleted:  null,
    colorblindMode:      false,
    hapticsEnabled:      true,
    sfxVolume:           1.0,
    musicVolume:         1.0,
    loginStreak:         { count: 0, lastLogin: '' },
    ratingPromptShown:   false,
    survivalBest:        { wave: 0, kills: 0 },
    bestStats:           {},    // { [levelId]: { combo: N, time: N, stars: N } }
  };
}
    totalCoinsEarned:       0,
    totalBenchUses:         0,
    totalBoostersPurchased: 0,
    totalDailyClaims:       0,
    dailyChallenge:         { date: '', completed: false },
    totalCarsDestroyed:     0,
    longestCombo:           0,
    totalAccurateShots:     0,
    totalShots:             0,
    boosterUseCounts:       { swap: 0, peek: 0, freeze: 0 },
  };
}

export class ProgressManager {
  constructor() {
    this._data = this._load();
  }

  // ── Basic stats ──────────────────────────────────────────────────────────

  get unlockedLevel()  { return this._data.unlockedLevel; }
  get coins()          { return this._data.coins; }
  get seenComboTip()   { return this._data.seenComboTip; }
  markSeenComboTip()   { this._data.seenComboTip = true; this._save(); }

  hasSeenUnlock(levelId) {
    return !!(this._data.seenUnlocks ?? {})[String(levelId)];
  }

  markSeenUnlock(levelId) {
    if (!this._data.seenUnlocks) this._data.seenUnlocks = {};
    this._data.seenUnlocks[String(levelId)] = true;
    this._save();
  }

  getStars(levelId) {
    return this._data.stars[String(levelId)] ?? 0;
  }

  getBoosters() {
    return { ...this._data.boosters };
  }

  // ── Level progression ────────────────────────────────────────────────────

  // Record a win: update best star count and unlock the next level.
  recordWin(levelId, stars) {
    const key = String(levelId);
    if ((this._data.stars[key] ?? 0) < stars) {
      this._data.stars[key] = stars;
    }
    if (levelId >= this._data.unlockedLevel && levelId < 40) {
      this._data.unlockedLevel = levelId + 1;
    }
    this._save();
  }

  setCoins(amount) {
    this._data.coins = Math.max(0, Math.floor(amount));
    this._save();
  }

  spendCoins(amount) {
    if (this._data.coins < amount) return false;
    this._data.coins -= amount;
    this._save();
    return true;
  }

  setBoosters(swap, peek, freeze = 0) {
    this._data.boosters = {
      swap:   Math.max(0, swap),
      peek:   Math.max(0, peek),
      freeze: Math.max(0, freeze),
    };
    this._save();
  }

  // ── Achievements ─────────────────────────────────────────────────────────

  hasAchievement(id) {
    return !!this._data.achievements[id];
  }

  awardAchievement(id) {
    this._data.achievements[id] = true;
    this._save();
  }

  // ── Lifetime stats (drive achievement checks) ─────────────────────────────

  get totalCoinsEarned()       { return this._data.totalCoinsEarned; }
  get totalBenchUses()         { return this._data.totalBenchUses; }
  get totalBoostersPurchased() { return this._data.totalBoostersPurchased; }
  get totalDailyClaims()       { return this._data.totalDailyClaims; }
  get totalCarsDestroyed()     { return this._data.totalCarsDestroyed; }
  get longestCombo()           { return this._data.longestCombo; }
  get totalAccurateShots()     { return this._data.totalAccurateShots; }
  get totalShots()             { return this._data.totalShots; }

  addEarnedCoins(amount) {
    if (amount > 0) {
      this._data.totalCoinsEarned += Math.floor(amount);
      this._save();
    }
  }

  incrementBenchUses() {
    this._data.totalBenchUses++;
    this._save();
  }

  incrementBoostersPurchased() {
    this._data.totalBoostersPurchased++;
    this._save();
  }

  recordKill() {
    this._data.totalCarsDestroyed++;
    this._save();
  }

  recordCombo(comboCount) {
    if (comboCount > this._data.longestCombo) {
      this._data.longestCombo = comboCount;
      this._save();
    }
  }

  recordShot(isAccurate = false) {
    this._data.totalShots++;
    if (isAccurate) {
      this._data.totalAccurateShots++;
    }
    this._save();
  }

  recordBoosterUsed(boosterType) {
    // boosterType: 'swap', 'peek', or 'freeze'
    if (this._data.boosterUseCounts[boosterType] !== undefined) {
      this._data.boosterUseCounts[boosterType]++;
      this._save();
    }
  }

  getAccuracy() {
    return Math.round((this._data.totalAccurateShots / Math.max(1, this._data.totalShots)) * 100);
  }

  getFavoriteBooster() {
    const counts = this._data.boosterUseCounts;
    const max = Math.max(counts.swap ?? 0, counts.peek ?? 0, counts.freeze ?? 0);
    if (max === 0) return 'None';
    if (counts.swap === max) return 'Swap';
    if (counts.peek === max) return 'Peek';
    return 'Freeze';
  }

  getTotalStars() {
    return Object.values(this._data.stars).reduce((sum, val) => sum + val, 0);
  }

  // ── Daily reward ──────────────────────────────────────────────────────────

  // ── Hearts (lives) ────────────────────────────────────────────────────────

  get hearts()             { return this._data.hearts ?? 5; }
  get heartsLastDepleted() { return this._data.heartsLastDepleted ?? null; }

  setHearts(count, anchor) {
    this._data.hearts             = Math.max(0, Math.min(5, count));
    this._data.heartsLastDepleted = anchor ?? null;
    this._save();
  }

  // ── User preferences ──────────────────────────────────────────────────────

  get colorblindMode()  { return this._data.colorblindMode  ?? false; }
  get hapticsEnabled()  { return this._data.hapticsEnabled  ?? true; }
  get sfxVolume()       { return this._data.sfxVolume       ?? 1.0; }
  get musicVolume()     { return this._data.musicVolume     ?? 1.0; }

  setColorblindMode(v)  { this._data.colorblindMode  = !!v;                    this._save(); }
  setHapticsEnabled(v)  { this._data.hapticsEnabled  = !!v;                    this._save(); }
  setSfxVolume(v)       { this._data.sfxVolume        = Math.max(0, Math.min(1, +v)); this._save(); }
  setMusicVolume(v)     { this._data.musicVolume      = Math.max(0, Math.min(1, +v)); this._save(); }

  // ── Rating prompt ─────────────────────────────────────────────────────────

  get ratingPromptShown()  { return this._data.ratingPromptShown ?? false; }
  markRatingPromptShown()  { this._data.ratingPromptShown = true; this._save(); }

  // ── Survival high score ───────────────────────────────────────────────────

  get survivalBest() { return this._data.survivalBest ?? { wave: 0, kills: 0 }; }

  /** Record a survival run result. Returns true if it's a new high score. */
  recordSurvivalRun(wave, kills) {
    const best = this.survivalBest;
    if (wave > best.wave || (wave === best.wave && kills > best.kills)) {
      this._data.survivalBest = { wave, kills };
      this._save();
      return true;
    }
    return false;
  }

  // ── Per-level personal best ───────────────────────────────────────────────

  getBestStats(levelId) {
    return this._data.bestStats?.[String(levelId)] ?? null;
  }

  /**
   * Update personal best stats for a level.
   * Returns an array of strings describing what records were beaten
   * (e.g. ['combo', 'stars']), empty if nothing improved.
   */
  updateBestStats(levelId, { combo, time, stars }) {
    if (!this._data.bestStats) this._data.bestStats = {};
    const key  = String(levelId);
    const prev = this._data.bestStats[key] ?? { combo: 0, time: Infinity, stars: 0 };
    const improved = [];

    if (stars > prev.stars)   improved.push('stars');
    if (combo > prev.combo)   improved.push('combo');
    if (time  < prev.time)    improved.push('time');

    if (improved.length > 0) {
      this._data.bestStats[key] = {
        combo: Math.max(combo, prev.combo),
        time:  Math.min(time,  prev.time),
        stars: Math.max(stars, prev.stars),
      };
      this._save();
    }
    return improved;
  }

  // ── Login streak ──────────────────────────────────────────────────────────

  get loginStreak() { return this._data.loginStreak?.count ?? 0; }

  /** Call once per app open to update the streak. Returns new streak count. */
  touchLoginStreak() {
    const today  = new Date().toISOString().slice(0, 10);
    const streak = this._data.loginStreak ?? { count: 0, lastLogin: '' };
    const last   = streak.lastLogin;

    if (last === today) return streak.count;   // already touched today

    // Check if yesterday (to continue streak) or further back (reset).
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const newCount  = last === yesterday ? streak.count + 1 : 1;
    this._data.loginStreak = { count: newCount, lastLogin: today };
    this._save();
    return newCount;
  }

  get dailyDay() { return this._data.dailyReward.day; }

  canClaimDaily() {
    const { lastClaim } = this._data.dailyReward;
    if (lastClaim === null) return true;
    return (Date.now() - lastClaim) >= MS_PER_DAY;
  }

  // Apply current day's reward, advance counter, persist.
  // Returns reward { type, amount } or null if not claimable.
  claimDaily() {
    if (!this.canClaimDaily()) return null;
    const day    = this._data.dailyReward.day;
    const reward = DAILY_REWARDS[day];

    if      (reward.type === 'coins')  this._data.coins += reward.amount;
    else if (reward.type === 'swap')   this._data.boosters.swap   += reward.amount;
    else if (reward.type === 'peek')   this._data.boosters.peek   += reward.amount;
    else if (reward.type === 'freeze') this._data.boosters.freeze += reward.amount;

    this._data.dailyReward.lastClaim = Date.now();
    this._data.dailyReward.day       = (day + 1) % 7;
    this._data.totalDailyClaims++;
    this._save();
    return reward;
  }

  // ── Daily challenge ───────────────────────────────────────────────────────

  isDailyChallengeCompleted(dateKey) {
    return this._data.dailyChallenge.date === dateKey
        && this._data.dailyChallenge.completed;
  }

  // Mark today's challenge as completed and award bonus coins.
  completeDailyChallenge(dateKey, bonusCoins = 25) {
    this._data.dailyChallenge = { date: dateKey, completed: true };
    this._data.coins         += bonusCoins;
    this._data.totalCoinsEarned += bonusCoins;
    this._save();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d    = defaults();
        const saved = JSON.parse(raw);
        Object.assign(d, saved);
        // Deep-merge nested objects so new sub-fields survive schema additions.
        d.boosters           = Object.assign(defaults().boosters,           saved.boosters           ?? {});
        d.dailyReward        = Object.assign(defaults().dailyReward,        saved.dailyReward        ?? {});
        d.dailyChallenge     = Object.assign(defaults().dailyChallenge,     saved.dailyChallenge     ?? {});
        d.boosterUseCounts   = Object.assign(defaults().boosterUseCounts,   saved.boosterUseCounts   ?? {});
        d.achievements       = saved.achievements  ?? {};
        d.seenUnlocks        = saved.seenUnlocks   ?? {};
        return d;
      }
    } catch {
      // Corrupt or missing — start fresh.
    }
    return defaults();
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
    } catch {
      // Storage full or unavailable — silently continue.
    }
  }
}
