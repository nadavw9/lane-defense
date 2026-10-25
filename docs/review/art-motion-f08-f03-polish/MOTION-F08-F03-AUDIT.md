# Traffic Bomb — motion ease + F-08 pulse + F-03 meta colors

**Date:** 2026-10-26 Asia/Jerusalem  
**Branch:** `art/motion-f08-f03-polish` (from `art/onboarding-hints-chrome` @ `7374c3f`)  
**Quality bar:** store-bar motion + design-audit visual FIX items still open.  
**Scope:** Visuals / motion only. No gameplay balance. No prod / master / Vercel / Base44.  
**Stamp:** self-HF.

## Gaps shipped

### 1) Screen transitions (motion soft fail)
`TransitionOverlay` used a **linear** black alpha ramp (callers 0.20–0.25s). Reads as a hard cut vs top mobile fades.

| Before | After |
|---|---|
| linear α(t)=t | **smoothstep** α(t)=t²(3−2t) |
| duration as passed | floor **≥0.28s** so ease has room |

Evidence: `transition-ease-curve.png`

### 2) F-08 Level Select next-node pulse
Next-to-play glow was easy to miss (`scale +0.06`, dim ring).

| Param | Before | After |
|---|---|---|
| node scale amp | 0.06 | **0.11** |
| ring alpha | 0.35–0.85 | **0.50–1.00** |
| ring scale amp | 0.12 | **0.20** |
| marker bob | 6px | **8px** |

Evidence: `before/levelselect-nodes.png` · `after/levelselect-nodes.png`

### 3) F-03 Title secondary colors
Meta row used green / amber / blue / **purple** / blue — chaotic palette.

| Before | After |
|---|---|
| CHALLENGE purple `0x8B4FE0` | **META blue `0x2F7FE0`** (same as trophies/stats/daily idle) |
| MAP green | kept (map entry) |
| DAILY amber | only when `hasDailyReward` (state, not a 4th accent) |

Evidence: `before/title-meta.png` · `after/title-meta.png` · `before-after-sheet.png`

## Hunt evidence (this pass)

| Item | Verdict |
|---|---|
| F-02 subtitle 17px | **gone** — title uses hero art, no "Stop the cars!" line |
| F-04 gear too small | **evolved** — `roundButton` r=22, icon 26 |
| F-05 PLAY 240×72 | **evolved** — 308×88 + button-primary |
| F-06 header 14px | **evolved** — roundButton icon headers |
| F-07 CityBackground on map | **fixed** — `backgroundLayer.visible=false` on LevelSelect |
| F-09/10/18/19 | skip (already evolved / prior ships) |
| F-11 Shop row unify | tiles already gold-rim gradient cards — not flat chaos |
| F-12 TIMER/COINS HUD | **suppressed** in FTUEOverlay (`_buildHUDHints` off) |
| F-13 CYCLE ring | CYCLE booster **removed** (3-card bar) |
| F-14 booster labels | **evolved** — 14–15px in card |
| F-15/16/17 win juice | **evolved** — stagger stars, coin tick, confetti polish |
| FTUE hands | **CLEAR** — all `uiIcon('hand')` PNG (FTUEOverlay, TutorialOrchestrator, GuideCard); no Graphics hands |
| PremiumUI chrome parity | CLEAR @ `7374c3f` |
| Hats / bike / button-daily / ivory / win-stars | skipped (blocked / art-direction) |
| LM phone-eye | no new soft defect with evidence vs HF kits on `art/recovery-option-kit` |

## Remaining needs Nadav / eng (not this visual class)
- F-01 Title sky dead space — layout / composition art-direction
- B-04 shooter tray black void — 3D/scene eng
- B-05 ComboGlow "disabled" — verify feel with playtest (code exists)
- Hats / bike CONCEPT — Nadav reopen

**Soft continuous polish in F-*/motion/FTUE-hand class → ship these three; next CLEAR or wait art-direction.**
