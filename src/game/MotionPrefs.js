// MotionPrefs — one switch for "reduce motion". Defaults to the OS preference
// (prefers-reduced-motion); the Settings toggle overrides it once the player
// has chosen. Read by anything that shakes or zooms the view.

let _override = null;   // null = follow the OS; true/false = the player's choice

function osPrefersReduced() {
  try { return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches; }
  catch { return false; }
}

export function isReducedMotion() {
  return _override ?? osPrefersReduced();
}

/** Apply the saved player choice (undefined/null = follow the OS). */
export function setReducedMotion(v) {
  _override = v == null ? null : !!v;
}

/** Scale a shake/zoom amplitude: full normally, none when reduced. */
export function motionScale(amount) {
  return isReducedMotion() ? 0 : amount;
}
