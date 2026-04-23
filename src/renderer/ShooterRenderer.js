// ShooterRenderer — draws the 4 shooter columns with real sprites.
//
// Each column shows:
//   • top shooter   — idle sprite (bouncing), swaps to fire sprite while deployed
//   • second shooter — idle sprite at 40% opacity
//   • third shooter  — idle sprite at 45% opacity (always visible)
//   • peek pips (4th/5th) — tiny idle sprites at cx±22 while Peek is active
//
// Textures must be preloaded by GameApp before ShooterRenderer is instantiated.
import { Sprite, Graphics, Container, Text, Assets } from 'pixi.js';
import { spriteFlags } from './SpriteFlags.js';
import { isColorblind, SHAPES } from '../game/ColorblindMode.js';

// ── Layout ────────────────────────────────────────────────────────────────────
export const SHOOTER_AREA_Y  = 520;
export const SHOOTER_AREA_H  = 180;   // 520–700 (bench row follows at 703)
export const COL_COUNT       = 4;
export const COL_W           = 390 / COL_COUNT;  // 97.5 px

export const TOP_RADIUS    = 34;   // kept for DragDrop hit-testing
export const SECOND_RADIUS = 24;
const        THIRD_RADIUS  = 17;
const        PIP_RADIUS    = 9;

export const TOP_Y    = SHOOTER_AREA_Y + 93;    // 613 — matches 3D turret screen position
export const SECOND_Y = SHOOTER_AREA_Y + 135;   // 655 — second shooter centre (below top)
const        THIRD_Y  = SHOOTER_AREA_Y + 163;   // 683 — third shooter centre
const        PIP_Y    = SHOOTER_AREA_Y + 174;   // 694 — peek pips row

// Target rendered diameters (diameter, not radius) at 1× scale
const TOP_DIAM    = TOP_RADIUS    * 2;   // 68 px
const SECOND_DIAM = SECOND_RADIUS * 2;   // 48 px
const THIRD_DIAM  = THIRD_RADIUS  * 2;   // 34 px
const PIP_DIAM    = PIP_RADIUS    * 2;   // 18 px

// Idle bounce
const BOUNCE_AMP   = 4;
const BOUNCE_SPEED = 2.4;

// Column background card
const PANEL_PAD    = 6;
const PANEL_COLOR  = 0x1a1a2e;
const PANEL_RADIUS = 12;

// Deploy punch animation
const PUNCH_DURATION = 0.15;
const PUNCH_SCALE    = 1.30;

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

// Programmatic fallback colors (used when sprite loading failed).
const COLOR_MAP = {
  Red:    0xE24B4A,
  Blue:   0x378ADD,
  Green:  0x639922,
  Yellow: 0xEF9F27,
  Purple: 0x7F77DD,
  Orange: 0xD85A30,
};

// Draw a cannon shape centred at (ox, oy) into Graphics g.
// size = diameter of the bounding circle.
// ox, oy = absolute centre position within g's coordinate space (default 0,0).
function drawCannon(g, color, size, alpha = 1, ox = 0, oy = 0) {
  const R  = size / 2;
  const bw = Math.round(R * 0.42);   // barrel width
  const bh = Math.round(R * 1.20);   // barrel height (extends above centre)
  const tw = Math.round(R * 1.60);   // track (base) width
  const th = Math.round(R * 0.52);   // track height

  // Drop shadow
  g.ellipse(ox + 3, oy + R * 0.55, R * 0.80, R * 0.22);
  g.fill({ color: 0x000000, alpha: 0.22 * alpha });

  // Track base (dark rectangle with rounded ends)
  g.roundRect(ox - tw / 2, oy + R - th, tw, th, 4);
  g.fill({ color: 0x1a1a1a, alpha: 0.92 * alpha });
  // Track highlight strip
  g.roundRect(ox - tw / 2, oy + R - th, tw, Math.max(2, th * 0.30), 4);
  g.fill({ color: 0x333333, alpha: 0.55 * alpha });

  // Barrel body (colored)
  g.roundRect(ox - bw / 2, oy - bh + R * 0.10, bw, bh, 3);
  g.fill({ color, alpha: 1.0 * alpha });
  // Barrel metallic sheen (left edge lighter strip)
  g.roundRect(ox - bw / 2, oy - bh + R * 0.10, Math.max(2, bw * 0.30), bh, 3);
  g.fill({ color: 0xffffff, alpha: 0.18 * alpha });

  // Muzzle cap (dark circle at barrel tip)
  const muzzleY = oy - bh + R * 0.10 - 1;
  g.circle(ox, muzzleY, bw * 0.62);
  g.fill({ color: 0x111111, alpha: 0.95 * alpha });
  g.circle(ox, muzzleY, bw * 0.62);
  g.stroke({ color: 0x444444, width: 1, alpha: 0.70 * alpha });
}

function easeOut(t) { return 1 - Math.pow(1 - Math.min(t, 1), 3); }

// Sprite URL helpers
const _B = import.meta.env.BASE_URL;
function idleUrl(color)  { return `${_B}sprites/shooters/shooter-${color.toLowerCase()}-idle.png`; }
function fireUrl(color)  { return `${_B}sprites/shooters/shooter-${color.toLowerCase()}-fire.png`; }

// Scale a sprite so its largest dimension equals targetDiam.
function fitSprite(sprite, targetDiam) {
  const max = Math.max(sprite.texture.width, sprite.texture.height);
  sprite.scale.set(targetDiam / max);
}

export class ShooterRenderer {
  constructor(layerManager, columns, boosterState = null) {
    this._layer        = layerManager.get('shooterColumnLayer');
    this._columns      = columns;
    this._boosterState = boosterState;

    this.draggingColumn = -1;

    // Per-column objects
    this._bgGraphics    = [];   // panel bg + swap highlight
    this._topContainers = [];   // Container at (cx, topY) — scale-animated
    this._topSprites    = [];   // Sprite inside topContainer
    this._topCircles    = [];   // Graphics fallback circle inside topContainer
    this._topTexts      = [];   // damage number
    this._punchState    = [];   // { active, t }
    this._crisisState   = [];   // { t, duration } — gold ring flash on CRISIS assist

    // Second / third / pip sprites — one array of Sprite per slot
    this._secondSprites = [];
    this._secondTexts   = [];
    this._thirdSprites  = [];
    this._thirdTexts    = [];
    this._pipLeft       = [];   // peek pip left  (4th shooter)
    this._pipRight      = [];   // peek pip right (5th shooter)

    for (let i = 0; i < COL_COUNT; i++) {
      const colContainer = new Container();
      this._layer.addChild(colContainer);

      // ── Panel background ────────────────────────────────────────────────────
      const bgG = new Graphics();
      colContainer.addChild(bgG);
      this._bgGraphics.push(bgG);

      // ── Second shooter ──────────────────────────────────────────────────────
      const sp2 = new Sprite();
      sp2.anchor.set(0.5);
      sp2.alpha   = 0;
      sp2.visible = false;
      colContainer.addChild(sp2);
      this._secondSprites.push(sp2);

      const t2 = new Text({ text: '', style: SECOND_TEXT_STYLE });
      t2.anchor.set(0.5);
      t2.visible = false;
      colContainer.addChild(t2);
      this._secondTexts.push(t2);

      // ── Third shooter ───────────────────────────────────────────────────────
      const sp3 = new Sprite();
      sp3.anchor.set(0.5);
      sp3.alpha   = 0;
      sp3.visible = false;
      colContainer.addChild(sp3);
      this._thirdSprites.push(sp3);

      const t3 = new Text({ text: '', style: SECOND_TEXT_STYLE });
      t3.anchor.set(0.5);
      t3.visible = false;
      colContainer.addChild(t3);
      this._thirdTexts.push(t3);

      // ── Peek pips ───────────────────────────────────────────────────────────
      const pipL = new Sprite();
      pipL.anchor.set(0.5); pipL.visible = false;
      colContainer.addChild(pipL);
      this._pipLeft.push(pipL);

      const pipR = new Sprite();
      pipR.anchor.set(0.5); pipR.visible = false;
      colContainer.addChild(pipR);
      this._pipRight.push(pipR);

      // ── Top shooter ─────────────────────────────────────────────────────────
      const topContainer = new Container();
      colContainer.addChild(topContainer);
      this._topContainers.push(topContainer);

      const sp1 = new Sprite();
      sp1.anchor.set(0.5);
      topContainer.addChild(sp1);
      this._topSprites.push(sp1);

      // Programmatic fallback — a plain Graphics circle drawn when sprites
      // are unavailable.  Drawn inside topContainer so punch animation applies.
      const circ1 = new Graphics();
      circ1.visible = false;
      topContainer.addChild(circ1);
      this._topCircles.push(circ1);

      const t1 = new Text({ text: '', style: TOP_TEXT_STYLE });
      t1.anchor.set(0.5);
      topContainer.addChild(t1);
      this._topTexts.push(t1);

      this._punchState.push({ active: false, t: 0 });
      this._crisisState.push({ active: false, t: 0 });
    }
  }

  triggerDeployPunch(colIdx) {
    if (colIdx < 0 || colIdx >= this._punchState.length) return;
    this._punchState[colIdx].active = true;
    this._punchState[colIdx].t      = 0;
  }

  /** Gold ring flash for ~1.5 s when CRISIS assist injects a shooter. */
  triggerCrisisFlash(colIdx) {
    if (colIdx < 0 || colIdx >= this._crisisState.length) return;
    this._crisisState[colIdx].active = true;
    this._crisisState[colIdx].t      = 0;
  }

  getTopShooterCenter(colIdx) {
    return { x: (colIdx + 0.5) * COL_W, y: TOP_Y };
  }

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
      // Fully transparent — the 3D Shooter3D turrets rendered in the bottom
      // Three.js viewport show through. PixiJS draws only damage numbers,
      // drag hit areas, and the swap/peek highlights on top.
      const panelX = i * COL_W + PANEL_PAD;
      const panelW = COL_W - PANEL_PAD * 2;
      g.roundRect(panelX, SHOOTER_AREA_Y + PANEL_PAD, panelW, SHOOTER_AREA_H - PANEL_PAD * 2, PANEL_RADIUS);
      g.fill({ color: PANEL_COLOR, alpha: 0.92 });

      if (bs?.swapMode && bs.swapFirst === i) {
        g.roundRect(panelX, SHOOTER_AREA_Y + PANEL_PAD, panelW, SHOOTER_AREA_H - PANEL_PAD * 2, PANEL_RADIUS);
        g.stroke({ color: 0x66aaff, width: 3, alpha: 0.85 });
      }

      // CRISIS gold ring — pulses for 1.5 s when a guaranteed-match shooter is injected.
      const crisis = this._crisisState[i];
      if (crisis.active) {
        crisis.t += dt;
        const DURATION = 1.5;
        if (crisis.t >= DURATION) {
          crisis.active = false;
        } else {
          const pulse = Math.sin((crisis.t / DURATION) * Math.PI); // 0→1→0
          g.roundRect(panelX - 2, SHOOTER_AREA_Y + PANEL_PAD - 2, panelW + 4, SHOOTER_AREA_H - PANEL_PAD * 2 + 4, PANEL_RADIUS + 2);
          g.stroke({ color: 0xffcc00, width: 3, alpha: pulse * 0.90 });
        }
      }

      // ── Programmatic fallback (no sprites) ──────────────────────────────────
      if (!spriteFlags.loaded) {
        this._drawFallback(i, col, g, cx, bounce);
        // Still run punch animation so the top circle scales on deploy.
        const punch = this._punchState[i];
        if (punch.active) {
          punch.t += dt;
          const prog = Math.min(1, punch.t / PUNCH_DURATION);
          this._topContainers[i].scale.set(PUNCH_SCALE - (PUNCH_SCALE - 1) * easeOut(prog));
          if (punch.t >= PUNCH_DURATION) { punch.active = false; this._topContainers[i].scale.set(1); }
        }
        continue;
      }

      // ── Second shooter ──────────────────────────────────────────────────────
      const second = col.shooters[1] ?? null;
      const sp2    = this._secondSprites[i];
      if (second) {
        const tex = Assets.get(idleUrl(second.color));
        if (tex && sp2.texture !== tex) { sp2.texture = tex; fitSprite(sp2, SECOND_DIAM); }
        sp2.x = cx; sp2.y = SECOND_Y;
        sp2.alpha   = 0.65;
        sp2.visible = true;
        this._secondTexts[i].text    = isColorblind()
          ? `${SHAPES[second.color] ?? ''}${second.damage}`
          : String(second.damage);
        this._secondTexts[i].x       = cx;
        this._secondTexts[i].y       = SECOND_Y;
        this._secondTexts[i].alpha   = 0.65;
        this._secondTexts[i].visible = true;
      } else {
        sp2.visible = false;
        this._secondTexts[i].visible = false;
      }

      // ── Third shooter ───────────────────────────────────────────────────────
      const third = col.shooters[2] ?? null;
      const sp3   = this._thirdSprites[i];
      if (third) {
        const tex = Assets.get(idleUrl(third.color));
        if (tex && sp3.texture !== tex) { sp3.texture = tex; fitSprite(sp3, THIRD_DIAM); }
        sp3.x = cx; sp3.y = THIRD_Y;
        sp3.alpha   = 0.40;
        sp3.visible = true;
        this._thirdTexts[i].text    = isColorblind()
          ? `${SHAPES[third.color] ?? ''}${third.damage}`
          : String(third.damage);
        this._thirdTexts[i].x       = cx;
        this._thirdTexts[i].y       = THIRD_Y;
        this._thirdTexts[i].alpha   = 0.40;
        this._thirdTexts[i].visible = true;
      } else {
        sp3.visible = false;
        this._thirdTexts[i].visible = false;
      }

      // ── Peek pips ───────────────────────────────────────────────────────────
      if (isPeeking) {
        const fourth = col.shooters[3] ?? null;
        const fifth  = col.shooters[4] ?? null;
        this._showPip(this._pipLeft[i],  fourth, cx - 22, PIP_Y);
        this._showPip(this._pipRight[i], fifth,  cx + 22, PIP_Y);
      } else {
        this._pipLeft[i].visible  = false;
        this._pipRight[i].visible = false;
      }

      // ── Top shooter ─────────────────────────────────────────────────────────
      const top      = col.top();
      const topY     = TOP_Y + (this.draggingColumn === i ? 0 : bounce);
      const topCont  = this._topContainers[i];
      const sp1      = this._topSprites[i];
      const topText  = this._topTexts[i];
      const punch    = this._punchState[i];

      topCont.x = cx;
      topCont.y = topY;

      if (top && this.draggingColumn !== i) {
        // Fire texture while the column's top shooter is actively firing; idle otherwise.
        // "Firing" is signalled by the punch being freshly active (within punch window).
        const url = (punch.active && punch.t < PUNCH_DURATION * 2) ? fireUrl(top.color) : idleUrl(top.color);
        const tex = Assets.get(url);
        if (tex && sp1.texture !== tex) { sp1.texture = tex; fitSprite(sp1, TOP_DIAM); }
        sp1.visible       = true;
        topText.text      = isColorblind()
          ? `${SHAPES[top.color] ?? ''}${top.damage}`
          : String(top.damage);
        topText.visible   = true;
      } else {
        sp1.visible     = false;
        topText.visible = false;
      }

      // ── Deploy punch ────────────────────────────────────────────────────────
      if (punch.active) {
        punch.t += dt;
        const prog = Math.min(1, punch.t / PUNCH_DURATION);
        topCont.scale.set(PUNCH_SCALE - (PUNCH_SCALE - 1) * easeOut(prog));
        if (punch.t >= PUNCH_DURATION) {
          punch.active = false;
          topCont.scale.set(1);
        }
      }
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  // Draw cannon shapes for all visible shooters in column i.
  // Used when spriteFlags.loaded is false.
  _drawFallback(i, col, g, cx, bounce) {
    // Hide all sprite objects for this column.
    this._secondSprites[i].visible = false;
    this._thirdSprites[i].visible  = false;
    this._pipLeft[i].visible       = false;
    this._pipRight[i].visible      = false;
    this._topSprites[i].visible    = false;

    // ── Second shooter — small cannon on bgGraphics ───────────────────────────
    const second = col.shooters[1] ?? null;
    if (second) {
      const color = COLOR_MAP[second.color] ?? 0x888888;
      drawCannon(g, color, SECOND_RADIUS * 2, 0.65, cx, SECOND_Y);

      this._secondTexts[i].text    = String(second.damage);
      this._secondTexts[i].x       = cx;
      this._secondTexts[i].y       = SECOND_Y + SECOND_RADIUS + 8;
      this._secondTexts[i].alpha   = 0.65;
      this._secondTexts[i].visible = true;
    } else {
      this._secondTexts[i].visible = false;
    }

    // ── Third shooter ─────────────────────────────────────────────────────────
    const third = col.shooters[2] ?? null;
    if (third) {
      const color = COLOR_MAP[third.color] ?? 0x888888;
      g.setTransform(cx, THIRD_Y);
      drawCannon(g, color, THIRD_RADIUS * 2, 0.40);
      g.setTransform(0, 0);

      this._thirdTexts[i].text    = String(third.damage);
      this._thirdTexts[i].x       = cx;
      this._thirdTexts[i].y       = THIRD_Y + THIRD_RADIUS + 6;
      this._thirdTexts[i].alpha   = 0.40;
      this._thirdTexts[i].visible = true;
    } else {
      this._thirdTexts[i].visible = false;
    }

    // ── Top shooter — drawn inside topCont so punch animation applies ─────────
    const top     = col.top();
    const topCont = this._topContainers[i];
    const circ    = this._topCircles[i];
    const topText = this._topTexts[i];
    topCont.x = cx;
    topCont.y = TOP_Y + (this.draggingColumn === i ? 0 : bounce);

    if (top && this.draggingColumn !== i) {
      const color = COLOR_MAP[top.color] ?? 0x888888;
      circ.clear();
      drawCannon(circ, color, TOP_RADIUS * 2, 1.0);
      circ.visible    = true;
      topText.text    = String(top.damage);
      topText.y       = 6;   // nudge number onto the barrel
      topText.visible = true;
    } else {
      circ.visible    = false;
      topText.visible = false;
    }
  }

  _showPip(pipSprite, shooter, x, y) {
    if (!shooter) { pipSprite.visible = false; return; }
    const tex = Assets.get(idleUrl(shooter.color));
    if (tex && pipSprite.texture !== tex) { pipSprite.texture = tex; fitSprite(pipSprite, PIP_DIAM); }
    pipSprite.x       = x;
    pipSprite.y       = y;
    pipSprite.alpha   = 0.45;
    pipSprite.visible = true;
  }
}
