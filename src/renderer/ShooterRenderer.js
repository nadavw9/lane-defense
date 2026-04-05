// ShooterRenderer — draws the 4 shooter columns in the shooter area (y 520–760).
// Each column shows:
//   • a subtle background panel
//   • the top shooter as a full-opacity colored circle with damage number
//   • the second shooter at 40% opacity (peek) so the player knows what's next
//
// The top shooter has a continuous idle bounce so the screen feels alive.
// When DragDrop is active it sets draggingColumn to suppress the top-shooter
// graphic for that column (the ghost in dragLayer shows it instead).
import { Graphics, Container, Text } from 'pixi.js';

// ── Layout (matches Screen Layout spec) ──────────────────────────────────────
export const SHOOTER_AREA_Y  = 520;
export const SHOOTER_AREA_H  = 240;   // 760 - 520
export const COL_COUNT       = 4;
export const COL_W           = 390 / COL_COUNT;  // 97.5 px

// Shooter circle sizes
export const TOP_RADIUS    = 36;
export const SECOND_RADIUS = 26;

// Absolute screen-center Y for each slot (before bounce offset)
export const TOP_Y    = SHOOTER_AREA_Y + 78;   // ~top-third of area
export const SECOND_Y = SHOOTER_AREA_Y + 170;  // ~bottom-third

// Idle bounce: amplitude and angular speed (radians/sec)
const BOUNCE_AMP = 4;
const BOUNCE_SPEED = 2.4;

// Column background card
const PANEL_PAD   = 6;
const PANEL_COLOR = 0x1a1a2e;
const PANEL_RADIUS = 12;

// Color palette — same as CarRenderer
const COLOR_MAP = {
  Red:    0xE24B4A,
  Blue:   0x378ADD,
  Green:  0x639922,
  Yellow: 0xEF9F27,
  Purple: 0x7F77DD,
  Orange: 0xD85A30,
};

const TOP_TEXT_STYLE = {
  fontSize:   22,
  fontWeight: 'bold',
  fill:       0xffffff,
  dropShadow: { color: 0x000000, blur: 3, distance: 1, alpha: 0.7 },
};

const SECOND_TEXT_STYLE = {
  fontSize:   16,
  fontWeight: 'bold',
  fill:       0xffffff,
};

export class ShooterRenderer {
  // layerManager: LayerManager
  // columns: Column[] — live column objects from the game loop
  constructor(layerManager, columns) {
    this._layer   = layerManager.get('shooterColumnLayer');
    this._columns = columns;

    // DragDrop sets this to suppress the top-circle for the column being dragged.
    this.draggingColumn = -1;

    // One Graphics + two Texts per column, persistent across frames.
    this._graphics = [];
    this._topTexts    = [];
    this._secondTexts = [];

    for (let i = 0; i < COL_COUNT; i++) {
      const container = new Container();
      this._layer.addChild(container);

      const g = new Graphics();
      container.addChild(g);
      this._graphics.push(g);

      const topText = new Text({ text: '', style: TOP_TEXT_STYLE });
      topText.anchor.set(0.5);
      container.addChild(topText);
      this._topTexts.push(topText);

      const secondText = new Text({ text: '', style: SECOND_TEXT_STYLE });
      secondText.anchor.set(0.5);
      container.addChild(secondText);
      this._secondTexts.push(secondText);
    }
  }

  // Returns the center position of column i's top shooter (pre-bounce).
  // DragDrop uses this to place the ghost at the right starting position.
  getTopShooterCenter(colIdx) {
    return { x: (colIdx + 0.5) * COL_W, y: TOP_Y };
  }

  // Call once per render frame.  elapsed (seconds) drives the idle bounce.
  update(elapsed) {
    const bounce = Math.sin(elapsed * BOUNCE_SPEED) * BOUNCE_AMP;

    for (let i = 0; i < COL_COUNT; i++) {
      const col     = this._columns[i];
      const g       = this._graphics[i];
      const cx      = (i + 0.5) * COL_W;

      g.clear();

      // ── Background panel ─────────────────────────────────────────────────
      const panelX = i * COL_W + PANEL_PAD;
      const panelW = COL_W - PANEL_PAD * 2;
      g.roundRect(panelX, SHOOTER_AREA_Y + PANEL_PAD, panelW, SHOOTER_AREA_H - PANEL_PAD * 2, PANEL_RADIUS);
      g.fill(PANEL_COLOR);

      // ── Second shooter (peek, 40% opacity) ───────────────────────────────
      const second = col.shooters[1] ?? null;
      if (second) {
        const color2 = COLOR_MAP[second.color] ?? 0x888888;
        g.circle(cx, SECOND_Y, SECOND_RADIUS);
        g.fill({ color: color2, alpha: 0.4 });

        this._secondTexts[i].text    = String(second.damage);
        this._secondTexts[i].x       = cx;
        this._secondTexts[i].y       = SECOND_Y;
        this._secondTexts[i].alpha   = 0.4;
        this._secondTexts[i].visible = true;
      } else {
        this._secondTexts[i].visible = false;
      }

      // ── Top shooter (full opacity, idle bounce) ───────────────────────────
      const top   = col.top();
      const topY  = TOP_Y + (this.draggingColumn === i ? 0 : bounce);

      if (top && this.draggingColumn !== i) {
        const color1 = COLOR_MAP[top.color] ?? 0x888888;

        // Shadow ring — subtle depth
        g.circle(cx, topY + 3, TOP_RADIUS);
        g.fill({ color: 0x000000, alpha: 0.25 });

        // Main circle
        g.circle(cx, topY, TOP_RADIUS);
        g.fill(color1);

        // Highlight glint — top-left inner arc suggestion
        g.circle(cx - 10, topY - 10, 10);
        g.fill({ color: 0xffffff, alpha: 0.18 });

        this._topTexts[i].text    = String(top.damage);
        this._topTexts[i].x       = cx;
        this._topTexts[i].y       = topY;
        this._topTexts[i].visible = true;
      } else {
        this._topTexts[i].visible = false;
      }
    }
  }
}
