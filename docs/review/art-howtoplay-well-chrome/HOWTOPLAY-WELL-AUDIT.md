# Traffic Bomb — HowToPlay illustration well Play Store polish

**Date:** 2026-10-26 Asia/Jerusalem  
**Branch:** `art/howtoplay-well-chrome` (from `art/lose-frame-wire` @ `d7317a2`)  
**Quality bar:** Google Play / Royal Match dialog chrome — illustration stage matches PremiumUI kit.  
**Scope:** Visuals only. No gameplay / ads / store scripts. No push to master / prod / Vercel / Base44.  
**Stamp:** self-HF (UI chrome parity — reuse existing PremiumUI.card; no new assets).

## Gap

HowToPlay illustration well was flat navy `Graphics` (`0x1B2A4A` + soft blue wash + dark stroke). Reads as placeholder next to the gold-bevel outer `panel()` and the gold-rim `card()` language used on Stats / Achievements / Settings. Called out after lose-frame ship as the next honest soft gap.

## Ship

| Surface | Before | After |
|---|---|---|
| HowToPlay art well | flat navy Graphics | `PremiumUI.card` gold-rim + indigo face (`face: 0x2A3568` / `faceDeep: 0x14122E`) |

No new PNGs. Illustration sprites / lane strips / ticks unchanged.

## Evidence

- `before/well-flat-navy.png`
- `after/well-premium-card.png`
- `before-after-sheet.png`

## Unwired-asset hunt (this pass)

| Asset | Status |
|---|---|
| `lose-frame.png` | WIRED (`art/lose-frame-wire` @ `d7317a2`) |
| `win-burst.png` | WIRED (WinScreen) |
| `win-stars.png` | Intentionally UNUSED (animated star row) — leave |
| `button-secondary.png` | WIRED (Title `_addPillBtn` path; meta now roundButtons) |
| `button-primary.png` | **PRELOADED, never `uiPlate`'d** — PremiumUI green uses procedural `plate: null`. Next honest candidate (wire green CTAs / Title PLAY). Do not invent new plates. |
| Batch 1c icons (`help`/`calendar`/`sparkle`/`controls`) + `button-daily` | **Not on disk** — need art gen; blocked (don't invent junk) |
| UI icons (chart/speaker/…) | WIRED |

## Left alone

- Hats PAUSED; bike CONCEPT; boss soft beds; ivory invent on flavor.
- W1 Toy Town parity — no weaker evidence.
- HowToPlay lane-strip Graphics inside the well — illustration content, not chrome; keep.
