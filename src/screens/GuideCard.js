// GuideCard — the one place the game explains itself.
//
// A centred card with a title, a short body and a NEXT button. A step may point at a
// part of the board: the rest of the screen dims, the target gets a pulsing gold ring
// and (optionally) a hand taps or drags over it. Steps are shown one after another;
// the last button reads GOT IT (or the step's own `cta`). Nothing here pauses the loop:
// GameApp runs every card through its modal queue, which pauses the game and blocks
// board input while a card is up.
//
// step = {
//   title:  'THE ROAD',
//   text:   'Cars drive down toward the red line.',
//   target: () => ({ x, y, w, h }) | null,   // read at show time, never cached
//   hand:   'tap' | 'drag' | null,           // 'drag' needs handFrom / handTo
//   handFrom, handTo: () => ({ x, y }),
//   cta:    'GOT IT',                         // last-step button label override
// }
import { Container, Graphics } from 'pixi.js';
import { uiIcon } from '../renderer/UIIcon.js';
import { panel, button, titleText, bodyText, GOLD } from '../renderer/PremiumUI.js';
import { INK } from '../renderer/ToyStyle.js';

const CARD_W   = 316;
const PAD_X    = 26;
const GAP      = 12;       // title -> body, body -> button
const BTN_W    = 190;
const BTN_H    = 52;
const DOTS_H   = 22;
const ANIM_IN  = 0.2;
const HAND_CYCLE = 1.0;

export class GuideCard {
  constructor(stage, appW, appH, steps, { onDone, onStep, audio = null } = {}) {
    this._stage = stage;
    this._W = appW;
    this._H = appH;
    this._steps = steps;
    this._i = 0;
    this._onDone = onDone;
    this._onStep = onStep;
    this._audio = audio;
    this._t = 0;
    this._dead = false;
    this._container = new Container();
    stage.addChild(this._container);
    this._show();
  }

  get stepIndex() { return this._i; }
  isAlive() { return !this._dead; }

  // Silent teardown (level change, quit): never fires onDone.
  destroy() {
    if (this._dead) return;
    this._dead = true;
    this._container.destroy({ children: true });
  }

  // Frame tick. Returns false once the card is gone.
  update(dt) {
    if (this._dead) return false;
    this._t += dt;
    const k = Math.min(1, this._t / ANIM_IN);
    const e = 1 - Math.pow(1 - k, 3);
    if (this._card) {
      this._card.alpha = e;
      this._card.scale.set(0.92 + 0.08 * e);
      this._card.pivot.set(this._cardW / 2, this._cardH / 2);
      this._card.x = this._cardCx;
      this._card.y = this._cardCy;
    }
    if (this._ring) this._ring.alpha = 0.55 + 0.45 * Math.sin(this._t * 5);
    if (this._hand) {
      if (this._handMode === 'tap') {
        this._hand.y = this._handBase.y + (0.5 + 0.5 * Math.sin(this._t * 6)) * 10;
      } else if (this._handMode === 'drag') {
        const p = (this._t / HAND_CYCLE) % 1;
        const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        this._hand.x = this._handFrom.x + (this._handTo.x - this._handFrom.x) * ease;
        this._hand.y = this._handFrom.y + (this._handTo.y - this._handFrom.y) * ease;
      }
    }
    return true;
  }

  // ── Private ───────────────────────────────────────────────────────────────────

  _show() {
    const C = this._container;
    C.removeChildren().forEach(c => c.destroy({ children: true }));
    this._t = 0;
    this._ring = null; this._hand = null; this._handMode = null;

    const W = this._W, H = this._H;
    const step = this._steps[this._i];
    const last = this._i === this._steps.length - 1;
    const target = typeof step.target === 'function' ? step.target() : (step.target ?? null);

    // Dim layer. A rounded window is cut out around the target; the layer swallows
    // every tap, so the board underneath cannot be played through the card.
    const dim = new Graphics().rect(0, 0, W, H).fill({ color: 0x0B0920, alpha: target ? 0.72 : 0.78 });
    if (target) {
      const pad = 6, r = Math.min(20, (target.h + pad * 2) / 2);
      dim.roundRect(target.x - pad, target.y - pad, target.w + pad * 2, target.h + pad * 2, r).cut();
    }
    dim.eventMode = 'static';
    C.addChild(dim);

    // Gold ring on the target.
    if (target) {
      const pad = 6, x = target.x - pad, y = target.y - pad, w = target.w + pad * 2, h = target.h + pad * 2;
      const r = Math.min(20, h / 2);
      const ring = new Graphics();
      ring.roundRect(x - 3, y - 3, w + 6, h + 6, r + 3).stroke({ color: GOLD, width: 10, alpha: 0.16 });
      ring.roundRect(x - 1, y - 1, w + 2, h + 2, r + 1).stroke({ color: INK, width: 5 });
      ring.roundRect(x, y, w, h, r).stroke({ color: GOLD, width: 3 });
      C.addChild(ring);
      this._ring = ring;
    }

    // Card content, measured first so the panel fits it exactly.
    const title = titleText(step.title ?? '', 26, GOLD);
    if (title.width > CARD_W - 2 * PAD_X) title.scale.set((CARD_W - 2 * PAD_X) / title.width);
    const body = bodyText(step.text ?? '', 17, 0xFFFFFF, { wrap: CARD_W - 2 * PAD_X, outline: false, weight: '600' });
    const multi = this._steps.length > 1;
    const TOP = 30;
    const cardH = Math.ceil(TOP + title.height * title.scale.y + GAP + body.height + GAP + 4
      + BTN_H + (multi ? DOTS_H : 0) + 26);
    const cardW = CARD_W;

    // Vertical placement: centred, unless that would sit on the target; then the
    // roomier side of the target (clamped inside the screen).
    let cy = H / 2;
    if (target) {
      const half = cardH / 2 + 10;
      const overlaps = !(cy + half < target.y - 8 || cy - half > target.y + target.h + 8);
      if (overlaps) {
        const above = target.y - 16;                       // free space above the target
        const below = H - (target.y + target.h) - 16;      // and below it
        cy = below >= above
          ? Math.min(H - half - 8, target.y + target.h + 16 + half)
          : Math.max(half + 8, target.y - 16 - half);
      }
    }
    this._cardW = cardW; this._cardH = cardH;
    this._cardCx = W / 2; this._cardCy = cy;

    const card = new Container();
    const pn = panel(cardW, cardH, { r: 24 });
    card.addChild(pn);
    title.x = cardW / 2; title.y = TOP + (title.height * title.scale.y) / 2;
    card.addChild(title);
    body.x = cardW / 2; body.y = TOP + title.height * title.scale.y + GAP + body.height / 2;
    card.addChild(body);
    const label = last ? (step.cta ?? 'GOT IT') : 'NEXT';
    const btn = button(label, { variant: last ? 'green' : 'blue', w: BTN_W, h: BTN_H, size: 22, onTap: () => this._next() });
    btn.x = cardW / 2; btn.y = cardH - 26 - BTN_H / 2 - (multi ? DOTS_H : 0);
    card.addChild(btn);
    if (multi) {
      const dots = new Graphics();
      const n = this._steps.length, gap = 14, x0 = cardW / 2 - ((n - 1) * gap) / 2;
      for (let k = 0; k < n; k++) {
        dots.circle(x0 + k * gap, cardH - 22, 4).fill(k === this._i ? GOLD : 0x6E68A0);
      }
      card.addChild(dots);
    }
    card.x = this._cardCx; card.y = cy;
    card.pivot.set(cardW / 2, cardH / 2);
    C.addChild(card);
    this._card = card;

    // Pointing hand: taps from above the target, or sweeps between two points.
    if (step.hand === 'drag' && step.handFrom && step.handTo) {
      this._handMode = 'drag';
      this._handFrom = step.handFrom(); this._handTo = step.handTo();
      this._hand = uiIcon('hand', 34, '👆');
      this._hand.x = this._handFrom.x; this._hand.y = this._handFrom.y;
      C.addChild(this._hand);
    } else if (step.hand === 'tap' && target) {
      this._handMode = 'tap';
      this._hand = uiIcon('hand', 34, '👆');
      this._hand.scale.y *= -1;                 // fingertip points DOWN at the target
      this._handBase = { y: target.y - 38 };
      this._hand.x = target.x + target.w / 2; this._hand.y = this._handBase.y;
      C.addChild(this._hand);
    }
    this._audio?.play?.('tutorial_ding');
    this._onStep?.(this._i);
  }

  _next() {
    if (this._dead) return;
    if (this._i < this._steps.length - 1) {
      this._i++;
      this._show();
      return;
    }
    const done = this._onDone;
    this.destroy();
    done?.();
  }
}
