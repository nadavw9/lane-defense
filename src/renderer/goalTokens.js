// goalTokens — the pure part of "a kill flies to the goal counter" (GoalCounterUI.collect).
// Royal Match / Candy Crush collect pattern: the destroyed piece sends a token to the goal and the
// number drops when it lands, so the player sees WHICH explosion counted and how many are left.
export const TOKEN = {
  flight: 0.48,    // s from explosion to counter
  stagger: 0.07,   // s between the tokens of one multi-kill
  grace: 0.6,      // s a kill may go without a landing token (boosters) before the count catches up
};

/** Point `p` (0..1) along the token's arc from `from` to `to`: out and up, easing into the counter. */
export function tokenPoint(from, to, p) {
  const e = 1 - Math.pow(1 - Math.max(0, Math.min(1, p)), 2);   // ease-out: fast off the road, settles in
  // A quadratic curve whose control point sits beside the start, level with the target's height
  // halfway up, so the token swings outwards and rises the whole way.
  const cx = from.x + (from.x < to.x ? -40 : 40), cy = (from.y + to.y) / 2;
  const u = 1 - e;
  return { x: u * u * from.x + 2 * u * e * cx + e * e * to.x, y: u * u * from.y + 2 * u * e * cy + e * e * to.y };
}

/** The shown count after one token lands. */
export function shownAfterLanding(shown, actual) { return Math.max(actual, shown - 1); }

/** True when the shown count must snap to the real one: behind, nothing flying, grace used up. */
export function needsCatchUp(shown, actual, inFlight, sinceBehind) {
  return shown > actual && inFlight === 0 && sinceBehind > TOKEN.grace;
}
