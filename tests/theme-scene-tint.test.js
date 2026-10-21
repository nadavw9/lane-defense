// The time-of-day wash (ThemeRegistry.sceneTint). The scenery is unlit sprites, so without it L5,
// L9 and L13 looked identical (polish pass, 2026-10-21).
import { describe, it, expect } from 'vitest';
import { THEMES, levelTheme } from '../src/renderer3d/ThemeRegistry.js';

describe('scenery tint', () => {
  it('the four Tutorial City times of day each look different', () => {
    const tints = ['morning', 'afternoon', 'sunset', 'misty'].map(k => THEMES[k].sceneTint);
    expect(new Set(tints).size).toBe(4);
    for (const t of tints) expect(t).toBeGreaterThanOrEqual(0x000000);
  });
  it('never darkens the scenery below readable (every channel at least 0x90)', () => {
    for (const [k, th] of Object.entries(THEMES)) {
      const t = th.sceneTint ?? 0xffffff;
      for (const ch of [(t >> 16) & 0xff, (t >> 8) & 0xff, t & 0xff]) expect(ch, k).toBeGreaterThanOrEqual(0x90);
    }
  });
  it('sunset is warm and misty is cool', () => {
    const s = levelTheme(9).sceneTint, m = levelTheme(13).sceneTint;
    expect((s >> 16) & 0xff).toBeGreaterThan(s & 0xff);        // red over blue
    expect(m & 0xff).toBeGreaterThan((m >> 16) & 0xff);        // blue over red
  });
});

describe('scenery glow (added over the baked backdrop)', () => {
  it('afternoon adds nothing; sunset adds warm light; misty adds a cool haze', () => {
    expect(THEMES.afternoon.sceneGlow).toBe(0);
    const s = THEMES.sunset.sceneGlow, m = THEMES.misty.sceneGlow;
    expect((s >> 16) & 0xff).toBeGreaterThan(s & 0xff);
    expect(m & 0xff).toBeGreaterThan((m >> 16) & 0xff);
  });
  it('stays a tint, not a blinding overlay (no channel above 0x60)', () => {
    for (const [k, th] of Object.entries(THEMES)) {
      const g = th.sceneGlow ?? 0;
      for (const ch of [(g >> 16) & 0xff, (g >> 8) & 0xff, g & 0xff]) expect(ch, k).toBeLessThanOrEqual(0x60);
    }
  });
});
