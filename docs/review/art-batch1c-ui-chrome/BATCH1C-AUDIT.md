# Traffic Bomb — Batch 1c UI icons (help / calendar / sparkle)

**Date:** 2026-10-26 Asia/Jerusalem  
**Branch:** `art/batch1c-ui-chrome` (from `art/button-primary-wire` @ `dc468a6`)  
**Quality bar:** Google Play / Royal Match icon kit — same glossy sticker language as Batch 1 gift/check.  
**Scope:** Visuals only. No gameplay / ads / store scripts. No push to master / prod / Vercel / Base44.  
**Stamp:** self-HF (calendar page face scrubbed clean of gen grit before ship).

## Spec source

`docs/superpowers/plans/IMPLEMENTATION_PLAYBOOK.md` § Batch 1c + Batch 2b:

| file | intended wire |
|---|---|
| `icon-controls.png` | Settings CONTROLS label |
| `icon-accessibility.png` | Settings ACCESSIBILITY label |
| `icon-help.png` | how-to-play goal-bar button |
| `icon-calendar.png` | Title DAILY no-reward variant |
| `icon-sparkle.png` | BoosterSpotlight "TAP TO TRY!" ✦ |
| `button-daily.png` | Title `_addPillBtn` amber plate when `hasDailyReward` |

## Shipped (live wires only)

| Asset | Wire |
|---|---|
| `public/sprites/ui/icon-help.png` | PauseScreen **HOW TO PLAY** (goal-bar how-to removed; pause is the live entry) |
| `public/sprites/ui/icon-calendar.png` | TitleScreen DAILY when `!hasDailyReward` (gift kept for reward-ready) |
| `public/sprites/ui/icon-sparkle.png` | BoosterSpotlight CTA — flanking sprites, text `TAP TO TRY!` |

Pipeline: GenerateImage (kit refs) → `sprite-sources/raw/split/icon-*.png` → dark-rim protect → `scripts/process-ui-icons.mjs` → 128×128.  
Preload: `EXTRA_ICON_NAMES` + `UI_ICON_NAMES` (`help`, `calendar`, `sparkle`).

## Blocked — invent nothing

| Item | Why blocked |
|---|---|
| `icon-controls` / `icon-accessibility` | Settings no longer has CONTROLS / ACCESSIBILITY rows (HELP uses `book` / car guide). No live glyph call site. |
| `button-daily.png` | Playbook wires `TitleScreen._addPillBtn` — **dead**. Title meta is `roundButton`s; amber already via `color: 0xF0A020` when reward-ready. PremiumUI also keeps non-green variants procedural (`plate: null`) — do not invent a multi-color plate. |

## Evidence

- `before/` — emoji / no-icon composites (pre-ship state)
- `after/title-meta-row.png` — DAILY calendar (claimed / no-reward)
- `after/pause-howto-crop.png` — HOW TO PLAY + help ?
- `after/spotlight-cta-composite.png` — sparkle flank (in-game spotlight mount flaky in headless; composite matches wire)
- `after/icons-strip.png` · `before-after-sheet.png`

## Left alone

- Hats PAUSED; bike CONCEPT; ivory invent on flavor; soft boss beds.
- `controls` / `accessibility` / `button-daily` — wait for real Settings rows / pill DAILY surface; do not fake orphan chrome.
