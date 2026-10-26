# Traffic Bomb — Confetti Play Store polish

**Date:** 2026-10-26 Asia/Jerusalem  
**Branch:** `art/confetti-polish` (from `origin/master` @ `036fb48`)  
**Quality bar:** Google Play / Royal Match / Toon Blast celebration juice — not muddy square placeholders.  
**Scope:** Visuals only. No gameplay / HP / collision / ads / store scripts. No push to master / prod / Vercel.

## Gap

Design-audit F-17 + live code: win / world-complete / booster-unlock confetti was plain `Graphics.rect` / `circle` flakes. Reads as placeholder next to Toy Town vehicles and PremiumUI chrome. Violates Nadav standing art rule for player-facing cues that would look better as proper store-bar shapes.

## Ship (self-HF under chrome / VFX rule — not character/vehicle art)

| Surface | Before | After |
|---|---|---|
| `WinScreen` ConfettiSystem | square + circle | ribbon / diamond / pennant / disc with gloss highlight |
| `WorldCompleteScreen` | same shared class | inherits |
| `BoosterSpotlight` | inline `rect` flakes | shared `ConfettiSystem.burstAt` |

New module: `src/renderer/Confetti.js` (`ConfettiSystem`, `drawConfettiPiece`, `CONFETTI_COLORS`).  
`WinScreen.js` re-exports `ConfettiSystem` so `WorldCompleteScreen` import stays stable.

## Evidence

- `before/burst-placeholders.png`
- `after/burst-store-bar.png`
- `before-after-sheet.png`

## Out of scope / next soft candidates

- Soft vehicle leftovers (bike chrome, boss empty black panels) — PASS already; need stamp-quality CONCEPT if touched; do not spam.
- Traffic-light housing still procedural Pixi Graphics (player-facing from L26) — soft next candidate for sprite bake.
- Legacy `public/sprites/cars/*` + 2D shooter sprites — not player-facing on 3D path (carLayer hidden; shooterRenderer.container.visible=false).
- World 1 Toy Town baseline left alone (W2–W7 already HF on separate art branches).
- FTUE L1 hand already uses `icon-hand.png` sprite (PASS); procedural arrow path is dead (only L1 had `showArrow`, and L1 uses hand demo).
