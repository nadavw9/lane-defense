// PremiumUI — the menu/dialog kit (2026-09-28 premium pass).
//
// One visual language for every screen outside gameplay, matching the owner's
// glossy icon set (sprites/ui) and the lit ToyStyle HUD: deep indigo panels with
// a gold bevelled frame, a red ribbon header, chunky gradient buttons with a
// press animation, Fredoka body text and Lilita One titles.
//
// Everything returns plain Pixi Containers positioned by the caller; nothing
// here knows about game state.
import { Container, Graphics, Text, FillGradient } from 'pixi.js';
import { INK, WHITE, shade, tint } from './ToyStyle.js';
import { uiPlate, uiIcon } from './UIIcon.js';

export const TITLE_FONT = '"Lilita One", Fredoka, Arial, sans-serif';
export const GOLD = 0xFFC93C, GOLD_DEEP = 0xB9771C, INDIGO = 0x2B2760, INDIGO_DEEP = 0x17143A;
export const RIBBON = 0xE8453C, GREEN = 0x3DBB3A, BLUE = 0x2F7FE0, PURPLE = 0x8B4FE0;

const _grads = new Map();
function grad(stops, key = null) {
  const k = key ?? JSON.stringify(stops);
  let g = _grads.get(k);
  if (!g) {
    g = new FillGradient({
      type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local',
      colorStops: stops.map(([offset, color]) => ({ offset, color })),
    });
    _grads.set(k, g);
  }
  return g;
}

/** Title text: Lilita One, white with an ink outline and a soft drop. */
export function titleText(str, size = 34, fill = WHITE) {
  const t = new Text({ text: str, style: {
    fontFamily: TITLE_FONT, fontSize: size, fill, letterSpacing: 1,
    stroke: { color: INK, width: Math.max(4, Math.round(size / 6)), join: 'round' },
    dropShadow: { color: 0x000000, alpha: 0.35, blur: 2, distance: 3, angle: Math.PI / 2 },
  } });
  t.anchor.set(0.5);
  return t;
}

/** Body text: Fredoka bold, optional ink outline. */
export function bodyText(str, size = 16, fill = WHITE, { outline = true, weight = '700', align = 'center', wrap = 0 } = {}) {
  const t = new Text({ text: str, style: {
    fontSize: size, fontWeight: weight, fill, align,
    ...(outline ? { stroke: { color: INK, width: Math.max(2, Math.round(size / 6)), join: 'round' } } : {}),
    ...(wrap ? { wordWrap: true, wordWrapWidth: wrap } : {}),
  } });
  t.anchor.set(0.5);
  return t;
}

/** Full-screen dim that also swallows taps behind a dialog. */
export function backdrop(w, h, alpha = 0.72) {
  const g = new Graphics();
  g.rect(0, 0, w, h).fill({ color: 0x0B0A1E, alpha });
  g.eventMode = 'static';
  return g;
}

/**
 * Dialog panel: soft shadow, gold bevelled frame, indigo lit face, inner rim.
 * Local origin is the panel's top-left.
 */
export function panel(w, h, { r = 26, face = INDIGO } = {}) {
  const c = new Container();
  const g = new Graphics();
  g.roundRect(4, 10, w, h, r).fill({ color: 0x000000, alpha: 0.35 });                 // shadow
  g.roundRect(0, 0, w, h, r).fill(grad([[0, 0xFFE9A0], [0.5, GOLD], [1, GOLD_DEEP]], 'gold'));   // frame
  g.roundRect(0, 0, w, h, r).stroke({ color: INK, width: 3.5 });
  g.roundRect(7, 7, w - 14, h - 14, r - 6).fill(grad([[0, tint(face, 0.12)], [1, shade(face, 0.62)]]));
  g.roundRect(7, 7, w - 14, h - 14, r - 6).stroke({ color: shade(GOLD_DEEP, 0.6), width: 2 });
  g.roundRect(11, 11, w - 22, h - 22, r - 9).stroke({ color: WHITE, width: 1.5, alpha: 0.12 });
  c.addChild(g);
  return c;
}

/** Ribbon banner with folded tails; centred on (0, 0). */
export function ribbon(str, w = 260, { color = RIBBON, size = 30 } = {}) {
  const c = new Container();
  const g = new Graphics();
  const h = 54, tail = 26, dip = 12;
  const dark = shade(color, 0.55);
  for (const sd of [-1, 1]) {                                          // tails
    const x0 = sd * (w / 2 - 10), x1 = sd * (w / 2 + tail);
    g.poly([x0, -h / 2 + 12, x1, -h / 2 + 12, x1 - sd * 12, 6 + dip / 2, x1, h / 2 + dip, x0, h / 2 + dip])
      .fill(dark).stroke({ color: INK, width: 3 });
  }
  g.roundRect(-w / 2, -h / 2, w, h, 10).fill(grad([[0, tint(color, 0.25)], [0.6, color], [1, shade(color, 0.8)]]))
    .stroke({ color: INK, width: 3.5 });
  g.roundRect(-w / 2 + 8, -h / 2 + 5, w - 16, 10, 5).fill({ color: WHITE, alpha: 0.25 });
  c.addChild(g);
  const t = titleText(str, size);
  t.y = 1;
  c.addChild(t);
  return c;
}

const VARIANTS = {
  green:  { plate: null, fill: GREEN },
  blue:   { plate: null, fill: BLUE },
  gold:   { plate: null, fill: GOLD, ink: 0x5A3500 },
  red:    { plate: null, fill: RIBBON },
  purple: { plate: null, fill: PURPLE },
  dark:   { plate: null, fill: 0x3A3662 },
};

/**
 * Chunky button centred on (0, 0). Press = squash to 0.94, release = tap.
 * opts: { variant, w, h, icon (display object), size, onTap, sub (small line) }
 */
export function button(label, { variant = 'green', w = 220, h = 64, icon = null, size = 26, onTap, sub = null } = {}) {
  const v = VARIANTS[variant] ?? VARIANTS.green;
  const c = new Container();
  const body = new Container();
  c.addChild(body);
  const plate = v.plate ? uiPlate(v.plate, w, h) : null;
  const g = new Graphics();
  g.roundRect(-w / 2 + 2, -h / 2 + 7, w, h, h / 2.6).fill({ color: 0x000000, alpha: 0.3 });
  body.addChild(g);
  if (plate) {
    plate.x = -w / 2; plate.y = -h / 2;
    body.addChild(plate);
  } else {
    const f = new Graphics();
    f.roundRect(-w / 2, -h / 2 + 5, w, h - 3, h / 2.6).fill(shade(v.fill, 0.55));
    f.roundRect(-w / 2, -h / 2, w, h - 5, h / 2.6).fill(grad([[0, tint(v.fill, 0.3)], [0.55, v.fill], [1, shade(v.fill, 0.82)]]));
    f.roundRect(-w / 2 + 8, -h / 2 + 5, w - 16, (h - 5) * 0.34, h / 5).fill({ color: WHITE, alpha: 0.32 });
    f.roundRect(-w / 2, -h / 2, w, h, h / 2.6).stroke({ color: INK, width: 3.5 });
    body.addChild(f);
  }
  const t = titleText(label, size, WHITE);
  t.y = sub ? -h * 0.12 : -2;
  if (icon) {
    const gap = 10;
    const iw = icon.width;
    t.x = (iw + gap) / 2;
    icon.x = t.x - t.width / 2 - gap - iw / 2;
    icon.y = t.y;
    body.addChild(icon);
  }
  body.addChild(t);
  if (sub) {
    const st = bodyText(sub, 13, WHITE);
    st.y = h * 0.24;
    body.addChild(st);
  }
  c.eventMode = 'static';
  c.cursor = 'pointer';
  c.hitArea = { contains: (x, y) => Math.abs(x) <= w / 2 && Math.abs(y) <= h / 2 };
  c.on('pointerdown', () => body.scale.set(0.94));
  c.on('pointerupoutside', () => body.scale.set(1));
  c.on('pointerup', () => { body.scale.set(1); onTap?.(); });
  return c;
}

/** Small round icon button (close, back, settings). Centred on (0, 0). */
export function roundButton(icon, { r = 24, color = 0x3A3662, onTap } = {}) {
  const c = new Container();
  const g = new Graphics();
  g.circle(1, 4, r).fill({ color: 0x000000, alpha: 0.3 });
  g.circle(0, 2, r).fill(shade(color, 0.55));
  g.circle(0, 0, r).fill(grad([[0, tint(color, 0.3)], [1, shade(color, 0.85)]]));
  g.circle(0, 0, r).stroke({ color: INK, width: 3 });
  g.ellipse(0, -r * 0.45, r * 0.6, r * 0.28).fill({ color: WHITE, alpha: 0.28 });
  c.addChild(g);
  if (icon) { icon.x = 0; icon.y = 0; c.addChild(icon); }
  c.eventMode = 'static';
  c.cursor = 'pointer';
  c.on('pointerdown', () => c.scale.set(0.92));
  c.on('pointerupoutside', () => c.scale.set(1));
  c.on('pointerup', () => { c.scale.set(1); onTap?.(); });
  return c;
}

/** Inset "well" row (stat line, list item) — local origin top-left. */
export function well(w, h, { r = 14 } = {}) {
  const g = new Graphics();
  g.roundRect(0, 0, w, h, r).fill({ color: 0x0C0A26, alpha: 0.55 });
  g.roundRect(0, 0, w, h, r).stroke({ color: 0x000000, width: 2, alpha: 0.35 });
  g.roundRect(1, h - 2, w - 2, 1.5, 1).fill({ color: WHITE, alpha: 0.08 });
  return g;
}

/** Full-screen menu background: violet → deep indigo, with a soft top glow. Swallows taps. */
export function screenBg(w, h) {
  const g = new Graphics();
  g.rect(0, 0, w, h).fill(grad([[0, 0x3A2F7A], [0.55, 0x241F5A], [1, INDIGO_DEEP]], 'screenbg'));
  g.ellipse(w / 2, 40, w * 0.75, 170).fill({ color: 0x7A5CFF, alpha: 0.18 });
  for (let i = 0; i < 26; i++) {                           // faint confetti dots (deterministic)
    const x = (i * 97.3) % w, y = 120 + ((i * 211.7) % (h - 180));
    g.circle(x, y, 1.5 + (i % 3)).fill({ color: WHITE, alpha: 0.05 + (i % 4) * 0.015 });
  }
  g.eventMode = 'static';
  return g;
}

/** Ribbon title + round back button, the standard full-screen header. */
export function screenHeader(parent, w, title, onBack, { ribbonW = 230, size = 26 } = {}) {
  const rb = ribbon(title, ribbonW, { size });
  rb.x = w / 2; rb.y = 40;
  parent.addChild(rb);
  if (onBack) {
    const back = roundButton(uiIcon('back', 22, '←'), { r: 22, color: BLUE, onTap: onBack });
    back.x = 32; back.y = 40;
    parent.addChild(back);
  }
  return rb;
}

/** Gold-rimmed indigo card — local origin top-left. `accent` tints the rim. */
export function card(w, h, { r = 16, rim = GOLD_DEEP, face = 0x3A3580, faceDeep = INDIGO, dim = false } = {}) {
  const g = new Graphics();
  g.roundRect(2, 5, w, h, r).fill({ color: 0x000000, alpha: 0.3 });
  g.roundRect(0, 0, w, h, r).fill(grad([[0, dim ? 0x2A2656 : face], [1, dim ? 0x1C1946 : faceDeep]]));
  g.roundRect(0, 0, w, h, r).stroke({ color: dim ? 0x3E3980 : rim, width: 2.5 });
  g.roundRect(3, 3, w - 6, h - 6, r - 3).stroke({ color: WHITE, width: 1, alpha: dim ? 0.05 : 0.12 });
  return g;
}

/** Progress bar — local origin top-left. */
export function bar(w, h, frac, { color = GREEN } = {}) {
  const g = new Graphics();
  const f = Math.max(0, Math.min(1, frac));
  g.roundRect(0, 0, w, h, h / 2).fill({ color: 0x0C0A26, alpha: 0.7 }).stroke({ color: INK, width: 2 });
  if (f > 0) {
    const fw = Math.max(h, (w - 4) * f);
    g.roundRect(2, 2, fw, h - 4, (h - 4) / 2).fill(grad([[0, tint(color, 0.3)], [1, shade(color, 0.8)]]));
    g.roundRect(4, 3, fw - 4, (h - 4) * 0.35, 2).fill({ color: WHITE, alpha: 0.3 });
  }
  return g;
}
