// BoosterUnlockScreen — full-screen popup shown once when a new feature unlocks.
//
// Appears on levels 6 (bench), 8 (swap), 12 (peek), 14 (freeze).
// GameApp pauses the game loop before showing this and resumes on dismiss.
// Call update(dt) each render tick for the fade-in animation.
import { Graphics, Text, Container } from 'pixi.js';

const UNLOCKS = {
  6: {
    name:   'Bench Unlocked!',
    color:  0x378ADD,
    desc:   'Store up to 4 unwanted shooters\nand retrieve them mid-battle.',
  },
  8: {
    name:   'Swap Unlocked!',
    color:  0xEF9F27,
    desc:   'Instantly swap the colors\nof two shooter columns.',
  },
  12: {
    name:   'Peek Unlocked!',
    color:  0x7F77DD,
    desc:   'Reveal upcoming shooter colors\nfor the next 5 seconds.',
  },
  14: {
    name:   'Freeze Unlocked!',
    color:  0x88ccff,
    desc:   'Stop all advancing cars\non the road for 10 seconds.',
  },
};

const FADE_DURATION = 0.35;

export class BoosterUnlockScreen {
  constructor(parent, appW, appH, levelId, { onPlay }) {
    this._root = new Container();
    parent.addChild(this._root);
    this._fadeT = 0;

    const unlock = UNLOCKS[levelId];
    // Shouldn't happen, but guard anyway.
    if (!unlock) { onPlay(); return; }

    const c   = this._root;
    const cx  = appW / 2;
    const cy  = appH  * 0.40;   // visual centre of content

    // ── Background ────────────────────────────────────────────────────────────
    // Two overlapping rects fake a top-dark → bottom-purple gradient.
    const bg = new Graphics();
    bg.rect(0, 0, appW, appH);
    bg.fill(0x0c0c22);
    bg.rect(0, appH * 0.45, appW, appH * 0.55);
    bg.fill({ color: 0x180828, alpha: 0.75 });
    bg.eventMode = 'static';   // absorb all pointer events behind the popup
    c.addChild(bg);

    // ── Radial light rays ─────────────────────────────────────────────────────
    const rays = new Graphics();
    const RAY_COUNT = 14, RAY_LEN = 800, HALF_A = 0.08;
    for (let i = 0; i < RAY_COUNT; i++) {
      const a = (i / RAY_COUNT) * Math.PI * 2;
      rays.poly([
        cx, cy,
        cx + Math.cos(a - HALF_A) * RAY_LEN, cy + Math.sin(a - HALF_A) * RAY_LEN,
        cx + Math.cos(a + HALF_A) * RAY_LEN, cy + Math.sin(a + HALF_A) * RAY_LEN,
      ]);
      rays.fill({ color: unlock.color, alpha: 0.055 });
    }
    c.addChild(rays);

    // ── Outer + inner glow discs ──────────────────────────────────────────────
    const glow = new Graphics();
    glow.circle(cx, cy, 130);
    glow.fill({ color: unlock.color, alpha: 0.08 });
    glow.circle(cx, cy, 80);
    glow.fill({ color: unlock.color, alpha: 0.11 });
    c.addChild(glow);

    // ── Feature icon circle ───────────────────────────────────────────────────
    const iconRing = new Graphics();
    iconRing.circle(cx, cy, 54);
    iconRing.fill({ color: 0x0d0d22, alpha: 0.90 });
    iconRing.circle(cx, cy, 54);
    iconRing.stroke({ color: unlock.color, width: 3, alpha: 0.85 });
    c.addChild(iconRing);

    // Icon symbol (unique per feature)
    c.addChild(this._makeIcon(levelId, cx, cy, unlock.color));

    // ── "NEW FEATURE" label ───────────────────────────────────────────────────
    const newLabel = new Text({
      text: 'NEW FEATURE',
      style: {
        fontSize: 12, fontWeight: 'bold', fill: unlock.color,
        letterSpacing: 5,
      },
    });
    newLabel.anchor.set(0.5);
    newLabel.x = cx;
    newLabel.y = cy + 76;
    c.addChild(newLabel);

    // ── Feature name ──────────────────────────────────────────────────────────
    const nameText = new Text({
      text: unlock.name,
      style: {
        fontSize: 30, fontWeight: 'bold', fill: 0xffffff,
        dropShadow: { color: unlock.color, blur: 22, distance: 0, alpha: 0.65 },
      },
    });
    nameText.anchor.set(0.5);
    nameText.x = cx;
    nameText.y = cy + 112;
    c.addChild(nameText);

    // ── Description ───────────────────────────────────────────────────────────
    const descText = new Text({
      text: unlock.desc,
      style: {
        fontSize: 16, fill: 0xaaaacc,
        align: 'center',
        wordWrap: true, wordWrapWidth: appW - 64,
        lineHeight: 25,
      },
    });
    descText.anchor.set(0.5);
    descText.x = cx;
    descText.y = cy + 175;
    c.addChild(descText);

    // ── Play button ───────────────────────────────────────────────────────────
    const btnW = 200, btnH = 58;
    const btn  = new Graphics();
    btn.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 16);
    btn.fill(0x1a5c1a);
    btn.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 16);
    btn.stroke({ color: 0x44ff88, width: 2.5, alpha: 0.85 });
    btn.x = cx;
    btn.y = appH - 130;
    btn.eventMode = 'static';
    btn.cursor    = 'pointer';
    btn.on('pointerdown', () => onPlay());
    btn.on('pointerover',  () => { btn.alpha = 0.78; });
    btn.on('pointerout',   () => { btn.alpha = 1.00; });
    c.addChild(btn);

    const btnLabel = new Text({
      text: 'PLAY',
      style: { fontSize: 24, fontWeight: 'bold', fill: 0x44ff88 },
    });
    btnLabel.anchor.set(0.5);
    btn.addChild(btnLabel);

    // Start fully transparent; update() drives the fade-in.
    c.alpha = 0;
  }

  // Call every render frame.
  update(dt) {
    if (this._root.alpha < 1) {
      this._fadeT += dt / FADE_DURATION;
      this._root.alpha = Math.min(1, this._fadeT);
    }
  }

  destroy() {
    this._root.destroy({ children: true });
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  // Unique programmatic icon per feature, centred at (cx, cy).
  _makeIcon(levelId, cx, cy, color) {
    const g = new Graphics();

    if (levelId === 6) {
      // Bench / storage: two stacked horizontal bars
      g.rect(cx - 20, cy - 10, 40, 8);
      g.fill({ color, alpha: 0.90 });
      g.rect(cx - 20, cy +  4, 40, 8);
      g.fill({ color, alpha: 0.60 });
      // Side legs
      g.rect(cx - 20, cy - 10, 6, 22);
      g.fill({ color, alpha: 0.40 });
      g.rect(cx + 14, cy - 10, 6, 22);
      g.fill({ color, alpha: 0.40 });
    } else if (levelId === 8) {
      // Swap: two opposing horizontal arrows
      // Left arrow (pointing left)
      g.poly([cx - 8, cy - 10,  cx + 20, cy - 10,  cx + 20, cy - 16,  cx + 30, cy - 4,  cx + 20, cy + 8,  cx + 20, cy + 2,  cx - 8, cy + 2]);
      g.fill({ color, alpha: 0.85 });
      // Right arrow (pointing right, mirrored, offset down)
      g.poly([cx + 8, cy + 2,  cx - 20, cy + 2,  cx - 20, cy - 4,  cx - 30, cy + 8,  cx - 20, cy + 20,  cx - 20, cy + 14,  cx + 8, cy + 14]);
      g.fill({ color, alpha: 0.60 });
    } else if (levelId === 12) {
      // Peek: simplified eye
      g.ellipse(cx, cy, 24, 14);
      g.fill({ color, alpha: 0.65 });
      // Pupil
      g.circle(cx, cy, 9);
      g.fill({ color: 0x0d0d22, alpha: 1 });
      g.circle(cx, cy, 5);
      g.fill({ color, alpha: 1 });
      // Highlight
      g.circle(cx + 3, cy - 3, 2);
      g.fill({ color: 0xffffff, alpha: 0.6 });
    } else if (levelId === 14) {
      // Freeze: six-pointed snowflake cross + diagonals
      g.rect(cx - 3,  cy - 24, 6, 48);
      g.fill({ color, alpha: 0.90 });
      g.rect(cx - 24, cy -  3, 48,  6);
      g.fill({ color, alpha: 0.90 });
      // Diagonal arms (rotated rects approximated as narrow parallelograms)
      for (let a = 1; a < 4; a += 2) {
        const ax = Math.cos((a * Math.PI) / 4) * 17;
        const ay = Math.sin((a * Math.PI) / 4) * 17;
        g.rect(cx + ax - 3, cy + ay - 3, 6, 6);
        g.fill({ color, alpha: 0.55 });
        g.rect(cx - ax - 3, cy - ay - 3, 6, 6);
        g.fill({ color, alpha: 0.55 });
        g.rect(cx + ax - 3, cy - ay - 3, 6, 6);
        g.fill({ color, alpha: 0.55 });
        g.rect(cx - ax - 3, cy + ay - 3, 6, 6);
        g.fill({ color, alpha: 0.55 });
      }
    }

    return g;
  }
}
