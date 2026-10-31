// The BRIDGE gesture (src/input/DragDrop.js, 2026-10-31): a pointer down on a car that belongs to
// an eligible pair starts a bridge drag; moving over the partner car arms it; releasing there
// makes the bridge (onBridge); releasing anywhere else does nothing. Bombs are never involved.
// Geometry is the real projection (PositionRegistry / roadGeometry), lanes are real Lane objects.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DragDrop } from '../src/input/DragDrop.js';
import { Lane } from '../src/models/Lane.js';
import { Car } from '../src/models/Car.js';
import { setActiveCounts, getLaneScreenX } from '../src/renderer/PositionRegistry.js';
import { setActiveLaneCount } from '../src/renderer3d/projection.js';
import { posToScreenY } from '../src/renderer/roadGeometry.js';
import { eligiblePairs } from '../src/game/bridges.js';

const ROWS = 5;
const mk = (color, row) => { const c = new Car({ color, hp: 1, row }); c.position = row / (ROWS - 1) * 100; return c; };
const at = (lane, car) => ({ x: getLaneScreenX(lane), y: posToScreenY(car.position) });

function harness() {
  setActiveLaneCount(3); setActiveCounts({ laneCount: 3, colCount: 3 });
  const lanes = [new Lane({ id: 0 }), new Lane({ id: 1 }), new Lane({ id: 2 })];
  const a = mk('Red', 2), b = mk('Red', 2), c = mk('Blue', 2), d = mk('Red', 3);
  lanes[0].addCar(a); lanes[1].addCar(b); lanes[2].addCar(c); lanes[0].addCar(d);
  const dd = Object.create(DragDrop.prototype);
  const calls = { bridge: vi.fn(() => true), drag: vi.fn() };
  Object.assign(dd, {
    _state: 'idle', inputBlocked: false, minBoardTapY: 0, _gridRows: ROWS, _lanes: lanes, _columns: [],
    _boosterState: null, _benchRenderer: null, _benchStorage: null,
    _getBridgeable: () => eligiblePairs(lanes, 3),
    _onBridge: calls.bridge, _onBridgeDrag: calls.drag,
    _isShotInFlight: () => false,
    _hitTestQueueSlot: () => null, _hitTestColumn: () => -1,
  });
  return { dd, lanes, a, b, c, d, calls };
}

describe('bridge drag', () => {
  it('a pointer down on a bridgeable car starts a bridge drag, not a bomb drag', () => {
    const { dd, a, calls } = harness();
    const p = at(0, a);
    dd.onPointerDown(p.x, p.y);
    expect(dd._state).toBe('bridging');
    expect(calls.drag).toHaveBeenCalledWith(expect.objectContaining({ from: expect.objectContaining({ lane: 0, car: a }), to: null }));
  });

  it('a pointer down on a car with no partner does nothing', () => {
    const { dd, c, d } = harness();
    for (const [lane, car] of [[2, c], [0, d]]) {
      const p = at(lane, car);
      dd.onPointerDown(p.x, p.y);
      expect(dd._state).toBe('idle');
    }
  });

  it('moving over the partner arms it; releasing there makes the bridge', () => {
    const { dd, a, b, calls } = harness();
    const pa = at(0, a), pb = at(1, b);
    dd.onPointerDown(pa.x, pa.y);
    dd.onPointerMove((pa.x + pb.x) / 2, pa.y + 150);   // between the lanes but a row away: nothing armed
    expect(calls.drag).toHaveBeenLastCalledWith(expect.objectContaining({ to: null }));
    dd.onPointerMove(pb.x, pb.y + 10);
    expect(calls.drag).toHaveBeenLastCalledWith(expect.objectContaining({ to: expect.objectContaining({ lane: 1, car: b }) }));
    dd.onPointerUp(pb.x, pb.y + 10);
    expect(calls.bridge).toHaveBeenCalledWith(0, a, 1, b);
    expect(dd._state).toBe('idle');
    expect(calls.drag).toHaveBeenLastCalledWith(null);
  });

  it('releasing over a car that is not the partner, or over the road, makes nothing', () => {
    const { dd, a, c, calls } = harness();
    const pa = at(0, a), pc = at(2, c);
    dd.onPointerDown(pa.x, pa.y);
    dd.onPointerMove(pc.x, pc.y);
    dd.onPointerUp(pc.x, pc.y);
    expect(calls.bridge).not.toHaveBeenCalled();
    expect(dd._state).toBe('idle');
    dd.onPointerDown(pa.x, pa.y);
    dd.onPointerUp(pa.x + 30, pa.y + 200);
    expect(calls.bridge).not.toHaveBeenCalled();
  });

  it('a cancelled touch and a blocked release both clear the drag', () => {
    const { dd, a, calls } = harness();
    const pa = at(0, a);
    dd.onPointerDown(pa.x, pa.y);
    dd.cancel();
    expect(dd._state).toBe('idle');
    expect(calls.drag).toHaveBeenLastCalledWith(null);
    dd.onPointerDown(pa.x, pa.y);
    dd.inputBlocked = true;
    dd.onPointerUp(pa.x, pa.y);
    expect(dd._state).toBe('idle');
    expect(calls.bridge).not.toHaveBeenCalled();
  });

  it('no bridge drag while a shot is in flight or when bridges are off', () => {
    const { dd, a } = harness();
    const pa = at(0, a);
    dd._isShotInFlight = () => true;
    dd.onPointerDown(pa.x, pa.y);
    expect(dd._state).toBe('idle');
    dd._isShotInFlight = () => false;
    dd._getBridgeable = () => [];
    dd.onPointerDown(pa.x, pa.y);
    expect(dd._state).toBe('idle');
  });
});
