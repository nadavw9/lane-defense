// Lane — one of the 4 vertical tracks that cars advance through.
// Cars travel from position 0 toward position 100 (breach point).
// A minimum 8-unit gap is enforced between cars so they never overlap.
const BREACH_POSITION = 100;
const MIN_GAP = 8;

export class Lane {
  constructor({ id, personality = 'standard' } = {}) {
    this.id = id;
    this.personality = personality;
    // Cars are kept sorted by position descending: index 0 = most advanced (front).
    this.cars = [];
  }

  addCar(car) {
    this.cars.push(car);
    // Re-sort so front (highest position) is always at index 0.
    this.cars.sort((a, b) => b.position - a.position);
  }

  // The car closest to the breach (highest position), or null if empty.
  frontCar() {
    return this.cars[0] ?? null;
  }

  removeFrontCar() {
    this.cars.shift();
  }

  isBreached() {
    return this.cars.some(c => c.position >= BREACH_POSITION);
  }

  mostAdvancedCar() {
    return this.cars[0] ?? null;
  }

  // Move all cars forward by speed * deltaTime.
  // Gap is enforced using the pre-advance order so a faster car behind can never
  // overtake (or come within 8 units of) the car ahead of it.
  advance(deltaTime) {
    // Establish lane order before this tick.
    this.cars.sort((a, b) => b.position - a.position);

    for (const car of this.cars) {
      car.position += car.speed * deltaTime;
    }

    // Enforce minimum gap in the same order: follower capped behind the car ahead.
    for (let i = 1; i < this.cars.length; i++) {
      const maxAllowed = this.cars[i - 1].position - MIN_GAP;
      if (this.cars[i].position > maxAllowed) {
        this.cars[i].position = maxAllowed;
      }
    }
  }
}
