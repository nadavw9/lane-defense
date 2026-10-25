# Traffic Bomb — Lose-frame Play Store polish

**Date:** 2026-10-26 Asia/Jerusalem  
**Branch:** `art/lose-frame-wire` (from `art/traffic-light-housing` @ `63ea3c9`)  
**Quality bar:** Google Play / Royal Match defeat chrome — not a bare modal floating on dim.  
**Scope:** Visuals only. No gameplay / HP / collision / ads / store scripts. No push to master / prod / Vercel / Base44.  
**Stamp:** self-HF (store-bar UI chrome — not character or vehicle art).

## Gap

Batch-2 chrome already shipped `public/sprites/ui/lose-frame.png` (cracked dark-bronze ornate rim, open centre) and preloads it via `FRAME_URLS` in `assetManifest.js`. WinScreen already wires sibling `win-burst.png` behind the win modal. **LoseScreen never consumed the frame** — player sees a bare PremiumUI gold/maroon panel on a flat dim. Playbook §2d: "Lose screen: dramatic frame art behind the panel."

## Ship

| Surface | Before | After |
|---|---|---|
| `LoseScreen` panel group | PremiumUI panel only | `lose-frame.png` Sprite behind panel (rim peeks ~+72px); slides with panel |
| `win-burst` / `win-stars` | unchanged | win-burst already live; win-stars intentionally unused (animated star row) |

Wire mirrors WinScreen burst placement: `Assets.get` → Sprite centered on panel, scale from texture, alpha 0.92, added to `_panelGroup` before the panel so the open centre sits behind the opaque modal.

## Evidence

- `before/lose-panel-bare.png`
- `after/lose-panel-framed.png`
- `before-after-sheet.png`

## Checked / left alone

- Soft vehicle leftovers (bike chrome, boss empty black panels) — PASS already; need stamp-quality CONCEPT if touched. User notes boss lamps/recess just shipped on `art/boss-sprite-audit` @ `c9046d0` (not on remote at hunt time).
- Bike chrome — skip (cannot guarantee store-bar CONCEPT quality this pass).
- W1 Toy Town parity vs W2–W7 — no honest evidence W1 is weaker (backdrop files present; leave alone).
- PremiumUI multi-color procedural buttons — intentional vs single green/slate 9-slice plates; Title secondary already uses `button-secondary`; do not force green plate without Nadav stamp.
- HowToPlay illustration wells — flat navy; below Perfect, but not a clearer store-bar gap than this unwired asset.
- Design-audit F-17 confetti — already shipped (`art/confetti-polish` @ `e7690c9`).
- Traffic-light housing — already shipped (`art/traffic-light-housing` @ `63ea3c9`).
- Lane Math inventable chrome — CLEAR (prior pass); wardrobe hats PAUSED (need Nadav reopen).
- Dead `_addPillBtn` / deferred `button-daily` — Title meta is roundButtons now; stale playbook item.

## Out of scope / blocked art-direction

- Hats: need Nadav reopen (wizard ear-cut skip; royal-crown behind-ear reject).
- Bike chrome: needs CONCEPT quality bar before touch.
- Boss empty bed panels: soft leftover; lamps/recess pass claimed just shipped — do not spam.
