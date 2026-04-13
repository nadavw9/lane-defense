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
import { Sprite, Graphics, Text, Assets } from 'pixi.js';
import { COL_W } from './ShooterRenderer.js';

export const BENCH_Y      = 703;
export const BENCH_SLOT_H = 50;

// Target size for bench shooter sprites — fits within the slot.
const BENCH_SPRITE_SIZE = 32;

function idleUrl(color) { return `/sprites/shooters/shooter-${color.toLowerCase()}-idle.png`; }

const SLOT_BG    = 0x0d0d1a;
const SLOT_EDGE  = 0x223344;
const HI_COLOR   = 0x44aaff;
const HI_ALPHA   = 0.35;

// Shooter color → hex for glow tint on occupied slots.
const GLOW_MAP = {
  Red:    0xE24B4A, Blue:   0x378ADD, Green:  0x639922,
  Yellow: 0xEF9F27, Purple: 0x7F77DD, Orange: 0xD85A30,
};

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
    this._sprites  = [];
    this._texts    = [];

    for (let i = 0; i < 4; i++) {
      const g = new Graphics();
      this._layer.addChild(g);
      this._graphics.push(g);

      const sp = new Sprite();
      sp.anchor.set(0.5);
      sp.visible = false;
      this._layer.addChild(sp);
      this._sprites.push(sp);

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
      for (const g  of this._graphics) g.clear();
      for (const sp of this._sprites)  sp.visible = false;
      for (const t  of this._texts)    t.visible  = false;
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
        // Soft colored glow stroke around occupied slot
        const glowCol = GLOW_MAP[shooter.color] ?? 0x44aaff;
        g.roundRect(sx, BENCH_Y, sw, BENCH_SLOT_H, 7);
        g.fill({ color: glowCol, alpha: 0.08 });
        g.roundRect(sx, BENCH_Y, sw, BENCH_SLOT_H, 7);
        g.stroke({ color: glowCol, width: 1.5, alpha: 0.45 });

        // Idle sprite left-of-center, damage number right-of-center.
        const sp  = this._sprites[i];
        const tex = Assets.get(idleUrl(shooter.color));
        if (tex) {
          if (sp.texture !== tex) {
            sp.texture = tex;
            const max = Math.max(tex.width, tex.height);
            sp.scale.set(BENCH_SPRITE_SIZE / max);
          }
          sp.x       = cx - 14;
          sp.y       = cy;
          sp.visible = true;
        } else {
          sp.visible = false;
        }

        this._texts[i].text    = String(shooter.damage);
        this._texts[i].x       = cx + 10;
        this._texts[i].y       = cy;
        this._texts[i].visible = true;
      } else {
        this._sprites[i].visible = false;
        // Empty slot indicator — small dim dot
        g.circle(cx, cy, 3.5);
        g.fill({ color: 0x334455, alpha: 0.55 });
        this._texts[i].visible = false;
      }
    }
  }
}
