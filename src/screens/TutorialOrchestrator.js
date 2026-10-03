// TutorialOrchestrator — spotlight-pause tutorials for FTUE moments.
// Uses PixiJS Graphics/Text so it renders on top of the existing WebGL stage.
//
// Each tutorial optionally pauses the game, draws a dark 4-rect cutout overlay
// around a target UI element, animates a pointing hand, and waits for the player
// to perform the required action.  On completion it flashes gold, plays a ding,
// then resumes.
//
// Usage:
//   const orch = new TutorialOrchestrator(stage, gameLoop);
//   orch.start({ id, text, bounds, handStart, handEnd, pauseGame });
//   // when the player does the thing:
//   orch.completeIfActive(id);

import { Container, Graphics, Text } from 'pixi.js';
import { uiIcon } from '../renderer/UIIcon.js';
import { ROAD_BOTTOM_Y } from '../renderer/LaneRenderer.js';
import { bodyText, GOLD } from '../renderer/PremiumUI.js';
import { INK } from '../renderer/ToyStyle.js';

const STORAGE_KEY    = 'ftue_completed';
const APP_W          = 390;
const APP_H          = 844;
const HAND_CYCLE     = 0.9;     // seconds for one hand sweep
const FLASH_DURATION = 0.55;    // seconds for gold completion flash

export class TutorialOrchestrator {
  constructor(stage, gameLoop, audio = null) {
    this._stage    = stage;
    this._gameLoop = gameLoop;
    this._audio    = audio;

    this._container = new Container();
    this._container.visible = false;
    stage.addChild(this._container);

    this._active   = null;   // current tutorial opts, or null
    this._handT    = 0;
    this._flashT   = -1;
    this._done     = this._loadDone();

    // Per-tutorial child refs (rebuilt on each start())
    this._overlay  = null;
    this._borderGfx = null;
    this._textObj  = null;
    this._handObj  = null;
    this._flashGfx = null;
  }

  // Start a tutorial.  opts:
  //   id         — unique string; skip if already done
  //   text       — instruction shown above/below spotlight
  //   bounds     — { x, y, w, h } canvas-pixel rect to spotlight (null = text-only),
  //                OR a function returning one. Prefer the function: it reads the
  //                real element's bounds at show time, so the spotlight can never
  //                drift from the button it points at (the old hardcoded rect sat
  //                ~2px off the BOMB card and clipped it).
  //   handStart  — { x, y } start of hand sweep, or null
  //   handEnd    — { x, y } end of hand sweep, or null
  //   pauseGame  — boolean (default true)
  start(opts) {
    const { id, text, handStart = null, handEnd = null, pauseGame = true } = opts;
    const bounds = typeof opts.bounds === 'function' ? opts.bounds() : (opts.bounds ?? null);
    if (this._done.has(id)) return;
    if (this._active?.id === id) return;
    this._clearGraphics();

    this._active = { id, text, bounds, handStart, handEnd, pauseGame };
    this._handT  = 0;
    this._flashT = -1;
    this._buildGraphics();

    // Bring container to top so it renders above game content
    this._stage.addChild(this._container);
    this._container.visible = true;

    if (pauseGame && this._gameLoop?.pause) this._gameLoop.pause();
  }

  // Call from the event that satisfies the tutorial's required action.
  completeIfActive(id) {
    if (this._active?.id !== id) return;
    this._complete();
  }

  // True while a tutorial spotlight is up (the pause menu must not open over it).
  isActive() { return this._active !== null; }

  // Dismiss (skip without completing) whatever tutorial is active.
  dismiss() {
    if (!this._active) return;
    if (this._active.pauseGame && this._gameLoop?.resume) this._gameLoop.resume();
    this._clearGraphics();
    this._active = null;
    this._flashT = -1;
  }

  isAnyActive() { return this._active !== null; }

  // Call every frame with dt in seconds.
  update(dt) {
    if (!this._active) return;

    if (this._flashT >= 0) {
      this._flashT += dt;
      if (this._flashGfx) {
        const alpha = Math.max(0, 0.70 * (1 - this._flashT / FLASH_DURATION));
        this._flashGfx.alpha = alpha;
      }
      if (this._flashT >= FLASH_DURATION) {
        this._flashT = -1;
        this._clearGraphics();
        this._active = null;
      }
      return;
    }

    this._t = (this._t ?? 0) + dt;
    // Soft breathing ring around the target.
    if (this._ringGfx) this._ringGfx.alpha = 0.55 + 0.45 * Math.sin(this._t * 5);
    // Tap mode (no sweep): the hand hovers ABOVE the target and dips onto it,
    // so it never sits on top of the thing it points at.
    if (this._handObj && this._tapHand) {
      const k = 0.5 + 0.5 * Math.sin(this._t * 6);
      this._handObj.y = this._tapHand.y + k * 10;
    }
    // Animate hand sweep
    if (this._handObj && this._active.handStart && this._active.handEnd) {
      this._handT = (this._handT + dt / HAND_CYCLE) % 1;
      const ease  = this._handT < 0.5
        ? 2 * this._handT * this._handT
        : 1 - Math.pow(-2 * this._handT + 2, 2) / 2;
      const hs = this._active.handStart;
      const he = this._active.handEnd;
      this._handObj.x = hs.x + (he.x - hs.x) * ease;
      this._handObj.y = hs.y + (he.y - hs.y) * ease;
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────────

  _buildGraphics() {
    const W = APP_W, H = APP_H;
    const { text, bounds, handStart, handEnd } = this._active;
    this._t = 0;
    this._tapHand = null;

    // Dim layer with a rounded window cut out around the target.
    if (bounds) {
      const pad = 6;
      const x = bounds.x - pad, y = bounds.y - pad, w = bounds.w + pad * 2, h = bounds.h + pad * 2;
      const r = Math.min(20, h / 2);
      this._layer = new Container();
      // ONE dim shape with a rounded window cut out of it. (An 'erase' hole
      // punches through the whole framebuffer — it erased the BOMB card itself.)
      const dim = new Graphics().rect(0, 0, W, H).fill({ color: 0x0B0920, alpha: 0.74 })
        .roundRect(x, y, w, h, r).cut();
      this._layer.addChild(dim);
      this._container.addChild(this._layer);
      this._overlay = this._layer;

      // Gold ring: a dark keyline outside, a bright gold line, a faint glow.
      this._borderGfx = new Graphics();
      this._borderGfx.roundRect(x - 3, y - 3, w + 6, h + 6, r + 3).stroke({ color: GOLD, width: 10, alpha: 0.16 });
      this._borderGfx.roundRect(x - 1, y - 1, w + 2, h + 2, r + 1).stroke({ color: INK, width: 5 });
      this._borderGfx.roundRect(x, y, w, h, r).stroke({ color: GOLD, width: 3 });
      this._container.addChild(this._borderGfx);
      this._ringGfx = this._borderGfx;
    }

    // Instruction: a dark rounded card with a gold rim (same family as the
    // other toasts), placed ABOVE the target with a pointer notch toward it —
    // below only when the target is at the very top.
    const label = bodyText(text.replace(/^[^\w]+/u, ''), 16, 0xFFFFFF, { wrap: W - 88 });
    const cw = Math.min(W - 32, label.width + 36), ch = label.height + 22;
    const above = !bounds || bounds.y > 150;
    const cx = W / 2;
    // Sit clear of the hand (above the target) — hand needs ~46px.
    const handRoom = bounds && !handStart ? 52 : 14;
    // A drag sweep starts above the target: the card sits above the sweep's start.
    const top = handStart ? Math.min(bounds?.y ?? 1e9, handStart.y - 34) : bounds?.y;
    const cy = bounds
      ? (above ? top - 6 - handRoom - ch : bounds.y + bounds.h + 6 + handRoom)
      : ROAD_BOTTOM_Y + 24;
    const card = new Graphics();
    card.roundRect(cx - cw / 2, cy, cw, ch, 16).fill({ color: 0x17143A, alpha: 0.96 }).stroke({ color: GOLD, width: 2.5 });
    card.roundRect(cx - cw / 2 + 3, cy + 3, cw - 6, ch * 0.42, 13).fill({ color: 0xffffff, alpha: 0.07 });
    this._container.addChild(card);
    this._cardGfx = card;
    label.x = cx; label.y = cy + ch / 2;
    this._textObj = label;
    this._container.addChild(label);

    // Pointing hand.
    if (handStart && handEnd) {            // drag sweep (bench tutorial)
      this._handObj = uiIcon('hand', 34, '👆');
      this._handObj.x = handStart.x;
      this._handObj.y = handStart.y;
      this._container.addChild(this._handObj);
    } else if (bounds) {                   // tap: hover above, dip onto the target
      this._handObj = uiIcon('hand', 34, '👆');
      this._handObj.scale.y *= -1;         // fingertip points DOWN at the button
      this._handObj.x = bounds.x + bounds.w / 2;
      this._tapHand = { y: bounds.y - 34 };
      this._handObj.y = this._tapHand.y;
      this._container.addChild(this._handObj);
    }
  }

  _clearGraphics() {
    this._overlay?.destroy();   this._overlay   = null;
    this._borderGfx?.destroy(); this._borderGfx = null;
    this._textObj?.destroy();   this._textObj   = null;
    this._cardGfx?.destroy();   this._cardGfx   = null;
    this._ringGfx = null; this._layer = null; this._tapHand = null;
    this._handObj?.destroy();   this._handObj   = null;
    this._flashGfx?.destroy();  this._flashGfx  = null;
    this._container.visible = false;
  }

  _complete() {
    const { id, pauseGame, bounds } = this._active;
    if (pauseGame && this._gameLoop?.resume) this._gameLoop.resume();
    this._done.add(id);
    this._saveDone();
    this._clearGraphics();

    if (bounds) {
      this._flashGfx = new Graphics();
      this._flashGfx.roundRect(bounds.x - 6, bounds.y - 6, bounds.w + 12, bounds.h + 12, Math.min(20, bounds.h / 2 + 6)).fill(0xf0c030);
      this._flashGfx.alpha = 0.70;
      this._container.addChild(this._flashGfx);
      this._container.visible = true;
    }
    this._flashT = 0;
    this._playDing();
  }

  _playDing() { this._audio?.play('tutorial_ding'); }

  _loadDone() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch { return new Set(); }
  }

  _saveDone() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this._done]));
    } catch { /* noop */ }
  }
}
