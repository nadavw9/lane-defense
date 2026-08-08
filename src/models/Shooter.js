// Shooter — a color-coded shooter occupying a column.
// fireDuration is derived from damage per the Director Spec table.
const FIRE_DURATION_BY_DAMAGE = {
  2: 1.5,
  3: 1.7,
  4: 1.9,
  5: 2.0,
  6: 2.2,
  7: 2.3,
  8: 2.5,
};

export class Shooter {
  constructor({ color, damage, column, isColorBomb = false }) {
    this.color = color;
    this.damage = damage;
    this.column = column;
    this.fireDuration = FIRE_DURATION_BY_DAMAGE[damage] ?? 2.0;
    // Rainbow color-bomb powerball: earned via a correct-shot streak, deployed
    // like a normal bomb but clears every car matching the target lane's front
    // car colour. Carries no damage number (badge shows a star instead).
    this.isColorBomb = isColorBomb;
  }
}
