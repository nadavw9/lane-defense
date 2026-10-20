// Retention stamps (2026-10-20). Every session row carries the player's install day and the number
// of local calendar days since, so D1 / D7 / D30 are read straight off the event log: the share of
// an install-day cohort with a session at dayIndex N (tools/funnel.mjs). Pure and storage-injected,
// no SDK: shared with The Math Wolf, whose telemetry must stay first-party.
import { localDateKey } from '../game/dateKeys.js';

const KEY = 'ld_install_day';
const NEW_SESSION_AFTER_MS = 30 * 60 * 1000;   // a return from the background after 30 min is a new session

/** 'YYYY-MM-DD' of the first day this install was seen. Storage failures fall back to today. */
export function installDayFor(storage, now = new Date()) {
  let day = null;
  try { day = storage?.getItem(KEY) ?? null; } catch { /* unavailable */ }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day ?? '')) {
    day = localDateKey(now);
    try { storage?.setItem(KEY, day); } catch { /* unavailable */ }
  }
  return day;
}

/** Local calendar days from installDay to now (0 on the install day). Noon-anchored: DST-safe. */
export function dayIndex(installDay, now = new Date()) {
  const [y, m, d] = installDay.split('-').map(Number);
  const a = Date.UTC(y, m - 1, d);
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/**
 * Sessions from app foreground/background. foreground() returns true when this is a NEW session
 * (first open, or back after 30 minutes away); background() returns the seconds just played.
 */
export function sessionClock(clock = () => Date.now()) {
  let since = null, leftAt = null;
  return {
    foreground() {
      const t = clock();
      const fresh = leftAt == null ? since == null : t - leftAt >= NEW_SESSION_AFTER_MS;
      since = t; leftAt = null;
      return fresh;
    },
    background() {
      const t = clock();
      const secs = since == null ? 0 : Math.round((t - since) / 1000);
      since = null; leftAt = t;
      return secs;
    },
  };
}
