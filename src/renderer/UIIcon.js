// UIIcon — single helper for the icon-set swap (kills the ~120 emoji instances).
// Returns a Sprite for the named icon (public/sprites/ui/icon-<name>.png,
// preloaded via UI_ICON_URLS in assetManifest.js), or a centered Text fallback
// showing the emoji when the texture hasn't loaded — a missing icon never
// blocks a screen.
import { Sprite, Text, Assets, NineSliceSprite, Container } from 'pixi.js';

const _B = import.meta.env.BASE_URL;
function iconUrl(name) { return `${_B}sprites/ui/icon-${name}.png`; }

// uiIcon(name, size, fallbackEmoji, opts)
//   size          target box (px); the sprite is scaled to fit its longest side
//   fallbackEmoji glyph shown (as centered Text) when the texture isn't loaded
//   opts.flipX    mirror horizontally — used to reuse 'back' (◀) as a 'next' (▶)
//                 chevron so we don't need a 21st icon
//   opts.tint     Pixi tint applied to the sprite (and fill of the text fallback)
//   opts.emojiFill text-fallback fill when no tint is given (default white)
// Both branches return a display object anchored at its CENTER, so callers place
// it at the same coordinates the emoji Text occupied.
export function uiIcon(name, size, fallbackEmoji, opts = {}) {
  const { flipX = false, tint, emojiFill } = opts;
  const tex = Assets.get(iconUrl(name));
  if (tex) {
    const sp = new Sprite(tex);
    sp.anchor.set(0.5);
    const s = size / Math.max(tex.width, tex.height);
    sp.scale.set(flipX ? -s : s, s);
    if (tint != null) sp.tint = tint;
    return sp;
  }
  const tx = new Text({
    text: fallbackEmoji ?? '?',
    style: { fontSize: size, fill: tint ?? emojiFill ?? 0xffffff },
  });
  tx.anchor.set(0.5);
  return tx;
}

// uiPlate(name, w, h) — a 9-slice button plate (public/sprites/ui/<name>.png,
// preloaded via BUTTON_PLATE_URLS). The plate is sliced at the ART's own scale
// and then shrunk evenly to the target height, so the rounded corners keep their
// drawn shape at any size. (It used to slice at screen scale: a 58px-tall card
// button kept 27px of a 180px-tall corner and squeezed the rest into 4px, which
// drew pointed ends with spikes — PrimeTestLab report 10510, M-01.)
// PLATE_CORNER is the corner radius in the art (both plates measure ~60px).
// Returns a Container w x h with its top-left at (0, 0), or null when the
// texture isn't loaded, so callers keep their Graphics fallback.
export const PLATE_CORNER = 64;
export function plateSlices(texW, texH, w, h) {
  const s = h / texH;
  const inset = Math.min(PLATE_CORNER, Math.floor(texH / 2) - 1);
  const geoW = w / s;
  // A plate narrower than its two corners keeps what fits (never overlaps).
  const side = Math.max(1, Math.min(inset, Math.floor(geoW / 2) - 1, Math.floor(texW / 2) - 1));
  return { s, geoW, geoH: texH, side, inset };
}

export function uiPlate(name, w, h) {
  const tex = Assets.get(`${_B}sprites/ui/${name}.png`);
  if (!tex) return null;
  const k = plateSlices(tex.width, tex.height, w, h);
  const ns = new NineSliceSprite({ texture: tex, leftWidth: k.side, rightWidth: k.side, topHeight: k.inset, bottomHeight: k.inset });
  ns.setSize(k.geoW, k.geoH);
  ns.scale.set(k.s);
  const c = new Container();
  c.addChild(ns);
  return c;
}

// boosterIcon(name, size, fallbackEmoji) — same contract as uiIcon but for the
// EXISTING booster sprites (public/sprites/designed/booster-<name>.png, preloaded
// via BOOSTER_URLS). name ∈ {colorchange, freeze, bomb}. Used to replace the
// 🎨/❄/💣 legend glyphs with the real glossy booster art.
function boosterUrl(name) { return `${_B}sprites/designed/booster-${name}.png`; }

export function boosterIcon(name, size, fallbackEmoji) {
  const tex = Assets.get(boosterUrl(name));
  if (tex) {
    const sp = new Sprite(tex);
    sp.anchor.set(0.5);
    sp.scale.set(size / Math.max(tex.width, tex.height));
    return sp;
  }
  const tx = new Text({ text: fallbackEmoji ?? '?', style: { fontSize: size, fill: 0xffffff } });
  tx.anchor.set(0.5);
  return tx;
}
