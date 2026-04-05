// DragDrop — the core interaction layer.
// State machine: IDLE → DRAGGING → FLYING (valid drop) | SNAPPING (invalid)
//
// On pointer-down over a top shooter, creates a ghost in dragLayer that
// follows the finger.  Valid lane drops animate the ghost to the lane;
// invalid drops snap it back.  Neither read nor write game state directly —
// the onDeploy callback hands control back to GameApp.
import { Graphics, Container, Text } from 'pixi.js';
import {
  ROAD_TOP_Y, ROAD_BOTTOM_Y,
  ROAD_TOP_X, ROAD_TOP_W, ROAD_BOTTOM_W,
  LANE_COUNT,
} from '../renderer/LaneRenderer.js';
import {
  COL_W, COL_COUNT, TOP_RADIUS, TOP_Y,
} from '../renderer/ShooterRenderer.js';

// Re-export color map so we can use it here without a circular dep on ShooterRenderer.
const COLOR_MAP = {
  Red:    0xE24B4A,
  Blue:   0x378ADD,
  Green:  0x639922,
  Yellow: 0xEF9F27,
  Purple: 0x7F77DD,
  Orange: 0xD85A30,
};

// Hit-test radius for the top shooter (slightly larger than visual for fat fingers).
const HIT_RADIUS = TOP_RADIUS + 14;

// Lane highlight color during drag
const HIGHLIGHT_COLOR = 0x44ff88;
const HIGHLIGHT_ALPHA = 0.28;

// Animation durations (seconds)
const FLY_DURATION  = 0.10;  // valid drop: ghost flies to lane
const SNAP_DURATION = 0.15;  // invalid drop: ghost snaps back

// Cubic ease-out: fast start, slow finish
function easeOut(t) {
  return 1 - Math.pow(1 - Math.min(t, 1), 3);
}

export class DragDrop {
  // onDeploy(colIdx, laneIdx) — called immediately when a valid drop occurs.
  // boosterState (optional) — when swap mode is active, column taps are
  //   intercepted for the swap mechanic instead of starting a drag.
  constructor(layerManager, columns, shooterRenderer, onDeploy, boosterState = null) {
    this._dragLayer       = layerManager.get('dragLayer');
    this._laneLayer       = layerManager.get('laneLayer');
    this._columns         = columns;
    this._shooterRenderer = shooterRenderer;
    this._onDeploy        = onDeploy;
    this._boosterState    = boosterState;

    // ── State ──────────────────────────────────────────────────────────────
    this._state       = 'idle';
    this._dragCol     = -1;
    this._dragShooter = null;
    this._ghost       = null;

    // Pointer offset at grab time (so ghost doesn't jump to finger centre)
    this._offsetX = 0;
    this._offsetY = 0;

    // Animation state (flying / snapping)
    this._animT        = 0;
    this._animDuration = 0;
    this._animFromX    = 0;
    this._animFromY    = 0;
    this._animToX      = 0;
    this._animToY      = 0;
    this._animOnDone   = null;

    // ── Lane highlight overlays — trapezoid polygons (created once, toggled during drag)
    this._highlights = [];
    for (let i = 0; i < LANE_COUNT; i++) {
      const g    = new Graphics();
      const topLx = ROAD_TOP_X + i       * ROAD_TOP_W  / LANE_COUNT;
      const topRx = ROAD_TOP_X + (i + 1) * ROAD_TOP_W  / LANE_COUNT;
      const botLx =              i       * ROAD_BOTTOM_W / LANE_COUNT;
      const botRx =              (i + 1) * ROAD_BOTTOM_W / LANE_COUNT;
      g.poly([topLx, ROAD_TOP_Y, topRx, ROAD_TOP_Y, botRx, ROAD_BOTTOM_Y, botLx, ROAD_BOTTOM_Y]);
      g.fill({ color: HIGHLIGHT_COLOR, alpha: HIGHLIGHT_ALPHA });
      g.visible = false;
      this._laneLayer.addChild(g);
      this._highlights.push(g);
    }
  }

  // ── Called by InputManager ─────────────────────────────────────────────────

  onPointerDown(x, y) {
    if (this._state !== 'idle') return;
    const col = this._hitTestColumn(x, y);

    // Swap booster: intercept column tap — don't start a drag.
    if (col !== -1 && this._boosterState?.swapMode) {
      this._boosterState.tapSwapColumn(col, this._columns);
      return;
    }

    if (col === -1 || !this._columns[col].top()) return;

    const shooter = this._columns[col].top();
    const { x: cx, y: cy } = this._shooterRenderer.getTopShooterCenter(col);

    this._dragCol     = col;
    this._dragShooter = shooter;
    this._offsetX     = cx - x;   // keep ghost anchored to grab point
    this._offsetY     = cy - y;
    this._state       = 'dragging';

    this._shooterRenderer.draggingColumn = col;
    this._ghost = this._createGhost(shooter, x + this._offsetX, y + this._offsetY);
  }

  onPointerMove(x, y) {
    if (this._state !== 'dragging') return;

    this._ghost.x = x + this._offsetX;
    this._ghost.y = y + this._offsetY;

    // Highlight whichever lane the finger is over.
    const hoveredLane = this._hitTestLane(x, y);
    for (let i = 0; i < LANE_COUNT; i++) {
      this._highlights[i].visible = (i === hoveredLane);
    }
  }

  onPointerUp(x, y) {
    if (this._state !== 'dragging') return;

    this._clearHighlights();
    const lane = this._hitTestLane(x, y);

    if (lane !== -1) {
      // Valid drop — call game logic immediately, then animate ghost into the lane.
      this._onDeploy(this._dragCol, lane);
      this._shooterRenderer.draggingColumn = -1;

      // Fly toward the bottom-centre of the dropped lane column (near breach line).
      const targetX = (lane + 0.5) * ROAD_BOTTOM_W / LANE_COUNT;
      const targetY = ROAD_BOTTOM_Y - 15;
      this._startAnim(
        this._ghost.x, this._ghost.y,
        targetX, targetY,
        FLY_DURATION,
        () => this._destroyGhost(),
      );
      this._state = 'flying';
    } else {
      // Invalid drop — snap ghost back to column origin.
      this._shooterRenderer.draggingColumn = -1;
      const { x: cx, y: cy } = this._shooterRenderer.getTopShooterCenter(this._dragCol);
      this._startAnim(
        this._ghost.x, this._ghost.y,
        cx, cy,
        SNAP_DURATION,
        () => this._destroyGhost(),
      );
      this._state = 'snapping';
    }
  }

  // Call from the main game-loop ticker.
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

  _hitTestColumn(x, y) {
    for (let i = 0; i < COL_COUNT; i++) {
      const { x: cx, y: cy } = this._shooterRenderer.getTopShooterCenter(i);
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= HIT_RADIUS * HIT_RADIUS) return i;
    }
    return -1;
  }

  // Valid drop zone: anywhere in the road area (ROAD_TOP_Y to ROAD_BOTTOM_Y).
  // Lane is determined by x position (which of the 4 vertical column bands).
  _hitTestLane(x, y) {
    if (y < ROAD_TOP_Y || y > ROAD_BOTTOM_Y) return -1;
    const laneIdx = Math.floor(x / (ROAD_BOTTOM_W / LANE_COUNT));
    return Math.max(0, Math.min(LANE_COUNT - 1, laneIdx));
  }

  _createGhost(shooter, x, y) {
    const color     = COLOR_MAP[shooter.color] ?? 0x888888;
    const container = new Container();

    const g = new Graphics();
    g.circle(0, 0, TOP_RADIUS);
    g.fill({ color: 0x000000, alpha: 0.2 });        // drop shadow
    g.circle(0, -3, TOP_RADIUS);
    g.fill(color);
    g.circle(-10, -13, 10);
    g.fill({ color: 0xffffff, alpha: 0.18 });        // glint

    const GHOST_TEXT_STYLE = {
      fontSize:   22,
      fontWeight: 'bold',
      fill:       0xffffff,
      dropShadow: { color: 0x000000, blur: 3, distance: 1, alpha: 0.7 },
    };
    const text = new Text({ text: String(shooter.damage), style: GHOST_TEXT_STYLE });
    text.anchor.set(0.5);
    text.y = -3;

    container.addChild(g);
    container.addChild(text);
    container.x     = x;
    container.y     = y;
    container.alpha = 0.88;
    container.scale.set(1.08);   // slightly larger while dragging — feels "lifted"

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
