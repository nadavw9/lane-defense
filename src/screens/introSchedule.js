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
  2:  ['lane_2', 'multi_color', 'combo'],
  3:  ['lane_3'],
  4:  ['supercharge'],
  6:  ['goal_colour'],
  8:  ['freeze_booster'],
  9:  ['colour_change_booster'],
  10: ['rainbow_bomb'],
};

// Moments inside play that can only be explained from a live event. A key may fire only while
// the player is on a level inside [min, max]; outside the window it is simply never shown.
//   first_kill / bomb_earned  L1 (a 10-car goal guarantees both)
//   first_miss / hp_miss      L2 (first second colour, first bigger car)
//   streak_charged            L4-5 (Hot Streak starts at L4)
//   rainbow_bomb              earned from L4 on; the L10 start card covers anyone who has not earned one
//   armor_break / plate_break / mender_heal / volatile_surge  the level that introduces the trait
export const REACTIVE_WINDOW = {
  first_kill:     [1, 1],
  bomb_earned:    [1, 1],
  first_miss:     [2, 2],
  hp_miss:        [2, 2],
  freeze_earned:  [1, 10],   // first FREEZE earned in play; the L8 start card covers anyone who has not
  colour_change_earned: [1, 10],   // same for COLOUR CHANGE (L9 card)
  streak_charged: [4, 5],
  rainbow_bomb:   [4, 10],
  armor_break:    [11, 11],
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
