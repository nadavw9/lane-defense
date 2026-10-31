// introSchedule — WHICH level explains WHAT. Hard-coded on purpose.
//
// Explanations used to fire "the first time the player meets X", which is not a level: a
// save that unlocked L30 and happened to chain its first combo there was taught combos at L30.
// Now every mechanic is taught at a fixed early level (the one that introduces it), and the
// in-play moments that used to be "first time anywhere" only count inside a fixed window.
//
// Cards are shown once ever (FeatureBanners keeps the seen-set), so replays stay quiet.
// Copy lives in guideContent.js (CARDS); this file only decides the level.

// Cards that open the level (after the splash, before the first move), in order.
// L1's walkthrough is the tour (guideContent.tourSteps), not listed here.
export const LEVEL_START_CARDS = {
  // One new thing per level (2026-10-22 pacing: the owner found the first levels boring, so the
  // practice level between new things is gone; L3 third lane, L5 third colour). Vehicles that shrink (car L4, van L7) are
  // introduced by their animated NEW VEHICLE card, not listed here; the bench (L13) has its own
  // spotlight tutorial. Colours and traits are announced by the level's hint on its card.
  // L1 teaches the colour match in play (second_colour below, LevelManager firstColors), so L2
  // adds only the lane. L6 bridges (bridges.BRIDGES_FROM): drag car to car, one hit takes both.
  2:  ['lane_2'],
  3:  ['lane_3'],
  6:  ['bridge'],
  8:  ['freeze_booster'],
  11: ['supercharge'],
  12: ['goal_colour'],
  21: ['colour_change_booster'],
  23: ['gift_car'],
  26: ['traffic_light'],
  33: ['rainbow_bomb'],
  43: ['convoy'],
};

// Moments inside play that can only be explained from a live event. A key may fire only while
// the player is on a level inside [min, max]; outside the window it is simply never shown.
//   first_kill / bomb_earned  L1 (a 10-car goal guarantees both)
//   second_colour             L1 (the first blue car reaches the front after a run of reds —
//                             GameApp fires it from the advance, hand on the blue bomb)
//   first_miss                L1-2 (a wrong colour is possible from the first blue car)
//   barrier_down              any level: the first time a lane's barrier is smashed (lane barriers)
//   wave_incoming             L10: the first WAVE 1 crest (waves start on WAVES_FROM)
//   streak_charged            L11-12 (Hot Streak starts at L11)
//   freeze / swap / rainbow earned  from the level each one arrives (boosterUnlocks.js)
//   armor_break / plate_break / mender_heal / volatile_surge  the level that introduces the trait
export const REACTIVE_WINDOW = {
  first_kill:     [1, 1],
  bomb_earned:    [1, 1],
  second_colour:  [1, 1],
  first_miss:     [1, 2],
  barrier_down:   [1, 200],   // the first smash IS the moment, on whatever level it happens (2026-10-30)
  wave_incoming:  [10, 10],   // the first WAVE 1 crest (TrafficRules.WAVES_FROM), an animated card
  bridge_guide:   [6, 6],     // the first bridgeable pair on the bridges level: hand on the real cars (bridges.BRIDGES_FROM)
  speeder:        [9, 9],     // the first speeder on the road (L9): the "bridge it in front, then shoot" demo
  freeze_earned:  [8, 11],
  colour_change_earned: [21, 24],
  streak_charged: [11, 12],
  rainbow_bomb:   [33, 35],
  armor_break:    [14, 14],
  plate_break:    [41, 41],
  mender_heal:    [46, 46],
  volatile_surge: [76, 76],
};

export function levelStartCards(level) {
  return typeof level === 'number' ? (LEVEL_START_CARDS[level] ?? []) : [];
}

export function reactiveAllowed(key, level) {
  if (typeof level !== 'number') return false;       // daily challenge: no teaching
  const w = REACTIVE_WINDOW[key];
  return !!w && level >= w[0] && level <= w[1];
}
