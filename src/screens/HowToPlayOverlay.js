// HowToPlayOverlay — rules slideshow opened from the ❓ button on the goal bar
// (premium pass, 2026-09-28).
//
// Each slide is an illustration composed from the game's own sprites (so it can
// never drift from the art the way the old L22 screenshots did) above a title
// and two lines of copy. ◀ / ▶ step through; the last slide ends with GOT IT!.
import { Container, Graphics, Sprite, Assets } from 'pixi.js';
import { uiIcon, boosterIcon } from '../renderer/UIIcon.js';
import { panel, ribbon, button, roundButton, titleText, bodyText, backdrop, GOLD, RIBBON } from '../renderer/PremiumUI.js';
import { INK, WHITE } from '../renderer/ToyStyle.js';

const _B = import.meta.env.BASE_URL ?? '';
const PW = 344, PH = 540, ART_H = 210;

const SLIDES = [
  { title: 'MATCH THE COLOR', art: 'match',
    body: 'Drag a bomb onto a lane. It hits the front car only if the colors match.' },
  { title: 'EVERY SHOT COUNTS', art: 'advance',
    body: 'After each shot, all cars roll one step closer. Stop them before the red line!' },
  { title: 'HOT STREAK', art: 'streak',
    body: 'Kill with 3 shots in a row to charge a POWER SHOT: double damage, any color.' },
  { title: 'BOOSTERS', art: 'boosters',
    body: 'Recolor repaints a whole color group, Freeze stops traffic, Bomb clears a lane.' },
];

export class HowToPlayOverlay {
  constructor(stage, appW, appH, { onClose } = {}) {
    this._container = new Container();
    stage.addChild(this._container);
    this._W = appW;
    this._H = appH;
    this._onClose = onClose;
    this._idx = 0;
    this._container.addChild(backdrop(appW, appH, 0.78));
    this._card = new Container();
    this._card.x = (appW - PW) / 2; this._card.y = (appH - PH) / 2 + 8;
    this._container.addChild(this._card);
    this._render();
  }

  destroy() { this._container.destroy({ children: true }); }

  _go(d) {
    this._idx = Math.max(0, Math.min(SLIDES.length - 1, this._idx + d));
    this._render();
  }

  _render() {
    this._card.removeChildren().forEach(ch => ch.destroy({ children: true }));
    const c = this._card;
    const s = SLIDES[this._idx];
    const last = this._idx === SLIDES.length - 1;
    c.addChild(panel(PW, PH));
    const rb = ribbon('HOW TO PLAY', 250, { size: 26 });
    rb.x = PW / 2; rb.y = 2;
    c.addChild(rb);
    const close = roundButton(uiIcon('close', 22, '✕'), { r: 22, color: RIBBON, onTap: () => this._onClose?.() });
    close.x = PW - 14; close.y = 14;
    c.addChild(close);

    // Illustration well.
    const ax = 22, ay = 48, aw = PW - 44;
    const well = new Graphics();
    well.roundRect(ax, ay, aw, ART_H, 18).fill(0x1B2A4A);
    well.roundRect(ax, ay, aw, ART_H * 0.5, 18).fill({ color: 0x3A6FB0, alpha: 0.25 });
    well.roundRect(ax, ay, aw, ART_H, 18).stroke({ color: 0x0C0A26, width: 2.5 });
    c.addChild(well);
    const art = new Container();
    art.x = ax + aw / 2; art.y = ay + ART_H / 2;
    c.addChild(art);
    ART[s.art](art, aw);

    const t = titleText(s.title, 28, GOLD);
    t.x = PW / 2; t.y = ay + ART_H + 34;
    c.addChild(t);
    const b = bodyText(s.body, 16, WHITE, { outline: false, weight: '600', wrap: PW - 60 });
    b.style.lineHeight = 22;
    b.x = PW / 2; b.y = ay + ART_H + 92;
    c.addChild(b);

    // Dots.
    const dy = PH - 116, gap = 20, dx0 = PW / 2 - ((SLIDES.length - 1) * gap) / 2;
    const dots = new Graphics();
    SLIDES.forEach((_, i) => {
      const on = i === this._idx;
      dots.circle(dx0 + i * gap, dy, on ? 7 : 5).fill(on ? GOLD : 0x4E4890).stroke({ color: INK, width: 2 });
    });
    c.addChild(dots);

    // Nav.
    if (this._idx > 0) {
      const prev = roundButton(arrow(-1), { r: 26, color: 0x3A3662, onTap: () => this._go(-1) });
      prev.x = 50; prev.y = PH - 56;
      c.addChild(prev);
    }
    if (last) {
      const ok = button('GOT IT!', { variant: 'green', w: 190, h: 62, size: 28, onTap: () => this._onClose?.() });
      ok.x = PW / 2; ok.y = PH - 56;
      c.addChild(ok);
    } else {
      const next = button('NEXT', { variant: 'blue', w: 170, h: 60, size: 26, onTap: () => this._go(1) });
      next.x = PW / 2; next.y = PH - 56;
      c.addChild(next);
    }
  }
}

// ── Illustrations (centred on the art container's origin) ─────────────────────

function sprite(parent, path, size, x, y, { alpha = 1, rot = 0 } = {}) {
  const url = `${_B}sprites/designed/${path}`;
  const place = (tex) => {
    if (parent.destroyed) return;
    const sp = new Sprite(tex);
    sp.anchor.set(0.5);
    sp.scale.set(size / Math.max(tex.width, tex.height));
    sp.x = x; sp.y = y; sp.alpha = alpha; sp.rotation = rot;
    parent.addChild(sp);
  };
  const tex = Assets.get(url);
  if (tex) place(tex); else Assets.load(url).then(place).catch(() => {});
}

function arrow(dir) {
  const g = new Graphics();
  g.poly([dir * 8, 0, -dir * 5, -9, -dir * 5, 9]).fill(WHITE).stroke({ color: INK, width: 2 });
  return g;
}

function laneStrip(g, x, w, top, bot) {
  g.roundRect(x - w / 2, top, w, bot - top, 10).fill(0x3A3F4E).stroke({ color: 0x0C0A26, width: 2 });
  for (let y = top + 14; y < bot - 10; y += 26) g.rect(x - 1.5, y, 3, 12).fill({ color: WHITE, alpha: 0.35 });
}

function tick(parent, x, y, ok) {
  const g = new Graphics();
  g.circle(x, y, 16).fill(ok ? 0x3DBB3A : 0xE8453C).stroke({ color: INK, width: 2.5 });
  parent.addChild(g);
  const ic = ok ? uiIcon('check', 18, '✓') : uiIcon('close', 16, '✕');
  ic.x = x; ic.y = y;
  parent.addChild(ic);
}

const ART = {
  match(a) {
    const g = new Graphics();
    laneStrip(g, -70, 74, -92, 92);
    laneStrip(g, 70, 74, -92, 92);
    // Drag trails.
    g.moveTo(-70, 58).lineTo(-70, -8).stroke({ color: 0x3DBB3A, width: 5, alpha: 0.9 });
    g.moveTo(70, 58).lineTo(70, -8).stroke({ color: 0xE8453C, width: 5, alpha: 0.9 });
    a.addChild(g);
    sprite(a, 'car-red-processed.png', 62, -70, -52);
    sprite(a, 'car-blue-processed.png', 62, 70, -52);
    sprite(a, 'powerball-red.png', 48, -70, 64);
    sprite(a, 'powerball-red.png', 48, 70, 64);
    tick(a, -30, 8, true);
    tick(a, 110, 8, false);
  },
  advance(a) {
    const g = new Graphics();
    laneStrip(g, 0, 90, -96, 70);
    g.rect(-80, 72, 160, 7).fill(0xE8453C).stroke({ color: INK, width: 2 });
    for (const y of [-58, -6]) {
      g.poly([-70, y + 16, -60, y + 30, -50, y + 16]).fill({ color: GOLD, alpha: 0.9 }).stroke({ color: INK, width: 1.5 });
      g.poly([50, y + 16, 60, y + 30, 70, y + 16]).fill({ color: GOLD, alpha: 0.9 }).stroke({ color: INK, width: 1.5 });
    }
    a.addChild(g);
    sprite(a, 'car-green-processed.png', 50, 0, -72);
    sprite(a, 'car-yellow-processed.png', 50, 0, -20);
    sprite(a, 'car-purple-processed.png', 50, 0, 34);
    const w = bodyText('BREACH LINE', 11, 0xFFB3AE, { outline: true });
    w.y = 92;
    a.addChild(w);
  },
  streak(a) {
    const g = new Graphics();
    for (let i = 0; i < 3; i++) {
      const x = -84 + i * 40;
      g.circle(x, -40, 17).fill(0xFF8A1C).stroke({ color: INK, width: 2.5 });
    }
    g.circle(76, 20, 58).fill({ color: 0xFFC93C, alpha: 0.18 });
    g.circle(76, 20, 44).fill({ color: 0xFF8A1C, alpha: 0.22 });
    a.addChild(g);
    for (let i = 0; i < 3; i++) {
      const f = uiIcon('fire', 24, '🔥');
      f.x = -84 + i * 40; f.y = -41;
      a.addChild(f);
    }
    const x3 = titleText('3 IN A ROW', 18, WHITE);
    x3.x = -44; x3.y = 4;
    a.addChild(x3);
    const eq = arrow(1);
    eq.scale.set(1.6); eq.x = 16; eq.y = 20;
    a.addChild(eq);
    sprite(a, 'powerball-orange.png', 64, 76, 20);
    const ps = titleText('POWER SHOT', 16, GOLD);
    ps.x = 76; ps.y = 80;
    a.addChild(ps);
    const d2 = titleText('x2', 22, WHITE);
    d2.x = -44; d2.y = 56;
    const dl = bodyText('DAMAGE · ANY COLOR', 11, 0xC9C3F0, { outline: false });
    dl.x = -44; dl.y = 80;
    a.addChild(d2, dl);
  },
  boosters(a) {
    [['colorchange', 'RECOLOR'], ['freeze', 'FREEZE'], ['bomb', 'BOMB']].forEach(([k, lbl], i) => {
      const x = -96 + i * 96;
      const g = new Graphics();
      g.circle(x, -14, 40).fill(0x2B2760).stroke({ color: GOLD, width: 3 });
      a.addChild(g);
      const ic = boosterIcon(k, 58, '?');
      ic.x = x; ic.y = -14;
      a.addChild(ic);
      const t = titleText(lbl, 16, WHITE);
      t.x = x; t.y = 50;
      a.addChild(t);
    });
  },
};
