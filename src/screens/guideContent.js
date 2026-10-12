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
const CARDS = {
  multi_color:     { title: 'MATCH THE COLOUR', text: 'A bomb only hurts cars of its own colour. Check the colour of the car at the front of the lane, then drag a bomb of the same colour onto it.', target: 'bombs' },
  multi_lane:      { title: 'NEW LANE',        target: 'road' },
  first_kill:      { title: 'FIRST KILL!',     text: 'Destroyed cars count toward your goal. Every 3rd car you destroy charges your next bomb.', target: 'goal' },
  first_combo:     { title: 'COMBO!',          text: 'Destroy cars back to back to build a combo. Bigger combos earn bonus coins.' },
  combo_hint_L2:   null,   // folded into first_combo
  first_miss:      { title: 'WRONG COLOUR',    text: 'No damage! A bomb only hurts cars of its own colour. Check the colour of the car in front of the lane.' },
  hp_miss:         { title: 'IT SHRANK!',      text: 'Big cars take more than one hit. Each hit makes the car smaller until it is gone.' },
  streak_charged:  { title: 'POWER SHOT!',     text: 'Your next bomb is charged and glows. Drag it like any bomb: it hits twice and smashes through ANY colour.', target: 'bombs' },
  colorchange_use: { title: 'COLOUR CHANGE',   text: 'Tap a car, then pick a colour. ALL cars of that colour change to it.' },
  plate_break:     { title: 'HEAVY PLATING',   text: 'Heavy plating takes TWO hits, any colour, to strip off. Then hit it with its own colour.' },
  armor_break:     { title: 'ARMOUR OFF!',     text: 'The armour is gone. Now hit it with its own colour.' },
  volatile_surge:  { title: 'VOLATILE!',       text: 'When a volatile car blows up, every OTHER lane lurches forward. Clear it carefully!' },
  mender_heal:     { title: 'MENDER',          text: 'Menders grow back a size when left alone. Keep shooting them!' },
  bench_appear:    null,   // the bench has its own spotlight tutorial
};

export function stepsFor(key, text, geo) {
  const c = CARDS[key];
  if (c === null) return null;                       // intentionally silent
  const title = c?.title ?? (key.startsWith('hint_L') ? 'TIP' : 'HEADS UP');
  const step = { title, text: c?.text ?? text };
  if (c?.target && geo[c.target]) step.target = geo[c.target];
  return [step];
}
