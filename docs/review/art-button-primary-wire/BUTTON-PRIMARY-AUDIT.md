# Traffic Bomb — button-primary 9-slice wire (PremiumUI green)

**Date:** 2026-10-26 Asia/Jerusalem  
**Branch:** `art/button-primary-wire` (from `art/howtoplay-well-chrome` @ `72901cf`)  
**Quality bar:** Google Play / Royal Match primary CTA chrome — shipped PNG plate, not duplicate procedural green.  
**Scope:** Visuals only. No gameplay / ads / store scripts. No push to master / prod / Vercel / Base44.  
**Stamp:** self-HF (wire existing Batch-2 chrome — same class as lose-frame).

## Gap

`public/sprites/ui/button-primary.png` was preloaded via `BUTTON_PLATE_URLS` but never passed to `uiPlate()`. PremiumUI `green` variant used `plate: null` and redrew glossy green with Graphics. Title PLAY + every green CTA ignored the shipped plate (same failure mode as unwired `lose-frame.png`).

## Ship

| Surface | Before | After |
|---|---|---|
| `PremiumUI.button` variant `green` | procedural Graphics | `uiPlate('button-primary', w, h)` |
| Title PLAY (`premiumButton` green 308×88) | inherits | plate |
| Lose TRY AGAIN / Pause RESUME / PreLevel PLAY / Rescue CONTINUE / … | inherits | plate |
| blue / gold / red / purple / dark | unchanged procedural | **no invented multi-color plates** |

Runtime fallback: if the texture is missing, `uiPlate` returns null and the existing Graphics path still draws.

## Evidence

- `before/title-play-procedural.png` · `after/title-play-plate.png`
- `before/prelevel-play-procedural.png` · `after/prelevel-play-plate.png`
- `before/rescue-continue-procedural.png` · `after/rescue-continue-plate.png`
- `before-after-sheet.png`

## Unwired / playbook hunt (post-ship)

| Item | Status |
|---|---|
| `button-primary.png` | **WIRED this ship** |
| `button-secondary.png` | WIRED in Title `_addPillBtn` (dead call path; meta is roundButtons) — leave |
| `lose-frame` / `win-burst` | wired |
| `win-stars.png` | intentional unused |
| Batch 1c icons + `button-daily` | **not on disk** — need art gen; skip |
| CarTypeIntroCard art strip `0x2C2F3A` | soft flat Graphics — optional next (reuse card/well; no new art) |
| Hats / bike CONCEPT / ivory invent / boss beds | skipped per standing rules |

## Next

Softest remaining honest chrome without art gen: **CarTypeIntroCard strip** → PremiumUI.card/well language (same HowToPlay move). Or CLEAR if that reads as inventing polish on intentional toy-slate strip.
