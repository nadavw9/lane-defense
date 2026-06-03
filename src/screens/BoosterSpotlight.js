// BoosterSpotlight — cinematic unlock reveal shown the first time a booster
// appears during gameplay.
//
// Sequence: overlay → beam → icon pop → confetti burst → ribbon unfurl →
//           title scale-in → description slide → "TAP TO TRY!" pulse.
//
// Usage:
//   const s = new BoosterSpotlight(stage, appW, appH, 'swap', () => resume());
//   // call s.update(dt) each frame; tap anywhere auto-calls onDismiss.
import { Container, Graphics, Text } from 'pixi.js';

// ── Booster metadata ──────────────────────────────────────────────────────────
const BOOSTER_INFO = {
  swap:   { label: 'SWAP UNLOCKED!',   desc: 'Exchange two\nbomb columns',             color: 0x66aaff },
  freeze: { label: 'FREEZE UNLOCKED!', desc: 'Your next shot:\ncars don\'t advance',      color: 0x44ccff },
  bomb:   { label: 'BOMB READY!',      desc: 'Earned by killing 10 cars\ntap to blast!', color: 0xff8844 },
};

// Button centres in screen px — matches new 52×52 icon card layout in BoosterBar.
// BAR_XOFF=109, CARD_W=52, CARD_GAP=8 → CARD_X[i]=109+i*60; centre=CARD_X[i]+26
// CARD_Y=760, centre Y=786
const BUTTON_POS = {
  swap:   { x: 135, y: 786 },
  freeze: { x: 195, y: 786 },
  bomb:   { x: 255, y: 786 },
};

const SPOT_R = 40;

// ── Timeline (seconds) ────────────────────────────────────────────────────────
const T_OVERLAY_END  = 0.40;
const T_BEAM_START   = 0.18;
const T_BEAM_END     = 0.52;
const T_ICON_START   = 0.28;
const T_ICON_END     = 0.74;
const T_CONFETTI     = 0.52;
const T_RIBBON_START = 0.60;
const T_RIBBON_END   = 0.88;
const T_TITLE_START  = 0.68;
const T_TITLE_END    = 0.92;
const T_DESC_START   = 0.84;
const T_DESC_END     = 1.06;
const T_TAP_START    = 1.02;
const T_TAP_END      = 1.22;
const DISMISS_DUR    = 0.28;

const CONFETTI_COLS = [0xff4466, 0x44aaff, 0xffcc22, 0x44ee88, 0xcc88ff, 0xff8844];

// ── Easing helpers ────────────────────────────────────────────────────────────
function c01(v) { return Math.max(0, Math.min(1, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function easeOut(t) { const u = c01(t); return 1 - (1 - u) * (1 - u) * (1 - u); }
function easeBack(t) {
  const u = c01(t), c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
}

export class BoosterSpotlight {
  constructor(stage, appW, appH, boosterName, onDismiss) {
    this._onDismiss  = onDismiss;
    this._t          = 0;
    this._dismissT   = -1;

    const info = BOOSTER_INFO[boosterName] ?? BOOSTER_INFO.swap;
    const pos  = BUTTON_POS[boosterName]   ?? BUTTON_POS.swap;

    this._info    = info;
    this._pos     = pos;
    this._appW    = appW;
    this._appH    = appH;
    this._confetti      = [];
    this._confettiBurst = false;

    // Vertical anchors
    const textCY  = Math.round((510 + 752) / 2);   // empty strip midpoint (y≈631)
    const iconCY  = Math.round((510 + textCY) / 2); // icon disc settles here (y≈570)
    this._textCY  = textCY;
    this._iconCY  = iconCY;

    this._container = new Container({ isRenderGroup: true });
    stage.addChild(this._container);

    // ── Dark overlay ──────────────────────────────────────────────────────────
    this._overlay = new Graphics();
    this._overlay.rect(0, 0, appW, appH);
    this._overlay.fill({ color: 0x000000 });
    this._overlay.alpha = 0;
    this._container.addChild(this._overlay);

    // ── Spotlight hole (erase) ────────────────────────────────────────────────
    const hole = new Graphics();
    hole.circle(pos.x, pos.y, SPOT_R);
    hole.fill(0xffffff);
    hole.blendMode = 'erase';
    this._container.addChild(hole);

    // ── Beam (cone from button to icon area, drawn once) ──────────────────────
    this._beam = new Graphics();
    const beamTopW = 84, beamBotW = 24;
    const btop = iconCY - 10, bbot = pos.y - SPOT_R;
    this._beam.moveTo(pos.x - beamTopW / 2, btop);
    this._beam.lineTo(pos.x + beamTopW / 2, btop);
    this._beam.lineTo(pos.x + beamBotW / 2, bbot);
    this._beam.lineTo(pos.x - beamBotW / 2, bbot);
    this._beam.closePath();
    this._beam.fill({ color: info.color, alpha: 0.16 });
    this._beam.alpha = 0;
    this._container.addChild(this._beam);

    // ── Ribbon (redrawn on expand) ────────────────────────────────────────────
    this._ribbonGfx = new Graphics();
    this._container.addChild(this._ribbonGfx);

    // ── Icon disc (animated each frame) ──────────────────────────────────────
    this._iconGfx = new Graphics();
    this._container.addChild(this._iconGfx);

    // ── Confetti layer ────────────────────────────────────────────────────────
    this._confettiGfx = new Graphics();
    this._container.addChild(this._confettiGfx);

    // ── Pulsing rings ─────────────────────────────────────────────────────────
    this._ringGfx = new Graphics();
    this._container.addChild(this._ringGfx);

    // ── Title text ────────────────────────────────────────────────────────────
    this._titleText = new Text({
      text: info.label,
      style: {
        fontSize: 26, fontWeight: 'bold', fill: 0xffffff, align: 'center',
        dropShadow: { color: info.color, blur: 12, distance: 0, alpha: 0.90 },
      },
    });
    this._titleText.anchor.set(0.5, 0.5);
    this._titleText.x = appW / 2;
    this._titleText.y = textCY - 28;
    this._titleText.scale.set(0);
    this._container.addChild(this._titleText);

    // ── Description text ──────────────────────────────────────────────────────
    this._descText = new Text({
      text: info.desc,
      style: {
        fontSize: 16, fontWeight: 'bold', fill: info.color, align: 'center',
        dropShadow: { color: 0x000000, blur: 5, distance: 2, alpha: 0.9 },
      },
    });
    this._descText.anchor.set(0.5, 0);
    this._descText.x = appW / 2;
    this._descText.y = textCY + 12;
    this._descText.alpha = 0;
    this._container.addChild(this._descText);

    // ── "TAP TO TRY!" button ──────────────────────────────────────────────────
    this._tapBg = new Graphics();
    this._container.addChild(this._tapBg);

    this._tapText = new Text({
      text: '✦  TAP TO TRY!  ✦',
      style: {
        fontSize: 17, fontWeight: 'bold', fill: 0xffffff, align: 'center',
        dropShadow: { color: info.color, blur: 8, distance: 0, alpha: 0.95 },
      },
    });
    this._tapText.anchor.set(0.5, 0.5);
    this._tapText.x = appW / 2;
    this._tapText.y = pos.y - SPOT_R - 30;
    this._tapText.alpha = 0;
    this._container.addChild(this._tapText);

    // ── Dismiss hitbox (must be last) ─────────────────────────────────────────
    const hitbox = new Graphics();
    hitbox.rect(0, 0, appW, appH);
    hitbox.fill({ color: 0, alpha: 0 });
    hitbox.interactive = true;
    hitbox.cursor = 'pointer';
    this._container.addChild(hitbox);
    hitbox.on('pointerdown', () => this.dismiss());
  }

  // ── Public ───────────────────────────────────────────────────────────────────

  update(dt) {
    if (!this._container) return;
    this._t += dt;
    const t = this._t;

    // Dismiss fade-out
    if (this._dismissT >= 0) {
      this._dismissT += dt;
      this._container.alpha = Math.max(0, 1 - this._dismissT / DISMISS_DUR);
      if (this._dismissT >= DISMISS_DUR) this._finalize();
      return;
    }

    // ── Overlay fade-in ───────────────────────────────────────────────────────
    this._overlay.alpha = c01(t / T_OVERLAY_END) * 0.82;

    // ── Beam fade-in ─────────────────────────────────────────────────────────
    this._beam.alpha = easeOut(c01((t - T_BEAM_START) / (T_BEAM_END - T_BEAM_START)));

    // ── Icon disc (pops from button to empty-strip area) ──────────────────────
    const iconP = easeBack(c01((t - T_ICON_START) / (T_ICON_END - T_ICON_START)));
    if (t >= T_ICON_START) {
      const ix = lerp(this._pos.x, this._appW / 2, iconP);
      const iy = lerp(this._pos.y, this._iconCY,    iconP);
      const ir = lerp(22, 52, iconP);
      this._iconGfx.clear();
      this._iconGfx.circle(ix, iy, ir + 10);
      this._iconGfx.fill({ color: this._info.color, alpha: 0.15 });
      this._iconGfx.circle(ix, iy, ir);
      this._iconGfx.fill({ color: this._info.color, alpha: 0.88 });
      this._iconGfx.circle(ix - ir * 0.26, iy - ir * 0.26, ir * 0.36);
      this._iconGfx.fill({ color: 0xffffff, alpha: 0.20 });
      this._iconGfx.circle(ix, iy, ir);
      this._iconGfx.stroke({ color: 0xffffff, width: 2, alpha: 0.50 });
    }

    // ── Confetti burst ────────────────────────────────────────────────────────
    if (t >= T_CONFETTI && !this._confettiBurst) {
      this._confettiBurst = true;
      const cx = this._appW / 2, cy = this._iconCY;
      for (let i = 0; i < 30; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 90 + Math.random() * 190;
        const maxLife = 1.1 + Math.random() * 0.8;
        this._confetti.push({
          x: cx, y: cy,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 130,
          r:  2.5 + Math.random() * 3,
          color: CONFETTI_COLS[i % CONFETTI_COLS.length],
          life: maxLife, maxLife,
        });
      }
    }

    this._confettiGfx.clear();
    for (let i = this._confetti.length - 1; i >= 0; i--) {
      const p = this._confetti[i];
      p.life -= dt;
      if (p.life <= 0) { this._confetti.splice(i, 1); continue; }
      p.x  += p.vx * dt;
      p.y  += p.vy * dt;
      p.vy += 310 * dt;
      const a = p.life / p.maxLife;
      this._confettiGfx.rect(p.x - p.r, p.y - p.r * 0.65, p.r * 2, p.r * 1.3);
      this._confettiGfx.fill({ color: p.color, alpha: a });
    }

    // ── Ribbon unfurl ─────────────────────────────────────────────────────────
    const ribbonP = easeOut(c01((t - T_RIBBON_START) / (T_RIBBON_END - T_RIBBON_START)));
    if (ribbonP > 0) {
      const rW = this._appW * ribbonP;
      const rH = 66, ry = this._textCY - rH / 2;
      this._ribbonGfx.clear();
      this._ribbonGfx.rect(this._appW / 2 - rW / 2, ry, rW, rH);
      this._ribbonGfx.fill({ color: this._info.color, alpha: 0.11 });
      this._ribbonGfx.rect(this._appW / 2 - rW / 2, ry, rW, 2);
      this._ribbonGfx.fill({ color: this._info.color, alpha: 0.50 });
      this._ribbonGfx.rect(this._appW / 2 - rW / 2, ry + rH - 2, rW, 2);
      this._ribbonGfx.fill({ color: this._info.color, alpha: 0.50 });
    }

    // ── Title scale-in (with overshoot) ──────────────────────────────────────
    this._titleText.scale.set(
      easeBack(c01((t - T_TITLE_START) / (T_TITLE_END - T_TITLE_START))),
    );

    // ── Description slide-in ─────────────────────────────────────────────────
    const descP           = easeOut(c01((t - T_DESC_START) / (T_DESC_END - T_DESC_START)));
    this._descText.alpha  = descP;
    this._descText.y      = this._textCY + 12 + (1 - descP) * 18;

    // ── "TAP TO TRY!" fade-in + pulse ─────────────────────────────────────────
    const tapP = easeOut(c01((t - T_TAP_START) / (T_TAP_END - T_TAP_START)));
    if (tapP > 0) {
      const pulse     = 0.80 + 0.20 * Math.sin(t * 4.5);
      const tw = 162, th = 34, ty = this._pos.y - SPOT_R - 47;
      this._tapBg.clear();
      this._tapBg.roundRect(this._appW / 2 - tw / 2, ty, tw, th, 17);
      this._tapBg.fill({ color: this._info.color, alpha: tapP * 0.14 * pulse });
      this._tapBg.roundRect(this._appW / 2 - tw / 2, ty, tw, th, 17);
      this._tapBg.stroke({ color: this._info.color, width: 1.5, alpha: tapP * 0.60 * pulse });
      this._tapText.alpha = tapP * pulse;
    }

    // ── Pulsing rings around spotlight hole ───────────────────────────────────
    this._ringGfx.clear();
    if (t > 0.25) {
      const p1  = 0.5 + 0.5 * Math.sin(t * 3.8);
      this._ringGfx.circle(this._pos.x, this._pos.y, SPOT_R + 7  + p1 * 10);
      this._ringGfx.stroke({ color: this._info.color, width: 2.5, alpha: 0.38 + p1 * 0.45 });

      const p2  = 0.5 + 0.5 * Math.sin(t * 2.2 + 1.0);
      this._ringGfx.circle(this._pos.x, this._pos.y, SPOT_R + 22 + p2 * 14);
      this._ringGfx.stroke({ color: this._info.color, width: 1.5, alpha: 0.14 + p2 * 0.20 });
    }
  }

  dismiss() {
    if (this._dismissT >= 0 || !this._container) return;
    this._dismissT = 0;
  }

  destroy() {
    if (this._container) {
      this._container.destroy({ children: true });
      this._container = null;
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  _finalize() {
    if (!this._container) return;
    this._container.destroy({ children: true });
    this._container = null;
    this._onDismiss?.();
  }
}
