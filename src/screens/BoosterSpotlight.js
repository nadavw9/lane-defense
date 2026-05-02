// BoosterSpotlight — dark-overlay spotlight tutorial shown the first time
// a booster button appears during gameplay.
//
// Rendered as: semi-transparent overlay with a circular hole over the target
// button, two pulsing rings, label + description text, and a dismiss hitbox.
//
// Usage:
//   const s = new BoosterSpotlight(stage, appW, appH, 'swap', () => resume());
//   // call s.update(dt) each frame; tap anywhere auto-calls onDismiss
import { Container, Graphics, Text } from 'pixi.js';

// ── Booster metadata ──────────────────────────────────────────────────────────
const BOOSTER_INFO = {
  swap:   { label: 'SWAP UNLOCKED!',   desc: 'Exchange two\nshooter columns',   color: 0x66aaff },
  peek:   { label: 'PEEK UNLOCKED!',   desc: 'Preview upcoming\nshooters',       color: 0xaaff66 },
  freeze: { label: 'FREEZE UNLOCKED!', desc: 'Freeze all cars\nfor 10 seconds',  color: 0x44ccff },
  cycle:  { label: 'CYCLE UNLOCKED!',  desc: 'Rotate column\nshooters',          color: 0xffdd66 },
  bomb:   { label: 'BOMB READY!',      desc: 'Earn by killing 10 cars\nthen tap to blast!', color: 0xff8844 },
};

// BoosterBar button centres in screen px (matches BoosterBar layout constants).
// BAR_XOFF≈21, SMALL_W=60, GAP=6, BTN_Y=763, BTN_H=30 → centre Y=778
const BUTTON_POS = {
  swap:   { x: 51,  y: 778 },
  peek:   { x: 117, y: 778 },
  freeze: { x: 183, y: 778 },
  cycle:  { x: 249, y: 778 },
  bomb:   { x: 327, y: 778 },
};

const SPOT_R = 48;   // spotlight hole radius

export class BoosterSpotlight {
  constructor(stage, appW, appH, boosterName, onDismiss) {
    this._onDismiss = onDismiss;
    this._t         = 0;

    const info = BOOSTER_INFO[boosterName]  ?? BOOSTER_INFO.swap;
    const pos  = BUTTON_POS[boosterName]    ?? BUTTON_POS.swap;
    this._ringCx    = pos.x;
    this._ringCy    = pos.y;
    this._ringColor = info.color;

    // Container with render-group so erase-mode children work correctly.
    this._container = new Container({ isRenderGroup: true });
    stage.addChild(this._container);

    // Dark overlay
    const overlay = new Graphics();
    overlay.rect(0, 0, appW, appH);
    overlay.fill({ color: 0x000000, alpha: 0.82 });
    this._container.addChild(overlay);

    // Spotlight hole (erase punches through the overlay at the button)
    const hole = new Graphics();
    hole.circle(pos.x, pos.y, SPOT_R + 2);
    hole.fill(0xffffff);
    hole.blendMode = 'erase';
    this._container.addChild(hole);

    // Pulsing rings (drawn over everything each frame)
    this._ring = new Graphics();
    this._container.addChild(this._ring);

    // ── Info text centred in the dead space between road and booster bar ─────
    const textCY = Math.round((510 + 752) / 2);   // midpoint of empty strip

    const badge = new Text({
      text: `✦  ${info.label}  ✦`,
      style: {
        fontSize: 22, fontWeight: 'bold', fill: 0xffffff, align: 'center',
        dropShadow: { color: info.color, blur: 10, distance: 0, alpha: 0.85 },
      },
    });
    badge.anchor.set(0.5, 1);
    badge.x = appW / 2;
    badge.y = textCY - 8;
    this._container.addChild(badge);

    const desc = new Text({
      text: info.desc,
      style: {
        fontSize: 17, fontWeight: 'bold', fill: info.color, align: 'center',
        dropShadow: { color: 0x000000, blur: 5, distance: 2, alpha: 0.9 },
      },
    });
    desc.anchor.set(0.5, 0);
    desc.x = appW / 2;
    desc.y = textCY + 6;
    this._container.addChild(desc);

    const tapHint = new Text({
      text: 'Tap anywhere to continue',
      style: {
        fontSize: 13, fill: 0x888888, align: 'center',
        dropShadow: { color: 0x000000, blur: 3, distance: 1, alpha: 0.8 },
      },
    });
    tapHint.anchor.set(0.5, 0);
    tapHint.x = appW / 2;
    tapHint.y = pos.y - SPOT_R - 38;
    this._container.addChild(tapHint);

    // Full-screen tap-to-dismiss hitbox (must be last = on top)
    const hitbox = new Graphics();
    hitbox.rect(0, 0, appW, appH);
    hitbox.fill({ color: 0, alpha: 0 });
    hitbox.interactive = true;
    hitbox.cursor = 'pointer';
    this._container.addChild(hitbox);
    hitbox.on('pointerdown', () => this.dismiss());
  }

  update(dt) {
    this._t += dt;
    const pulse = 0.5 + 0.5 * Math.sin(this._t * 3.5);

    this._ring.clear();

    // Inner ring: tighter, faster
    const r1     = SPOT_R + 6 + pulse * 10;
    const alpha1 = 0.45 + pulse * 0.45;
    this._ring.circle(this._ringCx, this._ringCy, r1);
    this._ring.stroke({ color: this._ringColor, width: 3, alpha: alpha1 });

    // Outer ring: wider, slower
    const pulse2 = 0.5 + 0.5 * Math.sin(this._t * 2.2 + 1.0);
    const r2     = SPOT_R + 20 + pulse2 * 14;
    const alpha2 = 0.20 + pulse2 * 0.25;
    this._ring.circle(this._ringCx, this._ringCy, r2);
    this._ring.stroke({ color: this._ringColor, width: 2, alpha: alpha2 });
  }

  dismiss() {
    if (!this._container) return;
    this._container.destroy({ children: true });
    this._container = null;
    this._onDismiss?.();
  }

  destroy() {
    if (this._container) {
      this._container.destroy({ children: true });
      this._container = null;
    }
  }
}
