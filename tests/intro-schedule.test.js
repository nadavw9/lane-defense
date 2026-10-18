// The teaching schedule is hard-coded to fixed early levels. These tests pin that: a save that
// unlocks all 40 levels and plays them in order must be taught every mechanic by the level
// that introduces it, and nothing may first-appear late.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { LEVEL_START_CARDS, REACTIVE_WINDOW, levelStartCards, reactiveAllowed } from '../src/screens/introSchedule.js';
import { CARDS, stepsFor } from '../src/screens/guideContent.js';
import { LevelManager } from '../src/game/LevelManager.js';

const geo = new Proxy({}, { get: () => () => ({ x: 0, y: 0, w: 1, h: 1 }) });
const cfgs = (() => { const lm = new LevelManager(); return Array.from({ length: 100 }, (_, i) => { lm.goToLevel(i + 1); return lm.current; }); })();
const firstLevel = (pred) => cfgs.find(pred)?.id;

describe('level-start cards', () => {
  it('every scheduled key has a titled card with copy and a target that exists', () => {
    for (const [lvl, keys] of Object.entries(LEVEL_START_CARDS)) for (const k of keys) {
      const [step] = stepsFor(k, '', geo) ?? [];
      expect(step, `L${lvl} ${k}`).toBeTruthy();
      expect(step.title, k).toBeTruthy(); expect(step.text, k).toBeTruthy();
      if (CARDS[k].target) expect(step.target, k).toBeTypeOf('function');
    }
  });
  it('no card is scheduled twice', () => {
    const all = Object.values(LEVEL_START_CARDS).flat();
    expect(new Set(all).size).toBe(all.length);
  });
  it('all core teaching lands by L12, one card per level, in the agreed order (2026-10-18 pacing)', () => {
    const ELEMENT_CARDS = ['gift_car', 'traffic_light', 'convoy'];   // board elements, taught on their own levels
    const core = Object.entries(LEVEL_START_CARDS).filter(([, ks]) => ks.some(k => !ELEMENT_CARDS.includes(k)));
    expect(Math.max(...core.map(([l]) => Number(l)))).toBeLessThanOrEqual(12);
    for (const [l, ks] of Object.entries(LEVEL_START_CARDS)) expect(ks.length, `L${l}`).toBe(1);
    const at = (k) => Number(Object.entries(LEVEL_START_CARDS).find(([, ks]) => ks.includes(k))[0]);
    expect(at('multi_color')).toBeLessThan(at('supercharge'));
    expect(at('freeze_booster')).toBeLessThan(at('rainbow_bomb'));
    expect(at('rainbow_bomb')).toBeLessThan(at('colour_change_booster'));
  });
  it('booster cards sit on the level each booster arrives (boosterUnlocks.js)', async () => {
    const { BOOSTER_UNLOCK_LEVEL, RAINBOW_FROM } = await import('../src/game/boosterUnlocks.js');
    expect(levelStartCards(BOOSTER_UNLOCK_LEVEL.freeze)).toContain('freeze_booster');
    expect(levelStartCards(BOOSTER_UNLOCK_LEVEL.colorChange)).toContain('colour_change_booster');
    expect(levelStartCards(RAINBOW_FROM)).toContain('rainbow_bomb');
    expect(REACTIVE_WINDOW.freeze_earned[0]).toBe(BOOSTER_UNLOCK_LEVEL.freeze);
    expect(REACTIVE_WINDOW.colour_change_earned[0]).toBe(BOOSTER_UNLOCK_LEVEL.colorChange);
    expect(REACTIVE_WINDOW.rainbow_bomb[0]).toBe(RAINBOW_FROM);
  });
  it('gift cars, traffic lights and convoys are explained on the level that first has them', () => {
    expect(levelStartCards(firstLevel(c => (c.traits?.gift ?? 0) > 0))).toContain('gift_car');
    expect(levelStartCards(firstLevel(c => !!c.lights))).toContain('traffic_light');
    expect(levelStartCards(firstLevel(c => !!c.convoy))).toContain('convoy');
  });
  it('colours are explained on the level that first has them (extra lanes need no card)', () => {
    expect(levelStartCards(firstLevel(c => c.colors.length >= 2))).toContain('multi_color');
  });
  it('the colour goal is explained on the first colour-goal level', () => {
    expect(levelStartCards(firstLevel(c => (c.goals ?? []).some(g => g.type === 'destroyColor')))).toContain('goal_colour');
  });
  it('daily / non-numeric levels get no scheduled cards', () => {
    expect(levelStartCards('daily')).toEqual([]);
    expect(reactiveAllowed('first_kill', 'daily')).toBe(false);
  });
});

describe('in-play teaching windows', () => {
  it('a reactive key only fires inside its window', () => {
    expect(reactiveAllowed('first_kill', 1)).toBe(true);
    expect(reactiveAllowed('first_kill', 2)).toBe(false);
    expect(reactiveAllowed('first_miss', 1)).toBe(false);
    expect(reactiveAllowed('first_miss', 2)).toBe(true);
    expect(reactiveAllowed('first_miss', 30)).toBe(false);
    expect(reactiveAllowed('nope', 1)).toBe(false);
  });
  it('every window key has a card', () => {
    for (const k of Object.keys(REACTIVE_WINDOW)) {
      if (k === 'bomb_earned') continue;                    // uses the bomb tutorial, not a card
      expect(CARDS[k], k).toBeTruthy();
    }
  });
  it('trait windows sit exactly on the level that first has the trait', () => {
    const at = (t) => firstLevel(c => Object.keys(c.traits ?? {}).includes(t));
    expect(REACTIVE_WINDOW.armor_break).toEqual([at('armored'), at('armored')]);
    expect(REACTIVE_WINDOW.plate_break).toEqual([at('plated'), at('plated')]);
    expect(REACTIVE_WINDOW.mender_heal).toEqual([at('mender'), at('mender')]);
    expect(REACTIVE_WINDOW.volatile_surge).toEqual([at('volatile'), at('volatile')]);
  });
  it('core in-play teaching never reaches past L12', () => {
    for (const k of ['first_kill', 'bomb_earned', 'first_miss', 'streak_charged', 'rainbow_bomb'])
      expect(REACTIVE_WINDOW[k][1], k).toBeLessThanOrEqual(12);
  });
  it('play L1..L40 in order: every card key is taught at or before the level that needs it', () => {
    const taught = new Set(); const firstTaught = {};
    for (let l = 1; l <= 40; l++) {
      for (const k of levelStartCards(l)) { taught.add(k); firstTaught[k] ??= l; }
      for (const [k, [a, b]] of Object.entries(REACTIVE_WINDOW)) if (l >= a && l <= b) { taught.add(k); firstTaught[k] ??= l; }
    }
    for (const k of ['multi_color', 'supercharge', 'goal_colour',
      'freeze_booster', 'colour_change_booster', 'rainbow_bomb', 'first_kill', 'first_miss', 'streak_charged', 'armor_break'])
      expect(firstTaught[k], k).toBeLessThanOrEqual(12);
  });
});

describe('visual fixtures', () => {
  it('seed every card key as seen, so specs are never blocked by a card', () => {
    const src = readFileSync(new URL('../tests-visual/fixtures/game.js', import.meta.url), 'utf8');
    const live = Object.entries(CARDS).filter(([, v]) => v).map(([k]) => k).concat('tour');
    for (const k of live) expect(src, k).toContain(`'${k}'`);
  });
});
