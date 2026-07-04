// ShooterRenderer — draws the 4 shooter columns with real sprites.
//
// Each column shows:
//   • top shooter   — idle sprite (bouncing), swaps to fire sprite while deployed
//   • second shooter — idle sprite at 40% opacity
//   • third shooter  — idle sprite at 45% opacity (always visible)
//
// Textures must be preloaded by GameApp before ShooterRenderer is instantiated.
import { Sprite, Graphics, Container, Text, Assets } from 'pixi.js';
import { spriteFlags } from './SpriteFlags.js';
import { isColorblind, SHAPES } from '../game/ColorblindMode.js';
import { getColumnScreenX, getColumnScreenY, getColumnSlotScreenY, getColScreenW } from './PositionRegistry.js';
import { BAR_Y as BOOSTER_BAR_Y } from './BoosterBar.js';
import { worldXToScreenX, roadHalfWPure } from '../renderer3d/projection.js';

// Road geometry — derived from the live projection (never hardcode a mirror).
const APP_W = 390;

// ── Layout ────────────────────────────────────────────────────────────────────
export const SHOOTER_AREA_Y  = 520;
export const SHOOTER_AREA_H  = 180;   // 520–700 (bench row follows at 703)
export const COL_COUNT       = 4;
export const COL_W           = 390 / COL_COUNT;  // 97.5 px

export const TOP_RADIUS    = 34;   // kept for DragDrop hit-testing
export const SECOND_RADIUS = 24;
const        THIRD_RADIUS  = 17;


export const TOP_Y    = SHOOTER_AREA_Y + 24;    // 544 — ortho: worldZ=-1.5 → screen Y 544
export const SECOND_Y = SHOOTER_AREA_Y + 71;    // 591 — slot1 worldZ=-0.5
const        THIRD_Y  = SHOOTER_AREA_Y + 118;   // 638 — slot2 worldZ=+0.5
export const STASH_Y  = SHOOTER_AREA_Y + 161;   // 681 — stash slot (below 3-bomb queue)

// Target rendered diameters (diameter, not radius) at 1× scale
const TOP_DIAM    = TOP_RADIUS    * 2;   // 68 px
const SECOND_DIAM = SECOND_RADIUS * 2;   // 48 px
const THIRD_DIAM  = THIRD_RADIUS  * 2;   // 34 px


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
// Draw a classic cartoon bomb colored in the shooter's color.
// Color = shooter color (body), so you instantly know which car it matches.
// ox, oy = absolute centre position within g's coordinate space (default 0,0).
function drawCannon(g, color, size, alpha = 1, ox = 0, oy = 0) {
  const R = size / 2;

  // Outer colour glow
  g.circle(ox, oy, R + 4);
  g.fill({ color, alpha: 0.20 * alpha });

  // Fuse
  const fuseLen = R * 0.90;
  g.roundRect(ox - 2, oy - R - fuseLen, 4, fuseLen, 2);
  g.fill({ color: 0xaaaaaa, alpha: 0.90 * alpha });
  g.roundRect(ox + 1, oy - R - fuseLen - 3, 6, 4, 2);
  g.fill({ color: 0xaaaaaa, alpha: 0.80 * alpha });

  // Spark
  g.circle(ox + 7, oy - R - fuseLen - 1, Math.max(2, R * 0.12));
  g.fill({ color: 0xffee44, alpha: 1.0 * alpha });

  // Bomb body — shooter's color
  g.circle(ox, oy, R);
  g.fill({ color, alpha: 1.0 * alpha });

  // Dark top-half shading (makes it look round)
  g.arc(ox, oy, R, 0, Math.PI);
  g.fill({ color: 0x000000, alpha: 0.25 * alpha });

  // White border
  g.circle(ox, oy, R);
  g.stroke({ color: 0xffffff, width: Math.max(1.5, R * 0.08), alpha: 0.50 * alpha });

  // Shine highlight
  g.arc(ox - R * 0.28, oy - R * 0.28, R * 0.35, Math.PI * 1.1, Math.PI * 1.65);
  g.stroke({ color: 0xffffff, width: 2, alpha: 0.40 * alpha });
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
    this._mode3D       = false;  // when true: panels transparent, 2D circles hidden
    this._boosterState = boosterState;

    this.draggingColumn = -1;

    // ── Bomb queue tray — dark backdrop from bomb columns to booster bar ──
    this._trayY = SHOOTER_AREA_Y - 4;
    this._trayH = BOOSTER_BAR_Y - this._trayY;
    this._tray  = new Graphics();
    this._layer.addChild(this._tray);
    this._drawTray(4);   // default; GameApp calls setLaneCount at level start

    // Wrapper container for all 4 column UIs — hides them without touching BenchRenderer.
    // Exposed as `container` so GameApp can call shooterRenderer.container.visible = false.
    this._columnsGroup = new Container();
    this._layer.addChild(this._columnsGroup);

    // Merge overlays (2D), drawn each frame ON the layer (NOT inside _columnsGroup,
    // which GameApp hides during 3D gameplay — container.visible = false):
    //   • merged-bomb halos — soft color-matched rings around merged bombs
    //   • reorder / bench-return target highlight — bright green/red on the column
    this._overlayG = new Graphics();
    this._layer.addChild(this._overlayG);   // added after _columnsGroup → renders on top
    this._reorderTarget = null;   // { col, row, valid } during a reorder/bench drag

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

    // Stash slot — one Graphics + Sprite + Text per column
    this._stashGraphics = [];
    this._stashSprites  = [];
    this._stashTexts    = [];

    // Queue depth badge: shows "+N" in 3D mode below front slot
    this._queueBadges = [];
    for (let i = 0; i < COL_COUNT; i++) {
      const bg = new Graphics(); this._columnsGroup.addChild(bg);
      const tx = new Text({ text: '', style: { fontSize: 12, fontWeight: 'bold', fill: 0xffffff,
        dropShadow: { color: 0x000000, blur: 2, distance: 0, alpha: 0.8 } } });
      tx.anchor.set(0.5, 0.5);
      this._columnsGroup.addChild(tx);
      this._queueBadges.push({ bg, tx });
    }

    for (let i = 0; i < COL_COUNT; i++) {
      const colContainer = new Container();
      this._columnsGroup.addChild(colContainer);

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

      // ── Stash slot ──────────────────────────────────────────────────────────
      const stashG = new Graphics();
      colContainer.addChild(stashG);
      this._stashGraphics.push(stashG);

      const stashSp = new Sprite();
      stashSp.anchor.set(0.5);
      stashSp.visible = false;
      colContainer.addChild(stashSp);
      this._stashSprites.push(stashSp);

      const stashT = new Text({ text: '', style: SECOND_TEXT_STYLE });
      stashT.anchor.set(0.5);
      stashT.visible = false;
      colContainer.addChild(stashT);
      this._stashTexts.push(stashT);

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
    return { x: getColumnScreenX(colIdx), y: getColumnScreenY() };
  }

  // Get the screen center of a queue slot at (colIdx, rowIdx)
  // rowIdx: 0=top (TOP_Y), 1=second (SECOND_Y), 2=third (THIRD_Y)
  getQueueSlotCenter(colIdx, rowIdx) {
    const x = getColumnScreenX(colIdx);
    const yOffsets = [TOP_Y, SECOND_Y, THIRD_Y];
    const y = yOffsets[rowIdx] ?? TOP_Y;
    return { x, y };
  }

  getStashCenter(colIdx) {
    return { x: getColumnScreenX(colIdx), y: STASH_Y };
  }

  // Reorder / bench-return drop-target highlight, set by DragDrop during a drag.
  setReorderTarget(col, row, valid) { this._reorderTarget = { col, row, valid }; }
  clearReorderTarget() { this._reorderTarget = null; }

  // Soft color-matched halos around merged bombs + the reorder/bench drop-target
  // highlight. Halos are stroked rings (no centre fill) so they ring the 3D bomb
  // without occluding it. Also draws a dim overlay when queue actions are locked.
  // Called once per frame by GameApp after update().
  // projectSlot(col,row) → {x,y} screen px of the 3D bomb (camera projection), so
  // the halo lands exactly concentric on it; falls back to slot constants if absent.
  drawMergeOverlay(elapsed, projectSlot = null) {
    const g = this._overlayG;
    g.clear();

    const slotR = [TOP_RADIUS, SECOND_RADIUS, THIRD_RADIUS];
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 3);   // 0..1

    for (let c = 0; c < COL_COUNT; c++) {
      const col = this._columns[c];
      if (!col?.shooters) continue;
      for (let r = 0; r < col.shooters.length && r < 3; r++) {
        const s = col.shooters[r];
        if (!s?.isMerged) continue;
        // Centre on the bomb's ACTUAL projected screen position (the 3D bomb run
        // through the camera) so the halo is exactly concentric with it; fall back
        // to the slot projection only if the 3D projector isn't available.
        const proj = projectSlot?.(c, r);
        const x = proj ? proj.x : getColumnScreenX(c);
        const y = proj ? proj.y : getColumnSlotScreenY(r);
        const R     = slotR[r] ?? TOP_RADIUS;
        const color = COLOR_MAP[s.color] ?? 0xffffff;
        const a     = 0.30 + 0.14 * pulse;             // ~0.30..0.44
        // Tight rings that hug the bomb so the halo stays concentric with the
        // number and doesn't bleed up into the breach stripe on the front slot.
        g.circle(x, y, R * 1.18); g.stroke({ color, width: 7, alpha: a * 0.45 });
        g.circle(x, y, R * 1.08); g.stroke({ color, width: 6, alpha: a * 0.78 });
        g.circle(x, y, R * 1.00); g.stroke({ color, width: 5, alpha: a });

        // Merge color bomb: a small color-matched ★ micro-label above the damage
        // number so players read it as a special "powerful same-colour" bomb.
        if (s.mergeColorBomb) {
          g.star(x, y - R * 0.92, 5, 5, 2.2);   // ~10px tall, subtle, just above the bomb
          g.fill({ color, alpha: 0.90 });
        }
      }
    }

    const t = this._reorderTarget;
    if (t) {
      // Highlight centred ON THE SLOT (concentric circles at the slot centre), not
      // the whole column. Centre on the bomb's ACTUAL projected screen position (the
      // 3D bomb run through the camera) — same projection as the merge halo — so the
      // ring is exactly concentric; fall back to slot constants if no projector.
      const proj = projectSlot?.(t.col, t.row);
      const { x, y } = proj ?? this.getQueueSlotCenter(t.col, t.row);
      const R     = (slotR[t.row] ?? TOP_RADIUS) * 1.45;
      const color = t.valid ? 0x44ff88 : 0xff4444;
      const tp    = 0.55 + 0.45 * pulse;
      g.circle(x, y, R * 1.12); g.fill({ color, alpha: 0.16 * tp });   // soft outer glow
      g.circle(x, y, R);        g.fill({ color, alpha: 0.20 * tp });
      g.circle(x, y, R);        g.stroke({ color, width: 4, alpha: 0.95 });
    }

    // Queue action locked visual: subtle dim overlay when free action has been used.
    // Spans the entire queue zone (SHOOTER_AREA_Y to SHOOTER_AREA_Y + SHOOTER_AREA_H).
    if (this._boosterState?.queueActionUsed) {
      g.roundRect(0, SHOOTER_AREA_Y, 390, SHOOTER_AREA_H, 8);
      g.fill({ color: 0x000000, alpha: 0.25 });
    }
  }

  // Call with true during gameplay so Shooter3D handles the visuals.
  // Panels become transparent; 2D circles are hidden.
  enable3DMode(enabled) { this._mode3D = !!enabled; }

  /** Hides/shows all 4 column UIs without touching BenchRenderer (same layer). */
  get container() { return this._columnsGroup; }

  update(elapsed, dt = 0) {
    const bounce    = Math.sin(elapsed * BOUNCE_SPEED) * BOUNCE_AMP;
    const bs        = this._boosterState;

    for (let i = 0; i < COL_COUNT; i++) {
      const col   = this._columns[i];
      const g     = this._bgGraphics[i];
      const cx    = getColumnScreenX(i);
      const colW  = getColScreenW();

      g.clear();

      // ── Panel background ────────────────────────────────────────────────────
      // Fully transparent — the 3D Shooter3D turrets rendered in the bottom
      // Three.js viewport show through. PixiJS draws only damage numbers,
      // drag hit areas, and the swap highlights on top.
      const panelX = i * colW + PANEL_PAD;
      const panelW = colW - PANEL_PAD * 2;
      g.roundRect(panelX, SHOOTER_AREA_Y + PANEL_PAD, panelW, SHOOTER_AREA_H - PANEL_PAD * 2, PANEL_RADIUS);
      g.fill({ color: PANEL_COLOR, alpha: this._mode3D ? 0.0 : 0.92 });

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

      // ── Queue depth badge — "+N" pill, shown in both 2D and 3D modes ──────────
      const qb         = this._queueBadges[i];
      const queueDepth = (col.shooters?.length ?? 0) - 1;
      if (queueDepth > 0) {
        const badgeX = cx;
        const badgeY = TOP_Y + TOP_RADIUS + 18;
        qb.tx.text    = `+${queueDepth}`;
        qb.tx.x       = badgeX;
        qb.tx.y       = badgeY;
        qb.tx.visible = true;
        const tw = Math.max(28, (qb.tx.width || 0) + 10);
        const th = 18;
        qb.bg.clear();
        qb.bg.roundRect(badgeX - tw / 2, badgeY - th / 2, tw, th, 9);
        qb.bg.fill({ color: 0x1a1a2e, alpha: 0.85 });
        qb.bg.roundRect(badgeX - tw / 2, badgeY - th / 2, tw, th, 9);
        qb.bg.stroke({ color: 0x6666aa, width: 1, alpha: 0.7 });
        qb.bg.visible = true;
      } else {
        qb.bg.clear();
        qb.tx.visible = false;
        qb.bg.visible = false;
      }

      // ── Stash slot — always rendered (visible in both 2D and 3D modes) ────────
      const stashG  = this._stashGraphics[i];
      const stashSp = this._stashSprites[i];
      const stashT  = this._stashTexts[i];
      const stashed = col.stash ?? null;
      const stashR  = SECOND_RADIUS;   // same radius as slot-1 bomb

      stashG.clear();

      // Stash RETIRED (bench is the sole storage). The 2D fallback no longer draws
      // the separator or the empty dashed ring. sepCX kept for the (now-inert)
      // occupied branch below.
      const sepCX = cx;

      if (stashed) {
        // Occupied: solid border circle tinted with shooter color
        const col3 = COLOR_MAP[stashed.color] ?? 0x888888;
        stashG.circle(sepCX, STASH_Y, stashR + 3);
        stashG.fill({ color: col3, alpha: 0.18 });
        stashG.circle(sepCX, STASH_Y, stashR + 3);
        stashG.stroke({ color: col3, width: 2, alpha: 0.70 });

        if (!this._mode3D) {
          const url = idleUrl(stashed.color);
          const tex = Assets.get(url);
          if (tex) {
            if (stashSp.texture !== tex) { stashSp.texture = tex; fitSprite(stashSp, stashR * 2); }
            stashSp.x       = sepCX;
            stashSp.y       = STASH_Y;
            stashSp.alpha   = 0.80;
            stashSp.visible = true;
          } else {
            stashSp.visible = false;
          }
          stashT.text    = String(stashed.damage);
          stashT.x       = sepCX;
          stashT.y       = STASH_Y + stashR + 8;
          stashT.alpha   = 0.80;
          stashT.visible = true;
        } else {
          stashSp.visible = false;
          stashT.visible  = false;
        }
      } else {
        // Stash RETIRED: empty dashed ring no longer drawn (bench is the sole storage).
        stashSp.visible = false;
        stashT.visible  = false;
      }

      // In 3D mode: panels transparent, Shooter3D renders ALL visuals including
      // damage numbers as canvas sprites attached to each turret mesh.
      if (this._mode3D) {
        // Hide all PixiJS text overlays — 3D sprites handle damage display.
        this._topTexts[i].visible      = false;
        this._secondTexts[i].visible   = false;
        this._thirdTexts[i].visible    = false;
        this._secondSprites[i].visible = false;
        this._thirdSprites[i].visible  = false;
        this._topContainers[i].alpha   = 0;

        continue;
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

      // ── Second / third shooter — hidden; queue depth badge shows "+N" ────────
      this._secondSprites[i].visible = false;
      this._secondTexts[i].visible   = false;
      this._thirdSprites[i].visible  = false;
      this._thirdTexts[i].visible    = false;

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

  setLaneCount(n) { this._drawTray(n); }

  _drawTray(n) {
    const hw_px = worldXToScreenX(roadHalfWPure(n)) - worldXToScreenX(0);
    const trayX = APP_W / 2 - hw_px - 16;
    const trayW = hw_px * 2 + 32;
    this._tray.clear();
    this._tray.roundRect(trayX, this._trayY, trayW, this._trayH, 12);
    this._tray.fill({ color: 0x0d1117, alpha: 0.25 });
    this._tray.roundRect(trayX, this._trayY, trayW, this._trayH, 12);
    this._tray.stroke({ color: 0x445566, width: 1, alpha: 0.50 });
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  // Draw cannon shapes for all visible shooters in column i.
  // Used when spriteFlags.loaded is false.
  _drawFallback(i, col, g, cx, bounce) {  // cx already resolved to getColumnScreenX(i)
    // Hide all sprite objects for this column.
    this._secondSprites[i].visible = false;
    this._thirdSprites[i].visible  = false;
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

}
