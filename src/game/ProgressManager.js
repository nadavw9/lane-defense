// ProgressManager — read/write player progress to localStorage.
//
// Schema (key: 'lane-defense-v1'):
//   unlockedLevel  — highest level the player may start (1-20)
//   stars          — { "1": 3, "2": 2, ... }  best star count per level
//   coins          — total accumulated coins across sessions
//   boosters       — { swap: n, peek: n }  persistent booster inventory
//   dailyReward    — { day: 0-6, lastClaim: ms-timestamp | null }
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
    unlockedLevel: 1,
    stars:         {},
    coins:         0,
    boosters:      { swap: 3, peek: 3 },
    dailyReward:   { day: 0, lastClaim: null },
  };
}

export class ProgressManager {
  constructor() {
    this._data = this._load();
  }

  get unlockedLevel() { return this._data.unlockedLevel; }
  get coins()         { return this._data.coins; }

  getStars(levelId) {
    return this._data.stars[String(levelId)] ?? 0;
  }

  getBoosters() {
    return { ...this._data.boosters };
  }

  // Record a win: update best star count and unlock the next level.
  recordWin(levelId, stars) {
    const key = String(levelId);
    if ((this._data.stars[key] ?? 0) < stars) {
      this._data.stars[key] = stars;
    }
    // Unlock the next level (capped at 20).
    if (levelId >= this._data.unlockedLevel && levelId < 20) {
      this._data.unlockedLevel = levelId + 1;
    }
    this._save();
  }

  // Persist the running coin total (call after every level end or purchase).
  setCoins(amount) {
    this._data.coins = Math.max(0, Math.floor(amount));
    this._save();
  }

  // Deduct coins.  Returns false (and does nothing) if insufficient balance.
  spendCoins(amount) {
    if (this._data.coins < amount) return false;
    this._data.coins -= amount;
    this._save();
    return true;
  }

  // Persist booster counts at end of a level.
  setBoosters(swap, peek) {
    this._data.boosters = { swap: Math.max(0, swap), peek: Math.max(0, peek) };
    this._save();
  }

  // ── Daily reward ──────────────────────────────────────────────────────────

  // The next day index to claim (0–6).
  get dailyDay() { return this._data.dailyReward.day; }

  // True if 24+ hours have elapsed since the last claim (or never claimed).
  canClaimDaily() {
    const { lastClaim } = this._data.dailyReward;
    if (lastClaim === null) return true;
    return (Date.now() - lastClaim) >= MS_PER_DAY;
  }

  // Apply the current day's reward, advance the day counter, persist.
  // Returns the reward object { type, amount }, or null if not claimable.
  claimDaily() {
    if (!this.canClaimDaily()) return null;
    const day    = this._data.dailyReward.day;
    const reward = DAILY_REWARDS[day];

    if (reward.type === 'coins') {
      this._data.coins += reward.amount;
    } else if (reward.type === 'swap') {
      this._data.boosters.swap += reward.amount;
    } else if (reward.type === 'peek') {
      this._data.boosters.peek += reward.amount;
    }

    this._data.dailyReward.lastClaim = Date.now();
    this._data.dailyReward.day       = (day + 1) % 7;
    this._save();
    return reward;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d    = defaults();
        const saved = JSON.parse(raw);
        // Shallow merge for top-level fields, then deep-merge nested objects
        // so new sub-fields survive schema additions on old saves.
        Object.assign(d, saved);
        d.boosters    = Object.assign(defaults().boosters,    saved.boosters    ?? {});
        d.dailyReward = Object.assign(defaults().dailyReward, saved.dailyReward ?? {});
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
