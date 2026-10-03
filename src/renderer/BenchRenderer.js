// BenchRenderer — draws the 4-slot shooter bench row between the bomb queue
// and the booster bar.
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
import { PX_PER_WU, BOMB_R, bombSlotScreenY, bombSlotRenderedBottom } from '../renderer3d/projection.js';
import { BAR_Y } from './BoosterBar.js';
import { INK } from './ToyStyle.js';
import { shapeFor } from '../game/ColorblindMode.js';

// ── Live bench geometry ───────────────────────────────────────────────────────
// FUNCTIONS, not module-level consts (2026-07-24, geometry-liveness sweep):
// the queue's screen position is lane-count-keyed and mutable since 63092fd,
// and the old `BENCH_Y = 703` — hand-tuned against band-540 geometry — put the
// tray 13px INTO the queue's row-2 balls on 3-lane levels (and 5px into the
// booster bar everywhere, a latent overlap the original layout shipped with).
// The bench now derives its band: it hugs the queue's bottom edge and flexes
// its slot height to whatever room remains above the booster bar.
// 2026-08-02 RECLAIM: 4 -> 0. The bench is MERGED against the queue panel now —
// the tray top sits exactly on the last slot socket edge, no separating strip.
const BENCH_QUEUE_GAP  = 0;    // px between row-2 SOCKET bottom and tray top
const BENCH_TRAY_PAD   = 4;    // tray extends this far above/below the slots
const BENCH_BAR_GAP    = 2;    // px between tray bottom and the booster bar
const BENCH_SLOT_H_MAX = 50;   // the original design height (4-lane levels keep it)
const BENCH_SLOT_H_MIN = 28;   // touch-target floor — never flex below this

// The tray must clear the queue's last slot AS RENDERED — socket ring included,
// not just the ball. Using the ball radius put the tray 0.95px (3-lane) / 3.01px
// (4-lane) INSIDE the third row's socket ring: the "bombs clipping their sockets"
// defect. bombSlotRenderedBottom() is the canonical extent; never re-derive it.
export function benchY() {
  return bombSlotRenderedBottom(2) + BENCH_QUEUE_GAP + BENCH_TRAY_PAD;
}
export function benchSlotH() {
  const room = BAR_Y - BENCH_BAR_GAP - BENCH_TRAY_PAD - benchY();
  return Math.max(BENCH_SLOT_H_MIN, Math.min(BENCH_SLOT_H_MAX, room));
}

// Same source art as the live bomb queue (Shooter3D's powerball plane): the bomb
// body fills ~72% of the image (fuse/spark/shine padding around it), so the full
// sprite must be scaled up by this ratio for the visible BODY to match 2×BOMB_R.
// Must track Shooter3D.js's bombPlaneSize() ratio — same art, same padding.
export const SPRITE_PAD_RATIO = 2.8;

// Target size for bench shooter sprites, DERIVED from the canonical ball size.
// Function, not a const: BOMB_R and PX_PER_WU are live (band-compensated) — a
// const froze at import with band-540 values and rendered bench sprites ~39%
// larger than the queue's own balls on 3-lane levels.
export function benchSpriteSize() { return BOMB_R * SPRITE_PAD_RATIO * PX_PER_WU; }

// Stored bombs use the powerball sprite (same art as the live bomb queue) so the
// bench matches the game — was the old shooter-idle sprite.
export function bombUrl(color) {
  const c    = color.toLowerCase();
  const file = `powerball-${c}.png`;
  return `${import.meta.env.BASE_URL}sprites/designed/${file}`;
}
// Toy Town: slots are recessed wells in a plum tray, ink-outlined.
const SLOT_BG    = 0x2A2540;
const SLOT_EDGE  = INK;
const HI_COLOR   = 0x44aaff;
const HI_ALPHA   = 0.35;

// Shooter color → hex for glow tint on occupied slots.
const GLOW_MAP = {
  Red:    0xFF3D3D, Blue:   0x2F8CFF, Green:  0x2FCC55,
  Yellow: 0xFFD42A, Purple: 0xA35CFF, Orange: 0xFF8A1C,
};

const DMG_STYLE = {
  fontFamily: '"Lilita One", Fredoka, Arial, sans-serif',
  fontSize:   15,
  fill:       0xffffff,
  stroke:     { color: 0x1F1A33, width: 4, join: 'round' },
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

    // Solid tray panel behind all slots — added first so it renders BEHIND the
    // slot circles. Makes the bench band visually distinct from the road.
    this._trayG = new Graphics();
    this._layer.addChild(this._trayG);

    this._graphics = [];
    this._sprites  = [];
    this._texts    = [];
    this._shapes   = [];   // colour-blind shape glyph per slot (stored bombs must stay readable)

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

      const sh = new Text({ text: '', style: { fontSize: 14, fontWeight: '900', fill: 0xFFFFFF, stroke: { color: INK, width: 3 } } });
      sh.anchor.set(0.5);
      sh.visible = false;
      this._layer.addChild(sh);
      this._shapes.push(sh);
    }
  }

  // Show or hide the entire bench row (feature gating for early levels).
  setVisible(visible) {
    this._visible = visible;
    if (!visible) {
      this._trayG.clear();
      for (const g  of this._graphics) g.clear();
      for (const sp of this._sprites)  sp.visible = false;
      for (const t  of this._texts)    t.visible  = false;
      for (const t  of this._shapes)   t.visible  = false;
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
      y: benchY() + benchSlotH() / 2,
    };
  }

  // Returns the slot index (0-3) that (x, y) falls in, or -1 if outside the bench.
  // Hit area is slightly larger than visual to account for fat fingers.
  hitTestSlot(x, y) {
    if (y < benchY() - 8 || y > benchY() + benchSlotH() + 8) return -1;
    return Math.max(0, Math.min(3, Math.floor(x / this._colW)));
  }

  // Call every render frame.
  update() {
    if (!this._visible) return;
    const BENCH_Y      = benchY();       // live per frame — band is per-level
    const BENCH_SLOT_H = benchSlotH();
    const cy = BENCH_Y + BENCH_SLOT_H / 2;

    // Solid tray panel spanning the full bench band — drawn first, behind slots,
    // so the storage area is always distinct from the road.
    this._trayG.clear();
    // Premium pass: the goal band's indigo with its gold trim, so the storage
    // tray reads as part of the same HUD family rather than a placeholder bar.
    const tw = this._colW * 4 - 4, th = BENCH_SLOT_H + BENCH_TRAY_PAD * 2, ty = BENCH_Y - BENCH_TRAY_PAD;
    this._trayG.roundRect(2, ty, tw, th, 12).fill(0x221E4E);
    this._trayG.roundRect(2, ty, tw, th * 0.5, 12).fill({ color: 0xFFFFFF, alpha: 0.05 });
    this._trayG.roundRect(2, ty, tw, th, 12).stroke({ color: 0xB9771C, width: 2.5 });
    this._trayG.roundRect(2, ty, tw, th, 12).stroke({ color: INK, width: 1, alpha: 0.7 });

    for (let i = 0; i < 4; i++) {
      const g       = this._graphics[i];
      // Suppress display while this slot is being dragged.
      const shooter = (this.draggingSlot === i) ? null : this._storage.getSlot(i);
      const cx      = (i + 0.5) * this._colW;
      const sx      = i * this._colW + 3;
      const sw      = this._colW - 6;

      g.clear();

      // Empty slots at 35% opacity so players can see there are slots to fill;
      // filled slots stay bright. (Tray panel behind makes both legible.)
      const isEmpty    = !shooter;
      const bgAlpha    = 1;
      const borderAlph = isEmpty ? 0.55 : 0.9;

      // Slot background
      g.roundRect(sx, BENCH_Y, sw, BENCH_SLOT_H, 7);
      g.fill({ color: SLOT_BG, alpha: bgAlpha });

      // Border: blue highlight when this is the drop target, grey otherwise
      if (this._highlight === i && isEmpty) {
        g.roundRect(sx, BENCH_Y, sw, BENCH_SLOT_H, 7);
        g.fill({ color: HI_COLOR, alpha: 0.12 });
        g.roundRect(sx, BENCH_Y, sw, BENCH_SLOT_H, 7);
        g.stroke({ color: HI_COLOR, width: 2, alpha: HI_ALPHA });
      } else {
        g.roundRect(sx, BENCH_Y, sw, BENCH_SLOT_H, 7);
        g.stroke({ color: SLOT_EDGE, width: 2, alpha: borderAlph });
      }

      if (shooter) {
        // Soft colored glow stroke around occupied slot
        const glowCol = GLOW_MAP[shooter.color] ?? 0x44aaff;
        g.roundRect(sx, BENCH_Y, sw, BENCH_SLOT_H, 7);
        g.fill({ color: glowCol, alpha: 0.08 });
        g.roundRect(sx, BENCH_Y, sw, BENCH_SLOT_H, 7);
        g.stroke({ color: glowCol, width: 1.5, alpha: 0.45 });

        // Idle sprite left-of-center, damage number right-of-center.
        const sp        = this._sprites[i];
        const tex       = Assets.get(bombUrl(shooter.color));
        if (tex) {
          const targetSize = benchSpriteSize();
          if (sp.texture !== tex || sp._benchTargetSize !== targetSize) {
            sp.texture = tex;
            const max = Math.max(tex.width, tex.height);
            sp.scale.set(targetSize / max);
            sp._benchTargetSize = targetSize;
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
        const sym = shapeFor(shooter.color);
        this._shapes[i].text    = sym;
        this._shapes[i].x       = cx - 4;
        this._shapes[i].y       = cy + 10;
        this._shapes[i].visible = sym !== '';
      } else {
        this._shapes[i].visible = false;
        this._sprites[i].visible = false;
        // Empty slot: an inset socket (same language as the queue sockets) with
        // a faint "+" — reads as "a bomb can park here", not as a stray dot.
        const r = Math.min(BENCH_SLOT_H * 0.36, 15);
        g.circle(cx, cy, r).fill({ color: 0x0C0A26, alpha: 0.75 });
        g.circle(cx, cy + 1.5, r - 1.5).stroke({ color: 0xFFFFFF, width: 1.2, alpha: 0.08 });
        g.circle(cx, cy, r).stroke({ color: 0x4E4890, width: 2 });
        g.rect(cx - r * 0.38, cy - 1, r * 0.76, 2).fill({ color: 0x7A74B0, alpha: 0.8 });
        g.rect(cx - 1, cy - r * 0.38, 2, r * 0.76).fill({ color: 0x7A74B0, alpha: 0.8 });
        this._texts[i].visible = false;
      }
    }
  }
}
