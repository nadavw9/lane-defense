// Analytics — anonymous gameplay analytics via Firebase Realtime Database REST API.
//
// Design constraints:
//   • Fire-and-forget: every POST is best-effort. A failed request is silently
//     dropped so analytics NEVER block or degrade gameplay.
//   • Anonymous: player identity is a random UUID stored in localStorage.
//     No PII is ever collected.

const DB_URL = 'https://lanedefense-analytics-default-rtdb.firebaseio.com';

function _genUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older Android WebViews.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export class Analytics {
  constructor() {
    this._playerId = this._getOrCreatePlayerId();
  }

  // Call once on app open. Records device info so we can segment by screen size.
  recordSessionStart() {
    this._post('events', {
      event:        'session_start',
      playerId:     this._playerId,
      timestamp:    Date.now(),
      deviceWidth:  window.innerWidth,
      deviceHeight: window.innerHeight,
    });
  }

  // Call after every level attempt (win, lose, or breach-with-rescue).
  // All numeric counters come from GameState; boostersUsed is tracked in GameApp.
  recordSession({
    levelId,
    result,          // 'win' | 'lose' | 'rescue'
    duration,        // seconds elapsed (integer)
    deploys,         // total shooter deploys
    correctDeploys,  // color-matched deploys
    wrongDeploys,    // color-mismatched deploys
    maxCombo,
    carsKilled,
    carryOvers,
    rescueUsed,      // boolean
    boostersUsed,    // string[] — names of activated boosters
  }) {
    this._post('sessions', {
      playerId:      this._playerId,
      levelId,
      result,
      duration:      Math.round(duration),
      deploys,
      correctDeploys,
      wrongDeploys,
      maxCombo,
      carsKilled,
      carryOvers,
      rescueUsed,
      boostersUsed,
      timestamp:     Date.now(),
      deviceWidth:   window.innerWidth,
      deviceHeight:  window.innerHeight,
    });
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  _getOrCreatePlayerId() {
    const KEY = 'ld_player_id';
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = _genUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  }

  // POST to a Firebase REST collection. Errors are swallowed at both the
  // Promise level (network failure) and the synchronous level (fetch missing).
  _post(collection, payload) {
    try {
      fetch(`${DB_URL}/${collection}.json`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      }).catch(() => {});
    } catch (_) {
      // fetch unavailable (SSR / test environment) — ignore.
    }
  }
}
