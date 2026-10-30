// queueMotion — how each bomb in a queue column reached its slot since the last frame, and
// where it is drawn while it travels there. Pure (no Three), so it is unit-tested.
//
// Shooter3D draws one ball per fixed slot and reads the column every frame; without motion a
// fired top made the whole column jump and the refill pop into the last slot. Bombs are
// tracked by identity (the Shooter object), so the move is read off the arrays:
//   up     — the bomb was further down (the top was fired): slide up into the slot
//   down   — the bomb was further up (a bomb was pushed in on top): slide down
//   enter  — a new bomb at the back of the queue: slide in from below the last slot
//   drop   — a new bomb at the FRONT: drop in from the road above
// Offsets are in SLOT units (positive = towards the back); bombSlotZ() is linear in the
// index, so the caller turns them into world Z with one multiply.
export const MOTION = {
  slide: 0.22,      // s, up / down by a slot
  enter: 0.34,      // s, a refill sliding in from below
  drop: 0.30,       // s, a front insert dropping in
  stagger: 0.07,    // s between two refills entering together
  enterGap: 0.45,   // slots below the last slot where a refill starts (behind the bench strip)
  dropGap: 1.3,     // slots above the front slot where a front insert starts
};

/**
 * @param {object[]} prev  the column's shooters last frame (front first)
 * @param {object[]} next  the column's shooters now
 * @returns {Array<null|{kind:string, from:number, delay?:number}>} one entry per slot of `next`
 */
export function queueMoves(prev, next) {
  if (!prev.length) return next.map(() => null);   // filled from empty (level start): snap
  const back = Math.max(prev.length, next.length);
  let entering = 0;
  return next.map((s, si) => {
    const p = prev.indexOf(s);
    if (p === si) return null;
    if (p > si) return { kind: 'up', from: p };
    if (p >= 0) return { kind: 'down', from: p };
    if (si === 0) return { kind: 'drop', from: -MOTION.dropGap };
    return { kind: 'enter', from: back + MOTION.enterGap, delay: MOTION.stagger * entering++ };
  });
}

const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
// A small overshoot so a bomb settling into its socket reads as a physical "clunk".
const easeOutBack = (p) => { const c = 1.25; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };

/** Offset from the home slot (slot units) of a bomb `t` seconds into its move. */
export function slotOffset(mv, si, t) {
  if (!mv) return 0;
  const start = mv.from - si;
  const tt = t - (mv.delay ?? 0);
  if (tt <= 0) return start;
  const dur = mv.kind === 'enter' ? MOTION.enter : mv.kind === 'drop' ? MOTION.drop : MOTION.slide;
  const p = tt / dur;
  if (p >= 1) return 0;
  const k = mv.kind === 'up' || mv.kind === 'down' ? easeOutBack(p) : easeOutCubic(p);
  return start * (1 - k);
}

/** Seconds until a move has fully settled. */
export function moveDuration(mv) {
  if (!mv) return 0;
  const dur = mv.kind === 'enter' ? MOTION.enter : mv.kind === 'drop' ? MOTION.drop : MOTION.slide;
  return (mv.delay ?? 0) + dur;
}
