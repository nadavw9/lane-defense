// ProgressManager — read/write player progress to localStorage.
//
// Schema (key: 'lane-defense-v1'):
//   unlockedLevel  — highest level the player may start (1-20)
//   stars          — { "1": 3, "2": 2, ... }  best star count per level
//   coins          — total accumulated coins across sessions
//   boosters       — { swap: n, peek: n }  persistent booster inventory
const STORAGE_KEY = 'lane-defense-v1';

function defaults() {
  return {
    unlockedLevel: 1,
    stars:         {},
    coins:         0,
    boosters:      { swap: 3, peek: 3 },
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

  // ── Private ────────────────────────────────────────────────────────────────

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        // Merge over defaults so new fields survive schema additions.
        return Object.assign(defaults(), JSON.parse(raw));
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
