# Wave 1 HF wiring — A02 feature graphic + C shop art

**HUMAN-FINAL: stamped 2026-10-29 by Nadav (via CoS).** Branch `art/gpt-wave1-store-shop-hf` (from `art/f01-raise-play` @ 4e76945). Not merged, not deployed, not uploaded to Play.

## Replaced / added
- `docs/store/art/feature-graphic.png` (1024x500) <- `art-gpt-wave1-feature-polish/polish-a02-1024x500.png` (same path/name).
- `public/sprites/designed/shop-pack-hero.png` <- `polish-c-pack-1024x512.png`
- `public/sprites/designed/shop-tile-{colorswap,freeze,bomb,shield}.png` <- `tile-v2-*-512.png` (Nadav's choice 2026-10-29; replaces the earlier polish-c tiles)

## Code (visual only)
- `src/renderer/assetManifest.js`: `SHOP_PACK_URL`, `SHOP_TILE_URLS`, `SHOP_ART_URLS` added to `ALL_SPRITE_URLS` preload (same pattern as BOOSTER_URLS).
- `src/screens/ShopScreen.js`: shop previously drew the pack + tiles procedurally. When the textures are loaded it now draws the baked art (rounded-mask sprite) and overlays BOOSTER PACK / item name / desc / price button / lock plate in code; falls back to the old procedural cards if a texture is missing. Pack card uses the art's 2:1 frame (358x179); tiles 173x174 (art stretched slightly, as accepted). No prices, economy, purchase or unlock logic changed. Buy "pop" now targets an empty holder (tile art stays still).
- Pack card (Nadav rules: no UI over UI, no text over art): art drawn 320x160 centred; only BOOSTER PACK sits on the art, inside the empty ribbon well. BEST VALUE tag, contents line, struck old price, -% sticker (beside, not on, the button) and price button / LEVEL lock plate are in a dark UI bar under the art. Checked locked (`after-shop-390x844.png`) and unlocked (`after-shop-unlocked-390x844.png`, unlock forced only in an uncommitted screenshot harness).
- Tiles (tile-v2): drawn square 160x160 (no stretch), centred in each column. Measured on the 512 art: cream panel ~y 5-32% / x 7-93%, gold price band ~y 72-95%. Code keeps a safety inset: name + description (+ Shield xN chip at the panel's right end) inside y 6-28% / x 9-91%; price button / LEVEL lock plate inside y 75.5-92.5% / x 10-90%. Text auto-shrinks (fitW now compounds scale correctly). Close-ups: `tiles-closeup-locked.png`, `tiles-closeup-unlocked.png`.
- Labels auto-shrink (`fitW`) to their wells, so nothing can overflow.

## Verification
- `vite build` OK. `vitest`: 1 failure (`tests/score.test.js` win-stars) — identical on the base commit, unrelated.
- Screenshots (390x844 @2x, headless Chromium, local vite dev): `before-shop-390x844.png`, `after-shop-390x844.png`, `shop-before-vs-after.png`; feature graphic `before-/after-feature-graphic-1024x500.png`, `feature-graphic-old-vs-new.png`.
- Overflow: EN labels fit inside frames/wells. **HE: the app has no Hebrew/i18n layer — shop strings are hard-coded English, so there is no HE render to check.** fitW scaling would contain longer strings if localization is added.
