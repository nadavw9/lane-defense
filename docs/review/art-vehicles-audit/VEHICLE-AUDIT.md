# Traffic Bomb — Vehicle Visual Audit (Play Store 10/10)

**Date:** 2026-10-25 Asia/Jerusalem  
**Branch for CONCEPT follow-up:** `art/vehicles-polish` (from `origin/master` @ `036fb48`)  
**Quality bar:** Google Play / top mobile store — Royal Match / Toon Blast class (clear silhouette, readable materials, consistent lighting, no muddy placeholders, Toy Town style lock with worlds). **Not** a console / PlayStation bar.  
**Scope:** Design-only. No gameplay / HP / collision changes. No push to master / prod / Vercel.

---

## 1. Inventory

### Bake pipeline (canonical)

| Piece | Path |
|---|---|
| HD vehicle models | `tools/art/studio/vehicles-hd.js` |
| Studio / bake page | `tools/art/studio/studio.js` + `studio.html` |
| Bake script | `scripts/render-3d-sprites.mjs` (`sheet` / `ship` / `v2` / `preview`) |
| Shipped gameplay sprites | `public/sprites/designed/` |
| Geometry table (generated) | `src/renderer3d/carSpriteGeometry.js` |
| Legacy SVG toy vectors (mockups / older path) | `tools/art/vehicles.mjs` |
| Goal-car montage (side-view UI) | `scripts/generate-goal-car-montage.mjs` → `scripts/process-goal-car-sprites.mjs` |
| Legacy 2D cars (still wired in places) | `public/sprites/cars/` |

**How baked:** Vite serves the studio → Playwright opens `studio.html` → Three.js HD models render with shared tilt/lights → PNGs written into `public/sprites/designed/`. Variants decorate the base mesh then frame to the base canvas.

**World skins:** Vehicles do **not** reskin per world. One Toy Town roster across W1–W7; worlds only change backdrops / verges / maps.

### Player-facing families (count)

| Family | Files | Naming | Live consumer |
|---|---:|---|---|
| Base small (bike) | 6 | `bike-{color}.png` | Car3D / intro / goals by type |
| Base big (sedan) | 6 | `car-{color}-processed.png` | Car3D / HUD / goals |
| Base jeep (van) | 6 | `van-{color}.png` | Car3D |
| Base truck | 6 | `truck-{color}.png` | Car3D (ladder / content) |
| Base bigrig | 6 | `bigrig-{color}.png` | Car3D |
| Base tank (color) | 6 | `tank-{color}.png` | Car3D |
| Armored variant | 24 | `armored-{type}-{color}.png` | Car3D specials |
| Speeder variant | 18 | `speeder-{type}-{color}.png` | Car3D specials |
| Chameleon variant | 24 | `chameleon-{type}-{color}.png` | Car3D specials |
| Mender variant | 24 | `mender-{type}-{color}.png` | Car3D specials |
| Volatile variant | 18 | `volatile-{type}-{color}.png` | Car3D specials |
| Boss | 2 | `boss.png`, `boss-armored.png` | Car3D / intro cards |
| Goal-car (side UI) | 6 | `goal-car-{color}.png` | GoalCounterUI **fallback** only |
| Legacy 2D cars | 7 | `public/sprites/cars/car-*.png` (+ boss) | **RaceScreen** (pre-fix) + assetManifest + CarRenderer path |
| Orphan | 1 | `tank.png` (colorless) | Not used by Car3D (replaced by `tank-{color}`) |

**Designed car-like PNGs ≈ 153** (+ 7 legacy under `public/sprites/cars/`).  
Colors: Red / Orange / Yellow / Green / Blue / Purple.

Evidence contact sheets (this review folder):

- `contact-base-types.png` — 6 types × 6 colors  
- `contact-red-roster.png` — red base + goal + bosses + orphan tank  
- `contact-variants.png` — armored / speeder / chameleon / mender / volatile showcase  
- `samples/` — per-asset tiles for close inspection  

---

## 2. Pass / fail vs Play Store 10/10

Legend: **PASS** = ships at Royal Match / Toon Blast class for mobile; **SOFT** = acceptable but room to polish; **FAIL** = below store bar or style break.

| Asset family | Verdict | Notes |
|---|---|---|
| Base bike / sedan / van / truck / bigrig | **PASS** | Clear silhouette, glossy toy materials, shared lighting, consistent scale language |
| Base tank `{color}` | **PASS** | Matches Toy Town; readable tracks + turret; color-match works |
| Armored / speeder / chameleon / mender / volatile | **PASS** | Same bake, readable traits (plow, bolt, roof lamp, cross, barrels) without muddying silhouette |
| Boss / boss-armored | **PASS** | Strong silhouette + hazard language; pink toy body reads premium |
| Goal-car side icons | **FAIL** | Flat SVG side-view; old muted palette; no clearcoat / soft AO; style break vs road Toy Town. Mostly fallback (GoalCounter prefers `car-*-processed`) but still shipped |
| Legacy `public/sprites/cars/*` | **FAIL** | Low-res muddy top-down; jagged edges; was shown on **Traffic Race** card |
| Orphan `tank.png` | **FAIL** (dead) | Olive military paint; style clash; not referenced by Car3D — delete or ignore |

### Top issues (ranked)

1. **Race card used legacy cars** — only remaining high-traffic player surface on muddy art (wired to designed on this CONCEPT branch).  
2. **Goal-car side icons are pre–Toy Town** — flat, wrong palette, weak materials (even if fallback).  
3. **Orphan `tank.png`** — confusing leftover next to the good `tank-{color}` set.  
4. Soft: bike is thinner / less “chrome” than sedan (still PASS). Soft: boss black panels a bit empty. Soft: no per-world vehicle paint (by design).

---

## 3. Recommended first fix batch

1. **RaceScreen:** point racer sprites at `sprites/designed/car-{color}-processed.png` (done on `art/vehicles-polish`; visual wire only).  
2. **Goal-car CONCEPT → ship after approval:** rebuild side-view montage with Toy Town palette + gloss / chrome wheels / soft shadow (`generate-goal-car-montage.mjs` updated on branch), then run process script before replacing `public/sprites/designed/goal-car-*.png`.  
3. **Housekeeping:** stop advertising orphan `tank.png`; remove from pipelines / docs when safe.  
4. Do **not** re-lit or rescale the PASS base/variant roster unless Nadav asks — they already clear the Play Store bar.

---

## 4. CONCEPT sample (weakest offenders)

Started on branch `art/vehicles-polish`.

| | Before | After (CONCEPT) |
|---|---|---|
| Goal car (blue/red) | `before/goal-car-*.png` | `after/goal-car-*-concept.png` |
| Race car (red) | `before/race-car-red-legacy.png` | `after/race-car-red-from-designed.png` |
| Sheet | | `before-after-sheet.png` |

Top row = current weak assets; bottom row = CONCEPT upgrade path (goal = new side-view toy SVG; race = reuse designed sedan).

**Honest call:** Core gameplay vehicles are already **strong** at Play Store class. Do not invent a full vehicle remodel. The gap work is the **legacy race card** + **goal-car fallback icons**.

---

## 5. Out of scope / avoided

- No push to master / prod / Vercel  
- No edits under `ios/**`, AdManager, AudioManager, store scripts (PR20 wall)  
- No HP / collision / ladder changes  
