// ToyStyle — the Toy Town UI language in one place (approved direction A,
// 2026-09-27): flat saturated fills, a thick dark ink outline, a darker "lip"
// under each button so it reads as a pressable chunk, and one soft gloss strip.
// Same ink and palette as the vector art in tools/art/, so the HUD and the
// sprites are drawn by one hand.
//
// Pure helpers over a Pixi Graphics — no state, no layout.

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

/**
 * A chunky toy button/card: lip, face, gloss, ink outline around the whole
 * shape. The face occupies (x, y, w, h); the lip adds `lip` px below it, so the
 * total footprint is w × (h + lip).
 */
export function toyPanel(g, x, y, w, h, r, fill, { lip = 4, stroke = 3.5, gloss = 0.28 } = {}) {
  if (lip > 0) g.roundRect(x, y + lip, w, h, r).fill(shade(fill, 0.62));
  g.roundRect(x, y, w, h, r).fill(fill);
  if (gloss > 0) {
    g.roundRect(x + 5, y + 4, w - 10, Math.max(4, h * 0.2), Math.min(r, h * 0.1)).fill({ color: WHITE, alpha: gloss });
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
