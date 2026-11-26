// Score and stars (2026-10-19, owner: "it should be a factor of points ... a bar with 1, 2 and 3
// stars per level that progresses with each point you get for car shooting and combos").
//
// Points: every destroyed car pays POINTS.car plus the COMBO bonus; a shot that destroys several
// pays each extra car a bonus too. Correct shots IN A ROW build the combo (any shot that hits a car
// of its colour, including one that only shrinks a big car; a wasted shot breaks it). It is the
// "xN COMBO" on screen. Since 2026-11-26 (owner: "3 stars is unreachable, I always get 1") the bonus
// is paid per car DESTROYED, never on a shrink hit: paid per hit, chipping at big cars out-scored
// picking cars off, so the smarter game scored less. Booster kills (lane clear, rainbow) pay the car
// value only. The simulator calls the same functions.
//
// Stars: a win is one star; two and three come from the goal (starTargetsFor): a CLEAN game (the
// goal's cars destroyed, the combo never broken) is three stars with room to spare.
export const POINTS = { car: 100, multiExtra: 50, chainStep: 25, chainCap: 150 };

/** Points for one shot that hit (`hit`) and destroyed `kills` cars, with `chain` correct shots in a row
 *  before it. Every car destroyed earns the combo bonus, so a bridged pair pays at least what two shots
 *  would; a hit that only shrinks a car pays nothing but still extends the combo (nextChain). */
export function shotPoints(kills, chain, hit = kills > 0) {
  const k = Math.max(0, kills);
  if (!hit || k === 0) return 0;
  return k * (POINTS.car + Math.min(POINTS.chainCap, chain * POINTS.chainStep)) + (k - 1) * POINTS.multiExtra;
}

/** The combo after a shot: one longer if it hit, broken if it was wasted. */
export function nextChain(chain, hit) { return hit ? chain + 1 : 0; }

/** Stars for a WON level. */
export function starsFor(score, [, two, three]) {
  return score >= three ? 3 : score >= two ? 2 : 1;
}

/** Points of a CLEAN game: `goalCars` cars destroyed one per shot, the combo never broken. */
export function cleanGamePoints(goalCars) {
  let pts = 0;
  for (let i = 0; i < goalCars; i++) pts += shotPoints(1, i);
  return pts;
}

/** [one, two, three] targets from the cars the goals ask for: one = their points (every win has
 *  them), two = 70% and three = 90% of a clean game, on 25s and strictly rising. A clean game is
 *  always three stars; a booster kill, a broken combo or a CONTINUE's lost shots cost points. */
export function starTargetsFor(goalCars) {
  const g = Math.max(1, goalCars), clean = cleanGamePoints(g), r25 = (x) => Math.floor(x / 25) * 25;
  const one = g * POINTS.car;
  const two = Math.max(one + 25, r25(clean * 0.7));
  return [one, two, Math.max(two + 25, r25(clean * 0.9))];
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

/**
 * The win screen's SCORE row. Short of three stars it names the next star's target in the label
 * ("SCORE · 3★ AT 7,275"): "6,725 / 7,275" alone did not say what the second number was
 * (PrimeTestLab report 10454, S-02).
 */
export function scoreRow(score, targets, stars) {
  const n = (x) => Math.round(x ?? 0).toLocaleString('en-US');
  const next = targets && stars < 3 ? targets[stars] : null;
  return { label: next != null ? `SCORE · ${stars + 1}★ AT ${n(next)}` : 'SCORE', value: n(score) };
}
