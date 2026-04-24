// Car — a single color-coded car advancing through a lane.
//
// Turn-based grid system:
//   row 0 = back of lane (newly spawned, top of road on screen)
//   row N = front (breach point — bottom of road)
//   position = row / maxRow * 100  (derived from row for rendering compatibility)
export class Car {
  constructor({ color, hp, speed = 0, type = "standard", row = 0 }) {
    this.color    = color;
    this.hp       = hp;
    this.maxHp    = hp;
    this.speed    = speed;   // kept for compat; unused in turn-based mode
    this.row      = row;
    this.position = 0;       // set externally via setPositionFromRow()
    this.type     = type;
  }

  takeDamage(amount) { this.hp = Math.max(0, this.hp - amount); }
  isDead()           { return this.hp <= 0; }
  distanceRatio()    { return this.position / 100; }
}
