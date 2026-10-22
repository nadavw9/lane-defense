// Score and stars (2026-10-19, owner: "it should be a factor of points ... a bar with 1, 2 and 3
// stars per level that progresses with each point you get for car shooting and combos").
//
// Points: every destroyed car pays POINTS.car; a shot that destroys several pays each extra car a
// bonus; and correct shots IN A ROW build the COMBO (any shot that hits a car of its colour,
// including one that only shrinks a big car; a wasted shot breaks it), which adds a growing,
// capped bonus to every hit. It is the "xN COMBO" on screen (2026-10-22, owner: the stars must
// come from points "where combos bring extra"; the screen used to show a 2-second kill window that
// paid nothing). The combo is shot-based, so the simulator scores exactly as the game does. Booster kills (lane clear, rainbow) pay the
// car value only. Stars: a win is one star; the per-level targets give two and three. Targets come
// from simulated winning runs (tools/tune-stars.mjs -> starTargets.js), so three stars is always
// reachable by a good game; a level missing from the table derives them from its goal.
import { STAR_TARGETS } from './starTargets.js';

export const POINTS = { car: 100, multiExtra: 50, chainStep: 25, chainCap: 150 };

/** Points for one shot that hit (`hit`) and destroyed `kills` cars, with `chain` correct shots in a row before it. */
export function shotPoints(kills, chain, hit = kills > 0) {
  if (!hit) return 0;
  const k = Math.max(0, kills);
  return k * POINTS.car + Math.max(0, k - 1) * POINTS.multiExtra + Math.min(POINTS.chainCap, chain * POINTS.chainStep);
}

/** The chain after a shot: one more for any kill (a multi-kill is one step), else broken. */
/** The combo after a shot: one longer if it hit, broken if it was wasted. */
export function nextChain(chain, hit) { return hit ? chain + 1 : 0; }

/** Stars for a WON level. */
export function starsFor(score, [, two, three]) {
  return score >= three ? 3 : score >= two ? 2 : 1;
}

/** [one, two, three] targets for a level; `goalCars` = total cars its goals ask for. */
export function starTargetsFor(levelId, goalCars) {
  const t = STAR_TARGETS[levelId];
  if (t) return [...t];
  const one = Math.max(1, goalCars) * POINTS.car;
  return [one, Math.round(one * 1.25 / 10) * 10, Math.round(one * 1.5 / 10) * 10];
}

/** Stars reached so far in play (0 before the first target). */
export function starsLit(score, [one, two, three]) { return score >= three ? 3 : score >= two ? 2 : score >= one ? 1 : 0; }

/**
 * How full the in-play star bar is, 0..1. The three stars sit evenly at 1/3, 2/3 and the end,
 * and the bar fills linearly between them, so every point moves it even when the targets are
 * close together (the tutorial levels).
 */
export function starBarFill(score, [one, two, three]) {
  const s = Math.max(0, score);
  if (s >= three) return 1;
  if (s >= two) return 2 / 3 + (s - two) / (three - two) / 3;
  if (s >= one) return 1 / 3 + (s - one) / (two - one) / 3;
  return s / one / 3;
}
