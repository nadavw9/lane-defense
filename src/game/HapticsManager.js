// HapticsManager — thin wrapper around @capacitor/haptics.
//
// Silently no-ops on web / desktop where Capacitor is unavailable.
// All methods are async but callers need not await them — haptics are
// fire-and-forget.

let _Haptics      = null;
let _ImpactStyle  = null;
let _available    = null;   // null = untested, true/false = cached result

async function _init() {
  if (_available !== null) return _available;
  try {
    const mod    = await import('@capacitor/haptics');
    _Haptics     = mod.Haptics;
    _ImpactStyle = mod.ImpactStyle;
    // Try one silent call to confirm the plugin is wired on this platform.
    await _Haptics.selectionStart();
    await _Haptics.selectionEnd();
    _available = true;
  } catch {
    _available = false;
  }
  return _available;
}

export class HapticsManager {
  constructor() {
    this._enabled = true;
    // Eagerly warm up the import so the first real call has no delay.
    _init().catch(() => {});
  }

  get enabled() { return this._enabled; }
  set enabled(v) { this._enabled = !!v; }

  /** Light tap — deploy a shooter, tap a button. */
  async light() {
    if (!this._enabled || !(await _init())) return;
    try { await _Haptics.impact({ style: _ImpactStyle.Light }); } catch {}
  }

  /** Medium impact — kill a car, earn a combo milestone. */
  async medium() {
    if (!this._enabled || !(await _init())) return;
    try { await _Haptics.impact({ style: _ImpactStyle.Medium }); } catch {}
  }

  /** Heavy thud — breach / game over. */
  async heavy() {
    if (!this._enabled || !(await _init())) return;
    try { await _Haptics.impact({ style: _ImpactStyle.Heavy }); } catch {}
  }

  /** Gentle selection tick — drag hover, slider nudge. */
  async selection() {
    if (!this._enabled || !(await _init())) return;
    try {
      await _Haptics.selectionStart();
      await _Haptics.selectionEnd();
    } catch {}
  }
}
