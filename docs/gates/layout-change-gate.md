# Layout/geometry change gate

Mandatory checks for any change that touches `band` (or `bandForLaneCount`),
active lane count, stage geometry (`APP_W`/`APP_H`/`DESIGN_ROAD_*`), or the
booster bar (`BAR_Y`/`BOOSTER_BAR_TOP_Y`).

## Why this exists

Production `L3-L8` shipped with the bomb queue rendered almost entirely
off-screen (queue Y≈778–947 on an 844px stage) because the "bomb-queue
vertical clipping" item on the Phase 1 sweep was performed as a qualitative
visual scan instead of real math (commit `10e16b7`). Three of four required
checks were done; the fourth — the one that broke — was skipped, and a prose
checklist had no way to make that visible before ship.

A car-size change also previously shipped a real regression (`69e2485`) that
passed vitest, the sim check, and manual renders locally, and only failed in
CI: growing `band` re-zooms the WHOLE ortho frustum (`computeFrustum()` ties
horizontal zoom to vertical zoom to avoid distortion), squeezing the side
panels exactly where the night-world brightness floor is marginal. "Checking
centered content is not enough; edge content is where a horizontal-zoom side
effect bites" (`GEOMETRY_MECHANICS_BATCH.md` §0a).

This gate turns both lessons into a schema
(`layout-change-schema.json`) where every check is a **required property**
with a **computed numeric value alongside its pass/fail** — never a bare
boolean — so a report that skips or fakes a check is structurally impossible
to produce, and a stale value is visible instead of silently trusted.

## Required checks

Derived from the actual incidents and regression tests in this repo, not
guessed. Each maps to a real, previously-shipped failure mode or an explicit
hard floor already enforced in code.

### 1. `carGrowthMultiplier`
How much bigger cars render vs. the shipped 4-lane baseline (`band=540`),
computed as `currentPxPerWu / baselinePxPerWu` — `PX_PER_WU` is
`projection.js`'s single scale export (`zToScreenY(1) - zToScreenY(0)`), the
same "exact formula" method used to derive the documented ~1.109× figure
(`SESSION_HANDOFF.md` §2). Live flood-fill pixel measurement is the
independent cross-check mentioned in the same doc; the schema only requires
the formula value, but re-run the flood-fill check by hand for anything
above the previously-approved ~1.05–1.09× range before setting `pass: true`.

### 2. `panelWidthPx`
Side-strip (city-edge) width in px, per lane count, from
`CityEdges._stripWidths()` / `roadHalfWPure(laneCount)` +
`worldXToScreenX()`. Must stay above `MIN_STRIP_PX` (35px, ~9% of the 390px
screen — `CityEdges.js`). This is the check the car-size regression
(`69e2485`) skipped: band is a whole-frustum zoom, not just a "grow cars"
lever, and it squeezes these strips in proportion to vertical car growth.

### 3. `panelBrightness`
Median pixel brightness of both side strips, sampled at 5 points per strip
and taking the **median** (a single sample point on a repeating tiled
texture is fragile — proven at 6.68–21.53 spread on one band/level,
`tests-visual/smoke/worlds.spec.js`), against the per-world floor: city/
industrial `12`, night `8` (night's art is legitimately darker — reproducible
`10.97`, not flake, per the same file's comments). This is the actual
automated check (`npm run test:visual`) the car-size regression's CI run
caught after everything local passed — the empirical, not just formula-
based, half of the panel-squeeze risk.

Note: the user's brief also named "contrast" — no separate contrast metric
exists in this codebase today; brightness (as above) is the only rendered-
panel-visibility signal that's actually measured. Don't invent a second
number to satisfy the word if one isn't backed by a real measurement.

### 4. `bombQueueVerticalFit`
The regression this gate exists for. Stash slot's (row 3) bottom edge —
`bombSlotScreenY(3) + BOMB_R * PX_PER_WU` — must clear `BOOSTER_BAR_TOP_Y`
(752, mirrors `BoosterBar.BAR_Y`) at **every lane count the game ships (1–4)**,
not just the one being changed (`tests/bomb-slot-position-sync.test.js`).
Growing `band` pushes the breach line — and the queue anchored below it —
down toward the fixed booster bar; past band=730 the queue had nowhere left
to go and rendered off-stage entirely.

### 5. `bombZoneLegibility`
`BOMB_ZONE_SCALE` (solved per-band by `_maxQueueScaleForBand()`, capped at
the approved 0.82 ceiling) must stay at or above `MIN_LEGIBLE_SCALE` (0.45 ≈
10px ball radius / ≈11px digit height — `projection.js`). This is a second,
independent failure mode from #4: a band can render the queue fully on-stage
while still shrinking it below where the HP-badge digits are readable.
`projection.js` already `console.error`s if a band picks a scale below this
floor — this check makes that floor a required, evidenced field instead of
a runtime-only warning nobody reads.

### 6. `simParityByteIdentity`
For any *render*-lever change (band, stage geometry, booster bar — anything
this gate covers), the balance sim must be byte-identical to the
last-recorded-good baseline at L5/L13/L20/L30, 300 runs each
(`node tools/balance-sim.js --level=$l --runs=300`). The sim reads no render
geometry by construction (`SimulationRunner` only imports director/model/game
modules), so if any number moves, the "render-only" change actually touched
something balance-relevant and must stop for investigation before shipping
(`GEOMETRY_MECHANICS_BATCH.md` §0b). Not required for pure content/mechanic
changes (those are allowed to move these numbers, with the table reported to
the user first) — only for changes in this gate's scope.

### 7. `staleConstantSweep`
Grep for hardcoded copies of every constant this change touches, before
assuming projection.js is the only place that needed editing — this bug
class has recurred 8+ times in this project (`GEOMETRY_MECHANICS_BATCH.md`
§0c). Known single sources: `projection.js` (all screen/world math),
`bombSlotZ`/`bombSlotScreenY` (bomb queue), `frontRowTapMargin(gridRows)`
(`roadGeometry.js`). `matchCount` must be `0` — any hit is a real mirror that
will silently drift the next time the canonical value changes, not a false
positive to explain away in the report.

## Report shape

One report = the full current `bandForLaneCount()` mapping and everything
downstream of it, not one lane count in isolation — `band` is already keyed
by lane count in the code (`projection.js`), and a change to that mapping or
its inputs can affect any subset of 1–4 lanes at once. Validate against
`layout-change-schema.json`.

## Running it

```
npm run gate:layout -- path/to/report.json
```

Exits non-zero (and prints every missing/failing field) if the report is
incomplete or any check's `pass` is `false`. **Not wired into CI yet** — run
it manually against a filled-in report before shipping a layout/geometry
change, until the check list itself has been validated against a few real
changes.

## Explicitly out of scope for this gate (for now)

- Mechanic/content changes that don't touch band/lane-count/stage geometry/
  booster bar (goals, spawn budget, `laneTargetCarCount`, booster tuning) —
  those are expected to move the sim numbers and go through the normal
  review-with-a-table process instead, not this gate.
- CI wiring — deliberately deferred (see above).
