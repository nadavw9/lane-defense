// HowToPlayOverlay — 4-slide tutorial slideshow opened from the ❓ button on the
// right of the goal bar. Each slide: → advances; ✕ quits. Last slide has ✕ only.
// Each slide has a small looping PixiJS demo animation above the text, driven by the
// app ticker (the game is paused while this is open, so it uses its own timer).

import { Container, Graphics, Text } from 'pixi.js';

const SLIDES = [
  { title: 'GOAL', loop: 3.0, anim: 'goal',
    body: 'Destroy the required cars shown at the top.\n\nMeet all targets before any car reaches the breach line!' },
  { title: 'HOW TO PLAY', loop: 2.0, anim: 'play',
    body: "Drag a bomb to a lane — it must match the car's color.\n\nEvery shot advances ALL cars one step forward. Plan carefully!" },
  { title: 'MERGE COMBOS', loop: 2.5, anim: 'merge',
    body: 'Line up 3 same-color bombs in a row or column to create a powerful merged bomb!\n\nUse your 1 free swap per shot to set up merges.' },
  { title: 'BOOSTERS', loop: 3.0, anim: 'boosters',
    body: 'COLOR: Tap a car then pick a color — all matching cars transform!\n\nFREEZE: Earned by a 3-car chain kill.\n\nBOMB: Clears an entire row!' },
];

const PW = 320, PH = 440;

export class HowToPlayOverlay {
  constructor(stage, appW, appH, { onClose, ticker } = {}) {
    this._container = new Container();
    stage.addChild(this._container);
    this._W = appW;
    this._H = appH;
    this._onClose = onClose;
    this._ticker = ticker;
    this._idx = 0;
    this._t = 0;
    this._slideUpdate = null;

    // Backdrop — blocks game input
    const backdrop = new Graphics();
    backdrop.rect(0, 0, appW, appH);
    backdrop.fill({ color: 0x000011, alpha: 0.82 });
    backdrop.eventMode = 'static';
    this._container.addChild(backdrop);

    this._card = new Container();
    this._container.addChild(this._card);

    if (this._ticker) {
      this._tickFn = (tk) => this._tick((tk.deltaMS ?? 16.7) / 1000);
      this._ticker.add(this._tickFn);
    }

    this._render();
  }

  destroy() {
    if (this._ticker && this._tickFn) this._ticker.remove(this._tickFn);
    this._container.destroy({ children: true });
  }

  _tick(dt) {
    this._t += dt;
    this._slideUpdate?.(this._t);
  }

  _render() {
    this._card.removeChildren().forEach(ch => ch.destroy({ children: true }));
    this._t = 0;
    this._slideUpdate = null;

    const W = this._W, H = this._H;
    const PX = (W - PW) / 2;
    const PY = (H - PH) / 2;
    const slide = SLIDES[this._idx];
    const isLast = this._idx === SLIDES.length - 1;

    // Panel
    const panel = new Graphics();
    panel.roundRect(PX, PY, PW, PH, 20);
    panel.fill({ color: 0x141a28, alpha: 0.98 });
    panel.roundRect(PX, PY, PW, PH, 20);
    panel.stroke({ color: 0x44aaff, width: 2, alpha: 0.30 });
    this._card.addChild(panel);

    // Step dots
    const dotsY = PY + 22, dotGap = 16;
    const dotsX = W / 2 - ((SLIDES.length - 1) * dotGap) / 2;
    for (let i = 0; i < SLIDES.length; i++) {
      const d = new Graphics();
      d.circle(dotsX + i * dotGap, dotsY, 4);
      d.fill({ color: 0xffffff, alpha: i === this._idx ? 0.95 : 0.28 });
      this._card.addChild(d);
    }

    // ── Animation demo (upper half, above text) ───────────────────────────────
    const animBox = new Graphics();
    animBox.roundRect(PX + 40, PY + 42, PW - 80, 150, 12);
    animBox.fill({ color: 0x0c1018, alpha: 0.9 });
    this._card.addChild(animBox);

    const animC = new Container();
    animC.x = W / 2; animC.y = PY + 42 + 75;
    this._card.addChild(animC);
    this._slideUpdate = ANIMS[slide.anim](animC, slide.loop);

    // Title
    const title = new Text({
      text: slide.title,
      style: { fontSize: 22, fontWeight: 'bold', fill: 0xffd54a, letterSpacing: 1, align: 'center' },
    });
    title.anchor.set(0.5, 0);
    title.x = W / 2; title.y = PY + 206;
    this._card.addChild(title);

    // Body
    const body = new Text({
      text: slide.body,
      style: { fontSize: 14, fill: 0xe8ecf4, align: 'center', lineHeight: 21,
               wordWrap: true, wordWrapWidth: PW - 48 },
    });
    body.anchor.set(0.5, 0);
    body.x = W / 2; body.y = PY + 244;
    this._card.addChild(body);

    // ✕ quit (top-right)
    this._addBtn(PX + PW - 30, PY + 8, '✕', 0xffffff, 0.10, () => this._onClose?.());

    // → next (bottom-right) — hidden on the last slide
    if (!isLast) {
      this._addBtn(PX + PW - 60, PY + PH - 56, '→', 0xffffff, 0.16, () => { this._idx++; this._render(); }, 48);
    }
  }

  _addBtn(x, y, glyph, color, bgAlpha, onTap, size = 30) {
    const g = new Graphics();
    g.roundRect(0, 0, size, size, 8);
    g.fill({ color: 0xffffff, alpha: bgAlpha });
    const t = new Text({ text: glyph, style: { fontSize: Math.round(size * 0.6), fontWeight: 'bold', fill: color } });
    t.anchor.set(0.5, 0.5); t.x = size / 2; t.y = size / 2;
    g.addChild(t);
    g.x = x; g.y = y;
    g.eventMode = 'static';
    g.cursor    = 'pointer';
    g.on('pointerdown', onTap);
    this._card.addChild(g);
  }
}

// ── Slide animations: each returns an update(t) that loops on the slide's period ──
const ANIMS = {
  // GOAL — mini road, 2 cars descending toward a breach line, goal counter ticking
  goal(c, loop) {
    const g = new Graphics(); c.addChild(g);
    const counter = new Text({ text: '3', style: { fontSize: 18, fontWeight: 'bold', fill: 0xffd54a } });
    counter.anchor.set(0.5); counter.y = -62; c.addChild(counter);
    return (t) => {
      const lt = t % loop;
      g.clear();
      g.roundRect(-46, -48, 92, 108, 6).fill({ color: 0x3a3d46 });
      for (let y = -46; y < 56; y += 16) g.rect(-1, y, 2, 8).fill({ color: 0xffffff, alpha: 0.45 });
      g.rect(-46, 54, 92, 5).fill({ color: 0xE24B4A });          // breach line
      const prog = Math.min(1, lt / 2.4);
      const cy = -38 + prog * 80;
      g.roundRect(-26, cy, 18, 26, 4).fill({ color: 0x378ADD });
      g.roundRect(8, cy - 12, 18, 26, 4).fill({ color: 0xE24B4A });
      const count = Math.max(0, 3 - Math.floor(lt / 0.8));
      if (lt >= 2.4) { counter.text = 'WIN!'; counter.style.fill = (Math.floor(lt * 8) % 2) ? 0x44ff88 : 0xffffff; }
      else           { counter.text = String(count); counter.style.fill = 0xffd54a; }
    };
  },

  // HOW TO PLAY — a matching-colour bomb drags to a car, explodes, car vanishes
  play(c, loop) {
    const g = new Graphics(); c.addChild(g);
    return (t) => {
      const lt = t % loop;
      g.clear();
      g.roundRect(-22, -60, 44, 120, 6).fill({ color: 0x3a3d46 });        // lane
      if (lt < 1.15) g.roundRect(-15, -52, 30, 32, 5).fill({ color: 0xE24B4A });  // car (red)
      if (lt < 1.0) {                                                      // bomb travels
        const p = lt;
        const bx = 70 - 70 * p, by = 52 + (-37 - 52) * p;
        g.circle(bx, by, 10).fill({ color: 0xE24B4A });
        g.circle(bx - 3, by - 3, 3.5).fill({ color: 0xffffff, alpha: 0.6 });
      } else if (lt < 1.3) {                                              // explosion
        const ep = (lt - 1.0) / 0.3;
        g.circle(0, -37, 7 + ep * 24).fill({ color: 0xffaa22, alpha: 1 - ep });
        g.circle(0, -37, 3 + ep * 15).fill({ color: 0xffffff, alpha: (1 - ep) * 0.8 });
      } else {                                                            // bomb waiting in queue
        g.circle(70, 52, 10).fill({ color: 0xE24B4A });
      }
    };
  },

  // MERGE — 3 same-colour bombs glow, converge, flash, become a lightning bomb
  merge(c, loop) {
    const g = new Graphics(); c.addChild(g);
    const bolt = new Text({ text: '⚡', style: { fontSize: 22 } });
    bolt.anchor.set(0.5); bolt.visible = false; c.addChild(bolt);
    const col = 0x639922;
    return (t) => {
      const lt = t % loop; g.clear(); bolt.visible = false;
      if (lt < 1.0) {
        const pulse = 0.5 + 0.5 * Math.sin(lt * 9);
        for (let i = 0; i < 3; i++) { const y = -44 + i * 44; g.circle(0, y, 14).fill({ color: col }); g.circle(0, y, 14 + pulse * 3).stroke({ color: 0xaaffaa, width: 2, alpha: 0.6 }); }
      } else if (lt < 1.8) {
        const p = (lt - 1.0) / 0.8;
        for (let i = 0; i < 3; i++) { const y = (-44 + i * 44) * (1 - p); g.circle(0, y, 14).fill({ color: col }); }
      } else if (lt < 2.0) {
        const fp = (lt - 1.8) / 0.2;
        g.circle(0, 0, 18 + fp * 18).fill({ color: 0xffffff, alpha: 1 - fp });
      } else {
        g.circle(0, 0, 22).fill({ color: col });
        g.circle(0, 0, 22).stroke({ color: 0xccffcc, width: 2, alpha: 0.85 });
        bolt.visible = true;
      }
    };
  },

  // BOOSTERS — the 3 booster icons pop in one at a time, each pulsing
  boosters(c) {
    const defs = [
      { label: 'COLOR',  col: 0xCC66FF },
      { label: 'FREEZE', col: 0x44ccff },
      { label: 'BOMB',   col: 0xEF9F27 },
    ];
    const items = defs.map((d, i) => {
      const cc = new Container(); cc.x = (i - 1) * 74; cc.y = -8; c.addChild(cc);
      const g = new Graphics();
      g.roundRect(-26, -26, 52, 52, 11).fill({ color: d.col });
      g.roundRect(-26, -26, 52, 52, 11).stroke({ color: 0xffffff, width: 2, alpha: 0.5 });
      cc.addChild(g);
      const tx = new Text({ text: d.label, style: { fontSize: 11, fontWeight: 'bold', fill: 0xffffff } });
      tx.anchor.set(0.5); tx.y = 42; cc.addChild(tx);
      return cc;
    });
    return (t) => {
      const lt = t % 3;
      items.forEach((cc, i) => {
        const appear = 0.3 + i * 0.7;
        if (lt < appear) { cc.scale.set(0); cc.alpha = 0; return; }
        const at = lt - appear;
        const pop = at < 0.3 ? 1 + 0.4 * Math.sin(Math.PI * (at / 0.3)) : 1;
        const a = Math.min(1, at * 4);
        cc.alpha = a; cc.scale.set(a * pop);
      });
    };
  },
};
