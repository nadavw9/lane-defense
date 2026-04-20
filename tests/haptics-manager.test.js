// Tests for HapticsManager new methods:
//   killDouble(), comboMilestone()
// Since Capacitor is unavailable in the test environment, _init() will
// fail silently and all methods no-op. We just verify they exist, are
// async, and don't throw.

import { describe, it, expect } from 'vitest';
import { HapticsManager } from '../src/game/HapticsManager.js';

describe('HapticsManager new methods', () => {
  const h = new HapticsManager();

  it('killDouble is a function', () => {
    expect(typeof h.killDouble).toBe('function');
  });

  it('comboMilestone is a function', () => {
    expect(typeof h.comboMilestone).toBe('function');
  });

  it('killDouble returns a Promise (async)', () => {
    const r = h.killDouble();
    expect(r).toBeInstanceOf(Promise);
    return r; // resolves without throwing
  });

  it('comboMilestone returns a Promise (async)', () => {
    const r = h.comboMilestone();
    expect(r).toBeInstanceOf(Promise);
    return r;
  });

  it('killDouble does not throw when disabled', async () => {
    h.enabled = false;
    await expect(h.killDouble()).resolves.not.toThrow();
    h.enabled = true;
  });

  it('comboMilestone does not throw when disabled', async () => {
    h.enabled = false;
    await expect(h.comboMilestone()).resolves.not.toThrow();
    h.enabled = true;
  });

  it('all original methods still exist', () => {
    expect(typeof h.light).toBe('function');
    expect(typeof h.medium).toBe('function');
    expect(typeof h.heavy).toBe('function');
    expect(typeof h.selection).toBe('function');
  });
});
