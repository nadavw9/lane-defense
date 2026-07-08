// GoalCounterUI — displays goal progress cards for the Level Goal System.
// Each goal (destroyTotal, destroyColor, destroyType) gets a card with:
// - An icon (burst/glyph, colored circle, or car sprite)
// - A count badge showing remaining kills
// - Green checkmark + dim when goal is met (goalProgress[i] === 0)
//
// Layout: horizontal row(s), centered below the top HUD badge/pause-button row.

import { Container, Graphics, Text, Sprite, Assets, Texture } from 'pixi.js';
import { uiIcon } from './UIIcon.js';

const _B = import.meta.env.BASE_URL;

// Color palette (matches CLAUDE.md section 10)
const COLOR_PALETTE = {
  Red:    0xE24B4A,
  Blue:   0x378ADD,
  Green:  0x639922,
  Yellow: 0xEF9F27,
  Purple: 0x7F77DD,
  Orange: 0xD85A30,
};

// Card styling — larger pills with breathing room (HUD redesign: goals own the top).
const CARD_W = 70;
const CARD_H = 70;
const CARD_GAP = 12;
const CARD_R = 14;
const CARD_BG_COLOR = 0x2a2f3e;
const CARD_BG_ALPHA = 0.95;

// The goals own the TOP zone: a full-width opaque band at the very top of the
// screen, above the road. Cards are centred inside it; the band's solid fill keeps
// the road/cars (which start ~44px) from showing through or overlapping.
const PANEL_TOP_Y   = 12;   // first card row top
const BAND_BG_COLOR = 0x0a0a1e;
const MAX_CARDS_PER_ROW = 3;

export class GoalCounterUI {
  constructor(parentLayer, stageWidth, opts = {}) {
    this._layer = parentLayer;
    this._stageWidth = stageWidth;
    this._onComplete = opts.onComplete;   // called once when a goal hits 0 (SFX)
    this._container = new Container();
    this._layer.addChild(this._container);

    // Full-width opaque band behind the cards (first child → drawn behind them).
    this._band = new Graphics();
    this._container.addChild(this._band);

    this._goals = [];
    this._goalProgress = [];
    this._prevProgress = [];
    this._cards = [];     // array of card containers
    this._bursts = [];    // active completion particle bursts

    // Particle FX layer (above the cards, re-stacked on top in _layoutCards).
    this._fx = new Graphics();
    this._container.addChild(this._fx);
  }

  // (Re)build cards from goals array
  setGoals(goals) {
    this._goals = goals ?? [];
    this._goalProgress = this._goals.map(g => g.count);

    // Destroy old cards
    for (const card of this._cards) {
      card.destroy();
    }
    this._cards = [];

    // If no goals, hide and bail
    if (this._goals.length === 0) {
      this._container.visible = false;
      return;
    }

    this._container.visible = true;

    // Build one card per goal
    for (let i = 0; i < this._goals.length; i++) {
      const goal = this._goals[i];
      const card = this._buildCard(goal, i);
      this._cards.push(card);
    }

    // Layout cards in rows
    this._layoutCards();
  }

  // Update remaining counts + completion state. dt (seconds) drives the celebration.
  update(goalProgress, dt = 0) {
    if (!goalProgress || goalProgress.length !== this._cards.length) return;
    this._goalProgress = goalProgress;

    for (let i = 0; i < this._cards.length; i++) {
      const card = this._cards[i];
      const remaining = Math.max(0, goalProgress[i]);
      const isComplete = remaining === 0;
      const justCompleted = isComplete && (this._prevProgress[i] ?? remaining) > 0 && !card._completed;

      if (justCompleted) {
        // Fire the celebration once: scale pop + white flash + particle burst + SFX.
        card._completed = true;
        card._popT   = 0;
        card._flashT = 0.10;
        this._spawnBurst(card.x, card.y, this._goalColor(this._goals[i]));
        this._onComplete?.();
      }
      this._prevProgress[i] = remaining;

      // Count badge / checkmark
      if (card._countText) {
        if (isComplete) {
          if (!card._checkmark) { card._countText.text = '✅'; card._checkmark = true; }
        } else {
          card._countText.text = String(remaining);
          card._checkmark = false;
          if (card._completed) { card._completed = false; this._drawCardBg(card, false, 0); }  // goal reset
        }
      }

      // Scale-pop (1.0 → ~1.4 → 1.0 over 300ms)
      if (card._popT >= 0) {
        card._popT += dt;
        const p = card._popT / 0.30;
        if (p >= 1) { card.scale.set(1); card._popT = -1; }
        else        { card.scale.set(1 + 0.40 * Math.sin(Math.PI * p)); }
      }

      // White flash → settle to completed (green) / normal bg
      if (card._flashT > 0) {
        card._flashT = Math.max(0, card._flashT - dt);
        this._drawCardBg(card, card._completed, (card._flashT / 0.10) * 0.9);
      }

      card.alpha = 1.0;   // no dimming — the green tint conveys "done"
    }

    this._stepBursts(dt);
  }

  _goalColor(goal) {
    if (goal?.type === 'destroyColor') return COLOR_PALETTE[goal.color] ?? 0xffffff;
    if (goal?.type === 'destroyType')  return 0xffaa33;
    return 0xffd54a;   // destroyTotal
  }

  _spawnBurst(x, y, color) {
    const parts = [];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.random() * 0.3;
      parts.push({ a, sp: 90 + Math.random() * 50 });
    }
    this._bursts.push({ x, y, color, t: 0, parts });
  }

  _stepBursts(dt) {
    const g = this._fx;
    g.clear();
    for (let i = this._bursts.length - 1; i >= 0; i--) {
      const b = this._bursts[i];
      b.t += dt;
      if (b.t >= 0.40) { this._bursts.splice(i, 1); continue; }
      const f = b.t / 0.40;
      const r = 3.2 * (1 - f);
      for (const p of b.parts) {
        const px = b.x + Math.cos(p.a) * p.sp * b.t;
        const py = b.y + Math.sin(p.a) * p.sp * b.t;
        g.circle(px, py, r).fill({ color: b.color, alpha: 1 - f });
      }
    }
  }

  setVisible(bool) {
    this._container.visible = bool;
  }

  destroy() {
    for (const card of this._cards) {
      card.destroy();
    }
    this._cards = [];
    this._container.destroy();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _buildCard(goal, index) {
    const card = new Container();

    // Background pill (redrawn during the completion flash / completed state)
    const bg = new Graphics();
    card.addChild(bg);
    card._bg = bg;
    card._popT = -1;        // >=0 while the scale-pop is playing
    card._flashT = 0;       // >0 while the white flash is playing
    card._completed = false;
    this._drawCardBg(card, false, 0);

    // Icon based on goal type
    let icon;
    if (goal.type === 'destroyTotal') {
      icon = this._buildBurstIcon();
    } else if (goal.type === 'destroyColor') {
      icon = this._buildColorCircle(goal.color);
    } else if (goal.type === 'destroyType') {
      icon = this._buildCarIcon(goal.carType);
    }

    if (icon) {
      icon.x = CARD_W / 2;
      icon.y = 24;
      card.addChild(icon);
    }

    // Count badge (bold white number or checkmark)
    const countText = new Text({
      text: String(goal.count),
      style: {
        fontSize:   22,
        fontWeight: 'bold',
        fill:       0xffffff,
        dropShadow: { color: 0x000000, blur: 3, distance: 0, alpha: 0.6 },
      },
    });
    countText.anchor.set(0.5, 0.5);
    countText.x = CARD_W / 2;
    countText.y = 50;
    card.addChild(countText);
    card._countText = countText;
    card._checkmark = false;

    return card;
  }

  // Redraw a card's pill bg: dark normally, green tint when complete, with an
  // optional white flash overlay (0..1) during the completion celebration.
  _drawCardBg(card, completed, flashAlpha = 0) {
    const g = card._bg;
    g.clear();
    const base = completed ? 0x1f6b3a : CARD_BG_COLOR;   // green when done
    g.roundRect(0, 0, CARD_W, CARD_H, CARD_R).fill({ color: base, alpha: CARD_BG_ALPHA });
    if (completed) g.roundRect(0, 0, CARD_W, CARD_H, CARD_R).stroke({ color: 0x44ff88, width: 2, alpha: 0.7 });
    if (flashAlpha > 0) g.roundRect(0, 0, CARD_W, CARD_H, CARD_R).fill({ color: 0xffffff, alpha: flashAlpha });
  }

  _buildBurstIcon() {
    return uiIcon('explosion', 32, '💥');   // sprite (glyph fallback)
  }

  _buildColorCircle(color) {
    const hexColor = COLOR_PALETTE[color];
    if (!hexColor) return null;

    const circle = new Graphics();
    circle.circle(0, 0, 13);
    circle.fill(hexColor);
    circle.stroke({ color: 0xffffff, width: 1.5, alpha: 0.5 });
    return circle;
  }

  _buildCarIcon(carType) {
    // Try to use a real sprite; fall back to car glyph
    // Car types: small, big, jeep, truck, bigrig, tank
    const spriteMap = {
      small:  'car',
      big:    'car',
      jeep:   'car',
      truck:  'truck',
      bigrig: 'bigrig',
      tank:   'tank',
    };

    const spriteKey = spriteMap[carType];
    if (!spriteKey) {
      // Fallback to the car icon (glyph fallback inside uiIcon)
      return uiIcon('car', 28, carType === 'truck' || carType === 'bigrig' ? '🚚' : '🚗');
    }

    // Try to load sprite (use red as default color)
    const spriteUrl = `${_B}sprites/designed/${spriteKey}-red.png`;
    const sprite = Sprite.from(spriteUrl);
    sprite.anchor.set(0.5, 0.5);
    // Scale to fit card
    const maxDim = 28;
    const scale = Math.min(1, maxDim / Math.max(sprite.width, sprite.height));
    sprite.scale.set(scale);
    return sprite;
  }

  _layoutCards() {
    if (this._cards.length === 0) return;

    const cardsPerRow = Math.min(MAX_CARDS_PER_ROW, this._cards.length);
    const totalRowsNeeded = Math.ceil(this._cards.length / cardsPerRow);

    // Total width of all cards in a row + gaps
    const rowWidth = cardsPerRow * CARD_W + (cardsPerRow - 1) * CARD_GAP;
    const panelStartX = (this._stageWidth - rowWidth) / 2;

    // Opaque full-width band sized to enclose all rows (occludes road behind it).
    const bandH = PANEL_TOP_Y * 2 + totalRowsNeeded * CARD_H + (totalRowsNeeded - 1) * CARD_GAP;
    this._band.clear();
    this._band.rect(0, 0, this._stageWidth, bandH);
    this._band.fill(BAND_BG_COLOR);
    this._band.rect(0, bandH - 1, this._stageWidth, 1);
    this._band.fill({ color: 0xffffff, alpha: 0.07 });

    let cardIndex = 0;
    for (let row = 0; row < totalRowsNeeded; row++) {
      const cardsInThisRow = Math.min(cardsPerRow, this._cards.length - cardIndex);
      const rowWidth2 = cardsInThisRow * CARD_W + (cardsInThisRow - 1) * CARD_GAP;
      const rowStartX = (this._stageWidth - rowWidth2) / 2;

      for (let col = 0; col < cardsInThisRow; col++) {
        const card = this._cards[cardIndex];
        // Pivot at centre so the completion pop scales about the card's middle;
        // x/y therefore address the card CENTRE (used as the particle-burst origin).
        card.pivot.set(CARD_W / 2, CARD_H / 2);
        card.x = rowStartX + col * (CARD_W + CARD_GAP) + CARD_W / 2;
        card.y = PANEL_TOP_Y + row * (CARD_H + CARD_GAP) + CARD_H / 2;
        this._container.addChild(card);
        cardIndex++;
      }
    }
    // Keep the particle FX layer above all cards, and reset completion tracking.
    this._container.addChild(this._fx);
    this._prevProgress = this._goalProgress.slice();
    this._bursts = [];
  }
}
