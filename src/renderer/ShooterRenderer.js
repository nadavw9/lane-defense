// ShooterRenderer — draws the 4 shooter columns in the shooter area (y 520–700).
// Each column shows:
//   • a background panel
//   • the top shooter as a full-opacity colored circle with damage number
//   • the second shooter at 40% opacity
//   • the third shooter at 45% opacity (always visible)
//   • while Peek booster is active: 4th+5th as tiny pips (radius 9) at cx±22
//
// The top shooter has a continuous idle bounce.  On deploy, it punches to 1.3×
// scale and eases back to 1.0 over 150 ms (call triggerDeployPunch(colIdx)).
// During Swap mode the selected column is outlined in blue.
import { Graphics, Container, Text } from 'pixi.js';

// ── Layout ────────────────────────────────────────────────────────────────────
export const SHOOTER_AREA_Y  = 520;
export const SHOOTER_AREA_H  = 180;   // 520-700 (bench row follows at 703)
export const COL_COUNT       = 4;
export const COL_W           = 390 / COL_COUNT;  // 97.5 px

export const TOP_RADIUS    = 34;
export const SECOND_RADIUS = 24;
const        THIRD_RADIUS  = 17;
const        PIP_RADIUS    = 9;

export const TOP_Y    = SHOOTER_AREA_Y + 46;   // 566 — top shooter center
export const SECOND_Y = SHOOTER_AREA_Y + 108;  // 628 — second shooter center
const        THIRD_Y  = SHOOTER_AREA_Y + 156;  // 676 — third shooter center (always visible)
const        PIP_Y    = SHOOTER_AREA_Y + 169;  // 689 — peek pips row

// Idle bounce amplitude and speed
const BOUNCE_AMP   = 4;
const BOUNCE_SPEED = 2.4;

// Column background card
const PANEL_PAD    = 6;
const PANEL_COLOR  = 0x1a1a2e;
const PANEL_RADIUS = 12;

// Deploy punch animation: scale 1.3 → 1.0 over this duration
const PUNCH_DURATION = 0.15; // seconds
const PUNCH_SCALE    = 1.30;

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

// Cubic ease-out
function easeOut(t) { return 1 - Math.pow(1 - Math.min(t, 1), 3); }

export class ShooterRenderer {
  // boosterState is optional — pass null/undefined when boosters are not yet active.
  constructor(layerManager, columns, boosterState = null) {
    this._layer        = layerManager.get('shooterColumnLayer');
    this._columns      = columns;
    this._boosterState = boosterState;

    // DragDrop sets this to suppress the top-circle for the column being dragged.
    this.draggingColumn = -1;

    // Per-column display objects
    this._bgGraphics    = []; // panel bg + second + third circles (redrawn each frame)
    this._secondTexts   = [];
    this._thirdTexts    = [];
    this._topContainers = []; // Container positioned at (cx, topY), scale animated
    this._topGraphics   = []; // Graphics inside topContainer, draws circles at (0,0)
    this._topTexts      = [];
    this._punchState    = []; // { active: bool, t: seconds }

    for (let i = 0; i < COL_COUNT; i++) {
      const colContainer = new Container();
      this._layer.addChild(colContainer);

      // Background graphics — redrawn each frame
      const bgG = new Graphics();
      colContainer.addChild(bgG);
      this._bgGraphics.push(bgG);

      const secondText = new Text({ text: '', style: SECOND_TEXT_STYLE });
      secondText.anchor.set(0.5);
      colContainer.addChild(secondText);
      this._secondTexts.push(secondText);

      const thirdText = new Text({ text: '', style: SECOND_TEXT_STYLE });
      thirdText.anchor.set(0.5);
      colContainer.addChild(thirdText);
      this._thirdTexts.push(thirdText);

      // Top shooter — in its own Container so we can scale it independently.
      const topContainer = new Container();
      colContainer.addChild(topContainer);
      this._topContainers.push(topContainer);

      const topG = new Graphics();
      topContainer.addChild(topG);
      this._topGraphics.push(topG);

      const topText = new Text({ text: '', style: TOP_TEXT_STYLE });
      topText.anchor.set(0.5);
      topText.y = 0;
      topContainer.addChild(topText);
      this._topTexts.push(topText);

      this._punchState.push({ active: false, t: 0 });
    }
  }

  // Trigger the deploy punch on the given column.
  // Call this right after a deploy is registered (from GameApp's onShoot handler).
  triggerDeployPunch(colIdx) {
    if (colIdx < 0 || colIdx >= this._punchState.length) return;
    this._punchState[colIdx].active = true;
    this._punchState[colIdx].t      = 0;
  }

  // Returns the centre position of column i's top shooter (pre-bounce).
  // DragDrop uses this to place the ghost at the right starting position.
  getTopShooterCenter(colIdx) {
    return { x: (colIdx + 0.5) * COL_W, y: TOP_Y };
  }

  // Call once per render frame.  elapsed (seconds) drives idle bounce; dt drives punch.
  update(elapsed, dt = 0) {
    const bounce    = Math.sin(elapsed * BOUNCE_SPEED) * BOUNCE_AMP;
    const isPeeking = this._boosterState?.isPeeking(elapsed) ?? false;
    const bs        = this._boosterState;

    for (let i = 0; i < COL_COUNT; i++) {
      const col = this._columns[i];
      const g   = this._bgGraphics[i];
      const cx  = (i + 0.5) * COL_W;

      g.clear();

      // ── Panel background ────────────────────────────────────────────────────
      const panelX = i * COL_W + PANEL_PAD;
      const panelW = COL_W - PANEL_PAD * 2;
      g.roundRect(panelX, SHOOTER_AREA_Y + PANEL_PAD, panelW, SHOOTER_AREA_H - PANEL_PAD * 2, PANEL_RADIUS);
      g.fill(PANEL_COLOR);

      // Swap first-selection highlight — blue outline on the chosen column.
      if (bs?.swapMode && bs.swapFirst === i) {
        g.roundRect(panelX, SHOOTER_AREA_Y + PANEL_PAD, panelW, SHOOTER_AREA_H - PANEL_PAD * 2, PANEL_RADIUS);
        g.stroke({ color: 0x66aaff, width: 3, alpha: 0.85 });
      }

      // ── Second shooter (40% opacity peek) ────────────────────────────────────
      const second = col.shooters[1] ?? null;
      if (second) {
        const c2 = COLOR_MAP[second.color] ?? 0x888888;
        g.circle(cx, SECOND_Y, SECOND_RADIUS);
        g.fill({ color: c2, alpha: 0.40 });
        this._secondTexts[i].text    = String(second.damage);
        this._secondTexts[i].x       = cx;
        this._secondTexts[i].y       = SECOND_Y;
        this._secondTexts[i].alpha   = 0.40;
        this._secondTexts[i].visible = true;
      } else {
        this._secondTexts[i].visible = false;
      }

      // ── Third shooter (45% opacity, always visible) ─────────────────────────
      const third = col.shooters[2] ?? null;
      if (third) {
        const c3 = COLOR_MAP[third.color] ?? 0x888888;
        g.circle(cx, THIRD_Y, THIRD_RADIUS);
        g.fill({ color: c3, alpha: 0.45 });
        this._thirdTexts[i].text    = String(third.damage);
        this._thirdTexts[i].x       = cx;
        this._thirdTexts[i].y       = THIRD_Y;
        this._thirdTexts[i].alpha   = 0.45;
        this._thirdTexts[i].visible = true;
      } else {
        this._thirdTexts[i].visible = false;
      }

      // ── Peek pips (4th + 5th shooters, tiny dots at cx±22) ──────────────────
      if (isPeeking) {
        const fourth = col.shooters[3] ?? null;
        const fifth  = col.shooters[4] ?? null;
        if (fourth) {
          g.circle(cx - 22, PIP_Y, PIP_RADIUS);
          g.fill({ color: COLOR_MAP[fourth.color] ?? 0x888888, alpha: 0.45 });
        }
        if (fifth) {
          g.circle(cx + 22, PIP_Y, PIP_RADIUS);
          g.fill({ color: COLOR_MAP[fifth.color] ?? 0x888888, alpha: 0.45 });
        }
      }

      // ── Top shooter — scaleable container ────────────────────────────────────
      const top        = col.top();
      const topY       = TOP_Y + (this.draggingColumn === i ? 0 : bounce);
      const topCont    = this._topContainers[i];
      const topG       = this._topGraphics[i];
      const topText    = this._topTexts[i];
      const punch      = this._punchState[i];

      // Position the container at the shooter's world position.
      // The Graphics inside draws relative to (0,0) so scale anchors to centre.
      topCont.x = cx;
      topCont.y = topY;

      topG.clear();

      if (top && this.draggingColumn !== i) {
        const c1 = COLOR_MAP[top.color] ?? 0x888888;

        // Shadow, main circle, highlight glint — all at local (0, 0)
        topG.circle(0, 3, TOP_RADIUS);
        topG.fill({ color: 0x000000, alpha: 0.25 });
        topG.circle(0, 0, TOP_RADIUS);
        topG.fill(c1);
        topG.circle(-10, -10, 10);
        topG.fill({ color: 0xffffff, alpha: 0.18 });

        topText.text    = String(top.damage);
        topText.visible = true;
      } else {
        topText.visible = false;
      }

      // ── Deploy punch scale animation ──────────────────────────────────────────
      if (punch.active) {
        punch.t += dt;
        const progress = Math.min(1, punch.t / PUNCH_DURATION);
        topCont.scale.set(PUNCH_SCALE - (PUNCH_SCALE - 1) * easeOut(progress));
        if (punch.t >= PUNCH_DURATION) {
          punch.active = false;
          topCont.scale.set(1);
        }
      }
    }
  }
}
