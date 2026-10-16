// InputManager gesture ownership (2026-10-03 review): one pointer owns a drag; a second
// finger must not steer or release it; pointercancel is NOT a release; capture is requested.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InputManager } from '../src/input/InputManager.js';

function setup() {
  globalThis.window = new EventTarget();
  const canvas = new EventTarget();
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 844 });
  canvas.setPointerCapture = vi.fn();
  const calls = [];
  const dd = {
    onPointerDown: (x, y) => calls.push(['down', x, y]),
    onPointerMove: (x, y) => calls.push(['move', x, y]),
    onPointerUp:   (x, y) => calls.push(['up', x, y]),
    cancel:        ()     => calls.push(['cancel']),
  };
  const im = new InputManager({ canvas, screen: { width: 390, height: 844 } }, dd);
  const fire = (type, o) => { const e = new Event(type); Object.assign(e, { buttons: 1, isPrimary: true, pointerId: 1, clientX: 0, clientY: 0 }, o); canvas.dispatchEvent(e); };
  return { im, canvas, calls, fire };
}

describe('InputManager gesture ownership', () => {
  beforeEach(() => {});
  afterEach(() => { delete globalThis.window; });

  it('ignores moves and ups from a second pointer during a drag', () => {
    const { calls, fire } = setup();
    fire('pointerdown', { pointerId: 1, clientX: 10, clientY: 10 });
    fire('pointerdown', { pointerId: 2, isPrimary: false, clientX: 200, clientY: 200 });
    fire('pointermove', { pointerId: 2, clientX: 300, clientY: 300 });
    fire('pointerup',   { pointerId: 2, clientX: 300, clientY: 300 });
    expect(calls).toEqual([['down', 10, 10]]);
    fire('pointerup', { pointerId: 1, clientX: 12, clientY: 12 });
    expect(calls.at(-1)).toEqual(['up', 12, 12]);
  });

  it('pointercancel snaps back instead of dropping', () => {
    const { calls, fire } = setup();
    fire('pointerdown', { pointerId: 1, clientX: 10, clientY: 10 });
    fire('pointercancel', { pointerId: 1, clientX: 10, clientY: 10 });
    expect(calls).toEqual([['down', 10, 10], ['cancel']]);
    // and the gesture is over: a new press is accepted
    fire('pointerdown', { pointerId: 1, clientX: 5, clientY: 5 });
    expect(calls.at(-1)).toEqual(['down', 5, 5]);
  });

  it('captures the pointer so a release outside the canvas still arrives', () => {
    const { canvas, fire } = setup();
    fire('pointerdown', { pointerId: 7, clientX: 10, clientY: 10 });
    expect(canvas.setPointerCapture).toHaveBeenCalledWith(7);
  });

  it('destroy() removes every listener it added (pointerleave used to leak)', () => {
    const { im, canvas, calls, fire } = setup();
    im.destroy();
    fire('pointerdown', { pointerId: 1 });
    fire('pointerleave', { buttons: 0 });
    expect(calls).toEqual([]);
  });
});
