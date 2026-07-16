// PreLevelScreen — optional "Power Up?" offer shown between the level-select tap
// and the level start. The player can watch rewarded ads to begin the level with
// boosters, or skip and start with none (FIX 4D).
//
//   Watch 1 ad  → 1 COLOR CHANGE
//   Watch 2 ads → COLOR CHANGE + FREEZE
//   Watch 3 ads → all 3 (COLOR CHANGE + FREEZE + BOMB)
//   Skip        → start with 0 boosters
//
// §3d DDA mercy: when the caller passes `freeBooster` (only at failStreak ≥ 2),
// a green "ON THE HOUSE" gift row appears above the ad tiers granting 1 booster
// for FREE (no ad). It NEVER references the player's failure — it reads as a
// gift, not charity (the invisible-assist principle: the player should not clock
// it's tied to their losses). The booster is COLOR CHANGE, matching the paid
// tier-1 value so "free" never out-values a paid ad tier.
//
// The screen is decoupled from AdManager: it reports the player's choice via
// onSelect(adCount, bundle); the caller runs the ads, then starts the level with
// the bundle. One tap on SKIP (or the choice button) dismisses it.
import { Container, Graphics, Text } from 'pixi.js';
import { boosterIcon } from '../renderer/UIIcon.js';

// Linear interpolate between two 0xRRGGBB colors. t=0 → a, t=1 → b.
function _lerpHex(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

export class PreLevelScreen {
  // callbacks: { onSelect(adCount, bundle), audio, freeBooster }
  //   bundle      = { colorChange, freeze, bombs }
  //   freeBooster = null | { key, emoji, desc, bundle } — §3d mercy gift row
  constructor(stage, appW, appH, levelLabel, { onSelect, audio, freeBooster = null }) {
    this._container   = new Container();
    stage.addChild(this._container);
    this._onSelect    = onSelect;
    this._audio       = audio;
    this._freeBooster = freeBooster;
    this._done        = false;
    this._t           = 0;
    this._jackpot     = null;   // tier-3 row container (animated shimmer)
    this._glow        = null;   // header radial glow (animated pulse)
    this._gift        = null;   // mercy gift row container (animated pulse)
    this._build(appW, appH, levelLabel);
  }

  destroy() { this._container.destroy({ children: true }); }

  // Driven by GameApp's render ticker. Gentle jackpot shimmer + header-glow pulse.
  update(dt = 1 / 60) {
    this._t += dt;
    if (this._jackpot) {
      // scale 1.0 → 1.02 → 1.0 over ~1.5s
      const s = 1.0 + 0.01 * (1 + Math.sin(this._t * (Math.PI * 2 / 1.5)));
      this._jackpot.scale.set(s);
    }
    if (this._gift) {
      // gentle gift-row pulse (offset phase from the jackpot so they don't sync)
      this._gift.scale.set(1.0 + 0.012 * (1 + Math.sin(this._t * (Math.PI * 2 / 1.7) + 1)));
    }
    if (this._glow) {
      this._glow.alpha = 0.55 + 0.20 * Math.sin(this._t * 2.2);
    }
  }

  _choose(adCount, bundle) {
    if (this._done) return;
    this._done = true;
    this._audio?.play('button_tap');
    this._onSelect?.(adCount, bundle);
  }

  _build(w, h, levelLabel) {
    const bg = new Graphics();
    bg.rect(0, 0, w, h);
    bg.fill({ color: 0x0a0a18, alpha: 0.92 });
    bg.eventMode = 'static';
    this._container.addChild(bg);

    // The mercy gift row (when present) adds a block above the ad tiers; grow the
    // panel and shift the ad section down by the same amount so nothing overlaps.
    const GIFT_BLOCK = this._freeBooster ? 76 : 0;
    const panelW = 340, panelH = 436 + GIFT_BLOCK;
    const px = (w - panelW) / 2;
    const py = (h - panelH) / 2;
    const cx = w / 2;

    // ── Panel with a vertical dark gradient (top darker → bottom lighter) ──────
    const mask = new Graphics();
    mask.roundRect(px, py, panelW, panelH, 20);
    mask.fill(0xffffff);
    this._container.addChild(mask);

    const grad = new Graphics();
    const BANDS = 24;
    for (let i = 0; i < BANDS; i++) {
      const t = i / (BANDS - 1);
      grad.rect(px, py + (panelH * i) / BANDS, panelW, panelH / BANDS + 1);
      grad.fill({ color: _lerpHex(0x0d0d22, 0x1d1d44, t) });
    }
    grad.mask = mask;
    this._container.addChild(grad);

    const border = new Graphics();
    border.roundRect(px, py, panelW, panelH, 20);
    border.stroke({ color: 0x9a55ee, width: 2, alpha: 0.55 });
    this._container.addChild(border);

    // ── Header: warm radial glow behind a big gold "POWER UP?" ────────────────
    const headY = py + 50;
    this._glow = this._headerGlow(cx, headY);
    this._text('POWER UP?', cx, headY, {
      fontSize: 36, fill: 0xFFD700,
      dropShadow: { color: 0x6a3000, blur: 10, distance: 0, alpha: 0.9 },
    });
    this._text(levelLabel != null ? `Before ${levelLabel}` : 'Before you start', cx, py + 84,
      { fontSize: 13, fill: 0xaab4cc, fontWeight: 'normal' });

    const RECOLOR = { key: 'colorchange', emoji: '🎨', desc: 'Recolor' };
    const FREEZE  = { key: 'freeze',      emoji: '❄️', desc: 'Freeze' };
    const BOMB    = { key: 'bomb',        emoji: '💣', desc: 'Bomb' };

    // ── Mercy gift row (§3d) — green "ON THE HOUSE", FREE, no ad ───────────────
    // Reads as a gift, never as pity: no reference to the player's losses. Placed
    // above the ad tiers as the most inviting option; a struggling player takes
    // the free help. The ad tiers below still sell bigger BUNDLES, so the paid
    // economy is intact (free grants exactly the tier-1 booster).
    if (this._freeBooster) {
      const fb = this._freeBooster;
      this._gift = this._tierRow(cx, py + 108, 308, 64, {
        leftLabel: 'FREE', boosters: [{ key: fb.key, emoji: fb.emoji, desc: fb.desc }],
        accent: 0x3ddc84, bgColor: 0x0e2418, shadow: 5,
        badge: { text: 'ON THE HOUSE', fill: 0x3ddc84, textFill: 0x06331d },
        onClick: () => this._choose(0, fb.bundle),
      });
    }

    // ── Tier rows — escalating visual weight ──────────────────────────────────
    // Tier 1: standard, blue/purple border.
    this._tierRow(cx, py + 112 + GIFT_BLOCK, 300, 62, {
      ads: 1, boosters: [RECOLOR], accent: 0x8a7bff, bgColor: 0x12122a, shadow: 4,
      onClick: () => this._choose(1, { colorChange: 1, freeze: 0, bombs: 0 }),
    });
    // Tier 2: slightly larger, cyan border, more elevated.
    this._tierRow(cx, py + 190 + GIFT_BLOCK, 308, 68, {
      ads: 2, boosters: [RECOLOR, FREEZE], accent: 0x44ccff, bgColor: 0x101a2a, shadow: 5,
      onClick: () => this._choose(2, { colorChange: 1, freeze: 1, bombs: 0 }),
    });
    // Tier 3: jackpot — gold border, warmer bg, BEST VALUE badge, animated shimmer.
    this._jackpot = this._tierRow(cx, py + 274 + GIFT_BLOCK, 316, 76, {
      ads: 3, boosters: [RECOLOR, FREEZE, BOMB], accent: 0xFFD700, bgColor: 0x241a08,
      shadow: 7, best: true,
      onClick: () => this._choose(3, { colorChange: 1, freeze: 1, bombs: 1 }),
    });

    // ── Skip — secondary, muted ───────────────────────────────────────────────
    this._skip('SKIP — START NOW', cx, py + 372 + GIFT_BLOCK, 200,
      () => this._choose(0, { colorChange: 0, freeze: 0, bombs: 0 }));
  }

  // Warm radial burst (same palette as the multi-kill popup) behind the header.
  _headerGlow(cx, cy) {
    const g = new Graphics();
    const R = 80, RINGS = 14;
    for (let i = RINGS; i >= 1; i--) {
      const f = i / RINGS;                       // 1 outer … →0 center
      const col = _lerpHex(0xFFF2B0, 0xE0531A, f);
      const a   = 0.05 + (1 - f) * 0.30;
      g.circle(cx, cy, R * f);
      g.fill({ color: col, alpha: a });
    }
    this._container.addChild(g);
    return g;
  }

  // One offer row, drawn in a self-contained Container pivoted at its centre so
  // the tier-3 jackpot can shimmer (scale) about its centre.
  _tierRow(cx, top, rw, rh, { ads, boosters, accent, bgColor, shadow, best = false, leftLabel = null, badge = null, onClick }) {
    const row = new Container();
    row.x = cx; row.y = top + rh / 2;
    row.pivot.set(rw / 2, rh / 2);   // local (0..rw, 0..rh); scale about centre

    const card = new Graphics();
    card.roundRect(0, 0, rw, rh, 12);
    card.fill({ color: bgColor });
    card.roundRect(0, 0, rw, rh, 12);
    card.stroke({ color: accent, width: best ? 2.5 : 1.5, alpha: best ? 0.95 : 0.6 });
    card.roundRect(0, rh - shadow, rw, shadow, 12);     // solid bottom = "elevation"
    card.fill({ color: accent, alpha: best ? 0.5 : 0.35 });
    card.eventMode = 'static';
    card.cursor = 'pointer';
    card.on('pointerdown', onClick);
    card.on('pointerover', () => { row.alpha = 0.85; });
    card.on('pointerout',  () => { row.alpha = 1.0; });
    row.addChild(card);

    const lbl = new Text({ text: leftLabel ?? `WATCH ${ads} AD${ads > 1 ? 'S' : ''}`,
      style: { fontSize: 15, fontWeight: '900', fill: 0xffffff, letterSpacing: 0.5 } });
    lbl.anchor.set(0, 0.5); lbl.x = 14; lbl.y = rh / 2;
    row.addChild(lbl);

    // Booster icons (large emoji + small description). Multi-icon groups stay
    // right-aligned; a single icon is centred in the right portion (matching where
    // the Tier 2/3 groups sit) instead of being pinned to the edge.
    const itemW = 50;
    const startX = boosters.length === 1
      ? rw - 12 - 2 * itemW                     // centre the lone icon in the right region
      : rw - 12 - boosters.length * itemW;      // right-aligned for 2+ icons
    boosters.forEach((bk, i) => {
      const icx = startX + i * itemW + itemW / 2;
      const em = boosterIcon(bk.key, best ? 26 : 23, bk.emoji);   // glossy booster sprite (glyph fallback)
      em.x = icx; em.y = rh * 0.36;
      row.addChild(em);
      const d = new Text({ text: bk.desc, style: { fontSize: 9, fontWeight: 'bold', fill: accent } });
      d.anchor.set(0.5); d.x = icx; d.y = rh * 0.74;
      row.addChild(d);
    });

    // Corner pill badge: BEST VALUE for the jackpot tier, or a caller-supplied
    // badge (the mercy gift's "ON THE HOUSE"). Same shape, different palette.
    const pill = badge ?? (best ? { text: 'BEST VALUE', fill: 0xFFD700, textFill: 0x3a2a00 } : null);
    if (pill) {
      const bt0 = new Text({ text: pill.text,
        style: { fontSize: 9, fontWeight: '900', fill: pill.textFill, letterSpacing: 0.5 } });
      const bw = Math.max(72, bt0.width + 16), bh = 17, bx = rw - bw - 4, by = -9;
      const bg2 = new Graphics();
      bg2.roundRect(bx, by, bw, bh, 8);
      bg2.fill({ color: pill.fill });
      row.addChild(bg2);
      bt0.anchor.set(0.5); bt0.x = bx + bw / 2; bt0.y = by + bh / 2;
      row.addChild(bt0);
    }

    this._container.addChild(row);
    return row;
  }

  _skip(label, cx, y, wdt, onClick) {
    const hh = 38;
    const btn = new Graphics();
    btn.roundRect(cx - wdt / 2, y, wdt, hh, 10);
    btn.fill({ color: 0x14141f, alpha: 0.9 });   // muted, no bright border
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointerdown', onClick);
    btn.on('pointerover', () => { btn.alpha = 0.8; });
    btn.on('pointerout',  () => { btn.alpha = 1.0; });
    this._container.addChild(btn);

    const t = new Text({ text: label, style: { fontSize: 14, fontWeight: 'bold', fill: 0x7d8699 } });
    t.anchor.set(0.5, 0.5); t.x = cx; t.y = y + hh / 2;
    this._container.addChild(t);
  }

  _text(str, x, y, style) {
    const t = new Text({ text: str, style: { fontWeight: 'bold', ...style } });
    t.anchor.set(0.5, 0.5); t.x = x; t.y = y;
    this._container.addChild(t);
    return t;
  }
}
