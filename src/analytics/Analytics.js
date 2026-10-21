// Analytics — anonymous gameplay analytics via Firebase Realtime Database REST API.
//
// Design constraints:
//   • Fire-and-forget: every POST is best-effort. A failed request is silently
//     dropped so analytics NEVER block or degrade gameplay.
//   • Anonymous: player identity is a random UUID stored in localStorage.
//     No PII is ever collected.

import { installDayFor, dayIndex, sessionClock } from './retention.js';

const DB_URL = 'https://lanedefense-analytics-default-rtdb.firebaseio.com';

// Build label (CI sets VITE_APP_VERSION to the Play versionName), so a metric can be split by release.
const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? 'dev';
let _storage = null;
try { _storage = globalThis.localStorage ?? null; } catch { /* unavailable */ }
// Install day + days since, on every row: D1/D7/D30 come straight off the log (tools/funnel.mjs).
function _stamp(now = new Date()) {
  const installDay = installDayFor(_storage, now);
  return { installDay, dayIndex: dayIndex(installDay, now), v: APP_VERSION };
}

// Rules generation. Stamped on every row so data from the old numbered-bomb model never mixes
// with the one-hit ladder when win rates are compared against the sim bands.
export const RULES_MODEL = 'onehit-1';

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

// Off until the app has resolved the consent flow (Google UMP via AdManager) or
// the SDK failed to start. Note: a declined EEA consent still lets statistics
// through (legitimate interest, as privacy.html states); only ads personalisation
// is withheld.
let _enabled = false;
export function setAnalyticsEnabled(v) { _enabled = !!v; }

// The anonymous install ID, as the player can read it in Settings. A deletion
// request by email quotes this value; it is the only way to find their rows.
export function getInstallId() { return new Analytics()._playerId; }

export class Analytics {
  constructor() {
    this._playerId = this._getOrCreatePlayerId();
  }

  // Call once on app open. Records device info so we can segment by screen size.
  recordSessionStart() {
    this._post('events', {
      event:        'session_start',
      model:        RULES_MODEL,
      ..._stamp(),
      playerId:     this._playerId,
      timestamp:    Date.now(),
      deviceWidth:  window.innerWidth,
      deviceHeight: window.innerHeight,
    });
  }

  // The app went to the background (or closed) after `seconds` of play.
  recordSessionEnd(seconds) {
    this._post('events', { event: 'session_end', model: RULES_MODEL, playerId: this._playerId, seconds, ..._stamp(), timestamp: Date.now() });
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
    benchUsed,       // number of times a shooter was deployed from bench
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
      benchUsed,
      model:         RULES_MODEL,
      timestamp:     Date.now(),
      deviceWidth:   window.innerWidth,
      deviceHeight:  window.innerHeight,
    });
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  _getOrCreatePlayerId() {
    const KEY = 'ld_player_id';
    // Storage can throw (disabled, quota, private mode). Analytics must never stop the
    // game starting: fall back to a per-session id.
    let id = null;
    try { id = localStorage.getItem(KEY); } catch { /* unavailable */ }
    if (!id) {
      id = _genUUID();
      try { localStorage.setItem(KEY, id); } catch { /* unavailable */ }
    }
    return id;
  }

  // POST to a Firebase REST collection. Errors are swallowed at both the
  // Promise level (network failure) and the synchronous level (fetch missing).
  _post(collection, payload) {
    if (import.meta.env.DEV || !_enabled) return;   // dev/test runs and no-consent players send nothing
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

// Fire-and-forget discrete event logger. Wraps every failure so analytics
// never affect gameplay.
let _cachedId = null;   // anonymous install id, so per-player funnels (first-attempt win rate) can be built
export function logEvent(eventName, data) {
  if (import.meta.env.DEV || !_enabled) return;
  try {
    fetch(`${DB_URL}/events.json`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ event: eventName, model: RULES_MODEL, playerId: _cachedId ??= getInstallId(), ..._stamp(), ...data, ts: Date.now() }),
    }).catch(() => {});
  } catch (_) {}
}

// Sessions for retention: one session_start per app open or return after 30 minutes away, one
// session_end (with seconds played) each time the app leaves the foreground.
export function trackSessions(analytics, doc = globalThis.document) {
  const clock = sessionClock();
  if (clock.foreground()) analytics.recordSessionStart();
  doc?.addEventListener?.('visibilitychange', () => {
    if (doc.hidden) analytics.recordSessionEnd(clock.background());
    else if (clock.foreground()) analytics.recordSessionStart();
  });
}
