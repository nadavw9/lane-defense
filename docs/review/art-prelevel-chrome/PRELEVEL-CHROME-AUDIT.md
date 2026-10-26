# Traffic Bomb: level-start card chrome (art/prelevel-chrome)

**Date:** 2026-10-26 · **Base:** `art/premium-pill` · layout/chrome only, no logic. Seen before every level.

| Element | Before | After |
|---|---|---|
| Win-streak bar (live) | flat dark-red roundRect, orange stroke | `PremiumUI.pill` ember face + gold bevel rim |
| Win-streak bar (building) | flat indigo roundRect | `pill({ rim: false })` |
| FREE under streak boosters | plain green outlined text | `PremiumUI.tag('FREE', green)` |
| NEW / BIG WAVE box | translucent fill + thin stroke | `PremiumUI.card` (gold rim; red rim + warm face for BIG WAVE) |
| Kit `tag()` | fixed 14 px side padding | padding scales with type size (two small tags no longer touch) |

Text fits in every frame (English UI). Self HUMAN-FINAL per the chrome rule.
Captures: `scripts/_prelevel-shots.mjs` (L46 NEW + live streak, L50 BIG WAVE, L33 streak building).

## Next
WinScreen SHARE as plain text, FTUEOverlay hint banner, Map stars plaque + RACE pill, Shop tiles.
