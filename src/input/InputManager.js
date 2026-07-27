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

    this._rect = null;                       // cached canvas rect, see _rectNow()
    this._onLayoutChange = () => this._invalidateRect();
    window.addEventListener('resize', this._onLayoutChange);
    window.addEventListener('orientationchange', this._onLayoutChange);
    // Pixi can also resize the canvas without a window resize (autoDensity /
    // renderer.resize), which a window listener would miss.
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(this._onLayoutChange);
      this._ro.observe(app.canvas);
    }

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
    window.removeEventListener('resize', this._onLayoutChange);
    window.removeEventListener('orientationchange', this._onLayoutChange);
    this._ro?.disconnect();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _onDown(e) {
    // Refresh at the START of every interaction: one forced layout per press
    // instead of one per move, and it guarantees a drag can never run against a
    // rect that went stale before the press.
    this._invalidateRect();
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
  //
  // The rect is CACHED. getBoundingClientRect() forces a synchronous layout
  // flush, and this runs on EVERY pointermove — up to 120Hz on a phone, during
  // the one interaction the player is most sensitive to. Measured ~4.6ms per
  // drag across both call sites (this one and GameApp's).
  //
  // Staleness: the canvas rect only changes when the layout changes, so the
  // cache is invalidated on resize and orientationchange (below), and also
  // refreshed on every pointerDOWN — so the worst case is a rect that went stale
  // between a layout change and the next press, which cannot happen mid-drag
  // because a drag begins with a pointerdown.
  _invalidateRect() { this._rect = null; }

  _rectNow() {
    if (!this._rect) this._rect = this._app.canvas.getBoundingClientRect();
    return this._rect;
  }

  _toGameCoords(e) {
    const rect   = this._rectNow();
    const scaleX = this._app.screen.width  / rect.width;
    const scaleY = this._app.screen.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    };
  }
}
