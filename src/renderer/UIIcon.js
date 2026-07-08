// UIIcon — single helper for the icon-set swap (kills the ~120 emoji instances).
// Returns a Sprite for the named icon (public/sprites/ui/icon-<name>.png,
// preloaded via UI_ICON_URLS in assetManifest.js), or a centered Text fallback
// showing the emoji when the texture hasn't loaded — a missing icon never
// blocks a screen.
import { Sprite, Text, Assets, NineSliceSprite } from 'pixi.js';

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
// preloaded via BUTTON_PLATE_URLS). Corner insets are clamped to the target
// height/width so a short 40px pill never overlaps its own corners. Returns null
// when the texture isn't loaded, so callers keep their Graphics fallback.
export function uiPlate(name, w, h) {
  const tex = Assets.get(`${_B}sprites/ui/${name}.png`);
  if (!tex) return null;
  const lw = Math.max(6, Math.min(58, Math.round(w * 0.4)));
  const th = Math.max(6, Math.min(Math.round(tex.height * 0.42), Math.round(h * 0.46)));
  const ns = new NineSliceSprite({ texture: tex, leftWidth: lw, rightWidth: lw, topHeight: th, bottomHeight: th });
  ns.width = w; ns.height = h;
  return ns;
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
