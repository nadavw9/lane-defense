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
//
// Lane highlights during drag:
//   • GREEN  — color matches the front car (or lane is empty)
//   • RED    — color mismatch (drop will be rejected)
//
// Bench highlights during drag from column:
//   • BLUE ring on the hovered empty bench slot
import { Graphics, Container, Text, Sprite, Texture } from 'pixi.js';
import {
  ROAD_TOP_Y, ROAD_BOTTOM_Y,
  ROAD_TOP_X, ROAD_TOP_W, ROAD_BOTTOM_W,
  LANE_COUNT,
} from '../renderer/LaneRenderer.js';
import {
  COL_W, COL_COUNT, TOP_RADIUS, TOP_Y,
  SHOOTER_AREA_Y, SHOOTER_AREA_H,
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

const HIT_RADIUS      = TOP_RADIUS + 14;
const HIGHLIGHT_GREEN = 0x44ff88;
const HIGHLIGHT_RED   = 0xff4444;
const HIGHLIGHT_ALPHA = 0.28;

const FLY_DURATION  = 0.10;
const SNAP_DURATION = 0.15;

// Ghost wobble: ±3° on a ~0.2 s period
const WOBBLE_AMP   = Math.PI / 60;   // 3 degrees
const WOBBLE_SPEED = 5.0;

// Spark animation redraw interval (ms)
const SPARK_INTERVAL_MS = 80;

function easeOut(t) {
  return 1 - Math.pow(1 - Math.min(t, 1), 3);
}

// ── Canvas helpers ─────────────────────────────────────────────────────────────
function _canvasRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x, y + h - r,     r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y,         x + r, y,          r);
  ctx.closePath();
}

// Draw 8-pointed rotating spark rays using PIXI Graphics.
function _drawSpark(g, x, y, angle, size) {
  g.clear();
  for (let i = 0; i < 8; i++) {
    const a   = angle + (i / 8) * Math.PI * 2;
    const len = (i % 2 === 0) ? size : size * 0.55;
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
  }
  g.stroke({ color: 0xffee44, width: 2.5 });
  g.circle(x, y, size * 0.35);
  g.fill({ color: 0xff8800 });
}

export class DragDrop {
  // columns        — Column[] (live reference from GameState)
  // lanes          — Lane[]   (live reference from GameState, for color-match checks)
  // benchStorage   — BenchStorage
  // shooterRenderer, benchRenderer — for visual coordination during drag
  // callbacks:
  //   onDeploy(colIdx, laneIdx)
  //   onDeployFromBench(shooter, laneIdx)
  //   onBenchStore(colIdx)
  //   onColorMismatch()
  //   onBenchFull()
  //   onLaneHover(laneIdx, colorHex)  — 3D road lane glow
  //   onLaneClear()                   — remove 3D road lane glow
  // boosterState       — optional
  // firingLineRenderer — optional
  // firingSlots        — optional live ref to gs.firingSlots
  constructor(
    layerManager,
    columns,
    lanes,
    benchStorage,
    shooterRenderer,
    benchRenderer,
    { onDeploy, onDeployFromBench, onBenchStore, onColorMismatch, onBenchFull, onBombPlaced,
      onLaneHover, onLaneClear } = {},
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
    this._onLaneHover       = onLaneHover        ?? (() => {});
    this._onLaneClear       = onLaneClear        ?? (() => {});

    this._firingLineRenderer = firingLineRenderer;
    this._firingSlots        = firingSlots;

    // ── State ──────────────────────────────────────────────────────────────
    this._state         = 'idle';
    this._dragSource    = 'column';
    this._dragSourceIdx = -1;
    this._dragShooter   = null;
    this._ghost         = null;

    this._offsetX = 0;
    this._offsetY = 0;

    this._animT        = 0;
    this._animDuration = 0;
    this._animFromX    = 0;
    this._animFromY    = 0;
    this._animToX      = 0;
    this._animToY      = 0;
    this._animOnDone   = null;

    // Ghost wobble elapsed
    this._ghostElapsed  = 0;
    // Spark setInterval handle
    this._sparkInterval = null;

    // Lane highlights
    this._highlights = [];
    for (let i = 0; i < LANE_COUNT; i++) {
      const g = new Graphics();
      g.visible = false;
      this._laneLayer.addChild(g);
      this._highlights.push(g);
    }

    this.uiOverlayActive = false;
  }

  // ── Called by InputManager ─────────────────────────────────────────────────

  onPointerDown(x, y) {
    if (this._state !== 'idle') return;

    if (this._boosterState?.bombMode) {
      if (y >= ROAD_TOP_Y && y <= ROAD_BOTTOM_Y) {
        this._onBombPlaced(x, y);
      }
      return;
    }

    const col = this._hitTestColumn(x, y);
    if (col !== -1 && this._boosterState?.swapMode) {
      this._boosterState.tapSwapColumn(col, this._columns);
      return;
    }

    if (this._boosterState?.cycleMode) {
      if (y >= SHOOTER_AREA_Y && y <= SHOOTER_AREA_Y + SHOOTER_AREA_H) {
        const cycleCol = Math.max(0, Math.min(COL_COUNT - 1, Math.floor(x / COL_W)));
        this._boosterState.tapCycleColumn(cycleCol, this._columns);
      }
      return;
    }

    if (col !== -1 && this._columns[col].top()) {
      const shooter = this._columns[col].top();
      this._startDrag('column', col, shooter, x, y, x, y);
      return;
    }

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

    if (this._dragSource === 'column' && this._hitTestBenchArea(x, y)) {
      this._handleBenchDrop();
      return;
    }

    const laneIdx = this._hitTestLane(x, y);
    if (laneIdx !== -1) {
      if (!this._checkColorMatch(laneIdx)) {
        this._onColorMismatch();
        this._snapBack();
        return;
      }
      if (this._firingSlots?.[laneIdx]) {
        this._snapBack();
        return;
      }
      this._handleLaneDrop(laneIdx);
    } else {
      this._snapBack();
    }
  }

  update(dt) {
    // Wobble ghost during active drag
    if (this._ghost && this._state === 'dragging') {
      this._ghostElapsed += dt;
      this._ghost.rotation = Math.sin(this._ghostElapsed * WOBBLE_SPEED) * WOBBLE_AMP;
    }

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
    this._ghostElapsed  = 0;

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
      const shooter = this._benchStorage.take(this._dragSourceIdx);
      if (this._benchRenderer) this._benchRenderer.draggingSlot = -1;
      this._onDeployFromBench(shooter, laneIdx);
    }
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
    const col     = this._columns[this._dragSourceIdx];
    const shooter = col.top();
    col.consume();
    const slotIdx = this._benchStorage.store(shooter);
    this._shooterRenderer.draggingColumn = -1;
    this._onBenchStore(this._dragSourceIdx);
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
    if (this.uiOverlayActive) {
      this._clearHighlights();
      this._benchRenderer?.setHighlight(-1);
      return;
    }

    this._clearHighlights();
    this._benchRenderer?.setHighlight(-1);

    const colorHex = COLOR_MAP[this._dragShooter?.color] ?? 0x888888;

    if (this._dragSource === 'bench') {
      const laneIdx = this._hitTestLane(x, y);
      if (laneIdx !== -1) {
        const isOccupied = this._firingSlots?.[laneIdx] != null;
        const isMatch    = this._checkColorMatch(laneIdx);
        this._showLaneHighlight(laneIdx, (isMatch && !isOccupied) ? HIGHLIGHT_GREEN : HIGHLIGHT_RED);
        if (!isOccupied) this._firingLineRenderer?.setHoverSlot(laneIdx, isMatch);
        this._onLaneHover(laneIdx, colorHex);
      }
      return;
    }

    if (y > BENCH_Y - 50) {
      const slot = this._benchRenderer?.hitTestSlot(x, y) ?? -1;
      if (slot !== -1 && !this._benchStorage?.getSlot(slot)) {
        this._benchRenderer?.setHighlight(slot);
      }
      return;
    }

    const laneIdx = this._hitTestLane(x, y);
    if (laneIdx !== -1) {
      const isOccupied = this._firingSlots?.[laneIdx] != null;
      const isMatch    = this._checkColorMatch(laneIdx);
      this._showLaneHighlight(laneIdx, (isMatch && !isOccupied) ? HIGHLIGHT_GREEN : HIGHLIGHT_RED);
      if (!isOccupied) this._firingLineRenderer?.setHoverSlot(laneIdx, isMatch);
      this._onLaneHover(laneIdx, colorHex);
    }
  }

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

  _hitTestBenchArea(x, y) {
    return y >= BENCH_Y - 30 && y <= BENCH_Y + BENCH_SLOT_H + 10;
  }

  // ── Ghost creation ─────────────────────────────────────────────────────────
  // Returns a PIXI Container with a static bomb sprite + animated spark child.
  _createGhost(shooter, x, y) {
    const color  = COLOR_MAP[shooter.color] ?? 0x888888;
    const damage = shooter.damage ?? 1;

    const S = 160;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const ctx = cv.getContext('2d');

    // Bomb geometry
    const cx = S / 2;
    const cy = S * 0.57;   // shifted down for fuse room
    const R  = S * 0.29;

    const r8 = ((color >> 16) & 0xff).toString(16).padStart(2,'0');
    const g8 = ((color >>  8) & 0xff).toString(16).padStart(2,'0');
    const b8 = ( color        & 0xff).toString(16).padStart(2,'0');
    const css = `#${r8}${g8}${b8}`;

    // ── Drop shadow (radial gradient ellipse under bomb) ─────────────────────
    const shadowGrad = ctx.createRadialGradient(cx, cy + R * 0.5, 0, cx, cy + R * 0.55, R * 1.25);
    shadowGrad.addColorStop(0, 'rgba(0,0,0,0.30)');
    shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy + R * 0.55, R * 1.30, R * 0.50, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Outer glow ────────────────────────────────────────────────────────────
    ctx.shadowColor = css;
    ctx.shadowBlur  = 20;
    ctx.fillStyle   = css;
    ctx.beginPath(); ctx.arc(cx, cy, R + 5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur  = 0;

    // ── Bomb body ─────────────────────────────────────────────────────────────
    ctx.fillStyle = css;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

    // ── Rim highlight gradient ────────────────────────────────────────────────
    const rimGrad = ctx.createLinearGradient(cx - R, cy - R, cx + R * 0.4, cy + R * 0.4);
    rimGrad.addColorStop(0, 'rgba(255,255,255,0.22)');
    rimGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rimGrad;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

    // ── Dark bottom-half shading ──────────────────────────────────────────────
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.arc(cx, cy, R, Math.PI * 0.05, Math.PI * 0.95, false);
    ctx.closePath(); ctx.fill();

    // ── Specular hotspot upper-left ───────────────────────────────────────────
    const specGrad = ctx.createRadialGradient(
      cx - R * 0.30, cy - R * 0.30, 0,
      cx - R * 0.30, cy - R * 0.30, R * 0.40,
    );
    specGrad.addColorStop(0, 'rgba(255,255,255,0.65)');
    specGrad.addColorStop(0.5, 'rgba(255,255,255,0.20)');
    specGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = specGrad;
    ctx.beginPath(); ctx.arc(cx - R * 0.30, cy - R * 0.30, R * 0.40, 0, Math.PI * 2); ctx.fill();

    // ── White border ──────────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,0.50)';
    ctx.lineWidth   = 2.5;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();

    // ── Fuse — thick curved line with gradient ────────────────────────────────
    const fuseEndX = cx + S * 0.14;
    const fuseEndY = cy - R - S * 0.22;
    const fuseCPX  = cx + S * 0.08;
    const fuseCPY  = cy - R - S * 0.10;
    const fuseGrad = ctx.createLinearGradient(cx, cy - R, fuseEndX, fuseEndY);
    fuseGrad.addColorStop(0, '#dddddd');
    fuseGrad.addColorStop(1, '#888888');
    ctx.strokeStyle = fuseGrad;
    ctx.lineWidth   = Math.max(3, S * 0.030);
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy - R);
    ctx.quadraticCurveTo(fuseCPX, fuseCPY, fuseEndX, fuseEndY);
    ctx.stroke();

    // ── Damage badge plate ────────────────────────────────────────────────────
    const badgeCX = cx;
    const badgeCY = cy + R * 0.32;
    const badgeW  = R * 1.15;
    const badgeH  = R * 0.62;
    _canvasRoundRect(ctx, badgeCX - badgeW / 2, badgeCY - badgeH / 2, badgeW, badgeH, 8);
    ctx.fillStyle   = '#0a0a14';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.80)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    ctx.font         = `bold ${Math.round(R * 0.70)}px Arial`;
    ctx.fillStyle    = '#ffffff';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor  = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur   = 3;
    ctx.fillText(String(damage), badgeCX, badgeCY);
    ctx.shadowBlur   = 0;

    // ── Build PIXI container ─────────────────────────────────────────────────
    const tex    = Texture.from(cv);
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);

    // Spark PIXI Graphics child — anchored at fuse tip offset from sprite centre
    const sparkOffX = fuseEndX - S / 2;
    const sparkOffY = fuseEndY - S / 2;
    const sparkG    = new Graphics();
    _drawSpark(sparkG, sparkOffX, sparkOffY, 0, S * 0.065);

    const container = new Container();
    container.addChild(sprite);
    container.addChild(sparkG);
    container.x     = x;
    container.y     = y;
    container.alpha = 0.92;
    this._dragLayer.addChild(container);

    // Animate spark rays every 80 ms
    let sparkAngle = 0;
    this._sparkInterval = setInterval(() => {
      if (sparkG.destroyed) return;
      sparkAngle += 0.45;
      _drawSpark(sparkG, sparkOffX, sparkOffY, sparkAngle, S * 0.065);
    }, SPARK_INTERVAL_MS);

    return container;
  }

  _destroyGhost() {
    if (this._sparkInterval !== null) {
      clearInterval(this._sparkInterval);
      this._sparkInterval = null;
    }
    if (this._ghost) {
      this._ghost.destroy({ children: true });
      this._ghost = null;
    }
    this._ghostElapsed = 0;
  }

  _clearHighlights() {
    for (const h of this._highlights) h.visible = false;
    this._firingLineRenderer?.clearHover();
    this._onLaneClear();
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
