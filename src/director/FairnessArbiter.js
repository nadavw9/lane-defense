// FairnessArbiter — enforces the 5 hard fairness rules on every car and shooter
// before they enter the game. Each check mutates the car/shooter in place if a
// violation is found and returns a fix record so callers can audit corrections.
//
// FR-1  At least 1 top shooter must color-match at least 1 front car.
// FR-2  At most 3 of 4 front cars share the same color.
// FR-5  At least 2 distinct colors in the top shooter row.
// (FR-3 and FR-4 compared bomb damage with car HP. Every bomb is one hit now, so
// there is no damage to balance against HP; see docs/ONE_HIT_MODEL.md.)
import { FAIRNESS } from './DirectorConfig.js';

export class FairnessArbiter {
  // Validate and fix FR-2 for a car about to enter a lane.
  // Returns { fixed: false } when nothing needed changing, or
  // { fixed: true, fixes: [{rule, original, corrected}, ...] } for every fix applied.
  checkCar(car, gameState) {
    const fixes = [];

    const fr2 = this._fixFR2(car, gameState);
    if (fr2) fixes.push(fr2);

    return fixes.length > 0 ? { fixed: true, fixes } : { fixed: false };
  }

  // Validate and fix FR-1 and FR-5 for a shooter about to become a column top.
  // shooter.column indicates which column slot this shooter fills in the top row.
  checkShooter(shooter, gameState) {
    const fixes = [];

    // Order matters: FR-1 may change color, FR-5 must not undo that, so FR-5
    // runs last and prefers colors that still satisfy FR-1.
    const fr1 = this._fixFR1(shooter, gameState);
    if (fr1) fixes.push(fr1);

    const fr5 = this._fixFR5(shooter, gameState);
    if (fr5) fixes.push(fr5);

    return fixes.length > 0 ? { fixed: true, fixes } : { fixed: false };
  }

  // ─── FR-2 ─────────────────────────────────────────────────────────────────
  // At most FAIRNESS.maxSameColorFrontCars (3) front cars may share a color.
  // If adding this car would create 4 same-color front cars, recolor it to the
  // palette color with the fewest existing front cars.

  _fixFR2(car, gameState) {
    const frontCars = this._getFrontCars(gameState);
    const sameCount = frontCars.filter(c => c.color === car.color).length;

    if (sameCount < FAIRNESS.maxSameColorFrontCars) return null;

    // Build color → count map for existing front cars.
    const counts = {};
    for (const c of frontCars) {
      counts[c.color] = (counts[c.color] || 0) + 1;
    }

    // Pick the palette color with the smallest front-car count (excluding current color).
    const original = car.color;
    let bestColor = null;
    let bestCount = Infinity;
    for (const color of gameState.colorPalette) {
      if (color === original) continue;
      const n = counts[color] || 0;
      if (n < bestCount) {
        bestCount = n;
        bestColor = color;
      }
    }

    if (!bestColor) return null; // palette too small to fix (edge case)

    car.color = bestColor;
    return { rule: 'FR-2', original, corrected: car.color };
  }

  // ─── FR-1 ─────────────────────────────────────────────────────────────────
  // At least one top-row shooter must color-match at least one front car.
  // If the hypothetical top row (other tops + this candidate) has no match,
  // recolor the candidate to a front-car color.

  _fixFR1(shooter, gameState) {
    const frontCars = this._getFrontCars(gameState);
    if (frontCars.length === 0) return null; // no cars → trivially satisfied

    const topRow = this._topRowWith(shooter, gameState);
    const frontColors = new Set(frontCars.map(c => c.color));

    if (topRow.some(s => frontColors.has(s.color))) return null;

    // Fix: pick a front-car color. Prefer one that differs from other top shooters
    // to reduce the chance of immediately triggering FR-5.
    const otherTopColors = new Set(
      topRow.filter(s => s !== shooter).map(s => s.color)
    );
    const original = shooter.color;

    const preferred = frontCars.map(c => c.color).find(c => !otherTopColors.has(c));
    shooter.color = preferred ?? frontCars[0].color;

    return { rule: 'FR-1', original, corrected: shooter.color };
  }

  // ─── FR-5 ─────────────────────────────────────────────────────────────────
  // At least 2 distinct colors must appear in the top shooter row.
  // When fixing, prefer a color that still satisfies FR-1 (matches a front car).

  _fixFR5(shooter, gameState) {
    const topRow = this._topRowWith(shooter, gameState);
    if (topRow.length < 2) return null; // impossible to have 2 colors with 1 shooter

    const distinctColors = new Set(topRow.map(s => s.color));
    if (distinctColors.size >= FAIRNESS.minTopShooterColors) return null;

    const original   = shooter.color;
    const frontColors = new Set(this._getFrontCars(gameState).map(c => c.color));

    // Prefer: different color AND matches a front car (maintains FR-1).
    // Fallback: any different palette color.
    const newColor =
      gameState.colorPalette.find(c => c !== shooter.color && frontColors.has(c)) ??
      gameState.colorPalette.find(c => c !== shooter.color);

    if (!newColor) return null;

    shooter.color = newColor;
    return { rule: 'FR-5', original, corrected: shooter.color };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  _getFrontCars(gameState) {
    return gameState.lanes.map(l => l.frontCar()).filter(Boolean);
  }

  // Returns the hypothetical top row: substitute the candidate for its own column,
  // keep other columns' current tops.  Null entries (empty columns) are dropped.
  _topRowWith(candidate, gameState) {
    return gameState.columns
      .map((col, idx) => (idx === candidate.column ? candidate : col.top()))
      .filter(Boolean);
  }
}
