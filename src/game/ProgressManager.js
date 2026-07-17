// ProgressManager — read/write player progress to localStorage.
//
// Added fields (v1.1):
//   colorblindMode       — bool; shape-symbol overlay enabled
//   hapticsEnabled       — bool; haptic feedback enabled
//   sfxVolume            — 0.0–1.0
//   musicVolume          — 0.0–1.0
//   loginStreak          — { count: N, lastLogin: 'YYYY-MM-DD' }
//   ratingPromptShown    — bool; one-time app-rate prompt flag
// (v1.1 hearts/heartsLastDepleted removed in v1.7 — the lives system was vestigial;
//  see the _load migration and §3e City Repair which replaced it with cityState.)
const STORAGE_KEY = 'lane-defense-v1';

// 7-day reward sequence.  Exported so DailyRewardScreen can render labels.
export const DAILY_REWARDS = [
  { type: 'coins', amount: 10 },   // Day 1
  { type: 'coins', amount: 15 },   // Day 2
  { type: 'coins', amount: 20 },   // Day 3
  { type: 'swap',  amount: 1  },   // Day 4
  { type: 'coins', amount: 30 },   // Day 5
  { type: 'coins', amount: 25 },   // Day 6
  { type: 'coins', amount: 50 },   // Day 7
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function defaults() {
  return {
    unlockedLevel:          1,
    stars:                  {},
    coins:                  0,
    boosters:               { swap: 3, freeze: 0 },
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
    boosterUseCounts:       { swap: 0, freeze: 0 },
    // v1.1 additions (hearts/heartsLastDepleted removed v1.7 — see _load migration:
    // the lives system was vestigial, gameplay had no hearts gate since FIX 3).
    colorblindMode:      false,
    hapticsEnabled:      true,
    sfxVolume:           1.0,
    musicVolume:         1.0,
    loginStreak:         { count: 0, lastLogin: '' },
    ratingPromptShown:   false,
    survivalBest:        { wave: 0, kills: 0 },
    bestStats:           {},    // { [levelId]: { combo: N, time: N, stars: N } }
    // v1.2 additions
    streakShields:       1,    // charges to protect a broken streak
    lastSessionMs:       null, // ms timestamp of last app open (for offline reward)
    weeklyClaimedLevels: {},   // { weekKey: [levelId, ...] }
    // v1.3 additions
    crisisAssistsReceived:    0,  // times CRISIS assist fired (for achievement)
    totalCoinsSpent:          0,  // coins spent in shop (Big Spender achievement)
    totalDailyChallengesDone: 0,  // completed daily challenges (Daily Challenger achievement)
    // v1.4 onboarding — one-time lifetime tutorial hints (see OnboardingHints.js)
    hintHpMissShown:   false,  // car-survived-a-hit → "check the book" pointer
    hintDamageShown:   false,  // first bomb pickup on L1 → match-damage tooltip
    hintAdvanceShown:  false,  // first correct shot on L1 → "all cars advance" hint
    hintColorBombShown: false, // first rainbow bomb earned → color-bomb intro card
    // v1.5 — car types whose "Meet the ..." intro card has been shown (once EVER,
    // at level start; see GameApp level-start intros)
    introducedCarTypes: [],
    // v1.6 — DDA fail-streak mercy (§3d): consecutive fails per level, { [levelId]: n }.
    // Persistent by design — the player this assists is the one who comes back
    // tomorrow. Increment on final loss, reset on win. Consumed by src/game/dda.js
    // at level start; the sim NEVER reads it (see the dda.js tripwire test).
    failStreak: {},
    // v1.7 — City Repair meta-loop (§3e): { [buildingId]: 0 rubble | 1 scaffold | 2 repaired }.
    // One building per level node (buildingForLevel = identity). Repaired on win,
    // downgraded 2→1 on a final loss (never to 0). Backfilled from stars for veteran
    // saves (see _load) so a returning player's city reflects their real progress.
    cityState: {},
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

  // ── One-time onboarding hints (lifetime; persisted to localStorage) ────────
  get hintHpMissShown()  { return !!this._data.hintHpMissShown; }
  markHintHpMiss()       { this._data.hintHpMissShown = true; this._save(); }
  get hintDamageShown()  { return !!this._data.hintDamageShown; }
  markHintDamage()       { this._data.hintDamageShown = true; this._save(); }
  get hintAdvanceShown() { return !!this._data.hintAdvanceShown; }
  markHintAdvance()      { this._data.hintAdvanceShown = true; this._save(); }
  get hintColorBombShown() { return !!this._data.hintColorBombShown; }
  markHintColorBomb()      { this._data.hintColorBombShown = true; this._save(); }

  // ── Car-type intros (once per type EVER; shown at level start) ─────────────
  getIntroducedCarTypes() { return new Set(this._data.introducedCarTypes ?? []); }

  markCarTypeIntroduced(typeKey) {
    const seen = this.getIntroducedCarTypes();
    if (seen.has(typeKey)) return;
    seen.add(typeKey);
    this._data.introducedCarTypes = [...seen];
    this._save();
  }

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
    // §3d DDA: a win clears the mercy streak — next attempt starts at base.
    delete this._data.failStreak[key];
    this._save();
  }

  // ── DDA fail-streak (§3d) ──────────────────────────────────────────────────
  // Record a FINAL loss on a level (called at the no-rescue lose screen — a
  // breach that gets rescued and then won is not a fail). Numeric levels only;
  // the daily challenge is excluded (competitive integrity).
  recordLoss(levelId) {
    if (typeof levelId !== 'number') return;
    const key = String(levelId);
    this._data.failStreak[key] = (this._data.failStreak[key] ?? 0) + 1;
    this._save();
  }

  // Consecutive fails on a level (0 if never failed / last attempt won).
  getFailStreak(levelId) {
    return this._data.failStreak[String(levelId)] ?? 0;
  }

  setCoins(amount) {
    this._data.coins = Math.max(0, Math.floor(amount));
    this._save();
  }

  spendCoins(amount) {
    if (this._data.coins < amount) return false;
    this._data.coins -= amount;
    this._data.totalCoinsSpent = (this._data.totalCoinsSpent ?? 0) + Math.floor(amount);
    this._save();
    return true;
  }

  setBoosters(swap, freeze = 0) {
    this._data.boosters = {
      swap:   Math.max(0, swap),
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
    const max = Math.max(counts.swap ?? 0, counts.freeze ?? 0);
    if (max === 0) return 'None';
    if (counts.swap === max) return 'Swap';
    return 'Freeze';
  }

  getTotalStars() {
    return Object.values(this._data.stars).reduce((sum, val) => sum + val, 0);
  }

  // ── Daily reward ──────────────────────────────────────────────────────────

  // ── City Repair (§3e) ─────────────────────────────────────────────────────
  // level select IS the city; every beaten level repairs one building; state saved.
  // buildingForLevel is identity for now (one building per level node) — kept a
  // function so a future coarser mapping changes one place.

  getCityState() { return { ...this._data.cityState }; }

  buildingForLevel(levelId) { return levelId; }

  // A win repairs the level's building (→ 2 repaired). Idempotent.
  repairBuilding(buildingId) {
    if (buildingId == null) return;
    this._data.cityState[String(buildingId)] = 2;
    this._save();
  }

  // A FINAL loss scuffs a REPAIRED building down to scaffolding (2→1) — losses
  // sting, they don't erase. Never drops below 1; leaves rubble (0)/absent alone.
  damageBuilding(buildingId) {
    if (buildingId == null) return;
    const key = String(buildingId);
    if ((this._data.cityState[key] ?? 0) === 2) {
      this._data.cityState[key] = 1;
      this._save();
    }
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

  /** Call once per app open to update the streak.
   *  Returns { count, wasReset, prevCount } so callers can offer a shield. */
  touchLoginStreak() {
    const today  = new Date().toISOString().slice(0, 10);
    const streak = this._data.loginStreak ?? { count: 0, lastLogin: '' };
    const last   = streak.lastLogin;
    const prev   = streak.count;

    if (last === today) return { count: prev, wasReset: false, prevCount: prev };

    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const continued = last === yesterday;
    const newCount  = continued ? prev + 1 : 1;
    this._data.loginStreak = { count: newCount, lastLogin: today };
    this._save();
    return { count: newCount, wasReset: !continued && prev > 0, prevCount: prev };
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
    this._data.totalDailyChallengesDone = (this._data.totalDailyChallengesDone ?? 0) + 1;
    this._save();
  }

  // ── Streak shield ─────────────────────────────────────────────────────────

  get streakShields() { return this._data.streakShields ?? 1; }

  hasStreakShield() { return (this._data.streakShields ?? 1) > 0; }

  addStreakShield(n = 1) {
    this._data.streakShields = (this._data.streakShields ?? 0) + n;
    this._save();
  }

  /** Spend one shield to restore yesterday's streak count. Returns true on success. */
  useStreakShield(prevCount) {
    if (!this.hasStreakShield()) return false;
    this._data.streakShields = Math.max(0, (this._data.streakShields ?? 1) - 1);
    // Restore the streak as if today continues yesterday.
    const today = new Date().toISOString().slice(0, 10);
    this._data.loginStreak = { count: prevCount + 1, lastLogin: today };
    this._save();
    return true;
  }

  // ── Offline coin reward ────────────────────────────────────────────────────
  // Awards 1 coin per 5 minutes away, capped at 20 coins. Min absence: 30 min.
  // Stamps lastSessionMs on every call so the next call measures correctly.

  claimOfflineReward() {
    const now    = Date.now();
    const last   = this._data.lastSessionMs ?? null;
    this._data.lastSessionMs = now;
    this._save();

    if (last === null) return null;                      // first ever launch
    const awayMin = (now - last) / 60000;
    if (awayMin < 30) return null;                       // wasn't away long enough

    const coins = Math.min(20, Math.floor(awayMin / 5));
    if (coins <= 0) return null;

    this._data.coins            += coins;
    this._data.totalCoinsEarned += coins;
    this._save();
    return { coins, awayMin: Math.floor(awayMin) };
  }

  // ── Weekly playlist tracking ───────────────────────────────────────────────

  hasClaimedWeeklyLevel(levelId, weekKey) {
    const claimed = this._data.weeklyClaimedLevels?.[weekKey] ?? [];
    return claimed.includes(levelId);
  }

  markClaimedWeeklyLevel(levelId, weekKey) {
    if (!this._data.weeklyClaimedLevels) this._data.weeklyClaimedLevels = {};
    const arr = this._data.weeklyClaimedLevels[weekKey] ?? [];
    if (!arr.includes(levelId)) {
      arr.push(levelId);
      this._data.weeklyClaimedLevels[weekKey] = arr;
      this._save();
    }
  }

  // ── v1.3 counters ─────────────────────────────────────────────────────────

  get crisisAssistsReceived()    { return this._data.crisisAssistsReceived    ?? 0; }
  get totalCoinsSpent()          { return this._data.totalCoinsSpent          ?? 0; }
  get totalDailyChallengesDone() { return this._data.totalDailyChallengesDone ?? 0; }

  incrementCrisisAssists() {
    this._data.crisisAssistsReceived = (this._data.crisisAssistsReceived ?? 0) + 1;
    this._save();
  }

  addCoinsSpent(amount) {
    if (amount > 0) {
      this._data.totalCoinsSpent = (this._data.totalCoinsSpent ?? 0) + Math.floor(amount);
      this._save();
    }
  }

  incrementDailyChallengesDone() {
    this._data.totalDailyChallengesDone = (this._data.totalDailyChallengesDone ?? 0) + 1;
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
        // Migration: earlier builds tracked intro-seen car types in a separate
        // localStorage key AND re-showed intros mid-level with no backfill, so
        // mid-progression players were re-introduced to types they met long ago.
        // Merge the legacy key, then backfill from progression — anyone past a
        // type's historical intro level has already met that type.
        const INTRO_LEVEL = { small: 1, big: 2, jeep: 5, truck: 9, bigrig: 13, tank: 15 };
        const introduced  = new Set(saved.introducedCarTypes ?? []);
        try {
          for (const t of JSON.parse(localStorage.getItem('lane_defense_seen_car_types') ?? '[]')) {
            introduced.add(t);
          }
        } catch { /* legacy key corrupt — ignore */ }
        for (const [type, lvl] of Object.entries(INTRO_LEVEL)) {
          if (d.unlockedLevel > lvl) introduced.add(type);
        }
        d.introducedCarTypes = [...introduced];

        // ── v1.7 migration (§3e) — ONE migration, two schema changes ──────────
        // (a) Strip the vestigial hearts fields. Object.assign(d, saved) carried
        //     them from old saves; defaults() no longer declares them and the
        //     lives system is deleted (gameplay had no hearts gate since FIX 3).
        delete d.hearts;
        delete d.heartsLastDepleted;
        // (b) Backfill cityState ONLY when the save has none — a veteran's already
        //     beaten levels (stars ≥ 1) become repaired buildings, honoring the
        //     VISION retroactively from truth already in the save (same pattern as
        //     the intro-card backfill above). PRESENCE-DRIVEN GUARD: this must run
        //     at most once. Re-deriving on a save that ALREADY has cityState would
        //     silently repair a damaged (2→1) building back to 2 on the next load —
        //     so once a city is persisted, never re-derive it from stars.
        if (saved.cityState == null) {
          const city = {};
          for (const [lvl, stars] of Object.entries(d.stars ?? {})) {
            if (stars >= 1) city[String(this.buildingForLevel(Number(lvl)))] = 2;
          }
          d.cityState = city;
        }
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
