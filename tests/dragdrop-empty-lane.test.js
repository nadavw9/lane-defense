// Empty-lane drop guard (bug fix):
//   Dropping a bomb on a lane with NO car must bounce the bomb back to the queue
//   instead of silently consuming it. The decision lives in DragDrop._checkColorMatch:
//   when it returns false, onPointerUp routes to onColorMismatch() + _snapBack()
//   (no consume); when true, the bomb deploys (consume + fire).
//
// _checkColorMatch only reads `this._lanes` and `this._dragShooter`, so we exercise
// it via the prototype to avoid DragDrop's Pixi-heavy constructor.

import { describe, it, expect } from 'vitest';
import { DragDrop } from '../src/input/DragDrop.js';
import { Lane }     from '../src/models/Lane.js';
import { Car }      from '../src/models/Car.js';

function checkMatch(lanes, dragShooter, laneIdx) {
  return DragDrop.prototype._checkColorMatch.call(
    { _lanes: lanes, _dragShooter: dragShooter }, laneIdx,
  );
}

function laneWithCar(color) {
  const lane = new Lane({ id: 0 });
  const car  = new Car({ color, hp: 5, speed: 5 });
  car.row = 4; car.position = 44;
  lane.addCar(car);
  return lane;
}

describe('DragDrop._checkColorMatch — empty-lane drop guard', () => {
  it('rejects a drop on an empty lane (bomb bounces back, not consumed)', () => {
    const lanes = [new Lane({ id: 0 })];   // no cars
    expect(checkMatch(lanes, { color: 'Red' }, 0)).toBe(false);
  });

  it('still allows a matching-color drop (existing shot behavior)', () => {
    expect(checkMatch([laneWithCar('Red')], { color: 'Red' }, 0)).toBe(true);
  });

  it('still rejects a wrong-color drop (existing bounce-back)', () => {
    expect(checkMatch([laneWithCar('Blue')], { color: 'Red' }, 0)).toBe(false);
  });

  it('rejects a color bomb on an empty lane but allows it on a lane with a car', () => {
    const empty   = new Lane({ id: 0 });
    const withCar = laneWithCar('Blue');
    expect(checkMatch([empty, withCar], { isColorBomb: true }, 0)).toBe(false); // empty → bounce
    expect(checkMatch([empty, withCar], { isColorBomb: true }, 1)).toBe(true);  // car  → fire
  });
});
