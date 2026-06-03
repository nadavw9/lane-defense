// OnboardingHints — three one-time, lifetime tutorial MODAL CARDS for new
// players, styled to match CarTypeIntroCard (centered panel, dark inner with an
// accent glow border, big title, a visual built from REAL game sprites, body
// copy, and a TAP TO CONTINUE button). Each card is modal: gameplay is paused
// and input is blocked by GameApp while a card is up, and the player must tap to
// dismiss it.
//
//   A) showHpMiss : a bomb hit a car but didn't kill it  → "STILL ALIVE!"
//   B) showDamage : first bomb pickup on L1              → "MATCH THE DAMAGE!"
//   C) showAdvance: first correct-colour shot on L1      → "CARS ADVANCE!"
//
// The "once ever" guard lives in ProgressManager (localStorage); this class only
// renders + animates one card at a time. update(dt) must run every frame.
//
// Vertical rhythm (shared by all cards): title→visual ≥16px, visual→body ≥16px,
// body→button ≥24px, body line-height 1.4×.
import { Container, Graphics, Text, Sprite, Assets } from 'pixi.js';

const BASE_URL = import.meta.env.BASE_URL ?? '';

const ANIM_IN  = 0.22;   // seconds
const ANIM_OUT = 0.16;

const CW = 328;          // card width
const CH = 344;          // card height (sized for the generous vertical rhythm)

// Layout anchors (offsets from card top CY). Tuned so every gap meets the
// spacing standard: title→visual ≥16, visual→body ≥16, body→button ≥24.
const TITLE_Y   = 24;    // title top   (bottom ≈58)
const VISUAL_CY = 130;   // visual-zone centre  (tallest visual top ≈80 → ≥16px gap)
const BODY_Y    = 196;   // body top            (visual bottom ≈175 → ≥21px gap)
const BTN_Y     = CH - 56;  // button top  =288  (body bottom ≈236-256 → ≥32px gap)
const BTN_W = 196, BTN_H = 42;

const LINE_HEIGHT = 20;  // 14.5px × ~1.4

// Sprite assets used in the card visuals.
const SPR = {
  powerball: `${BASE_URL}sprites/designed/powerball-red.png`,
  sedan:     `${BASE_URL}sprites/designed/car-red-processed.png`,
  bike:      `${BASE_URL}sprites/designed/bike-red.png`,
  breach:    `${BASE_URL}sprites/designed/breach-warning.png`,
};

export class OnboardingHints {
  constructor(stage, appW, appH) {
    this._stage = stage;
    this._appW  = appW;
    this._appH  = appH;
    this._card  = null;   // active card state, or null
  }

  get active() { return !!this._card; }

  update(dt) {
    const k = this._card;
    if (!k) return;
    k.t += dt;

    if (k.animIn) {
      const p = Math.min(1, k.t / ANIM_IN);
      const e = 1 - Math.pow(1 - p, 3);
      k.container.alpha = e;
      k.panel.scale.set(0.72 + 0.28 * e);
      if (p >= 1) k.animIn = false;
    }
    if (k.pulse) k.pulse(k.t);

    if (k.animOut) {
      k.outT += dt;
      const p = Math.min(1, k.outT / ANIM_OUT);
      k.container.alpha = 1 - p;
      k.panel.scale.set(1 - 0.10 * p);
      if (p >= 1) this._finish();
    }
  }

  destroy() {
    if (this._card) { this._card.container.destroy({ children: true }); this._card = null; }
  }

  // ── Card builders ────────────────────────────────────────────────────────────

  // A) Car survived a hit → point to the book / car manual.
  showHpMiss(onDismiss) {
    const accent = 0x6cc6ff;
    const { panel, vx, vy } = this._buildShell(
      accent, 'STILL ALIVE!',
      'Some cars take more than one hit.\nTap the book button (top-left) to open\nthe Car Manual and see every car’s HP.',
      onDismiss,
    );
    // Visual: book icon with a pulsing ring (mirrors the real top-left button).
    const ring = new Graphics(); panel.addChild(ring);
    const book = new Text({ text: '📖', style: { fontSize: 56 } });
    book.anchor.set(0.5); book.x = vx; book.y = vy; panel.addChild(book);
    this._card.pulse = (t) => {
      const p = 0.5 + 0.5 * Math.sin(t * 5);
      ring.clear();
      ring.circle(vx, vy, 38 + p * 6);
      ring.stroke({ color: 0xffe14a, width: 3.5, alpha: 0.45 + p * 0.45 });
    };
  }

  // B) First bomb pickup on L1 → match the damage number. [bomb 8] ➜ [sedan]
  showDamage(onDismiss) {
    const accent = 0xffcc44;
    const { panel, vx, vy } = this._buildShell(
      accent, 'MATCH THE DAMAGE!',
      'Drag a bomb whose damage number\nmatches or beats the car’s HP to\ndestroy it in one shot.',
      onDismiss,
    );
    // Bomb sprite (left) with its damage number layered ON TOP (added in the
    // sprite's onAdded so the async-loaded powerball can't cover the number).
    this._addSprite(panel, SPR.powerball, vx - 66, vy, 62, 62, () => {
      const dmg = new Text({ text: '8', style: { fontSize: 28, fontWeight: '900', fill: 0xffffff,
        stroke: { color: 0x000000, width: 3 },
        dropShadow: { color: 0x000000, blur: 3, distance: 1, alpha: 0.9 } } });
      dmg.anchor.set(0.5); dmg.x = vx - 66; dmg.y = vy;
      panel.addChild(dmg);
    });
    // Arrow (middle).
    const g = new Graphics(); panel.addChild(g);
    g.poly([vx - 16, vy - 9, vx + 6, vy - 9, vx + 6, vy - 17, vx + 22, vy, vx + 6, vy + 17, vx + 6, vy + 9, vx - 16, vy + 9]);
    g.fill({ color: 0xffe14a });
    // Real sedan sprite (right).
    this._addSprite(panel, SPR.sedan, vx + 64, vy, 60, 76);
  }

  // C) First correct shot on L1 → all cars advance toward the breach.
  // Motorbike (the L1 vehicle) → down arrow → real breach hazard stripe.
  showAdvance(onDismiss) {
    const accent = 0x66dd88;
    const { panel, vx, vy } = this._buildShell(
      accent, 'CARS ADVANCE!',
      'Every correct shot moves ALL cars one\nstep forward — across every lane.',
      onDismiss,
    );
    // Motorbike sprite (matches what the player sees on L1).
    this._addSprite(panel, SPR.bike, vx, vy - 22, 44, 56);
    // Down chevron — movement direction (toward the breach).
    const g = new Graphics(); panel.addChild(g);
    g.poly([vx, vy + 22, vx - 12, vy + 6, vx + 12, vy + 6]).fill({ color: 0x8effa6 });
    // Real breach hazard stripe at the bottom of the visual zone.
    this._addSprite(panel, SPR.breach, vx, vy + 38, 152, 18);
  }

  // ── Shared shell ──────────────────────────────────────────────────────────────
  // Returns { container, panel, vx, vy } — vx/vy = centre of the visual zone.
  _buildShell(accent, title, body, onDismiss) {
    const W = this._appW, H = this._appH;
    const CX = (W - CW) / 2, CY = (H - CH) / 2 - 16;

    const container = new Container();
    container.eventMode = 'static';
    container.on('pointerdown', () => this._dismiss());
    this._stage.addChild(container);

    // Full-screen dim backdrop (absorbs taps).
    const bg = new Graphics();
    bg.rect(0, 0, W, H).fill({ color: 0x000000, alpha: 0.72 });
    container.addChild(bg);

    // Panel (scaled/animated as a unit).
    const panel = new Container();
    panel.pivot.set(CX + CW / 2, CY + CH / 2);
    panel.position.set(CX + CW / 2, CY + CH / 2);
    container.addChild(panel);

    const card = new Graphics();
    card.roundRect(CX - 2, CY - 2, CW + 4, CH + 4, 18).fill({ color: accent, alpha: 0.55 });
    card.roundRect(CX, CY, CW, CH, 16).fill({ color: 0x0e0b1c, alpha: 1 });
    card.roundRect(CX, CY, CW, CH * 0.32, 16).fill({ color: 0x1c1038, alpha: 1 });
    panel.addChild(card);

    const titleTxt = new Text({
      text: title,
      style: { fontSize: 34, fontWeight: '900', fill: 0xffffff, align: 'center',
               dropShadow: { color: accent, blur: 20, distance: 0, alpha: 0.75 } },
    });
    titleTxt.anchor.set(0.5, 0); titleTxt.x = W / 2; titleTxt.y = CY + TITLE_Y;
    const maxTW = CW - 32;
    if (titleTxt.width > maxTW) titleTxt.scale.set(maxTW / titleTxt.width);
    panel.addChild(titleTxt);

    const bodyTxt = new Text({
      text: body,
      style: { fontSize: 14.5, fontWeight: 'bold', fill: 0xcdd8ee, align: 'center',
               wordWrap: true, wordWrapWidth: CW - 36, lineHeight: LINE_HEIGHT,
               dropShadow: { color: 0x000000, blur: 3, distance: 1, alpha: 0.7 } },
    });
    bodyTxt.anchor.set(0.5, 0); bodyTxt.x = W / 2; bodyTxt.y = CY + BODY_Y;
    panel.addChild(bodyTxt);

    // TAP TO CONTINUE button.
    const bx = CX + (CW - BTN_W) / 2, by = CY + BTN_Y;
    const btn = new Graphics();
    btn.roundRect(bx, by, BTN_W, BTN_H, 12).fill({ color: accent, alpha: 0.92 });
    btn.roundRect(bx + 2, by + 2, BTN_W - 4, BTN_H * 0.42, 10).fill({ color: 0xffffff, alpha: 0.22 });
    panel.addChild(btn);
    const btnTxt = new Text({ text: 'TAP TO CONTINUE', style: { fontSize: 15, fontWeight: '900', fill: 0x06121f } });
    btnTxt.anchor.set(0.5); btnTxt.x = W / 2; btnTxt.y = by + BTN_H / 2;
    panel.addChild(btnTxt);

    container.alpha = 0;
    this._card = { container, panel, t: 0, outT: 0, animIn: true, animOut: false, onDismiss, pulse: null, token: {} };
    return { container, panel, vx: W / 2, vy: CY + VISUAL_CY };
  }

  // Load a sprite async and add it to `panel`, scaled to fit boxW×boxH (aspect
  // preserved), centred at (cx,cy). No-ops if the card is dismissed before load.
  _addSprite(panel, url, cx, cy, boxW, boxH, onAdded) {
    const token = this._card?.token;
    Assets.load(url).then((tex) => {
      if (!this._card || this._card.token !== token || panel.destroyed) return;
      const spr = new Sprite(tex);
      const s = Math.min(boxW / spr.width, boxH / spr.height);
      spr.scale.set(s);
      spr.anchor.set(0.5);
      spr.x = cx; spr.y = cy;
      panel.addChild(spr);
      onAdded?.(spr);   // e.g. layer a damage number on top of the bomb
    }).catch(() => { /* sprite missing — card still readable via title+body */ });
  }

  _dismiss() {
    if (!this._card || this._card.animOut) return;
    this._card.animOut = true;
    this._card.outT = 0;
  }

  _finish() {
    const cb = this._card?.onDismiss;
    this._card?.container.destroy({ children: true });
    this._card = null;
    cb?.();
  }
}
