// Local-calendar date keys. Every "once a day" feature (login streak, daily
// challenge) keys off the PLAYER'S day, so they all roll over at local
// midnight — not at UTC midnight, which is mid-morning or evening elsewhere.

const pad = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' in the local timezone. */
export function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The local key for the calendar day before `d` (DST-safe: steps by calendar day). */
export function previousLocalDateKey(d = new Date()) {
  return localDateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 12));
}

/** Legacy UTC key, still found in saves written before the local-date change. */
export function utcDateKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}
