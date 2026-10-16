// ToyStyle — the Toy Town UI language in one place (approved direction A,
// 2026-09-27): flat saturated fills, a thick dark ink outline, a darker "lip"
// under each button so it reads as a pressable chunk, and one soft gloss strip.
// Same ink and palette as the vector art in tools/art/, so the HUD and the
// sprites are drawn by one hand.
//
// Pure helpers over a Pixi Graphics — no state, no layout.
//
// 2026-09-28 premium pass: faces are lit (a vertical gradient, lighter on top),
// with an inner rim light, a soft drop shadow and a gradient gloss — the
// finish of Royal Match / Toon Blast buttons — over the same shapes.
import { FillGradient } from 'pixi.js';

export const INK       = 0x1F1A33;   // outlines, dark text
export const PLUM      = 0x3A3550;   // HUD bands, bomb-queue floor
export const PLUM_DEEP = 0x2C2742;   // bottom booster bar
export const CREAM     = 0xF4F1E6;
export const SUN       = 0xFFD42A;   // primary button yellow (= palette Yellow)
export const WHITE     = 0xFFFFFF;

/** Multiply each RGB channel by f (0..1) — the lip / shadow tone of a fill. */
export function shade(hex, f) {
  const r = Math.round(((hex >> 16) & 255) * f);
  const g = Math.round(((hex >> 8) & 255) * f);
  const b = Math.round((hex & 255) * f);
  return (r << 16) | (g << 8) | b;
}

/** Blend each RGB channel toward white by t (0..1). */
export function tint(hex, t) {
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  return (Math.round(r + (255 - r) * t) << 16) | (Math.round(g + (255 - g) * t) << 8) | Math.round(b + (255 - b) * t);
}

const _gradCache = new Map();
function vGrad(stops) {
  const key = stops.map(([o, c, a = 1]) => `${o}:${c}:${a}`).join('|');
  let gr = _gradCache.get(key);
  if (!gr) {
    gr = new FillGradient({
      type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local',
      colorStops: stops.map(([offset, color, alpha = 1]) => ({ offset, color: alpha < 1 ? { r: ((color >> 16) & 255) / 255, g: ((color >> 8) & 255) / 255, b: (color & 255) / 255, a: alpha } : color })),
    });
    _gradCache.set(key, gr);
  }
  return gr;
}

/**
 * A chunky button/card: soft drop shadow, lip, lit face, rim light, gloss, ink
 * outline around the whole shape. The face occupies (x, y, w, h); the lip adds
 * `lip` px below it, so the total footprint is w × (h + lip).
 */
export function toyPanel(g, x, y, w, h, r, fill, { lip = 4, stroke = 3.5, gloss = 0.28, shadow = true } = {}) {
  if (shadow) g.roundRect(x + 1, y + lip + 3, w, h, r).fill({ color: 0x000000, alpha: 0.22 });
  if (lip > 0) g.roundRect(x, y + lip, w, h, r).fill(shade(fill, 0.58));
  g.roundRect(x, y, w, h, r).fill(vGrad([[0, tint(fill, 0.22)], [0.55, fill], [1, shade(fill, 0.86)]]));
  // Rim light just inside the top edge.
  g.roundRect(x + 2.5, y + 2.5, w - 5, h - 5, Math.max(1, r - 2)).stroke({ color: WHITE, width: 1.5, alpha: 0.3 });
  if (gloss > 0) {
    g.roundRect(x + 5, y + 4, w - 10, Math.max(4, h * 0.36), Math.min(r, h * 0.18))
      .fill(vGrad([[0, WHITE, gloss * 1.5], [1, WHITE, 0]]));
  }
  g.roundRect(x, y, w, h + lip, r).stroke({ color: INK, width: stroke });
  return g;
}

/** Text style: bold white with an ink outline — readable on any fill. */
export function toyLabel(fontSize, fill = WHITE) {
  return {
    fontSize,
    fontWeight: '900',
    fill,
    stroke: { color: INK, width: Math.max(3, Math.round(fontSize / 5)), join: 'round' },
  };
}
