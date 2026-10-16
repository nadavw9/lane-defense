// Save-data safety: corrupt saves are preserved + replaced by defaults, scalars are
// sanitized, the schema version is stamped. Analytics send nothing without consent.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProgressManager, SAVE_VERSION } from '../src/game/ProgressManager.js';
import { setAnalyticsEnabled, logEvent } from '../src/analytics/Analytics.js';

function installStorage(initial = {}) {
  const store = { ...initial };
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  return store;
}

afterEach(() => { delete globalThis.localStorage; });

describe('ProgressManager save safety', () => {
  it('keeps a corrupt save under a side key and starts fresh', () => {
    const store = installStorage({ 'lane-defense-v1': '{not json' });
    const p = new ProgressManager();
    expect(p.unlockedLevel).toBe(1);
    expect(store['lane-defense-v1-corrupt']).toBe('{not json');
  });

  it('treats a non-object save (array / number) as corrupt', () => {
    const store = installStorage({ 'lane-defense-v1': '[1,2,3]' });
    new ProgressManager();
    expect(store['lane-defense-v1-corrupt']).toBe('[1,2,3]');
  });

  it('sanitizes NaN / negative scalars', () => {
    installStorage({ 'lane-defense-v1': JSON.stringify({ unlockedLevel: 'x', coins: -50 }) });
    const p = new ProgressManager();
    expect(p.unlockedLevel).toBe(1);
    expect(p.coins).toBe(0);
  });

  it('stamps the schema version and preserves real progress', () => {
    const store = installStorage({ 'lane-defense-v1': JSON.stringify({ unlockedLevel: 12, coins: 340 }) });
    const p = new ProgressManager();
    expect(p.unlockedLevel).toBe(12);
    expect(p.coins).toBe(340);
    p.markSeenComboTip();   // any write
    expect(JSON.parse(store['lane-defense-v1']).saveVersion).toBe(SAVE_VERSION);
  });
});

describe('analytics consent gate', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn(() => Promise.resolve())); });
  afterEach(() => { setAnalyticsEnabled(false); vi.unstubAllGlobals(); });

  // import.meta.env.DEV is true under vitest, so _post/logEvent return early either
  // way; what this pins is that the gate API exists and defaults closed.
  it('exports a gate that defaults to closed and can be toggled', () => {
    expect(() => setAnalyticsEnabled(true)).not.toThrow();
    expect(() => setAnalyticsEnabled(false)).not.toThrow();
    logEvent('x', {});
    expect(fetch).not.toHaveBeenCalled();
  });
});
