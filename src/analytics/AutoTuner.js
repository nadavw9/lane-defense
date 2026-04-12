// AutoTuner — passive difficulty adjustment driven by real win-rate data.
//
// On startup it fetches the 50 most-recent sessions from Firebase (fire-and-
// forget).  For each level with ≥ 5 sessions it computes a win rate and
// nudges a per-level modifier stored in localStorage:
//
//   win rate < 60%  → speed × 0.90, HP × 0.90  (capped at 0.50 / 0.40)
//   win rate > 95%  → speed × 1.05             (capped at 2.0)
//
// Modifiers compound on repeated runs (each fetch applies one increment).
// LevelManager reads getModifier(levelId) when building a level config.
//
// Never blocks game startup — if the fetch fails, cached localStorage
// values are used unchanged.

const DB_URL = 'https://lanedefense-analytics-default-rtdb.firebaseio.com/sessions.json';
const LS_KEY = 'lanedefense_autotuner_v1';

const MIN_SAMPLES    = 5;
const WIN_RATE_HARD  = 0.60;   // below this → ease
const WIN_RATE_EASY  = 0.95;   // above this → tighten
const EASE_SPEED     = 0.90;
const EASE_HP        = 0.90;
const TIGHTEN_SPEED  = 1.05;
const MIN_SPEED_FAC  = 0.50;
const MIN_HP_FAC     = 0.40;
const MAX_SPEED_FAC  = 2.00;

export class AutoTuner {
  constructor() {
    this._modifiers = this._load();
  }

  // Returns { speedFactor, hpFactor } for a level id.
  // Both default to 1.0 when no modifier has been computed yet.
  getModifier(levelId) {
    return this._modifiers[levelId] ?? { speedFactor: 1.0, hpFactor: 1.0 };
  }

  // Kick off the async fetch.  Returns immediately — never awaited by caller.
  startFetch() {
    this._fetchAndUpdate().catch(() => {
      // Silently keep existing localStorage modifiers.
    });
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  async _fetchAndUpdate() {
    // Firebase REST: orderBy="$key" + limitToLast gives ~chronological 50 newest.
    const url = `${DB_URL}?orderBy=%22%24key%22&limitToLast=50`;
    const res  = await fetch(url);
    if (!res.ok) return;

    const raw = await res.json();
    if (!raw || typeof raw !== 'object') return;

    const sessions = Object.values(raw).filter(Boolean);
    if (sessions.length === 0) return;

    this._computeModifiers(sessions);
    this._save();
  }

  _computeModifiers(sessions) {
    // Group by level id.
    const byLevel = {};
    for (const s of sessions) {
      const id = s.levelId ?? s.level ?? s.level_id;
      if (id == null) continue;
      const lvl = Number(id);
      if (!Number.isFinite(lvl)) continue;

      if (!byLevel[lvl]) byLevel[lvl] = { wins: 0, total: 0 };
      const won = s.won === true || s.won === 1 || s.outcome === 'win' || s.result === 'win';
      byLevel[lvl].total++;
      if (won) byLevel[lvl].wins++;
    }

    for (const [lvlStr, data] of Object.entries(byLevel)) {
      if (data.total < MIN_SAMPLES) continue;   // too few samples — don't guess
      const lvl     = Number(lvlStr);
      const winRate = data.wins / data.total;
      const cur     = this._modifiers[lvl] ?? { speedFactor: 1.0, hpFactor: 1.0 };

      if (winRate < WIN_RATE_HARD) {
        this._modifiers[lvl] = {
          speedFactor: Math.max(MIN_SPEED_FAC, cur.speedFactor * EASE_SPEED),
          hpFactor:    Math.max(MIN_HP_FAC,    cur.hpFactor    * EASE_HP),
        };
      } else if (winRate > WIN_RATE_EASY) {
        this._modifiers[lvl] = {
          speedFactor: Math.min(MAX_SPEED_FAC, cur.speedFactor * TIGHTEN_SPEED),
          hpFactor:    cur.hpFactor,
        };
      }
      // 60–95 %: no change — difficulty is in the target band.
    }
  }

  _load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  _save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(this._modifiers));
    } catch {
      // Storage quota exceeded or private-browsing restriction — ignore.
    }
  }
}
