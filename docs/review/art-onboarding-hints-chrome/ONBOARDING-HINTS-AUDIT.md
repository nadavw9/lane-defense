# Traffic Bomb — OnboardingHints PremiumUI panel parity

**Date:** 2026-10-26 Asia/Jerusalem  
**Branch:** `art/onboarding-hints-chrome` (from `art/cartype-intro-strip-chrome` @ `9f211bd`)  
**Quality bar:** Google Play / Royal Match dialog chrome — tutorial cards match CarTypeIntro / HowToPlay.  
**Scope:** Visuals only. No gameplay / ads / store scripts. No push to master / prod / Vercel / Base44.  
**Stamp:** self-HF (reuse PremiumUI `panel` / `ribbon` / `button` / `backdrop` / `bodyText`; no new assets).

## Gap

OnboardingHints `_buildShell` used bespoke flat Graphics: accent glow outline, flat `0x0e0b1c` face, top band, and a flat accent "TAP TO CONTINUE" pill. Comment said "styled to match CarTypeIntroCard" but chrome lagged the gold-bevel `panel()` + green CTA language shipped on CarTypeIntro / HowToPlay / Pause.

## Ship

| Surface | Before | After |
|---|---|---|
| Card frame | flat indigo + accent outline | `PremiumUI.panel` gold bevel |
| Title | Text + accent dropShadow | `ribbon(title, …, { color: accent })` (keeps per-card personality) |
| Body | raw Text | `bodyText` |
| CTA | flat accent Graphics pill | `button('TAP TO CONTINUE', { variant: 'green' })` → button-primary plate |
| Dim | raw Graphics rect | `backdrop` |
| Layout | screen-absolute CX/CY | panel-local coords (CarTypeIntro pattern) |

Visuals (book / bomb→bike / advance / rainbow disc) unchanged. DEV QA: `_nav.showOnboardingHint('HpMiss'|'Damage'|'Advance'|'ColorBomb')`.

## Evidence

- `before/card-HpMiss.png` · `before/card-Damage.png`
- `after/card-HpMiss.png` · `after/card-Damage.png`
- `before-after-sheet.png`

## Next hunt

| Candidate | Verdict |
|---|---|
| CarTypeIntro strip | shipped @ `9f211bd` |
| OnboardingHints shell | **WIRED this ship** |
| GuideCard | already `panel()` |
| HowToPlay / lose-frame / button-primary / Batch 1c | shipped |
| Blocked list (hats, bike, button-daily, controls/accessibility, win-stars) | skip |
| Soft F-* leftovers (Title sky F-01, Shop F-11, …) | larger product/layout; not same chrome-parity class |
| LM | no weaker inventable chrome with evidence this pass |

**Soft PremiumUI chrome-parity class → CLEAR** until a new flat Graphics dialog shows up with phone-eye evidence.
