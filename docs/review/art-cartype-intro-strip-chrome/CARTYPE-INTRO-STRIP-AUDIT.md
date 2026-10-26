# Traffic Bomb — CarTypeIntro ladder strip Play Store chrome

**Date:** 2026-10-26 Asia/Jerusalem  
**Branch:** `art/cartype-intro-strip-chrome` (from `art/batch1c-ui-chrome` @ `a42c6d7`)  
**Quality bar:** Google Play / Royal Match dialog chrome — illustration stage matches PremiumUI kit.  
**Scope:** Visuals only. No gameplay / ads / store scripts. No push to master / prod / Vercel / Base44.  
**Stamp:** self-HF (reuse existing `PremiumUI.card`; no new assets — same class as HowToPlay well).

## Gap

`CarTypeIntroCard` ladder strip was flat slate `Graphics` (`0x2C2F3A` + `INK` stroke). Reads as placeholder inset next to the gold-bevel outer `panel()` and the gold-rim `card()` language used on HowToPlay / Stats / Settings. Flagged after `art/button-primary-wire` as the softest remaining honest chrome without art gen.

## Ship

| Surface | Before | After |
|---|---|---|
| CarTypeIntro ladder strip | flat `0x2C2F3A` Graphics | `PremiumUI.card` gold rim + deep slate face (`face: 0x2C3148` / `faceDeep: 0x16182A`) |

No new PNGs. Ladder sprites / connectors / pulse / GOT IT unchanged. Local `card` Container kept; import aliased as `uiCard` to avoid shadowing.

## Evidence

- `before/card-crop.png` · `before/strip-closeup.png`
- `after/card-crop.png` · `after/strip-closeup.png`
- `before-after-sheet.png`

## Hunt notes (this pass)

| Candidate | Verdict |
|---|---|
| Batch 1c icons | **Shipped** @ `a42c6d7` |
| `button-daily` / `_addPillBtn` / `button-secondary` dead path | skip (blocked) |
| `icon-controls` / `accessibility` | skip (Settings rows gone) |
| `win-stars` | intentional unused |
| Hats / bike CONCEPT / ivory invent | skip |
| LM inventable chrome | prior kits + recovery-option HF; no weaker phone-eye evidence this pass |
| Design-audit F-09/F-10 PreLevel | already evolved (`START WITH A BOOSTER` 14px, close = roundButton, tiles = `well`) |
| F-18 Win NEXT LEVEL primary | already `variant: isNext ? 'green' : 'blue'` |
| F-19 Lose stat contrast | already light fills post lose-frame |
| OnboardingHints custom card chrome | still bespoke Graphics — optional later; larger than strip parity |

## Left alone

- HowToPlay inner lane-strip Graphics (illustration content, not chrome).
- Hats PAUSED; bike CONCEPT; boss soft beds.
