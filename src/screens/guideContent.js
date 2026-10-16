// guideContent — every explanation the game gives, in one place.
//
// Two kinds:
//   tourSteps(geo)        the level-1 walkthrough, shown once before the first move.
//   stepsFor(key, text, geo)  a first-time card, shown the first moment a mechanic
//                         appears (FeatureBanners.fire routes here). `text` is the
//                         wording at the call site; a key may override it below.
//
// `geo` is supplied by GameApp and returns live screen rects ({x, y, w, h}); targets are
// functions so they are read when the card is shown, never captured early.
//
// Copy rules: short, in the player's words, no numbers about bomb power (every bomb is
// one hit; a car's size is its health).

import { KILLS_PER_BOMB } from '../director/DirectorConfig.js';

export function tourSteps(geo) {
  return [
    {
      title: 'WELCOME!',
      text: 'Cars are racing down the road toward your base. Stop every one of them!',
    },
    {
      title: 'THE ROAD',
      text: 'Cars drive down these lanes toward you.',
      target: geo.road,
    },
    {
      title: 'THE RED LINE',
      text: 'If a car crosses this line, you LOSE.',
      target: geo.breach,
    },
    {
      title: 'YOUR BOMBS',
      text: 'Drag a bomb onto a lane to hit the car in front of it. Every correct shot also moves ALL cars a step closer.',
      target: geo.bombs,
      hand: 'drag',
      handFrom: () => { const b = geo.bombs(); return { x: b.x + b.w / 2, y: b.y + 14 }; },
      handTo:   () => { const r = geo.road();  return { x: r.x + r.w / 2, y: r.y + r.h - 70 }; },
    },
    {
      title: 'THE GOAL',
      text: 'Destroy this many cars to WIN the level.',
      target: geo.goal,
      cta: "LET'S GO!",
    },
  ];
}

// Titles and, where useful, a pointer at the part of the board the card is about.
export const CARDS = {
  // ── Level-start cards (levels fixed in introSchedule.js) ──
  lane_2:          { title: 'A SECOND LANE', text: 'Cars now come down two lanes. Each lane has its own front car, so pick the lane that matches the bomb you are holding.', target: 'road' },
  lane_3:          { title: 'THREE LANES', text: 'Three lanes now, and every correct hit moves ALL the traffic one step closer. Stop the car nearest the red line first!', target: 'road' },
  multi_color:     { title: 'MATCH THE COLOUR', text: 'A bomb only hurts cars of its own colour. Check the colour of the car at the front of the lane, then drag a bomb of the same colour onto it.', target: 'bombs' },
  combo:           { title: 'COMBO!', text: 'Destroy cars one after another, quickly, to build a combo. Bigger combos earn bonus coins.', target: 'goal' },
  supercharge:     { title: 'SUPERCHARGE', text: 'Every 3rd car you destroy charges your next bomb. A charged bomb glows, hits twice and smashes through ANY colour.', target: 'bombs' },
  reorder:         { title: 'SHUFFLE YOUR BOMBS', text: 'Need a different bomb on top? Drag a bomb onto another bomb in the queue to swap them. You get one free swap between shots.', target: 'bombs' },
  goal_colour:     { title: 'A COLOUR GOAL', text: 'This goal counts only one colour. Only cars of that colour add to it, but you still have to stop every car.', target: 'goal' },
  freeze_booster:  { title: 'FREEZE', text: 'Tap FREEZE and your next shot is free: no car moves closer. Earn one by destroying 3 or more cars with a single bomb.', target: 'boosters' },
  colour_change_booster: { title: 'COLOUR CHANGE', text: 'Tap COLOUR, tap a car, then pick a colour. ALL cars of that colour change to it. Earn one with two multi-kill shots in a row.', target: 'boosters' },
  rainbow_bomb:    { title: 'RAINBOW BOMB', text: 'Make three shots that each destroy 2 or more cars and a RAINBOW bomb joins your queue. It destroys every car of the colour it hits, in every lane.', target: 'bombs' },

  freeze_earned:   { title: 'FREEZE EARNED!', text: 'Destroying 3 or more cars with one bomb earns a FREEZE. Tap it and your next shot is free: no car moves closer.', target: 'boosters' },
  colour_change_earned: { title: 'COLOUR CHANGE EARNED!', text: 'Two multi-kill shots in a row earned a COLOUR CHANGE. Tap COLOUR, tap a car, then pick a colour: ALL cars of that colour change to it.', target: 'boosters' },

  // ── In-play moments (only inside their window, see introSchedule.js) ──
  first_kill:      { title: 'FIRST KILL!',     text: `Destroyed cars count toward your goal. Destroy ${KILLS_PER_BOMB} cars and you earn a BOMB booster.`, target: 'goal' },
  first_combo:     null,   // taught by the L2 COMBO card
  combo_hint_L2:   null,   // folded into combo
  first_miss:      { title: 'WRONG COLOUR',    text: 'No damage! A bomb only hurts cars of its own colour. Check the colour of the car in front of the lane.' },
  hp_miss:         { title: 'IT SHRANK!',      text: 'Big cars take more than one hit. Each hit makes the car smaller until it is gone.' },
  streak_charged:  { title: 'POWER SHOT!',     text: 'Your next bomb is charged and glows. Drag it like any bomb: it hits twice and smashes through ANY colour.', target: 'bombs' },
  colorchange_use: null,   // taught by the L9 COLOUR CHANGE card
  plate_break:     { title: 'HEAVY PLATING',   text: 'Heavy plating takes TWO hits, any colour, to strip off. Then hit it with its own colour.' },
  armor_break:     { title: 'ARMOUR OFF!',     text: 'The armour is gone. Now hit it with its own colour.' },
  volatile_surge:  { title: 'VOLATILE!',       text: 'When a volatile car blows up, every OTHER lane lurches forward. Clear it carefully!' },
  mender_heal:     { title: 'MENDER',          text: 'Menders grow back a size when left alone. Keep shooting them!' },
  bench_appear:    null,   // the bench has its own spotlight tutorial (L4)
};

export function stepsFor(key, text, geo) {
  const c = CARDS[key];
  if (c === null) return null;                       // intentionally silent
  const title = c?.title ?? (key.startsWith('hint_L') ? 'TIP' : 'HEADS UP');
  const step = { title, text: c?.text ?? text };
  if (c?.target && geo[c.target]) step.target = geo[c.target];
  return [step];
}
