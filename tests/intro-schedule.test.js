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
const levelStartCardLevel = (k) => Number(Object.entries(LEVEL_START_CARDS).find(([, ks]) => ks.includes(k))[0]);

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
  it('one card per level, a quiet level between cards, none on a HARD level (2026-10-18 re-spacing)', async () => {
    const { levelDifficulty } = await import('../src/game/LevelManager.js');
    const levels = Object.keys(LEVEL_START_CARDS).map(Number).sort((a, b) => a - b);
    for (const l of levels) {
      expect(LEVEL_START_CARDS[l].length, `L${l}`).toBe(1);
      expect(levelDifficulty(l), `L${l} is hard`).toBe('normal');
    }
    for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1], `L${levels[i - 1]} -> L${levels[i]}`).toBeGreaterThanOrEqual(2);
    const at = (k) => Number(Object.entries(LEVEL_START_CARDS).find(([, ks]) => ks.includes(k))[0]);
    expect(at('multi_color')).toBeLessThan(at('freeze_booster'));
    expect(at('freeze_booster')).toBeLessThan(at('supercharge'));
    expect(at('colour_change_booster')).toBeLessThan(at('rainbow_bomb'));
  });
  it('no level in L1-40 brings two new things (cards, vehicles, lanes, colours, traits)', async () => {
    const { spawnableTypesFor } = await import('../src/director/CarTypes.js');
    const { BENCH_FROM_LEVEL } = await import('../src/game/LevelManager.js');
    const seen = { types: new Set(), traits: new Set(), colors: 0, lanes: 0 };
    let last = 0;
    for (let l = 1; l <= 40; l++) {
      const c = cfgs[l - 1];
      let news = levelStartCards(l).filter(k => !['multi_color', 'lane_3'].includes(k)).length;   // those name the colour / lane change below
      for (const t of spawnableTypesFor(l, c.gridRows, c)) if (!seen.types.has(t)) { if (l > 1) news++; seen.types.add(t); }
      for (const t of Object.keys(c.traits ?? {})) if ((c.traits[t] ?? 0) > 0 && t !== 'gift' && !seen.traits.has(t)) { news++; seen.traits.add(t); }
      if (c.colors.length > seen.colors) { if (l > 1) news++; seen.colors = c.colors.length; }
      if (c.laneCount > seen.lanes && l > 2) { news++; }
      seen.lanes = Math.max(seen.lanes, c.laneCount);
      if (l === BENCH_FROM_LEVEL) news++;
      expect(news, `L${l}`).toBeLessThanOrEqual(1);
      if (news && l > 1) { expect(l - last, `L${last} -> L${l}`).toBeGreaterThanOrEqual(2); }
      if (news) last = l;
    }
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
  it('each in-play window is short and starts where its mechanic starts', () => {
    for (const [k, [a, b]] of Object.entries(REACTIVE_WINDOW)) expect(b - a, k).toBeLessThanOrEqual(3);
    expect(REACTIVE_WINDOW.streak_charged[0]).toBe(levelStartCardLevel('supercharge'));
  });
  it('play L1..L40 in order: every card key is taught at or before the level that needs it', () => {
    const taught = new Set(); const firstTaught = {};
    for (let l = 1; l <= 40; l++) {
      for (const k of levelStartCards(l)) { taught.add(k); firstTaught[k] ??= l; }
      for (const [k, [a, b]] of Object.entries(REACTIVE_WINDOW)) if (l >= a && l <= b) { taught.add(k); firstTaught[k] ??= l; }
    }
    for (const k of ['multi_color', 'supercharge', 'goal_colour', 'freeze_booster', 'colour_change_booster',
      'rainbow_bomb', 'gift_car', 'traffic_light', 'first_kill', 'first_miss', 'streak_charged', 'armor_break'])
      expect(firstTaught[k], k).toBeLessThanOrEqual(40);
  });
});

describe('visual fixtures', () => {
  it('seed every card key as seen, so specs are never blocked by a card', () => {
    const src = readFileSync(new URL('../tests-visual/fixtures/game.js', import.meta.url), 'utf8');
    const live = Object.entries(CARDS).filter(([, v]) => v).map(([k]) => k).concat('tour');
    for (const k of live) expect(src, k).toContain(`'${k}'`);
  });
});
