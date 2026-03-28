// Car — a single color-coded car advancing through a lane.
// Position starts at 0 and advances toward 100 (breach point).
export class Car {
  constructor({ color, hp, speed, type = 'standard' }) {
    this.color = color;
    this.hp = hp;
    this.maxHp = hp;
    this.speed = speed;
    this.position = 0;
    this.type = type;
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
  }

  isDead() {
    return this.hp <= 0;
  }

  // How far along the lane the car is, as a fraction of total distance (100 units).
  distanceRatio() {
    return this.position / 100;
  }
}
