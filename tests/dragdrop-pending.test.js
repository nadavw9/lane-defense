// Drop zone + pending drop (2026-10-30, spec §3.7). Owner: "if you send the bomb to the correct
// lane it is not always sent". Two causes, both fixed here:
//   1. a release below the front car's centre line (its lower half, the hazard stripe) was dead;
//   2. a release while the previous shot was still in flight snapped back silently.
// DragDrop's constructor is Pixi-heavy, so these drive the prototype methods on a plain object.
import { describe, it, expect, vi } from 'vitest';
import { DragDrop } from '../src/input/DragDrop.js';
import { Lane }     from '../src/models/Lane.js';
import { Car }      from '../src/models/Car.js';
import { ROAD_TOP_Y, ROAD_BOTTOM_Y } from '../src/renderer/LaneRenderer.js';
import { laneDropBottomY, BREACH_LINE_Y, APP_W } from '../src/renderer3d/projection.js';

function laneWith(color) {
  const lane = new Lane({ id: 0 });
  const car  = new Car({ color, hp: 2, speed: 5 });
  car.row = 4; car.position = 90;
  lane.addCar(car);
  return lane;
}
function makeDD({ inFlight, lanes, shooter = { color: 'Red' } }) {
  const dd = Object.create(DragDrop.prototype);
  Object.assign(dd, {
    _state: 'dragging', inputBlocked: false, _dragSource: 'column', _dragSourceRow: 0, _dragSourceIdx: 1,
    _dragShooter: shooter, _lanes: lanes, _firingSlots: [null, null, null, null],
    _isShotInFlight: () => inFlight.v, _benchReturnEnabled: false, _benchRenderer: null, _pending: null, _ghost: null,
    _clearHighlights: vi.fn(), _showLaneHighlight: vi.fn(), _onLaneHover: vi.fn(), _hitTestBenchArea: () => false,
    _handleLaneDrop: vi.fn(), _snapBack: vi.fn(), _onColorMismatch: vi.fn(),
  });
  return dd;
}
const X = APP_W / 2;   // the middle lane

describe('drop zone', () => {
  const dd = makeDD({ inFlight: { v: false }, lanes: [laneWith('Red'), laneWith('Red'), laneWith('Red')] });
  it('accepts a release anywhere from the road top to the bottom of the breach stripe', () => {
    expect(dd._hitTestLane(X, ROAD_TOP_Y)).toBeGreaterThanOrEqual(0);
    expect(dd._hitTestLane(X, ROAD_BOTTOM_Y + 5)).toBeGreaterThanOrEqual(0);   // the front car's lower half (was dead)
    expect(dd._hitTestLane(X, BREACH_LINE_Y)).toBeGreaterThanOrEqual(0);       // the stripe
    expect(dd._hitTestLane(X, laneDropBottomY())).toBeGreaterThanOrEqual(0);
    expect(laneDropBottomY()).toBeGreaterThan(ROAD_BOTTOM_Y);
  });
  it('rejects a release above the road or below the stripe (the bomb queue)', () => {
    expect(dd._hitTestLane(X, ROAD_TOP_Y - 1)).toBe(-1);
    expect(dd._hitTestLane(X, laneDropBottomY() + 1)).toBe(-1);
  });
});

describe('pending drop while a shot is in flight', () => {
  it('waits at the release point and fires the moment the lane is free', () => {
    const inFlight = { v: true };
    const dd = makeDD({ inFlight, lanes: [laneWith('Red'), laneWith('Red'), laneWith('Red')] });
    dd.onPointerUp(X, ROAD_BOTTOM_Y);
    expect(dd._state).toBe('pending');
    expect(dd._handleLaneDrop).not.toHaveBeenCalled();
    expect(dd._snapBack).not.toHaveBeenCalled();
    dd.update(0.1);
    expect(dd._state).toBe('pending');
    inFlight.v = false;
    dd.update(0.016);
    expect(dd._handleLaneDrop).toHaveBeenCalledWith(dd._hitTestLane(X, ROAD_BOTTOM_Y));
    expect(dd._snapBack).not.toHaveBeenCalled();
    expect(dd._state).not.toBe('pending');
  });

  it('bounces back with the mismatch cue if the front car changed colour meanwhile', () => {
    const inFlight = { v: true };
    const lanes = [laneWith('Red'), laneWith('Red'), laneWith('Red')];
    const dd = makeDD({ inFlight, lanes });
    dd.onPointerUp(X, ROAD_BOTTOM_Y);
    const lane = dd._hitTestLane(X, ROAD_BOTTOM_Y);
    lanes[lane].frontCar().color = 'Blue';
    inFlight.v = false;
    dd.update(0.016);
    expect(dd._handleLaneDrop).not.toHaveBeenCalled();
    expect(dd._onColorMismatch).toHaveBeenCalled();
    expect(dd._snapBack).toHaveBeenCalled();
  });

  it('gives up after 0.8 s (snaps back, no mismatch cue)', () => {
    const inFlight = { v: true };
    const dd = makeDD({ inFlight, lanes: [laneWith('Red'), laneWith('Red'), laneWith('Red')] });
    dd.onPointerUp(X, ROAD_BOTTOM_Y);
    dd.update(0.5);
    expect(dd._state).toBe('pending');
    dd.update(0.5);
    expect(dd._snapBack).toHaveBeenCalled();
    expect(dd._onColorMismatch).not.toHaveBeenCalled();
    expect(dd._handleLaneDrop).not.toHaveBeenCalled();
  });

  it('never fires into a paused game: a modal during the wait cancels it', () => {
    const inFlight = { v: true };
    const dd = makeDD({ inFlight, lanes: [laneWith('Red'), laneWith('Red'), laneWith('Red')] });
    dd.onPointerUp(X, ROAD_BOTTOM_Y);
    dd.inputBlocked = true;
    inFlight.v = false;
    dd.update(0.016);
    expect(dd._handleLaneDrop).not.toHaveBeenCalled();
    expect(dd._snapBack).toHaveBeenCalled();
  });

  it('a new touch is ignored while a drop is pending', () => {
    const inFlight = { v: true };
    const dd = makeDD({ inFlight, lanes: [laneWith('Red'), laneWith('Red'), laneWith('Red')] });
    dd.onPointerUp(X, ROAD_BOTTOM_Y);
    dd._boosterState = null;
    dd.onPointerDown(X, ROAD_BOTTOM_Y);
    expect(dd._state).toBe('pending');
  });
});
