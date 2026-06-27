// GoalCounterUI — displays goal progress cards for the Level Goal System.
// Each goal (destroyTotal, destroyColor, destroyType) gets a card with:
// - An icon (burst/glyph, colored circle, or car sprite)
// - A count badge showing remaining kills
// - Green checkmark + dim when goal is met (goalProgress[i] === 0)
//
// Layout: horizontal row(s), centered below the top HUD badge/pause-button row.

import { Container, Graphics, Text, Sprite, Assets, Texture } from 'pixi.js';

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

// Card styling
const CARD_W = 60;
const CARD_H = 60;
const CARD_GAP = 8;
const CARD_R = 12;
const CARD_BG_COLOR = 0x1a1d26;
const CARD_BG_ALPHA = 0.75;

// Position below HUD (HUD is 70px tall) with some spacing
const PANEL_TOP_Y = 80;
const MAX_CARDS_PER_ROW = 3;

export class GoalCounterUI {
  constructor(parentLayer, stageWidth, opts = {}) {
    this._layer = parentLayer;
    this._stageWidth = stageWidth;
    this._container = new Container();
    this._layer.addChild(this._container);

    this._goals = [];
    this._goalProgress = [];
    this._cards = [];  // array of card containers
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

  // Update remaining counts and completion state
  update(goalProgress) {
    if (!goalProgress || goalProgress.length !== this._cards.length) return;

    this._goalProgress = goalProgress;

    for (let i = 0; i < this._cards.length; i++) {
      const card = this._cards[i];
      const remaining = Math.max(0, goalProgress[i]);
      const isComplete = remaining === 0;

      // Update or replace the count badge
      if (card._countText) {
        if (isComplete) {
          // Show checkmark instead of count
          if (!card._checkmark) {
            card._countText.text = '✅';
            card._checkmark = true;
          }
        } else {
          card._countText.text = String(remaining);
          card._checkmark = false;
        }
      }

      // Dim card when complete
      card.alpha = isComplete ? 0.5 : 1.0;
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

    // Background pill
    const bg = new Graphics();
    bg.roundRect(0, 0, CARD_W, CARD_H, CARD_R);
    bg.fill({ color: CARD_BG_COLOR, alpha: CARD_BG_ALPHA });
    card.addChild(bg);

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
      icon.y = 20;
      card.addChild(icon);
    }

    // Count badge (bold white number or checkmark)
    const countText = new Text({
      text: String(goal.count),
      style: {
        fontSize:   18,
        fontWeight: 'bold',
        fill:       0xffffff,
        dropShadow: { color: 0x000000, blur: 3, distance: 0, alpha: 0.6 },
      },
    });
    countText.anchor.set(0.5, 0.5);
    countText.x = CARD_W / 2;
    countText.y = 44;
    card.addChild(countText);
    card._countText = countText;
    card._checkmark = false;

    return card;
  }

  _buildBurstIcon() {
    // Explosion glyph using Text emoji
    const txt = new Text({
      text: '💥',
      style: { fontSize: 24 },
    });
    txt.anchor.set(0.5, 0.5);
    return txt;
  }

  _buildColorCircle(color) {
    const hexColor = COLOR_PALETTE[color];
    if (!hexColor) return null;

    const circle = new Graphics();
    circle.circle(0, 0, 10);
    circle.fill(hexColor);
    circle.stroke({ color: 0xffffff, width: 1, alpha: 0.4 });
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
      // Fallback to text glyph
      const txt = new Text({
        text: carType === 'truck' || carType === 'bigrig' ? '🚚' : '🚗',
        style: { fontSize: 20 },
      });
      txt.anchor.set(0.5, 0.5);
      return txt;
    }

    // Try to load sprite (use red as default color)
    const spriteUrl = `${_B}sprites/designed/${spriteKey}-red.png`;
    const sprite = Sprite.from(spriteUrl);
    sprite.anchor.set(0.5, 0.5);
    // Scale to fit card (max 20px width)
    const maxDim = 20;
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

    let cardIndex = 0;
    for (let row = 0; row < totalRowsNeeded; row++) {
      const cardsInThisRow = Math.min(cardsPerRow, this._cards.length - cardIndex);
      const rowWidth2 = cardsInThisRow * CARD_W + (cardsInThisRow - 1) * CARD_GAP;
      const rowStartX = (this._stageWidth - rowWidth2) / 2;

      for (let col = 0; col < cardsInThisRow; col++) {
        const card = this._cards[cardIndex];
        card.x = rowStartX + col * (CARD_W + CARD_GAP);
        card.y = PANEL_TOP_Y + row * (CARD_H + CARD_GAP);
        this._container.addChild(card);
        cardIndex++;
      }
    }
  }
}
