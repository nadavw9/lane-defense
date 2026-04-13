// FiringLineRenderer — draws the 4 firing-line slots at ROAD_BOTTOM_Y.
//
// Each slot corresponds to a lane.  When a shooter is placed there (via
// GameLoop._startFiring), it shows the fire sprite and emits upward-flying
// projectile circles until the fire duration elapses.
//
// Visual states per slot:
//   • Occupied — colored background disc + fire sprite + periodic projectiles
//   • Empty     — dim ring; tinted GREEN or RED when DragDrop hovers over it
//
// Reads gs.firingSlots[] — never writes.
// DragDrop calls setHoverSlot / clearHover during drags.
import { Sprite, Graphics, Assets } from 'pixi.js';
import {
  ROAD_BOTTOM_Y,
  ROAD_BOTTOM_W,
  LANE_COUNT,
} from './LaneRenderer.js';

const SLOT_R     = 22;     // radius of the slot circle
const FIRE_DIAM  = SLOT_R * 2;

// Projectile settings — faster and smaller to match reduced fire durations.
const PROJ_R     = 4;      // radius (down from 6 — less chunky)
const PROJ_SPEED = 520;    // px/s upward (up from 380 — zippier)
const PROJ_LIFE  = 0.28;   // seconds until fully faded (down from 0.40)
const PROJ_SPAWN = 0.18;   // seconds between spawns (down from 0.35 — more shots)

const COLOR_MAP = {
  Red:    0xE24B4A,
  Blue:   0x378ADD,
  Green:  0x639922,
  Yellow: 0xEF9F27,
  Purple: 0x7F77DD,
  Orange: 0xD85A30,
};

function fireUrl(color) {
  return `/sprites/shooters/shooter-${color.toLowerCase()}-fire.png`;
}

export class FiringLineRenderer {
  constructor(layerManager, firingSlots) {
    this._layer       = layerManager.get('activeShooterLayer');
    this._firingSlots = firingSlots;   // live ref to gs.firingSlots — never replaced

    this._hoverIdx   = -1;
    this._hoverMatch = true;

    // Per-slot persistent display objects
    this._bgGraphics  = [];
    this._sprites     = [];
    this._spawnTimers = new Float32Array(LANE_COUNT);  // countdown to next projectile

    // Active projectiles: { g: Graphics, x, y, life }
    this._projectiles = [];

    for (let i = 0; i < LANE_COUNT; i++) {
      const g = new Graphics();
      this._layer.addChild(g);
      this._bgGraphics.push(g);

      const sp = new Sprite();
      sp.anchor.set(0.5);
      sp.visible = false;
      this._layer.addChild(sp);
      this._sprites.push(sp);
    }
  }

  // DragDrop calls this while a shooter is dragged over an empty slot.
  // isMatch — true if the shooter color matches the lane's front car.
  setHoverSlot(idx, isMatch) {
    this._hoverIdx   = idx;
    this._hoverMatch = isMatch;
  }

  clearHover() {
    this._hoverIdx = -1;
  }

  // Call on level restart to clear projectile pool and timers.
  reset() {
    for (let i = 0; i < LANE_COUNT; i++) this._spawnTimers[i] = 0;
    for (const p of this._projectiles) p.g.destroy();
    this._projectiles.length = 0;
  }

  // Call every render frame.
  update(dt) {
    for (let i = 0; i < LANE_COUNT; i++) {
      const g    = this._bgGraphics[i];
      const slot = this._firingSlots[i];
      const cx   = (i + 0.5) * ROAD_BOTTOM_W / LANE_COUNT;
      const cy   = ROAD_BOTTOM_Y;

      g.clear();

      if (slot) {
        const color = COLOR_MAP[slot.shooter.color] ?? 0x888888;

        // Outer glow ring
        g.circle(cx, cy, SLOT_R + 5);
        g.fill({ color, alpha: 0.18 });

        // Filled slot disc
        g.circle(cx, cy, SLOT_R);
        g.fill({ color, alpha: 0.65 });
        g.circle(cx, cy, SLOT_R);
        g.stroke({ color: 0xffffff, width: 1.5, alpha: 0.55 });

        // Fire sprite
        const sp  = this._sprites[i];
        const tex = Assets.get(fireUrl(slot.shooter.color));
        if (tex) {
          if (sp.texture !== tex) {
            sp.texture = tex;
            const max = Math.max(tex.width, tex.height);
            sp.scale.set(FIRE_DIAM / max);
          }
          sp.x       = cx;
          sp.y       = cy;
          sp.visible = true;
        } else {
          sp.visible = false;
        }

        // Spawn a new projectile at the slot interval
        this._spawnTimers[i] -= dt;
        if (this._spawnTimers[i] <= 0) {
          this._spawnTimers[i] = PROJ_SPAWN;
          const proj = new Graphics();
          proj.circle(0, 0, PROJ_R);
          proj.fill({ color, alpha: 0.85 });
          proj.x = cx;
          proj.y = cy;
          this._layer.addChild(proj);
          this._projectiles.push({ g: proj, x: cx, y: cy, life: PROJ_LIFE });
        }
      } else {
        // Empty slot
        this._sprites[i].visible = false;
        this._spawnTimers[i]     = 0;

        g.circle(cx, cy, SLOT_R);
        g.fill({ color: 0x0d0d1a, alpha: 0.55 });

        // Hover highlight from DragDrop
        if (this._hoverIdx === i) {
          const hColor = this._hoverMatch ? 0x44ff88 : 0xff4444;
          g.circle(cx, cy, SLOT_R);
          g.stroke({ color: hColor, width: 2.5, alpha: 0.75 });
        } else {
          g.circle(cx, cy, SLOT_R);
          g.stroke({ color: 0x334455, width: 1.5, alpha: 0.40 });
        }
      }
    }

    // Advance projectiles upward and fade them out
    for (let i = this._projectiles.length - 1; i >= 0; i--) {
      const p = this._projectiles[i];
      p.life  -= dt;
      p.y     -= PROJ_SPEED * dt;
      p.g.x    = p.x;
      p.g.y    = p.y;
      p.g.alpha = Math.max(0, p.life / PROJ_LIFE);
      if (p.life <= 0) {
        p.g.destroy();
        this._projectiles.splice(i, 1);
      }
    }
  }
}
