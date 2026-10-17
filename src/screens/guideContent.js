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
  // Three cards, then play: what wins, what loses, and the one gesture. Top puzzle games teach
  // with the board, not with reading; the rest arrives as one-line cards on the levels that use it.
  return [
    {
      title: 'THE GOAL',
      text: 'Destroy this many cars on the road to WIN.',
      target: geo.goal,
    },
    {
      title: 'THE RED LINE',
      text: 'A car past this line = you LOSE.',
      target: geo.breach,
    },
    {
      title: 'YOUR BOMBS',
      text: 'Drag a bomb onto a lane. Every shot moves all cars closer.',
      target: geo.bombs,
      hand: 'drag',
      handFrom: () => { const b = geo.bombs(); return { x: b.x + b.w / 2, y: b.y + 14 }; },
      handTo:   () => { const r = geo.road();  return { x: r.x + r.w / 2, y: r.y + r.h - 70 }; },
      cta: "LET'S GO!",
    },
  ];
}

// Titles and, where useful, a pointer at the part of the board the card is about.
export const CARDS = {
  // ── Level-start cards (levels fixed in introSchedule.js) ──
  lane_2:          { title: 'A SECOND LANE', text: 'Two lanes now. Aim each bomb at a car of its color.', target: 'road' },
  lane_3:          { title: 'THREE LANES', text: 'Three lanes. Stop the car nearest the red line first!', target: 'road' },
  multi_color:     { title: 'MATCH THE COLOR', text: 'A bomb only hurts cars of its own color.', target: 'bombs' },
  combo:           { title: 'COMBO!', text: 'Destroy cars quickly, one after another, for bonus coins.', target: 'goal' },
  supercharge:     { title: 'SUPERCHARGE', text: 'Destroy a car 3 shots in a row to charge your next bomb. It hits twice, any color.', target: 'bombs' },
  goal_colour:     { title: 'A COLOR GOAL', text: 'Only cars of this color count toward the goal.', target: 'goal' },
  freeze_booster:  { title: 'FREEZE', text: 'Tap FREEZE: your next shot moves no cars.', target: 'boosterFreeze' },
  colour_change_booster: { title: 'COLOR SWAP', text: 'Tap COLOR, tap a car, pick a color. All cars of that color change.', target: 'boosterColor' },
  rainbow_bomb:    { title: 'RAINBOW BOMB', text: '3 multi-kill shots in a row earn a RAINBOW bomb. It hits one color in every lane.', target: 'bombs' },

  freeze_earned:   { title: 'FREEZE EARNED!', text: '3+ cars with one bomb earned a FREEZE. Tap it for a free shot.', target: 'boosterFreeze' },
  colour_change_earned: { title: 'COLOR SWAP EARNED!', text: '2 multi-kill shots in a row earned a COLOR SWAP. Tap COLOR to use it.', target: 'boosterColor' },

  // ── In-play moments (only inside their window, see introSchedule.js) ──
  first_kill:      { title: 'FIRST KILL!',     text: `Destroy ${KILLS_PER_BOMB} cars to earn a BOMB booster.`, target: 'goal' },
  first_combo:     null,   // taught by the L2 COMBO card
  combo_hint_L2:   null,   // folded into combo
  first_miss:      { title: 'WRONG COLOR',    text: 'No damage! A bomb only hurts cars of its own color.' },
  hp_miss:         { title: 'IT SHRANK!',      text: 'Big cars shrink with each hit until they are gone.' },
  streak_charged:  { title: 'POWER SHOT!',     text: 'Your next bomb is charged. It hits twice, any color.', target: 'bombs' },
  colorchange_use: null,   // taught by the L9 COLOUR CHANGE card
  plate_break:     { title: 'HEAVY PLATING',   text: 'Two hits of any color strip the plating.' },
  armor_break:     { title: 'ARMOR OFF!',     text: 'Now hit it with its own color.' },
  volatile_surge:  { title: 'VOLATILE!',       text: 'When it blows up, the other lanes lurch forward!' },
  mender_heal:     { title: 'MENDER',          text: 'Menders grow back a size when left alone.' },
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
