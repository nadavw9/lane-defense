// UIIcon — single helper for the icon-set swap (kills the ~120 emoji instances).
// Returns a Sprite for the named icon (public/sprites/ui/icon-<name>.png,
// preloaded via UI_ICON_URLS in assetManifest.js), or a centered Text fallback
// showing the emoji when the texture hasn't loaded — a missing icon never
// blocks a screen.
import { Sprite, Text, Assets } from 'pixi.js';

const _B = import.meta.env.BASE_URL;
function iconUrl(name) { return `${_B}sprites/ui/icon-${name}.png`; }

export function uiIcon(name, size, fallbackEmoji) {
  const tex = Assets.get(iconUrl(name));
  if (tex) {
    const sp = new Sprite(tex);
    sp.anchor.set(0.5);
    sp.scale.set(size / Math.max(tex.width, tex.height));
    return sp;
  }
  const tx = new Text({
    text: fallbackEmoji ?? '?',
    style: { fontSize: size, fill: 0xffffff },
  });
  tx.anchor.set(0.5);
  return tx;
}
