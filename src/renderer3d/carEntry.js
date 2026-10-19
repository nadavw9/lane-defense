// carEntry — how a refill car arrives on the road. Pure (no Three), unit-tested.
//
// A mid-level refill (a car that replaces one the player destroyed) drives in from beyond the
// TOP of the screen to its row: a short beat after the kill so the explosion reads first,
// then a drive-in that brakes into place. It used to start just SPAWN_OFFSET (5 wu) above its
// row, still under the HUD band, and finish most of a 0.45 s ease-out there — on the phone the
// car simply appeared (owner report 2026-10-19). The opening board never uses this (Car3D
// places isInitial cars settled).
export const CAR_ENTRY = {
  delay: 0.12,      // s after the spawn before the car moves (lets the explosion read)
  duration: 0.62,   // s of travel
  minOffset: 5.0,   // never start closer to the row than the old spawn offset (wu)
  halfLen: 3.2,     // half the longest car's length (bigrig ~2.52) + margin (wu)
};

/** World Z the car starts from: fully above the top screen edge, and at least minOffset away. */
export function carEntryStartZ(targetZ, screenTopZ, halfLen = CAR_ENTRY.halfLen) {
  return Math.min(targetZ - CAR_ENTRY.minOffset, screenTopZ - halfLen);
}

/** 0..1 travel fraction `t` seconds after the spawn: still for the delay, then ease-out (brake). */
export function carEntryProgress(t) {
  const p = (t - CAR_ENTRY.delay) / CAR_ENTRY.duration;
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  return 1 - (1 - p) * (1 - p);
}
