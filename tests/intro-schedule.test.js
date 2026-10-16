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
  it('all core teaching lands by L10, in the agreed order', () => {
    expect(Math.max(...Object.keys(LEVEL_START_CARDS).map(Number))).toBeLessThanOrEqual(10);
    const at = (k) => Number(Object.entries(LEVEL_START_CARDS).find(([, ks]) => ks.includes(k))[0]);
    expect(at('lane_2')).toBeLessThan(at('lane_3'));
    expect(at('freeze_booster')).toBeLessThan(at('colour_change_booster'));
    expect(at('colour_change_booster')).toBeLessThan(at('rainbow_bomb'));
  });
  it('lanes and colours are explained on the level that first has them', () => {
    expect(levelStartCards(firstLevel(c => c.laneCount >= 2))).toContain('lane_2');
    expect(levelStartCards(firstLevel(c => c.laneCount >= 3))).toContain('lane_3');
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
  it('core in-play teaching never reaches past L10', () => {
    for (const k of ['first_kill', 'bomb_earned', 'first_miss', 'hp_miss', 'streak_charged', 'rainbow_bomb'])
      expect(REACTIVE_WINDOW[k][1], k).toBeLessThanOrEqual(10);
  });
  it('play L1..L40 in order: every card key is taught at or before the level that needs it', () => {
    const taught = new Set(); const firstTaught = {};
    for (let l = 1; l <= 40; l++) {
      for (const k of levelStartCards(l)) { taught.add(k); firstTaught[k] ??= l; }
      for (const [k, [a, b]] of Object.entries(REACTIVE_WINDOW)) if (l >= a && l <= b) { taught.add(k); firstTaught[k] ??= l; }
    }
    for (const k of ['lane_2', 'lane_3', 'multi_color', 'combo', 'supercharge', 'goal_colour',
      'freeze_booster', 'colour_change_booster', 'rainbow_bomb', 'first_kill', 'first_miss', 'hp_miss', 'streak_charged', 'armor_break'])
      expect(firstTaught[k], k).toBeLessThanOrEqual(11);
  });
});

describe('visual fixtures', () => {
  it('seed every card key as seen, so specs are never blocked by a card', () => {
    const src = readFileSync(new URL('../tests-visual/fixtures/game.js', import.meta.url), 'utf8');
    const live = Object.entries(CARDS).filter(([, v]) => v).map(([k]) => k).concat('tour');
    for (const k of live) expect(src, k).toContain(`'${k}'`);
  });
});
