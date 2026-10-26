// OnboardingHints — three one-time, lifetime tutorial MODAL CARDS for new
// players, styled to match CarTypeIntroCard (PremiumUI panel + ribbon + green
// CTA). Each card is modal: gameplay is paused and input is blocked by GameApp
// while a card is up, and the player must tap to dismiss it.
//
//   A) showHpMiss : a bomb hit a car but didn't kill it  → "STILL ALIVE!"
//   B) showDamage : first bomb pickup on L1              → "MATCH THE COLOR!"
//   C) showAdvance: first correct-colour shot on L1      → "CARS ADVANCE!"
//   D) showColorBomb: first rainbow color bomb earned    → "COLOR BOMB!"
//
// The "once ever" guard lives in ProgressManager (localStorage); this class only
// renders + animates one card at a time. update(dt) must run every frame.
//
// Vertical rhythm (shared by all cards): title→visual ≥16px, visual→body ≥16px,
// body→button ≥24px, body line-height 1.4×.
import { Container, Graphics, Sprite, Assets } from 'pixi.js';
import { uiIcon } from '../renderer/UIIcon.js';
import { panel as uiPanel, ribbon, bodyText, backdrop, button } from '../renderer/PremiumUI.js';

const BASE_URL = import.meta.env.BASE_URL ?? '';

const ANIM_IN  = 0.22;   // seconds
const ANIM_OUT = 0.16;

const CW = 328;          // card width
const CH = 344;          // card height (sized for the generous vertical rhythm)

// Layout anchors (offsets from card top). Tuned so every gap meets the
// spacing standard: title→visual ≥16, visual→body ≥16, body→button ≥24.
const TITLE_Y   = 8;     // ribbon centre near top of panel
const VISUAL_CY = 130;   // visual-zone centre
const BODY_Y    = 210;   // body centre (was top-anchored at 196; bodyText is centre-anchored)
const BTN_Y     = CH - 48;
const BTN_W = 220, BTN_H = 54;

const LINE_HEIGHT = 20;  // ~1.4× body size

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
    const accent = 0x2F7FE0;
    const { panel, vx, vy } = this._buildShell(
      accent, 'STILL ALIVE!',
      'Big cars take more than one hit.\nEach hit shrinks them: van, car,\nthen motorbike. Keep shooting!',
      onDismiss,
    );
    // Visual: book icon with a pulsing ring (mirrors the real top-left button).
    const ring = new Graphics(); panel.addChild(ring);
    const book = uiIcon('book', 56, '📖');
    book.x = vx; book.y = vy; panel.addChild(book);
    this._card.pulse = (t) => {
      const p = 0.5 + 0.5 * Math.sin(t * 5);
      ring.clear();
      ring.circle(vx, vy, 38 + p * 6);
      ring.stroke({ color: 0xffe14a, width: 3.5, alpha: 0.45 + p * 0.45 });
    };
  }

  // B) First bomb pickup on L1 → match the color. [bomb] ➜ [motorbike]
  showDamage(onDismiss) {
    const accent = 0xF08A24;
    const { panel, vx, vy } = this._buildShell(
      accent, 'MATCH THE COLOR!',
      'Drag a bomb onto a car of the\nsame color to hit it.\nEvery bomb is one hit.',
      onDismiss,
    );
    this._addSprite(panel, SPR.powerball, vx - 66, vy, 62, 62);
    const g = new Graphics(); panel.addChild(g);
    g.poly([vx - 16, vy - 9, vx + 6, vy - 9, vx + 6, vy - 17, vx + 22, vy, vx + 6, vy + 17, vx + 6, vy + 9, vx - 16, vy + 9]);
    g.fill({ color: 0xffe14a });
    this._addSprite(panel, SPR.bike, vx + 64, vy, 46, 60);
  }

  // C) First correct shot on L1 → all cars advance toward the breach.
  showAdvance(onDismiss) {
    const accent = 0x3DBB3A;
    const { panel, vx, vy } = this._buildShell(
      accent, 'CARS ADVANCE!',
      'Every correct shot moves ALL cars one\nstep forward — across every lane.',
      onDismiss,
    );
    this._addSprite(panel, SPR.bike, vx, vy - 22, 44, 56);
    const g = new Graphics(); panel.addChild(g);
    g.poly([vx, vy + 22, vx - 12, vy + 6, vx + 12, vy + 6]).fill({ color: 0x8effa6 });
    this._addSprite(panel, SPR.breach, vx, vy + 38, 152, 18);
  }

  // D) First time a rainbow color bomb is earned → explain what it is. (FIX 5)
  showColorBomb(onDismiss) {
    const accent = 0x8B4FE0;
    const { panel, vx, vy } = this._buildShell(
      accent, 'COLOR BOMB!',
      'Get 3 multi-kill shots to earn a Color Bomb!\nDestroy 2+ cars in one shot to score a multi-kill.',
      onDismiss,
    );
    const RB = [0xff4477, 0xffaa22, 0xffe14a, 0x44dd66, 0x4aa8ff, 0xb066ff];
    const disc = new Graphics(); panel.addChild(disc);
    const TAU = Math.PI * 2;
    for (let i = 0; i < 6; i++) {
      disc.moveTo(vx, vy);
      disc.arc(vx, vy, 40, (i / 6) * TAU, ((i + 1) / 6) * TAU);
      disc.fill({ color: RB[i], alpha: 0.95 });
    }
    disc.circle(vx, vy, 40).stroke({ color: 0xffffff, width: 2.5, alpha: 0.7 });
    const star = uiIcon('star-filled', 34, '★', { emojiFill: 0xffffff });
    star.x = vx; star.y = vy; panel.addChild(star);
  }

  // ── Shared shell ──────────────────────────────────────────────────────────────
  // PremiumUI panel + ribbon + green CTA — same language as CarTypeIntroCard /
  // HowToPlay. Accent keeps ribbon personality; retires flat Graphics card +
  // accent pill button that read below store bar next to gold-bevel dialogs.
  // Returns { container, panel, vx, vy } — vx/vy = centre of the visual zone
  // in panel-local coordinates.
  _buildShell(accent, title, body, onDismiss) {
    const W = this._appW, H = this._appH;

    const container = new Container();
    this._stage.addChild(container);

    const dim = backdrop(W, H, 0.72);
    dim.on('pointerdown', () => this._dismiss());
    container.addChild(dim);

    // Panel (scaled/animated as a unit). Local origin = top-left of card.
    const panelRoot = new Container();
    panelRoot.pivot.set(CW / 2, CH / 2);
    panelRoot.position.set(W / 2, H / 2 - 16);
    container.addChild(panelRoot);

    panelRoot.addChild(uiPanel(CW, CH, { r: 24 }));

    const rb = ribbon(title, Math.min(290, CW - 24), { color: accent, size: 26 });
    rb.x = CW / 2; rb.y = TITLE_Y;
    panelRoot.addChild(rb);

    const bodyTxt = bodyText(body, 15, 0xD8D3FF, {
      outline: false, weight: '700', wrap: CW - 40,
    });
    bodyTxt.style.lineHeight = LINE_HEIGHT;
    bodyTxt.x = CW / 2; bodyTxt.y = BODY_Y;
    panelRoot.addChild(bodyTxt);

    const cta = button('TAP TO CONTINUE', {
      variant: 'green', w: BTN_W, h: BTN_H, size: 18,
      onTap: () => this._dismiss(),
    });
    cta.x = CW / 2; cta.y = BTN_Y;
    panelRoot.addChild(cta);

    container.alpha = 0;
    this._card = {
      container, panel: panelRoot, t: 0, outT: 0,
      animIn: true, animOut: false, onDismiss, pulse: null, token: {},
    };
    return { container, panel: panelRoot, vx: CW / 2, vy: VISUAL_CY };
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
      onAdded?.(spr);
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
