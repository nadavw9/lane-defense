// Every first-time explanation is a moving picture (DemoCard + demoScenes, 2026-10-31). Pins:
// each guide card has a scene unless it points a hand at the real board; every scene is
// well-formed (lanes, cars, bombs, boosters and ops reference what exists); copy stays short.
import { describe, it, expect } from 'vitest';
import { DEMO_SCENES } from '../src/screens/demoScenes.js';
import { CARDS } from '../src/screens/guideContent.js';

// Cards that stay a GuideCard on purpose: they ring a REAL board element and animate a hand there,
// or have their own bespoke animated card.
const HAND_GUIDED = new Set(['second_colour', 'bridge_guide']);
const BESPOKE = new Set(['barrier_down', 'wave_incoming']);
const OPS = new Set(['shot', 'bounce', 'shrink', 'grow', 'boom', 'advance', 'bridge', 'snap', 'hit', 'tag', 'counter', 'glow', 'unglow',
  'light', 'freeze', 'boosterTap', 'boosterPlus', 'recolor', 'plate', 'gift', 'surge', 'goalTick', 'wait']);

describe('demo scenes cover the cards', () => {
  it('every text card has a scene, except the hand-guided and bespoke ones', () => {
    const missing = Object.entries(CARDS)
      .filter(([key, card]) => card && !HAND_GUIDED.has(key) && !BESPOKE.has(key) && !DEMO_SCENES[key])
      .map(([key]) => key);
    expect(missing).toEqual([]);
  });

  it('the speeder lesson exists (bridge it in front, then shoot)', () => {
    expect(DEMO_SCENES.speeder).toBeTruthy();
    expect(DEMO_SCENES.speeder.scene.steps.some(s => s[1] === 'snap')).toBe(true);
  });
});

describe('every scene is well-formed', () => {
  for (const [key, def] of Object.entries(DEMO_SCENES)) {
    it(`${key}`, () => {
      expect(def.title.length).toBeGreaterThan(0);
      expect(def.caption.length).toBeLessThanOrEqual(80);
      const S = def.scene;
      expect(S.lanes).toBeGreaterThanOrEqual(1);
      expect(S.lanes).toBeLessThanOrEqual(3);
      for (const c of S.cars) {
        expect(c.lane).toBeGreaterThanOrEqual(0); expect(c.lane).toBeLessThan(S.lanes);
        expect(c.row).toBeGreaterThanOrEqual(0); expect(c.row).toBeLessThanOrEqual(2);
      }
      let last = -1;
      for (const step of S.steps) {
        const [t, op, ...args] = step;
        expect(OPS.has(op)).toBe(true);
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThan(S.loop);
        expect(t).toBeGreaterThanOrEqual(last);           // steps in time order
        last = t;
        if (op === 'shot' || op === 'bounce') { expect(S.bombs[args[0]]).toBeTruthy(); expect(args[1]).toBeLessThan(S.lanes); }
        if (op === 'boosterTap' || op === 'boosterPlus') expect(S.boosters).toContain(args[0]);
        if (op === 'bridge' || op === 'snap') { expect(Math.abs(args[0] - args[1])).toBe(1); expect(Math.max(args[0], args[1])).toBeLessThan(S.lanes); }
        if (op === 'glow' && typeof args[0] === 'number') expect(S.bombs[args[0]]).toBeTruthy();
      }
    });
  }
});
