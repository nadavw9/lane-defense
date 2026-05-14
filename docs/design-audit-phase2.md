# Lane Defense — Design Audit Phase 2
> Generated 2026-05-14. Standard: "Would Royal Match / Color Block Jam / Toon Blast ship this screen?"
> Rubric: SYMMETRY · HIERARCHY · COLOR · TYPOGRAPHY · JUICE · CLUTTER · CONSISTENCY

---

## Summary

| Status | Count |
|--------|-------|
| BROKEN | 5 |
| FIX    | 14 |
| PASS   | 6 |

---

## Screen-by-Screen Audit

---

### 01 · TITLE SCREEN
**Screenshot:** `docs/screenshots/01-title-screen.png`

| Criterion | Score | Notes |
|-----------|-------|-------|
| SYMMETRY | PASS | Title centered, 2×2 button grid balanced |
| HIERARCHY | FIX | PLAY button gets lost — too small relative to the sky void above it |
| COLOR | FIX | 4 secondary buttons each have a different color (blue/orange/purple/green) — looks chaotic, not a palette |
| TYPOGRAPHY | FIX | "Stop the cars!" subtitle is 17px — unreadable on a real phone |
| JUICE | FIX | Title text has no animation. Cars animate on road (good) but the hero element is static |
| CLUTTER | FIX | Sky area is ~45% of screen height with only clouds — massive dead space |
| CONSISTENCY | PASS | Cartoon aesthetic consistent throughout |

**Overall: FIX**

Issues:
- F-01: Sky occupies 45% of screen, PLAY button sits near the bottom third — poor use of space
- F-02: Subtitle "Stop the cars!" is 17px — must be ≥22px
- F-03: 4 different accent colors on secondary buttons — pick 1 neutral secondary color
- F-04: Settings gear icon in top-right is 20px and barely tappable
- F-05: PLAY button at 240×72px looks small on 390px canvas — should be 280×80px minimum

---

### 02 · LEVEL SELECT
**Screenshot:** `docs/screenshots/02-level-select.png`

| Criterion | Score | Notes |
|-----------|-------|-------|
| SYMMETRY | PASS | Map grid is centered with consistent column spacing |
| HIERARCHY | FIX | The next-to-play level (L1) glows but is easy to miss at bottom of screen |
| COLOR | PASS | Dark navy + vivid level node colors — works well |
| TYPOGRAPHY | FIX | Header buttons (BACK, SHOP, ACHIEVEMENTS) are 14px — too small for finger-tap |
| JUICE | PASS | Node reveal animation on scroll is a nice touch |
| CLUTTER | PASS | Clean dark map look |
| CONSISTENCY | FIX | City skyline at top looks like a different game (it's the old PixiJS CityBackground — should be hidden) |

**Overall: FIX**

Issues:
- F-06: Header tap targets (BACK 14px, SHOP 14px) too small — minimum 18px bold, ideally 44px hit area
- F-07: Old CityBackground layer bleeds into top of level select — should be `visible=false`
- F-08: Active/next level node needs a stronger pulse (currently subtle) 

---

### 03 · LEVEL POPUP
**Screenshot:** `docs/screenshots/03-level-popup.png`

| Criterion | Score | Notes |
|-----------|-------|-------|
| SYMMETRY | PASS | Centered card, symmetric layout |
| HIERARCHY | PASS | START LEVEL is unmistakably the primary CTA |
| COLOR | PASS | Red header for L1 is vivid and appropriate |
| TYPOGRAPHY | PASS | LEVEL 1 at 26px, START LEVEL at 20px bold |
| JUICE | PASS | Slide-in animation smooth |
| CLUTTER | FIX | "OPTIONAL AD BOOSTERS" label is 11px — unreadably tiny |
| CONSISTENCY | PASS | Matches the dark overlay language used throughout |

**Overall: FIX**

Issues:
- F-09: "OPTIONAL AD BOOSTERS" caption is 11px — bump to 14px minimum
- F-10: "← BACK" link has no button chrome — looks like debug text, not a UI element

---

### 04 · SHOP SCREEN
**Screenshot:** `docs/screenshots/04-shop.png`

| Criterion | Score | Notes |
|-----------|-------|-------|
| SYMMETRY | PASS | Cards are full-width, consistent |
| HIERARCHY | PASS | Booster names are prominent |
| COLOR | FIX | Each row uses a different dark background tone — inconsistent design language |
| TYPOGRAPHY | PASS | Booster names bold at ≥16px |
| JUICE | BROKEN | Zero interactivity feedback — price buttons don't react, no hover/active state |
| CLUTTER | BROKEN | Bottom 40% of screen is empty black — 4 cards fill only half the screen |
| CONSISTENCY | FIX | Price buttons (grey pill with coin icon) are barely readable — dark grey on dark background |

**Overall: BROKEN**

Issues:
- **B-01**: Bottom 40% of shop is empty black dead space — needs content or visual treatment
- **B-02**: Price buttons are dark grey text on dark grey background — contrast fails WCAG
- F-11: Row backgrounds all different shades of dark — unify to one card style

---

### 05 · L1 OPENING
**Screenshot:** `docs/screenshots/05-L1-opening.png`

| Criterion | Score | Notes |
|-----------|-------|-------|
| SYMMETRY | PASS | Road centered, single-lane L1 is fine |
| HIERARCHY | FIX | FTUE tutorial banners cover the road at the EXACT spot where the action is |
| COLOR | PASS | Morning theme (cream sky, green trees) looks great |
| TYPOGRAPHY | FIX | "↑ TIMER Survive until runs out!" and "COINS ↑ Earn by killing cars" are ~10px — invisible on mobile |
| JUICE | FIX | FTUE hand animation good, but cars advance silently with no anticipation effect |
| CLUTTER | BROKEN | FTUE banners stack and overlap road — two banners simultaneously covering the game |
| CONSISTENCY | N/A | Tutorial pass |

**Overall: BROKEN**

Issues:
- **B-03**: Two FTUE banners simultaneously visible, both overlapping the 3D road — player can't see cars while reading instructions
- F-12: HUD tutorial hints (TIMER/COINS labels) are 10px — raise to 13px minimum or remove

---

### 06 · L1 MID-GAME (Gameplay Viewport)
**Screenshot:** `docs/screenshots/06-L1-midgame.png`

| Criterion | Score | Notes |
|-----------|-------|-------|
| SYMMETRY | PASS | Road is centered |
| HIERARCHY | BROKEN | Bottom 30% of screen (shooter columns) is pure black — no background |
| COLOR | PASS | 3D environment looks excellent — morning theme |
| TYPOGRAPHY | FIX | Booster bar labels (SWAP/PEEK/FREEZE/CYCLE/BOMB) at bottom are too small to read at a glance |
| JUICE | BROKEN | ComboGlow is permanently disabled (`comboGlow.update(dt, 0)`) — combo has zero visual feedback |
| CLUTTER | FIX | CYCLE booster has a permanent blue highlight ring — looks like a UI bug |
| CONSISTENCY | BROKEN | Black void below the 3D road breaks visual continuity with the game environment |

**Overall: BROKEN**

Issues:
- **B-04**: Shooter column area (bottom ~35% of screen) is pure black with no background — looks unfinished. The 3D road environment needs to extend or a dark gradient needs to blend the transition.
- **B-05**: ComboGlow permanently disabled — no visual feedback for combos at all. The code comment says it was drawing a "yellow frame" — this needs to be replaced with a better combo effect, not just removed.
- F-13: CYCLE booster always shows a blue outline ring — check if this is intentional or a state bug
- F-14: Booster bar labels are ~11px — raise to 14px

---

### 07 · L2 — SEDAN INTRO CARD
**Screenshot:** `docs/screenshots/07-L2-sedan-intro.png`

| Criterion | Score | Notes |
|-----------|-------|-------|
| All | PASS | Dark purple card, bold white title, orange HP badge, good auto-dismiss timer bar |

**Overall: PASS** — Car intro cards are polished.

---

### 08 · L5 — VAN + AFTERNOON THEME
**Screenshot:** `docs/screenshots/08-L5-midgame.png`

| Criterion | Score | Notes |
|-----------|-------|-------|
| COLOR | PASS | Afternoon theme (deeper blue sky) clearly different from morning |
| CLUTTER | FIX | "New lane open!" FTUE banner at top obscures top of road |

**Overall: FIX** — Same FTUE overlap issue as L1.

---

### 09 · L9 — TRUCK + SUNSET THEME  
**Screenshot:** `docs/screenshots/09-L9-sunset.png`

| Criterion | Score | Notes |
|-----------|-------|-------|
| COLOR | PASS | Sunset orange/indigo sky is visually striking |
| All others | PASS | Theme is distinct and beautiful |

**Overall: PASS** — Sunset theme is the best-looking theme.

---

### 10 · L13 — BIG RIG + MISTY THEME
**Screenshot:** `docs/screenshots/10-L13-misty.png`

| Criterion | Score | Notes |
|-----------|-------|-------|
| COLOR | PASS | Grey overcast creates appropriate tension |
| VISIBILITY | PASS | Cars visible through the fog (fix from earlier session works) |

**Overall: PASS**

---

### 11 · L20 — ALL LANES
**Screenshot:** `docs/screenshots/11-L20-midgame.png`

| Criterion | Score | Notes |
|-----------|-------|-------|
| COLOR | PASS | Autumn amber/gold sky, 4 lanes of colored cars |
| HIERARCHY | PASS | 4 distinct car colors clearly visible |
| CLUTTER | FIX | "NEW! Yellow shooters unlocked!" banner positioned awkwardly at breach line |

**Overall: FIX**

---

### 12 · WIN SCREEN
**Screenshot:** `docs/screenshots/12-win-screen.png`

| Criterion | Score | Notes |
|-----------|-------|-------|
| SYMMETRY | PASS | Centered card |
| HIERARCHY | FIX | NEXT LEVEL button is missing when present — "LEVEL SELECT" is not visually differentiated as primary vs secondary CTA |
| COLOR | PASS | Gold stars on dark — classic win screen look |
| TYPOGRAPHY | PASS | "PERFECT DEFENSE!" headline is bold and readable |
| JUICE | FIX | Stars all appear at once — should stagger-animate in. Coin count shows static final value — should tick up |
| CLUTTER | FIX | Confetti particles are tiny colored squares — looks like placeholder art |
| CONSISTENCY | PASS | Card style matches other overlays |

**Overall: FIX**

Issues:
- F-15: Stars should animate in one-by-one with a pop and sparkle effect
- F-16: Coin reward should count from 0 to final value with a tick sound
- F-17: Confetti is primitive colored squares — upgrade to proper confetti shapes
- F-18: When NEXT LEVEL button is present, it should be primary (green) and LEVEL SELECT secondary

---

### 13 · LOSE SCREEN
**Screenshot:** `docs/screenshots/13-lose-screen.png`

| Criterion | Score | Notes |
|-----------|-------|-------|
| SYMMETRY | PASS | Centered |
| HIERARCHY | PASS | RETRY is the primary CTA, styled with red fill |
| COLOR | FIX | Dark maroon background makes stat values (grey text) very hard to read |
| TYPOGRAPHY | FIX | Stat labels/values (Cars Destroyed, Time Survived, Accuracy) use low-contrast grey on dark |
| JUICE | FIX | No "defeat" feeling — just a static card. Could use a brief screen shake before the overlay |
| CLUTTER | PASS | Clean layout |
| CONSISTENCY | PASS | |

**Overall: FIX**

Issues:
- F-19: Stat text is low-contrast grey on dark maroon — must increase to white or light text
- F-20: Heart display row (♥♥♥♥♥) at bottom of lose screen feels out of place — either remove or give it a clear label

---

### 14 · PAUSE SCREEN
**Screenshot:** `docs/screenshots/14-pause-screen.png`

| Criterion | Score | Notes |
|-----------|-------|-------|
| SYMMETRY | PASS | Centered card |
| HIERARCHY | PASS | RESUME clearly primary (green), QUIT TO MENU clearly destructive (red) |
| COLOR | PASS | Good contrast, appropriate color coding |
| TYPOGRAPHY | PASS | All buttons readable |
| JUICE | FIX | No animation — card just appears. Should slide in or fade in |
| CLUTTER | PASS | Clean and focused |
| CONSISTENCY | PASS | |

**Overall: PASS** — Pause screen is one of the best screens.

---

### 15 · GAMEPLAY (Booster Bar)
**Screenshot:** `docs/screenshots/15-gameplay-booster.png`

| Criterion | Score | Notes |
|-----------|-------|-------|
| HIERARCHY | BROKEN | Booster bar (5 buttons) is crushed into a 60px strip at bottom of 844px screen — virtually invisible |
| COLOR | FIX | CYCLE button has a permanent blue ring that looks like a UI bug |
| TYPOGRAPHY | FIX | Booster labels (SWAP/PEEK/FREEZE/CYCLE/BOMB) are ≤11px |
| JUICE | FIX | No visual affordance that boosters can be tapped |

**Overall: BROKEN** (same as B-04/B-05 above)

---

## BROKEN Items — Priority Order

| ID | Screen | Issue | Impact |
|----|--------|-------|--------|
| B-01 | Shop | Bottom 40% empty black dead space | HIGH — looks unfinished |
| B-02 | Shop | Price buttons: dark grey text on dark grey background | HIGH — unreadable |
| B-03 | L1/Gameplay | Two FTUE banners simultaneously covering the 3D road | HIGH — blocks game |
| B-04 | All Gameplay | Shooter column area is pure black — no background | CRITICAL — looks unshipped |
| B-05 | All Gameplay | ComboGlow permanently disabled — zero combo feedback | HIGH — core mechanic has no feedback |

---

## FIX Items — Priority Order

| ID | Screen | Issue |
|----|--------|-------|
| F-01 | Title | Sky takes 45% screen — PLAY button placement too low |
| F-02 | Title | "Stop the cars!" subtitle 17px → 22px |
| F-03 | Title | 4 different secondary button colors — unify to 2 colors max |
| F-04 | Title | Settings gear icon too small |
| F-05 | Title | PLAY button 240×72 → 280×80 |
| F-06 | Level Select | BACK/SHOP header text 14px → 18px bold |
| F-07 | Level Select | CityBackground visible at top — hide it |
| F-08 | Level Select | Next-level node glow needs stronger pulse |
| F-09 | Level Popup | "OPTIONAL AD BOOSTERS" 11px → 14px |
| F-10 | Level Popup | "← BACK" needs button styling |
| F-11 | Shop | Booster row backgrounds — unify card style |
| F-12 | Gameplay | HUD tutorial labels (TIMER/COINS) 10px → 13px |
| F-13 | Gameplay | CYCLE booster permanent highlight ring — audit state logic |
| F-14 | Gameplay | Booster labels 11px → 14px |
| F-15 | Win Screen | Stars should animate in one-by-one |
| F-16 | Win Screen | Coin count should tick up from 0 |
| F-17 | Win Screen | Upgrade confetti from squares to proper shapes |
| F-18 | Win Screen | NEXT LEVEL = primary CTA styling |
| F-19 | Lose Screen | Stat text contrast too low — go white |
| F-20 | Lose Screen | Heart row purpose unclear — label or remove |

---

## DIRECTOR BUGS — needs separate session

None found during visual audit. All issues are renderer/UI layer.

---

## JUICE Additions Needed (Phase 4)

| Item | Status | Notes |
|------|--------|-------|
| Bomb drag scale-up 1.1x + shadow | MISSING | |
| Bomb wrong-lane red flash + return | MISSING | |
| Car destroy particle burst in lane color | PARTIAL | Basic particles exist, not lane-colored |
| Row bomb cascade stagger 80ms | MISSING | |
| 3x combo screen-edge vignette flash | MISSING | ComboGlow disabled — need replacement |
| 5x+ road pulse with combo color | MISSING | |
| Combo break grey flash + deflate | MISSING | |
| Win stars fly in with sparkle trail | MISSING | Stars just appear |
| Win coin count-up with tick | MISSING | Static final value |
| NEXT LEVEL gentle pulse | MISSING | |
| Title LANE DEFENSE idle shimmer | MISSING | Static text |
| Road car mini-headlights | MISSING | Road car sprites have no headlights |

---

## App Store Readiness Assessment

**Current state: NOT READY for premium positioning.**

The game has strong bones — the 3D road environment looks genuinely good, the morning/sunset/misty themes are distinct, and the core mechanic is clearly communicated. But three things immediately signal "student project" rather than "published game":

1. **The black void below the road** — The shooter column zone is raw black. On any real device, this would feel unfinished. This is the single highest-priority fix.
2. **The shop screen's empty lower half** — A hollow UI signals an unfinished product.
3. **Zero combo feedback** — The combo multiplier (4x!) is the primary skill expression in this game. Permanently disabling all feedback for it means the most rewarding moment in gameplay has no visual payoff.

Fix those three BROKEN items, plus the FIX items, and this game can legitimately sit next to Color Block Jam in the casual puzzle category.
