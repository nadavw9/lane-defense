import { describe, it, expect, afterEach } from 'vitest';
import { isReducedMotion, setReducedMotion, motionScale } from '../src/game/MotionPrefs.js';
import { ProgressManager } from '../src/game/ProgressManager.js';

afterEach(() => { setReducedMotion(null); delete globalThis.matchMedia; delete globalThis.localStorage; });

describe('MotionPrefs', () => {
  it('follows the OS preference until the player chooses', () => {
    globalThis.matchMedia = () => ({ matches: true });
    expect(isReducedMotion()).toBe(true);
    setReducedMotion(false);
    expect(isReducedMotion()).toBe(false);
    setReducedMotion(null);
    expect(isReducedMotion()).toBe(true);
  });
  it('defaults to full motion when matchMedia is missing', () => {
    expect(isReducedMotion()).toBe(false);
    expect(motionScale(5)).toBe(5);
  });
  it('motionScale is zero when reduced', () => {
    setReducedMotion(true);
    expect(motionScale(5)).toBe(0);
  });
  it('the choice persists on the save and is null before it is made', () => {
    const store = {};
    globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
    const p = new ProgressManager();
    expect(p.reducedMotion).toBeNull();
    p.setReducedMotion(true);
    expect(new ProgressManager().reducedMotion).toBe(true);
  });
});
