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
  constructor({ color, damage, column }) {
    this.color = color;
    this.damage = damage;
    this.column = column;
    this.fireDuration = FIRE_DURATION_BY_DAMAGE[damage];
  }
}
