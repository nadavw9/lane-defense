// BoosterBar — four booster buttons + bomb kill-progress pips.
//   • SWAP   — tap two columns to exchange their top shooters
//   • PEEK   — reveals 4th+5th shooter pips per column for 4 seconds
//   • FREEZE — freezes all cars for 10 seconds
//   • BOMB   — AOE blast + concussion freeze at a road position
//
// Bomb earning: every 10 kills earns one bomb charge (max 3).
// Progress is shown as 10 small pips below the BOMB button.
import { Graphics, Text } from 'pixi.js';

const BAR_Y   = 752;  // top of booster bar
const BAR_H   = 68;   // taller than before to fit pips row
const BTN_H   = 30;   // button height
const BTN_Y   = BAR_Y + (BAR_H - BTN_H) / 2 - 8;  // vertically centre buttons in upper 50 px

// Layout: 3 × 78 px small boosters | 8 px gap | 1 × 100 px bomb
const SMALL_W  = 78;
const BOMB_W   = 100;
const GAP      = 7;
const TOTAL_W  = 3 * SMALL_W + BOMB_W + 3 * GAP;  // 3*78+100+21 = 355
const BAR_XOFF = Math.round((390 - TOTAL_W) / 2);  // ≈ 17 px left margin

const BTN_X = [
  BAR_XOFF,
  BAR_XOFF + SMALL_W + GAP,
  BAR_XOFF + 2 * (SMALL_W + GAP),
  BAR_XOFF + 3 * SMALL_W + 2 * GAP + SMALL_W, // after last small + extra gap
];
// Recalc bomb X cleanly
const BOMB_X  = BAR_XOFF + 3 * SMALL_W + 3 * GAP;

// Kill progress pips sit below the bomb button
const PIP_Y   = BAR_Y + BAR_H - 16;  // bottom of bar minus 16 px
const KILLS_PER_BOMB = 10;

export class BoosterBar {
  constructor(layerManager, boosterState, gameState, appW, onSwap, onPeek, onFreeze, onBomb) {
    this._state = boosterState;
    this._gs    = gameState;
    this._layer = layerManager.get('hudLayer');

    // Background strip
    const bg = new Graphics();
    bg.rect(0, BAR_Y, appW, BAR_H);
    bg.fill(0x0a0a18);
    bg.rect(0, BAR_Y, appW, 1);
    bg.fill(0x1a1a3a);
    this._layer.addChild(bg);

    const btnY = BTN_Y;

    this._swapBtn   = _makeBtn(this._layer, 'SWAP ×0',   BTN_X[0],  btnY, SMALL_W, BTN_H, 0x0d2040, 0x66aaff, onSwap);
    this._peekBtn   = _makeBtn(this._layer, 'PEEK ×0',   BTN_X[1],  btnY, SMALL_W, BTN_H, 0x0d2040, 0xaaff66, onPeek);
    this._freezeBtn = _makeBtn(this._layer, 'FREEZE ×0', BTN_X[2],  btnY, SMALL_W, BTN_H, 0x0a1a2a, 0x44ccff, onFreeze);
    this._bombBtn   = _makeBtn(this._layer, 'BOMB ×0',   BOMB_X,    btnY, BOMB_W,  BTN_H, 0x1a0800, 0xffaa00, onBomb);

    // Bomb button gets a prominent border glow (redrawn in update).
    this._bombGlow = new Graphics();
    this._layer.addChild(this._bombGlow);

    // Kill-progress pips (10 small circles centred under the bomb button).
    this._pips = [];
    const pipR     = 3.5;
    const pipGap   = 5;
    const pipsW    = KILLS_PER_BOMB * (pipR * 2) + (KILLS_PER_BOMB - 1) * pipGap;
    const pipX0    = BOMB_X + (BOMB_W - pipsW) / 2 + pipR;
    for (let i = 0; i < KILLS_PER_BOMB; i++) {
      const pip = new Graphics();
      pip.circle(0, 0, pipR);
      pip.fill(0x333355);
      pip.x = pipX0 + i * (pipR * 2 + pipGap);
      pip.y = PIP_Y;
      this._layer.addChild(pip);
      this._pips.push(pip);
    }

    // Floating "BOMB READY!" text (shown briefly when bomb earned).
    this._readyText = null;
    this._readyTextT = 0;

    this._prevBombs    = 0;
    this._bombPulse    = 0;  // 0..2π for idle pulse animation
    this._bombFlashT   = 0;  // countdown for earn flash
  }

  // Show or hide individual buttons (feature gating).
  setButtonVisibility(swap, peek, freeze) {
    this._swapBtn.visible   = swap;
    this._peekBtn.visible   = peek;
    this._freezeBtn.visible = freeze;
    // Bomb button is always visible (unlocks from level 1 — earns through kills).
    this._bombBtn.visible   = true;
  }

  // Call once per render frame to keep labels, opacity, and animations current.
  update(dt = 0) {
    const s  = this._state;
    const gs = this._gs;
    const el = gs.elapsed;

    // ── Standard booster labels / dimming ─────────────────────────────────
    const swapLabel   = `SWAP ×${s.swap}`;
    const peekLabel   = `PEEK ×${s.peek}`;
    const freezeLabel = `FREEZE ×${s.freeze}`;
    const bombLabel   = s.bombMode ? 'CANCEL' : `BOMB ×${s.bombs}`;

    if (this._swapBtn.label.text   !== swapLabel)   this._swapBtn.label.text   = swapLabel;
    if (this._peekBtn.label.text   !== peekLabel)   this._peekBtn.label.text   = peekLabel;
    if (this._freezeBtn.label.text !== freezeLabel) this._freezeBtn.label.text = freezeLabel;
    if (this._bombBtn.label.text   !== bombLabel)   this._bombBtn.label.text   = bombLabel;

    this._swapBtn.alpha   = s.swap   <= 0 ? 0.28 : s.swapMode ? 0.55 : 1.0;
    this._peekBtn.alpha   = (s.peek  <= 0 || s.isPeeking(el)) ? 0.28 : 1.0;
    this._freezeBtn.alpha = (s.freeze <= 0 || s.isFrozen(el))  ? 0.28 : 1.0;
    this._bombBtn.alpha   = (s.bombs <= 0 && !s.bombMode) ? 0.30 : s.bombMode ? 0.70 : 1.0;

    // ── Bomb button glow / pulse ───────────────────────────────────────────
    this._bombPulse += dt * 3.5;
    const pulseAlpha  = s.bombs > 0 ? (0.30 + 0.20 * Math.sin(this._bombPulse)) : 0.10;
    const glowColor   = s.bombMode ? 0xff3300 : 0xffaa00;

    this._bombGlow.clear();
    this._bombGlow.roundRect(BOMB_X - 2, BTN_Y - 2, BOMB_W + 4, BTN_H + 4, 9);
    this._bombGlow.stroke({ color: glowColor, width: 2, alpha: pulseAlpha * (s.bombs > 0 ? 1.8 : 1) });

    // Flash on newly earned bomb.
    if (this._bombFlashT > 0) {
      this._bombFlashT = Math.max(0, this._bombFlashT - dt);
      const fl = this._bombFlashT / 0.5;
      this._bombGlow.roundRect(BOMB_X - 4, BTN_Y - 4, BOMB_W + 8, BTN_H + 8, 11);
      this._bombGlow.stroke({ color: 0xffdd00, width: 4, alpha: fl });
    }

    // Detect newly earned bomb (state change).
    if (s.bombs > this._prevBombs) {
      this._bombFlashT = 0.5;
      this._spawnReadyText();
    }
    this._prevBombs = s.bombs;

    // ── Kill-progress pips ────────────────────────────────────────────────
    const filled = gs.killsTowardBomb % KILLS_PER_BOMB;
    for (let i = 0; i < KILLS_PER_BOMB; i++) {
      const pip = this._pips[i];
      pip.clear();
      if (i < filled) {
        pip.circle(0, 0, 3.5);
        pip.fill(0xffaa00);  // gold filled pip
      } else {
        pip.circle(0, 0, 3.5);
        pip.fill(0x333355);  // dark empty pip
      }
    }

    // ── "BOMB READY!" floating text ───────────────────────────────────────
    if (this._readyText) {
      this._readyTextT -= dt;
      this._readyText.y  -= dt * 28;
      this._readyText.alpha = Math.max(0, this._readyTextT / 1.4);
      if (this._readyTextT <= 0) {
        this._readyText.destroy();
        this._readyText = null;
      }
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _spawnReadyText() {
    if (this._readyText) { this._readyText.destroy(); this._readyText = null; }
    const t = new Text({
      text: 'BOMB READY!',
      style: {
        fontSize:   16,
        fontWeight: 'bold',
        fill:       0xffdd00,
        dropShadow: { color: 0x000000, blur: 6, distance: 2, alpha: 0.9 },
      },
    });
    t.anchor.set(0.5, 1);
    t.x = BOMB_X + BOMB_W / 2;
    t.y = BAR_Y - 4;
    this._readyTextT = 1.4;
    this._layer.addChild(t);
    this._readyText = t;
  }
}

// ── Module-private helpers ─────────────────────────────────────────────────────

function _makeBtn(layer, label, x, y, w, h, bgColor, fgColor, onClick) {
  const btn = new Graphics();
  btn.roundRect(0, 0, w, h, 7);
  btn.fill(bgColor);
  btn.roundRect(0, 0, w, h, 7);
  btn.stroke({ color: fgColor, width: 1.2, alpha: 0.50 });
  btn.x = x;
  btn.y = y;
  btn.eventMode = 'static';
  btn.cursor    = 'pointer';
  btn.on('pointerdown', onClick);

  const t = new Text({ text: label, style: { fontSize: 12, fontWeight: 'bold', fill: fgColor } });
  t.anchor.set(0.5, 0.5);
  t.x = w / 2;
  t.y = h / 2;
  btn.addChild(t);

  // Expose label Text so BoosterBar.update() can mutate it.
  btn.label = t;

  layer.addChild(btn);
  return btn;
}
