// DragDrop — core interaction layer.
//
// State machine: IDLE → DRAGGING → FLYING (valid drop) | SNAPPING (invalid)
//
// Two drag sources:
//   • Column top  — drag UP to a lane (deploy) or DOWN to bench (store)
//   • Bench slot  — drag UP to a lane (deploy from bench)
//
// Color-match enforcement:
//   • Dropping a shooter on a lane with a mismatched front car is REJECTED
//     (snap back + onColorMismatch callback). An empty lane is always allowed.
//
// Lane highlights during drag:
//   • GREEN  — color matches the front car (or lane is empty)
//   • RED    — color mismatch (drop will be rejected)
//
// Bench highlights during drag from column:
//   • BLUE ring on the hovered empty bench slot
import { Graphics, Container, Text } from 'pixi.js';
import {
  ROAD_TOP_Y, ROAD_BOTTOM_Y,
  ROAD_TOP_X, ROAD_TOP_W, ROAD_BOTTOM_W,
  LANE_COUNT,
} from '../renderer/LaneRenderer.js';
import {
  COL_W, COL_COUNT, TOP_RADIUS, TOP_Y,
} from '../renderer/ShooterRenderer.js';
import { BENCH_Y, BENCH_SLOT_H } from '../renderer/BenchRenderer.js';

// Re-export color map so we can use it without a circular dep on ShooterRenderer.
const COLOR_MAP = {
  Red:    0xE24B4A,
  Blue:   0x378ADD,
  Green:  0x639922,
  Yellow: 0xEF9F27,
  Purple: 0x7F77DD,
  Orange: 0xD85A30,
};

const HIT_RADIUS      = TOP_RADIUS + 14;  // fat-finger tolerance
const HIGHLIGHT_GREEN = 0x44ff88;
const HIGHLIGHT_RED   = 0xff4444;
const HIGHLIGHT_ALPHA = 0.28;

const FLY_DURATION  = 0.10;  // valid drop: ghost flies to target
const SNAP_DURATION = 0.15;  // invalid: ghost snaps back

function easeOut(t) {
  return 1 - Math.pow(1 - Math.min(t, 1), 3);
}

export class DragDrop {
  // columns        — Column[] (live reference from GameState)
  // lanes          — Lane[]   (live reference from GameState, for color-match checks)
  // benchStorage   — BenchStorage
  // shooterRenderer, benchRenderer — for visual coordination during drag
  // callbacks:
  //   onDeploy(colIdx, laneIdx)       — column-to-lane deploy
  //   onDeployFromBench(shooter, laneIdx) — bench-to-lane deploy
  //   onBenchStore(colIdx)            — shooter stored to bench (column consumed)
  //   onColorMismatch()               — rejected drop due to color mismatch
  //   onBenchFull()                   — rejected bench store (all 4 slots full)
  // boosterState       — optional; intercepts column taps when swap mode is active
  // firingLineRenderer — optional FiringLineRenderer; receives hover notifications
  // firingSlots        — optional live ref to gs.firingSlots; occupancy checks
  constructor(
    layerManager,
    columns,
    lanes,
    benchStorage,
    shooterRenderer,
    benchRenderer,
    { onDeploy, onDeployFromBench, onBenchStore, onColorMismatch, onBenchFull, onBombPlaced } = {},
    boosterState = null,
    firingLineRenderer = null,
    firingSlots = null,
  ) {
    this._dragLayer       = layerManager.get('dragLayer');
    this._laneLayer       = layerManager.get('laneLayer');
    this._columns         = columns;
    this._lanes           = lanes;
    this._benchStorage    = benchStorage;
    this._shooterRenderer = shooterRenderer;
    this._benchRenderer   = benchRenderer;
    this._boosterState    = boosterState;

    this._onDeploy          = onDeploy          ?? (() => {});
    this._onDeployFromBench = onDeployFromBench  ?? (() => {});
    this._onBenchStore      = onBenchStore       ?? (() => {});
    this._onColorMismatch   = onColorMismatch    ?? (() => {});
    this._onBenchFull       = onBenchFull        ?? (() => {});
    this._onBombPlaced      = onBombPlaced       ?? (() => {});

    this._firingLineRenderer = firingLineRenderer;
    this._firingSlots        = firingSlots;

    // ── State ──────────────────────────────────────────────────────────────
    this._state         = 'idle';
    this._dragSource    = 'column';   // 'column' | 'bench'
    this._dragSourceIdx = -1;         // column or bench slot index
    this._dragShooter   = null;
    this._ghost         = null;

    // Pointer offset at grab time — keeps ghost anchored to finger contact point
    this._offsetX = 0;
    this._offsetY = 0;

    // Animation state (FLYING or SNAPPING)
    this._animT        = 0;
    this._animDuration = 0;
    this._animFromX    = 0;
    this._animFromY    = 0;
    this._animToX      = 0;
    this._animToY      = 0;
    this._animOnDone   = null;

    // Lane highlights — one Graphics per lane, redrawn dynamically with
    // the correct color so a single object supports both GREEN and RED.
    this._highlights = [];
    for (let i = 0; i < LANE_COUNT; i++) {
      const g = new Graphics();
      g.visible = false;
      this._laneLayer.addChild(g);
      this._highlights.push(g);
    }

    // Set to true while any tutorial/combo/achievement overlay is visible.
    // Suppresses lane hover highlights so they don't bleed through the UI.
    this.uiOverlayActive = false;
  }

  // ── Called by InputManager ─────────────────────────────────────────────────

  onPointerDown(x, y) {
    if (this._state !== 'idle') return;

    // Bomb placement intercept: when bomb mode is active, any tap on the
    // road places the bomb.  Taps outside the road cancel placement.
    if (this._boosterState?.bombMode) {
      this._onBombPlaced(x, y);
      return;
    }

    // Swap booster intercept: column tap handled by booster, not drag.
    const col = this._hitTestColumn(x, y);
    if (col !== -1 && this._boosterState?.swapMode) {
      this._boosterState.tapSwapColumn(col, this._columns);
      return;
    }

    // Try starting a drag from a column top.
    if (col !== -1 && this._columns[col].top()) {
      const shooter = this._columns[col].top();
      const { x: cx, y: cy } = this._shooterRenderer.getTopShooterCenter(col);
      this._startDrag('column', col, shooter, cx, cy, x, y);
      return;
    }

    // Try starting a drag from an occupied bench slot.
    const slot = this._benchRenderer?.hitTestSlot(x, y) ?? -1;
    if (slot !== -1 && this._benchStorage?.getSlot(slot)) {
      const shooter = this._benchStorage.getSlot(slot);
      const { x: cx, y: cy } = this._benchRenderer.getSlotCenter(slot);
      this._startDrag('bench', slot, shooter, cx, cy, x, y);
    }
  }

  onPointerMove(x, y) {
    if (this._state !== 'dragging') return;
    this._ghost.x = x + this._offsetX;
    this._ghost.y = y + this._offsetY;
    this._updateHighlights(x, y);
  }

  onPointerUp(x, y) {
    if (this._state !== 'dragging') return;
    this._clearHighlights();
    this._benchRenderer?.setHighlight(-1);

    // Column source: check for bench drop (dragging downward toward bench).
    if (this._dragSource === 'column' && this._hitTestBenchArea(x, y)) {
      this._handleBenchDrop();
      return;
    }

    // Try lane drop (both sources).
    const laneIdx = this._hitTestLane(x, y);
    if (laneIdx !== -1) {
      if (!this._checkColorMatch(laneIdx)) {
        // Color mismatch — reject.
        this._onColorMismatch();
        this._snapBack();
        return;
      }
      if (this._firingSlots?.[laneIdx]) {
        // Firing slot already occupied — snap back silently.
        this._snapBack();
        return;
      }
      this._handleLaneDrop(laneIdx);
    } else {
      this._snapBack();
    }
  }

  // Call from the main render ticker.
  update(dt) {
    if (this._state !== 'flying' && this._state !== 'snapping') return;

    this._animT += dt / this._animDuration;
    const t = easeOut(this._animT);

    if (this._ghost) {
      this._ghost.x = this._animFromX + (this._animToX - this._animFromX) * t;
      this._ghost.y = this._animFromY + (this._animToY - this._animFromY) * t;
    }

    if (this._animT >= 1) {
      this._animOnDone?.();
      this._state = 'idle';
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _startDrag(source, sourceIdx, shooter, cx, cy, px, py) {
    this._dragSource    = source;
    this._dragSourceIdx = sourceIdx;
    this._dragShooter   = shooter;
    this._offsetX       = cx - px;
    this._offsetY       = cy - py;
    this._state         = 'dragging';

    if (source === 'column') {
      this._shooterRenderer.draggingColumn = sourceIdx;
    } else {
      if (this._benchRenderer) this._benchRenderer.draggingSlot = sourceIdx;
    }

    this._ghost = this._createGhost(shooter, px + this._offsetX, py + this._offsetY);
  }

  _handleLaneDrop(laneIdx) {
    if (this._dragSource === 'column') {
      this._onDeploy(this._dragSourceIdx, laneIdx);
      this._shooterRenderer.draggingColumn = -1;
    } else {
      // Bench → lane: extract shooter from bench, then deploy.
      const shooter = this._benchStorage.take(this._dragSourceIdx);
      if (this._benchRenderer) this._benchRenderer.draggingSlot = -1;
      this._onDeployFromBench(shooter, laneIdx);
    }
    // Fly ghost to the firing slot at the road/shooter boundary.
    const targetX = (laneIdx + 0.5) * ROAD_BOTTOM_W / LANE_COUNT;
    const targetY = ROAD_BOTTOM_Y;
    this._startAnim(
      this._ghost.x, this._ghost.y, targetX, targetY,
      FLY_DURATION, () => this._destroyGhost(),
    );
    this._state = 'flying';
  }

  _handleBenchDrop() {
    if (!this._benchStorage || !this._benchRenderer) {
      this._snapBack();
      return;
    }
    if (this._benchStorage.isFull) {
      this._onBenchFull();
      this._snapBack();
      return;
    }
    // Consume shooter from column and store in bench.
    const col     = this._columns[this._dragSourceIdx];
    const shooter = col.top();
    col.consume();
    const slotIdx = this._benchStorage.store(shooter);
    this._shooterRenderer.draggingColumn = -1;
    this._onBenchStore(this._dragSourceIdx);
    // Fly ghost to the slot it landed in.
    const { x: tx, y: ty } = this._benchRenderer.getSlotCenter(slotIdx);
    this._startAnim(
      this._ghost.x, this._ghost.y, tx, ty,
      FLY_DURATION, () => this._destroyGhost(),
    );
    this._state = 'flying';
  }

  _snapBack() {
    let cx, cy;
    if (this._dragSource === 'column') {
      ({ x: cx, y: cy } = this._shooterRenderer.getTopShooterCenter(this._dragSourceIdx));
      this._shooterRenderer.draggingColumn = -1;
    } else {
      ({ x: cx, y: cy } = this._benchRenderer.getSlotCenter(this._dragSourceIdx));
      if (this._benchRenderer) this._benchRenderer.draggingSlot = -1;
    }
    this._startAnim(
      this._ghost.x, this._ghost.y, cx, cy,
      SNAP_DURATION, () => this._destroyGhost(),
    );
    this._state = 'snapping';
  }

  _updateHighlights(x, y) {
    // Suppress lane color hints while any UI overlay is visible — they would
    // bleed through tutorial panels or combo/achievement popups.
    if (this.uiOverlayActive) {
      this._clearHighlights();
      this._benchRenderer?.setHighlight(-1);
      return;
    }

    this._clearHighlights();
    this._benchRenderer?.setHighlight(-1);

    if (this._dragSource === 'bench') {
      // Bench-source drag: only lanes are valid drop targets.
      const laneIdx = this._hitTestLane(x, y);
      if (laneIdx !== -1) {
        const isOccupied = this._firingSlots?.[laneIdx] != null;
        const isMatch    = this._checkColorMatch(laneIdx);
        this._showLaneHighlight(laneIdx, (isMatch && !isOccupied) ? HIGHLIGHT_GREEN : HIGHLIGHT_RED);
        if (!isOccupied) this._firingLineRenderer?.setHoverSlot(laneIdx, isMatch);
      }
      return;
    }

    // Column-source drag: bench or lane.
    if (y > BENCH_Y - 50) {
      // Approaching or in bench area — show blue highlight on hovered empty slot.
      const slot = this._benchRenderer?.hitTestSlot(x, y) ?? -1;
      if (slot !== -1 && !this._benchStorage?.getSlot(slot)) {
        this._benchRenderer?.setHighlight(slot);
      }
      return;
    }

    // In lane area.
    const laneIdx = this._hitTestLane(x, y);
    if (laneIdx !== -1) {
      const isOccupied = this._firingSlots?.[laneIdx] != null;
      const isMatch    = this._checkColorMatch(laneIdx);
      this._showLaneHighlight(laneIdx, (isMatch && !isOccupied) ? HIGHLIGHT_GREEN : HIGHLIGHT_RED);
      if (!isOccupied) this._firingLineRenderer?.setHoverSlot(laneIdx, isMatch);
    }
  }

  // Redraw a lane highlight polygon with the given color.
  // Called on every pointer-move so the color reflects the current front car.
  _showLaneHighlight(laneIdx, color) {
    const g     = this._highlights[laneIdx];
    const topLx = ROAD_TOP_X + laneIdx       * ROAD_TOP_W  / LANE_COUNT;
    const topRx = ROAD_TOP_X + (laneIdx + 1) * ROAD_TOP_W  / LANE_COUNT;
    const botLx =              laneIdx       * ROAD_BOTTOM_W / LANE_COUNT;
    const botRx =              (laneIdx + 1) * ROAD_BOTTOM_W / LANE_COUNT;
    g.clear();
    g.poly([topLx, ROAD_TOP_Y, topRx, ROAD_TOP_Y, botRx, ROAD_BOTTOM_Y, botLx, ROAD_BOTTOM_Y]);
    g.fill({ color, alpha: HIGHLIGHT_ALPHA });
    g.visible = true;
  }

  // Returns true if the shooter's color matches the front car in this lane,
  // or if the lane is empty (empty lanes are always valid drop targets).
  _checkColorMatch(laneIdx) {
    if (!this._lanes || !this._dragShooter) return true;
    const frontCar = this._lanes[laneIdx]?.frontCar?.();
    if (!frontCar) return true;
    return this._dragShooter.color === frontCar.color;
  }

  _hitTestColumn(x, y) {
    for (let i = 0; i < COL_COUNT; i++) {
      const { x: cx, y: cy } = this._shooterRenderer.getTopShooterCenter(i);
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= HIT_RADIUS * HIT_RADIUS) return i;
    }
    return -1;
  }

  _hitTestLane(x, y) {
    if (y < ROAD_TOP_Y || y > ROAD_BOTTOM_Y) return -1;
    const laneIdx = Math.floor(x / (ROAD_BOTTOM_W / LANE_COUNT));
    return Math.max(0, Math.min(LANE_COUNT - 1, laneIdx));
  }

  // True when the pointer is in the vertical zone that maps to the bench.
  _hitTestBenchArea(x, y) {
    return y >= BENCH_Y - 30 && y <= BENCH_Y + BENCH_SLOT_H + 10;
  }

  _createGhost(shooter, x, y) {
    const container = new Container();
    const color     = COLOR_MAP[shooter.color] ?? 0x888888;
    const R         = TOP_RADIUS + 4;   // slightly larger than hit radius
    const g         = new Graphics();

    // ── Drop shadow (soft blur ring) ─────────────────────────────────────────
    g.circle(2, 4, R + 6);
    g.fill({ color: 0x000000, alpha: 0.30 });

    // ── Outer metallic rim ────────────────────────────────────────────────────
    g.circle(0, 0, R);
    g.fill({ color: 0x2a2a3a });

    // ── Turret base plate (dark gunmetal) ─────────────────────────────────────
    g.circle(0, 0, R - 4);
    g.fill({ color: 0x181828 });

    // ── Turret body (shooter color) ───────────────────────────────────────────
    g.circle(0, -2, R - 9);
    g.fill(color);

    // ── Metallic rim highlight (top-left arc simulating 3D lighting) ──────────
    g.arc(0, -2, R - 9, Math.PI * 1.1, Math.PI * 1.65);
    g.stroke({ color: 0xffffff, width: 3, alpha: 0.45 });

    // ── Barrel (pointing downward — toward deployment zone) ───────────────────
    const barrelW = 8, barrelL = R - 4;
    g.roundRect(-barrelW / 2, -2, barrelW, barrelL, 3);
    g.fill({ color: 0x1a1a2a });
    // Barrel highlight stripe
    g.roundRect(-2, -2, 3, barrelL - 4, 2);
    g.fill({ color: 0xffffff, alpha: 0.20 });

    // ── Turret center dot (emissive core) ─────────────────────────────────────
    g.circle(0, -2, 5);
    g.fill({ color: 0xffffff, alpha: 0.70 });
    g.circle(0, -2, 3);
    g.fill({ color: 0xffffff });

    container.addChild(g);

    // ── Damage number ─────────────────────────────────────────────────────────
    const text = new Text({
      text: String(shooter.damage),
      style: {
        fontSize:   18,
        fontWeight: 'bold',
        fill:       0xffffff,
        dropShadow: { color: 0x000000, blur: 4, distance: 0, alpha: 0.9 },
      },
    });
    text.anchor.set(0.5);
    text.y = -R - 12;   // float above the turret
    container.addChild(text);

    container.x = x;
    container.y = y;
    container.alpha = 0.92;
    container.scale.set(1.0);

    this._dragLayer.addChild(container);
    return container;
  }

  _destroyGhost() {
    if (this._ghost) {
      this._ghost.destroy({ children: true });
      this._ghost = null;
    }
  }

  _clearHighlights() {
    for (const h of this._highlights) h.visible = false;
    this._firingLineRenderer?.clearHover();
  }

  _startAnim(fromX, fromY, toX, toY, duration, onDone) {
    this._animFromX    = fromX;
    this._animFromY    = fromY;
    this._animToX      = toX;
    this._animToY      = toY;
    this._animDuration = duration;
    this._animT        = 0;
    this._animOnDone   = onDone;
  }
}
