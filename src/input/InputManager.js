// InputManager — normalises raw pointer events from the canvas and forwards
// them to DragDrop as game-space coordinates.
//
// The canvas may be CSS-scaled (autoDensity + devicePixelRatio), so every
// event coordinate must be mapped from CSS pixels → logical game pixels before
// any hit-testing happens.
export class InputManager {
  // app:      PixiJS Application (for screen dimensions)
  // dragDrop: DragDrop instance
  constructor(app, dragDrop) {
    this._app      = app;
    this._dragDrop = dragDrop;

    // Bind so addEventListener / removeEventListener work with the same reference.
    this._onDown   = this._onDown.bind(this);
    this._onMove   = this._onMove.bind(this);
    this._onUp     = this._onUp.bind(this);

    const c = app.canvas;
    c.addEventListener('pointerdown',   this._onDown);
    c.addEventListener('pointermove',   this._onMove);
    c.addEventListener('pointerup',     this._onUp);
    c.addEventListener('pointercancel', this._onUp);
    // Only treat pointerleave as a release when no button is held (e.g. finger
    // still down on mobile).  Prevents premature drop cancellation mid-drag.
    c.addEventListener('pointerleave',  (e) => { if (e.buttons === 0) this._onUp(e); });
  }

  destroy() {
    const c = this._app.canvas;
    c.removeEventListener('pointerdown',   this._onDown);
    c.removeEventListener('pointermove',   this._onMove);
    c.removeEventListener('pointerup',     this._onUp);
    c.removeEventListener('pointercancel', this._onUp);
    c.removeEventListener('pointerleave',  this._onUp);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _onDown(e) {
    const { x, y } = this._toGameCoords(e);
    this._dragDrop.onPointerDown(x, y);
  }

  _onMove(e) {
    const { x, y } = this._toGameCoords(e);
    this._dragDrop.onPointerMove(x, y);
  }

  _onUp(e) {
    const { x, y } = this._toGameCoords(e);
    this._dragDrop.onPointerUp(x, y);
  }

  // Map a DOM PointerEvent from CSS-pixel space into the logical game canvas space.
  // PixiJS autoDensity scales the canvas element but reports screen.width/height
  // in logical pixels, so we just scale by the CSS→logical ratio.
  _toGameCoords(e) {
    const rect   = this._app.canvas.getBoundingClientRect();
    const scaleX = this._app.screen.width  / rect.width;
    const scaleY = this._app.screen.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    };
  }
}
