// GoalCounterUI — displays goal progress cards for the Level Goal System.
// Each goal (destroyTotal, destroyColor, destroyType) gets a card with:
// - An icon (burst/glyph, colored circle, or car sprite)
// - A count badge showing remaining kills
// - Green checkmark + dim when goal is met (goalProgress[i] === 0)
//
// Layout: horizontal row(s), centered below the top HUD badge/pause-button row.

import { Container, Graphics, Text, Sprite, Assets, Texture } from 'pixi.js';
import { uiIcon } from './UIIcon.js';
import { row0CoverY } from '../renderer3d/projection.js';
import { INK, PLUM, WHITE, toyPanel, shade, tint } from './ToyStyle.js';
import { FillGradient } from 'pixi.js';

const _B = import.meta.env.BASE_URL;

// Color palette (matches CLAUDE.md section 10)
const COLOR_PALETTE = {
  Red:    0xFF3D3D,
  Blue:   0x2F8CFF,
  Green:  0x2FCC55,
  Yellow: 0xFFD42A,
  Purple: 0xA35CFF,
  Orange: 0xFF8A1C,
};

// Card styling — larger pills with breathing room (HUD redesign: goals own the top).
const CARD_W = 66;
const CARD_H = 60;
const CARD_GAP = 8;
const CARD_R = 14;
const CARD_LIP = 4;                 // toy-button lip under the face (inside CARD_H)
const CARD_BG_COLOR   = WHITE;      // Toy Town: white cards, ink outline, ink number
const CARD_DONE_COLOR = 0xC9F5D3;   // soft mint when the goal is met

// The goals own the TOP zone: a full-width opaque band at the very top of the
// screen, above the road. Cards are centred inside it; the band's solid fill keeps
// the road/cars (which start ~44px) from showing through or overlapping.
const PANEL_TOP_Y   = 12;   // first card row top
const BAND_BG_COLOR = PLUM;
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
    // Goal plaque (gold frame around the goal slots) + overall progress bar.
    this._plaque = new Graphics();
    this._container.addChild(this._plaque);
    this._bar = new Graphics();
    this._container.addChild(this._bar);
    this._barBox = null;
    this._barShown = -1;

    // Board depth, for the band's row-0 occlusion floor (see _layoutCards).
    // Defaults to 16 = every level's depth before the rows-8 pilot, so an
    // un-wired caller reproduces the historical band exactly.
    this._gridRows = 16;

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
  /**
   * Board depth for this level. Drives the band's row-0 occlusion floor.
   * MUST be called BEFORE setGoals() — setGoals triggers _layoutCards, which is
   * what actually sizes the band, so a depth arriving afterwards would size the
   * band for the previous level. (This is the same create-before-configure trap
   * that made Car3D render every level at gridRows-16 size; see
   * GameRenderer3D.setGridRows.)
   */
  setGridRows(gridRows) {
    this._gridRows = gridRows ?? 16;
    if (this._cards.length > 0) this._layoutCards();   // re-size if goals already exist
  }

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
          if (!card._checkmark) { card._countText.visible = false; card._check.visible = true; card._checkmark = true; }
        } else {
          card._countText.text = String(remaining);
          card._countText.visible = true; card._check.visible = false;
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
    this._drawBar(dt);
  }

  // Overall goal progress (kills made / kills needed), eased toward the target.
  _drawBar(dt) {
    if (!this._barBox) return;
    const total = this._goals.reduce((a, g) => a + (g.count ?? 0), 0) || 1;
    const left  = this._goalProgress.reduce((a, r) => a + Math.max(0, r), 0);
    const target = 1 - left / total;
    this._barShown = this._barShown < 0 ? target : this._barShown + (target - this._barShown) * Math.min(1, dt * 8);
    const { x, y, w, h } = this._barBox;
    const g = this._bar;
    g.clear();
    g.roundRect(x, y, w, h, h / 2).fill({ color: 0x0C0A26, alpha: 0.85 });
    const fw = Math.max(0, (w - 4) * this._barShown);
    if (fw > 1) {
      g.roundRect(x + 2, y + 2, Math.max(h - 4, fw), h - 4, (h - 4) / 2).fill(this._barGrad ??= new FillGradient({
        type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local',
        colorStops: [{ offset: 0, color: 0x9CF06A }, { offset: 1, color: 0x2FA33A }] }));
      g.roundRect(x + 4, y + 3, Math.max(0, fw - 4), (h - 4) * 0.35, 2).fill({ color: WHITE, alpha: 0.35 });
    }
    g.roundRect(x, y, w, h, h / 2).stroke({ color: INK, width: 1.5 });
  }

  _goalColor(goal) {
    if (goal?.type === 'destroyColor') return COLOR_PALETTE[goal.color] ?? 0xffffff;
    if (goal?.type === 'destroyType')  return 0xffaa33;
    if (goal?.type === 'defeatBoss')   return 0xA35CFF;
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

  /** Bottom edge of the goal band in stage px (live — changes per level). */
  get bandBottom() { return this._bandH ?? 100; }

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
      icon = this._buildColorCarIcon(goal.color);
    } else if (goal.type === 'destroyType') {
      icon = this._buildCarIcon(goal.carType);
    } else if (goal.type === 'defeatBoss') {
      icon = this._designedSprite('boss', 34) ?? uiIcon('car', 28, '👹');
    }

    if (icon) {
      icon.x = CARD_W / 2;
      icon.y = 21;
      card.addChild(icon);
    }

    // Count badge (bold white number or checkmark)
    const countText = new Text({
      text: String(goal.count),
      style: { fontFamily: '"Lilita One", Fredoka, Arial, sans-serif', fontSize: 22, fill: WHITE,
        stroke: { color: INK, width: 5, join: 'round' } },
    });
    countText.anchor.set(0.5, 0.5);
    countText.x = CARD_W / 2;
    countText.y = 45;
    card.addChild(countText);
    card._countText = countText;
    // Done: a green tick disc replaces the number.
    const check = new Container();
    const disc = new Graphics();
    disc.circle(0, 0, 12).fill(0x3DBB3A).stroke({ color: INK, width: 2.5 });
    check.addChild(disc);
    const tick = uiIcon('check', 16, '✓');
    check.addChild(tick);
    check.x = CARD_W / 2; check.y = 45; check.visible = false;
    card.addChild(check);
    card._check = check;
    card._checkmark = false;

    return card;
  }

  // Redraw a card's toy panel: white normally, mint when complete, with an
  // optional gold flash overlay (0..1) during the completion celebration.
  _drawCardBg(card, completed, flashAlpha = 0) {
    const g = card._bg;
    g.clear();
    // Inset well inside the gold plaque: dark indigo, lit rim at the bottom;
    // green-lit when the goal is met.
    const face = completed ? 0x1F5A36 : 0x14113A;
    g.roundRect(0, 0, CARD_W, CARD_H, CARD_R).fill(face);
    g.roundRect(0, 0, CARD_W, CARD_H * 0.5, CARD_R).fill({ color: 0x000000, alpha: 0.18 });
    g.roundRect(0, 0, CARD_W, CARD_H, CARD_R).stroke({ color: 0x000000, width: 2, alpha: 0.5 });
    g.roundRect(1, CARD_H - 3, CARD_W - 2, 2, 1).fill({ color: completed ? 0x9CF06A : 0xFFFFFF, alpha: completed ? 0.6 : 0.12 });
    if (flashAlpha > 0) g.roundRect(0, 0, CARD_W, CARD_H, CARD_R).fill({ color: 0xffe066, alpha: flashAlpha });
  }

  _buildBurstIcon() {
    return uiIcon('explosion', 32, '💥');   // sprite (glyph fallback)
  }

  // destroyColor: the same toy sedan the player is hunting on the road. (Bug D
  // swapped in a side-view icon because the OLD painted top-down sprite read
  // poorly at 32px; the outlined toy art reads cleanly, and matching the road
  // is the point of the card.) Fallback chain: toy sedan → side-view → circle.
  _buildColorCarIcon(color) {
    const c = String(color).toLowerCase();
    const sprite = this._designedSprite(`car-${c}-processed`, 30)
                ?? this._designedSprite(`goal-car-${c}`, 34);
    if (sprite) return sprite;
    return this._buildColorCircle(color);
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
    // Per-type sprite (red variant), matching Car3D's naming. NOTE: small/big/jeep
    // previously pointed at car-red.png (no such file — the designed car is
    // car-red-processed.png); latent only because no level ships those goal types.
    const spriteMap = {
      small:  'bike-red',
      big:    'car-red-processed',
      jeep:   'van-red',
      truck:  'truck-red',
      bigrig: 'bigrig-red',
      tank:   'tank-red',
    };

    const sprite = spriteMap[carType] && this._designedSprite(spriteMap[carType], 30);
    if (sprite) return sprite;
    // Fallback to the car icon (glyph fallback inside uiIcon)
    return uiIcon('car', 28, carType === 'truck' || carType === 'bigrig' ? '🚚' : '🚗');
  }

  // Centered sprite from the preloaded designed/ set, scaled to fit a `size` box —
  // Assets.get only (no lazy Sprite.from: its texture is 1×1 until loaded, which
  // made the old scale-to-fit a no-op). Returns null when the texture isn't cached.
  _designedSprite(name, size) {
    const tex = Assets.get(`${_B}sprites/designed/${name}.png`);
    if (!tex) return null;
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5, 0.5);
    sprite.scale.set(size / Math.max(tex.width, tex.height));
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
    //
    // It must ALSO fully cover row 0. Row 0 is a staging row — hidden on all 40
    // shipped levels, cars emerging whole at row 1 — and the rows-8 pilot's
    // doubled row pitch left ~23% of a row-0 car protruding below the card-sized
    // band, which reads as cars sliced in half at level start.
    //
    // max() rather than a depth-keyed constant so the no-op is GUARANTEED, not
    // asserted: on every shipped 16-row board the card height already exceeds
    // row0CoverY, so this returns exactly today's value and cannot regress a
    // level it was not meant to touch. Only shallow boards move it.
    const cardsH = PANEL_TOP_Y * 2 + totalRowsNeeded * CARD_H + (totalRowsNeeded - 1) * CARD_GAP;
    const bandH  = Math.max(cardsH, row0CoverY(this._gridRows));
    this._bandH = bandH;   // read live by the popup queue (tip banners dock under it)
    // Header band: deep indigo gradient, faint pinstripes, gold trim, and a soft
    // shadow cast onto the road so the header sits ABOVE the scene.
    const W = this._stageWidth;
    const b = this._band;
    b.clear();
    for (let i = 0; i < 14; i++) b.rect(0, bandH + i, W, 1).fill({ color: 0x0B0A1E, alpha: 0.32 * (1 - i / 14) });
    b.rect(0, 0, W, bandH).fill(new FillGradient({
      type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local',
      colorStops: [{ offset: 0, color: 0x221D55 }, { offset: 1, color: 0x352F78 }] }));
    for (let x = -bandH; x < W; x += 14) b.poly([x, 0, x + 6, 0, x + 6 + bandH, bandH, x + bandH, bandH]).fill({ color: WHITE, alpha: 0.025 });
    b.rect(0, bandH - 6, W, 5).fill(0xE0A332);
    b.rect(0, bandH - 6, W, 1.5).fill({ color: 0xFFE9A0, alpha: 0.9 });
    b.rect(0, bandH - 1, W, 1).fill(INK);

    // Gold plaque around the goal slots, with the progress bar under them.
    const n  = Math.min(cardsPerRow, this._cards.length);
    const pw = n * CARD_W + (n - 1) * CARD_GAP + 20;
    const ph = totalRowsNeeded * CARD_H + (totalRowsNeeded - 1) * CARD_GAP + 26;
    const px = (W - pw) / 2, py = PANEL_TOP_Y - 8;
    const pq = this._plaque;
    pq.clear();
    pq.roundRect(px + 2, py + 5, pw, ph, 20).fill({ color: 0x000000, alpha: 0.35 });
    pq.roundRect(px, py, pw, ph, 20).fill(new FillGradient({
      type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local',
      colorStops: [{ offset: 0, color: 0xFFE9A0 }, { offset: 0.5, color: 0xFFC93C }, { offset: 1, color: 0xB9771C }] }));
    pq.roundRect(px, py, pw, ph, 20).stroke({ color: INK, width: 2.5 });
    pq.roundRect(px + 5, py + 5, pw - 10, ph - 10, 16).fill(0x2B2760);
    pq.roundRect(px + 5, py + 5, pw - 10, ph - 10, 16).stroke({ color: shade(0xB9771C, 0.6), width: 1.5 });
    this._barBox = { x: px + 14, y: py + ph - 14, w: pw - 28, h: 9 };
    this._barShown = -1;

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
        card.y = PANEL_TOP_Y - 2 + row * (CARD_H + CARD_GAP) + CARD_H / 2;
        this._container.addChild(card);
        cardIndex++;
      }
    }
    // Keep the particle FX layer above all cards, and reset completion tracking.
    this._container.addChild(this._bar);
    this._container.addChild(this._fx);
    this._prevProgress = this._goalProgress.slice();
    this._bursts = [];
  }
}
