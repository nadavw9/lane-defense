// BenchRenderer — draws the 4-slot shooter bench row at y 703–753, between
// the shooter columns and the booster bar.
//
// Each slot shows:
//   • Occupied: a color circle + damage number for the stored shooter
//   • Empty:    a dim rounded square with a dot
//
// DragDrop drives two transient visual states:
//   draggingSlot  — which slot is being dragged FROM (shown as empty)
//   setHighlight  — which slot to blue-highlight as a drop target
import { Graphics, Text } from 'pixi.js';
import { COL_W } from './ShooterRenderer.js';

export const BENCH_Y      = 703;
export const BENCH_SLOT_H = 50;

const BENCH_CIRCLE_R = 16;

const COLOR_MAP = {
  Red:    0xE24B4A,
  Blue:   0x378ADD,
  Green:  0x639922,
  Yellow: 0xEF9F27,
  Purple: 0x7F77DD,
  Orange: 0xD85A30,
};

const SLOT_BG   = 0x0d0d1a;
const SLOT_EDGE = 0x223344;
const HI_COLOR  = 0x44aaff;
const HI_ALPHA  = 0.35;

const DMG_STYLE = {
  fontSize:   13,
  fontWeight: 'bold',
  fill:       0xffffff,
  dropShadow: { color: 0x000000, blur: 2, distance: 1, alpha: 0.6 },
};

export class BenchRenderer {
  constructor(layerManager, benchStorage, appW) {
    this._layer   = layerManager.get('shooterColumnLayer');
    this._storage = benchStorage;
    this._colW    = appW / 4;

    // Set by DragDrop: the slot index currently being dragged (-1 = none).
    this.draggingSlot = -1;

    this._highlight = -1;   // slot to draw blue ring on (-1 = none)
    this._visible   = true; // hidden before bench unlocks (L6+)

    this._graphics = [];
    this._texts    = [];

    for (let i = 0; i < 4; i++) {
      const g = new Graphics();
      this._layer.addChild(g);
      this._graphics.push(g);

      const t = new Text({ text: '', style: DMG_STYLE });
      t.anchor.set(0.5);
      this._layer.addChild(t);
      this._texts.push(t);
    }
  }

  // Show or hide the entire bench row (feature gating for early levels).
  setVisible(visible) {
    this._visible = visible;
    if (!visible) {
      for (const g of this._graphics) g.clear();
      for (const t of this._texts)    t.visible = false;
    }
  }

  // DragDrop calls this during drag to mark which empty slot is being targeted.
  // Pass -1 to clear all highlights.
  setHighlight(slotIdx) {
    this._highlight = slotIdx;
  }

  // Returns the centre (x, y) of bench slot i — used for fly-to animations.
  getSlotCenter(i) {
    return {
      x: (i + 0.5) * this._colW,
      y: BENCH_Y + BENCH_SLOT_H / 2,
    };
  }

  // Returns the slot index (0-3) that (x, y) falls in, or -1 if outside the bench.
  // Hit area is slightly larger than visual to account for fat fingers.
  hitTestSlot(x, y) {
    if (y < BENCH_Y - 8 || y > BENCH_Y + BENCH_SLOT_H + 8) return -1;
    return Math.max(0, Math.min(3, Math.floor(x / this._colW)));
  }

  // Call every render frame.
  update() {
    if (!this._visible) return;
    const cy = BENCH_Y + BENCH_SLOT_H / 2;

    for (let i = 0; i < 4; i++) {
      const g       = this._graphics[i];
      // Suppress display while this slot is being dragged.
      const shooter = (this.draggingSlot === i) ? null : this._storage.getSlot(i);
      const cx      = (i + 0.5) * this._colW;
      const sx      = i * this._colW + 3;
      const sw      = this._colW - 6;

      g.clear();

      // Slot background
      g.roundRect(sx, BENCH_Y, sw, BENCH_SLOT_H, 7);
      g.fill({ color: SLOT_BG, alpha: 0.90 });

      // Border: blue highlight when this is the drop target, grey otherwise
      if (this._highlight === i && !shooter) {
        g.roundRect(sx, BENCH_Y, sw, BENCH_SLOT_H, 7);
        g.fill({ color: HI_COLOR, alpha: 0.12 });
        g.roundRect(sx, BENCH_Y, sw, BENCH_SLOT_H, 7);
        g.stroke({ color: HI_COLOR, width: 2, alpha: HI_ALPHA });
      } else {
        g.roundRect(sx, BENCH_Y, sw, BENCH_SLOT_H, 7);
        g.stroke({ color: SLOT_EDGE, width: 1, alpha: 0.55 });
      }

      if (shooter) {
        const clr = COLOR_MAP[shooter.color] ?? 0x888888;
        // Small color circle left-of-center, damage number right-of-center
        g.circle(cx - 14, cy, BENCH_CIRCLE_R);
        g.fill(clr);

        this._texts[i].text    = String(shooter.damage);
        this._texts[i].x       = cx + 10;
        this._texts[i].y       = cy;
        this._texts[i].visible = true;
      } else {
        // Empty slot indicator — small dim dot
        g.circle(cx, cy, 3.5);
        g.fill({ color: 0x334455, alpha: 0.55 });
        this._texts[i].visible = false;
      }
    }
  }
}
