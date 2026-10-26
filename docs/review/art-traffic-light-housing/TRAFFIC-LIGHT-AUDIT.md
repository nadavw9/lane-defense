# Traffic Bomb — Traffic-light housing Play Store polish

**Date:** 2026-10-26 Asia/Jerusalem  
**Branch:** `art/traffic-light-housing` (from `art/confetti-polish` @ `e7690c9`)  
**Quality bar:** Google Play / Royal Match / Toy Town prop chrome — not flat procedural Pixi pills.  
**Scope:** Visuals only. No gameplay / HP / collision / ads / store scripts. No push to master / prod / Vercel / Base44.  
**Stamp:** self-HF (store-bar VFX / prop chrome — not character or vehicle art).

## Gap

Confetti audit + design standing rule: L26+ traffic-light housing was redrawn every frame as procedural Pixi `Graphics` (dark pill + two flat circles + halo). Reads as placeholder next to Toy Town vehicles and PremiumUI chrome.

## Ship

| Surface | Before | After |
|---|---|---|
| `TrafficLights` housing | `Graphics.roundRect` + `circle` lamps | baked `traffic-light-red.png` / `traffic-light-green.png` sprites |
| Stop bar (red lane) | soft Graphics band + pulse | unchanged live VFX |
| Moves-left badge | Graphics circle + Text | unchanged live overlay |

Bake script: `scripts/make-traffic-light-sprites.mjs` (SVG → sharp → `public/sprites/designed/`).  
Preload: `TRAFFIC_LIGHT_URLS` in `src/renderer/assetManifest.js`.

## Evidence

- `before/housing-procedural-red.png`
- `before/housing-procedural-green.png`
- `after/housing-sprite-red.png`
- `after/housing-sprite-green.png`
- `before-after-sheet.png`

## Out of scope / next soft candidates

- Soft vehicle leftovers (bike chrome, boss empty black panels) — PASS already; stamp-quality CONCEPT only if touched.
- World 1 Toy Town baseline parity vs W2–W7 HF branches — leave alone unless Nadav asks.
- Legacy `public/sprites/cars/*` + 2D shooter sprites — not player-facing on 3D path.
- Stop-bar / moves badge stay live Graphics+Text (dynamic pulse / number) — intentional.
