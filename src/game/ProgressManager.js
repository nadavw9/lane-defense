// ProgressManager — read/write player progress to localStorage.
//
// Schema (key: 'lane-defense-v1'):
//   unlockedLevel          — highest level the player may start (1-20)
//   stars                  — { "1": 3, "2": 2, ... }  best star count per level
//   coins                  — total accumulated coins (current balance)
//   boosters               — { swap, peek, freeze }  persistent inventory
//   dailyReward            — { day: 0-6, lastClaim: ms-timestamp | null }
//   seenComboTip           — bool; one-time combo explanation popup
//   achievements           — { [id]: true }  earned achievement ids
//   totalCoinsEarned       — cumulative coins ever earned (for Collector)
//   totalBenchUses         — cumulative bench deploys (for Bench Warmer)
//   totalBoostersPurchased — cumulative shop purchases (for Shopkeeper)
//   totalDailyClaims       — cumulative daily reward claims (for Dedicated)
//   dailyChallenge         — { date: 'YYYY-MM-DD', completed: bool }
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
    seenUnlocks:            {},   // { "6": true, "8": true, ... }
    achievements:           {},
    totalCoinsEarned:       0,
    totalBenchUses:         0,
    totalBoostersPurchased: 0,
    totalDailyClaims:       0,
    dailyChallenge:         { date: '', completed: false },
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
    if (levelId >= this._data.unlockedLevel && levelId < 20) {
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

  // ── Daily reward ──────────────────────────────────────────────────────────

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
        d.boosters        = Object.assign(defaults().boosters,        saved.boosters        ?? {});
        d.dailyReward     = Object.assign(defaults().dailyReward,     saved.dailyReward     ?? {});
        d.dailyChallenge  = Object.assign(defaults().dailyChallenge,  saved.dailyChallenge  ?? {});
        d.achievements    = saved.achievements  ?? {};
        d.seenUnlocks     = saved.seenUnlocks   ?? {};
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
