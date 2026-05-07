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

const STORAGE_KEY    = 'ftue_completed';
const APP_W          = 390;
const APP_H          = 844;
const HAND_CYCLE     = 0.9;     // seconds for one hand sweep
const FLASH_DURATION = 0.55;    // seconds for gold completion flash

export class TutorialOrchestrator {
  constructor(stage, gameLoop) {
    this._stage    = stage;
    this._gameLoop = gameLoop;

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
  //   bounds     — { x, y, w, h } canvas-pixel rect to spotlight (null = text-only)
  //   handStart  — { x, y } start of hand sweep, or null
  //   handEnd    — { x, y } end of hand sweep, or null
  //   pauseGame  — boolean (default true)
  start(opts) {
    const { id, text, bounds = null, handStart = null, handEnd = null, pauseGame = true } = opts;
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

  // Dismiss (skip without completing) whatever tutorial is active.
  dismiss() {
    if (!this._active) return;
    if (this._active.pauseGame && this._gameLoop?.resume) this._gameLoop.resume();
    this._clearGraphics();
    this._active = null;
    this._flashT = -1;
  }

  isDone(id)    { return this._done.has(id); }
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

  destroy() {
    this.dismiss();
    this._container.destroy({ children: true });
  }

  // ── Private ───────────────────────────────────────────────────────────────────

  _buildGraphics() {
    const W = APP_W, H = APP_H;
    const { text, bounds, handStart } = this._active;

    if (bounds) {
      // 4-rect dark surround
      const { x, y, w, h } = bounds;
      this._overlay = new Graphics();
      this._overlay.alpha = 0.72;
      this._overlay.rect(0,     0,     W,         y        ).fill(0x000000);
      this._overlay.rect(0,     y + h, W,         H - y - h).fill(0x000000);
      this._overlay.rect(0,     y,     x,         h        ).fill(0x000000);
      this._overlay.rect(x + w, y,     W - x - w, h        ).fill(0x000000);
      this._container.addChild(this._overlay);

      // Gold spotlight border
      this._borderGfx = new Graphics();
      this._borderGfx.rect(x - 2, y - 2, w + 4, h + 4)
        .stroke({ color: 0xf0c030, width: 3 });
      this._container.addChild(this._borderGfx);
    }

    // Instruction text — above spotlight if room, else below; centred if no bounds
    const textY = bounds
      ? (bounds.y > 44 ? bounds.y - 24 : bounds.y + bounds.h + 24)
      : H / 2 - 60;
    this._textObj = new Text({
      text,
      style: {
        fontSize:      16,
        fontWeight:    'bold',
        fill:          0xffffff,
        align:         'center',
        wordWrap:      true,
        wordWrapWidth: W - 40,
        dropShadow:    { color: 0x000000, blur: 5, distance: 0, alpha: 0.95 },
      },
    });
    this._textObj.anchor.set(0.5, 0.5);
    this._textObj.x = W / 2;
    this._textObj.y = textY;
    this._container.addChild(this._textObj);

    // Animated hand
    if (handStart) {
      this._handObj = new Text({ text: '👆', style: { fontSize: 28 } });
      this._handObj.anchor.set(0.5, 0.5);
      this._handObj.x = handStart.x;
      this._handObj.y = handStart.y;
      this._container.addChild(this._handObj);
    }
  }

  _clearGraphics() {
    this._overlay?.destroy();   this._overlay   = null;
    this._borderGfx?.destroy(); this._borderGfx = null;
    this._textObj?.destroy();   this._textObj   = null;
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
      this._flashGfx.rect(bounds.x, bounds.y, bounds.w, bounds.h).fill(0xf0c030);
      this._flashGfx.alpha = 0.70;
      this._container.addChild(this._flashGfx);
      this._container.visible = true;
    }
    this._flashT = 0;
    this._playDing();
  }

  _playDing() {
    try {
      const ctx  = new (window.AudioContext || window.webkitAudioContext)();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
      osc.onended = () => ctx.close();
    } catch { /* audio unavailable */ }
  }

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
