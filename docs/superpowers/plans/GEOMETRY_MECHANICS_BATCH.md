# GEOMETRY + MECHANICS BATCH — execution spec (Fable exit, 2026-07-19)

Written for an Opus/Sonnet session to execute WITHOUT re-deriving design. Same
contract as FABLE_EXIT_BRIEF.md: these are EXECUTABLE specs (what to build,
which files, how to verify, what NOT to touch) — the design judgment is done.
The user reviews everything before commit (screenshots in docs/review/, review
gate per item, ONE COMMIT PER ITEM). Push → watch to deploy-green with `gh`
(the deploy gate is blocking: `needs: [test, visual-smoke]`).

---

## 0. SETTLED — do not re-open

### 0a. Car size (SHIPPED, commit 69e2485)
- ~1.09× bigger cars via **FIT +0.03** (Car3D.js: 0.78/0.80/0.82/0.84/0.86/0.88,
  ordering preserved, bigrig gap 3.6px) + **DESIGN_ROAD_BOTTOM_Y 540→565**
  (projection.js — viewport zoom; also grew bomb balls 32.1→33.5px).
  **ROAD_Z_FAR unchanged at −26.**
- **THE HONEST CEILING at fixed gridRows is ~1.11×. The levers are exhausted:**
  - Viewport (band) clips the 3rd bomb-queue row behind the booster bar at 575
    (proven by render). 565 is max-safe.
  - FIT caps at bigrig 0.88–0.90 (same-type gap fuses beyond; ordering must hold).
  - ROAD_Z_FAR **backfires**: lengthening the road rescales the whole frustum
    smaller — bombs shrank 32→24px while cars barely grew. Never use it for size.
- **gridRows-based sizing is REJECTED — sim-proven genre break.** Below
  gridRows ~12 the 4-lane flow floods structurally: 0% win even at hp 0.08 with
  goals ×0.25 (you clear one lane per shot while three advance). gridRows 7/8
  are unwinnable AT ANY TUNING. Do not retry.
- **Bigger than ~1.11× ⇒ PROJECT B: bomb-zone redesign** (compact/horizontal
  queue frees road-band pixels; still zero balance cost). Separate UI project.
  **Justified ONLY if device feedback (the user's sister) says ~1.09× isn't
  enough.** Do not start speculatively.

### 0b. The decoupling method (now the standard for any geometry change)
The sim reads NO render geometry (structural: SimulationRunner imports only
director/model/game modules; its only geometry input is `gridRows`). Any
render-lever change MUST ship with the empirical check anyway:
`for l in 5 13 20 30; do node tools/balance-sim.js --level=$l --runs=300; done`
→ must be **byte-identical** to baseline (currently L5 90.0 / L13 79.7 /
L20 43.0 / L30 46.3 @ 300 runs). If any number moves, the lever is NOT
decoupled — stop and investigate.

### 0c. Stale-constant sweep ritual (recurring bug class — 8+ instances this project)
Any geometry change: grep for hardcoded copies of the OLD value before assuming
single-source. Known single sources: projection.js (all screen/world math),
bombSlotZ/bombSlotScreenY (bomb queue), frontRowTapMargin(gridRows)
(roadGeometry.js). Axis separation (from MAP 1): gridRows drives
turns-to-breach + car-sprite pitch scaling; the road-span axis (CELL,
BOMB_ZONE_SCALE, band) drives bomb slots + side-strip width. Don't conflate.

---

## 1. #2 Bomb-grab hit-testing ("wrong bomb grabbed when bombs are close")

**First: re-test on the shipped geometry** — balls are now 33.5px on a 44.1px
slot pitch; the complaint predates this. If it reproduces, the mechanism is
almost certainly:

- `src/input/DragDrop.js` `_hitTestColumn` (~line 773) and `_hitTestQueueSlot`
  (~line 783): both use `HIT_RADIUS = TOP_RADIUS + 14 = 48px` **circles** on a
  **44px pitch** grid → adjacent hit circles overlap by ~52px, and both loops
  are **first-match-wins in index order** (col 0→3, row 0→2), NOT
  nearest-wins. A tap between two bombs grabs the lower-indexed one even when
  the other is closer. That's the bug.

**Fix shape (minimal):** make both hit-tests **nearest-center-within-radius**:
scan all candidates, pick min distance² ≤ HIT_RADIUS², instead of returning the
first hit. Do NOT shrink HIT_RADIUS (48px is the deliberate fat-finger size;
shrinking it trades misgrabs for dead zones). Keep the
`QUEUE_BENCH_BOUNDARY_Y` partition (f225e66) untouched.

**Verify:** headless unit test on the pure geometry (synthetic (x,y) between
two slot centers must select the nearer; boundary ties stable), plus a real-drag
probe via the dev server (pattern: earlier bench-fix verification). Tests that
touch these paths: dragdrop-reorder.test.js, free-queue-action.test.js — keep
green (note #3 below deletes/rewrites some of them; land #2 first or rebase).

---

## 2. #3 Remove bomb-switch ENTIRELY + merges fire ONLY from auto-fill

**MAP 2 finding (verified in code): removing the switch does NOT automatically
make merges auto-fill-only.** The player-merge trigger is separate code with
THREE callers of `GameApp.onReorder → mergeSequencer.start()`:
1. `DragDrop._handleQueueReorder` (the switch — being removed),
2. `DragDrop._handleBenchToQueueReturn` (~line 596: `this._onReorder(-1,-1,col,-1)`
   — "same as queue reorder merge trigger"),
3. the **level-start settle** (`_trySettle` → `mergeSequencer.start()`,
   GameApp ~line 788, settles pre-made opening-board merges).

**Remove (switch mechanic):**
- DragDrop: queue-slot drag-START pickup (onPointerDown ~line 260 block),
  `_handleQueueReorder`, the reorder branch in onPointerUp (~line 350), reorder
  hover highlight (onPointerMove ~line 681 block). Keep `_hitTestQueueSlot`
  itself — bench-return still targets queue columns with it.
- ShooterRenderer: `setReorderTarget`/`clearReorderTarget` become dead — remove.
- GameApp `onReorder` handler: remove `mergeSequencer.start()` for player paths.
- Bench-return: KEEP the return action, DELETE its `_onReorder(...)` call. A
  merge pattern created by a bench-return stays unmerged until the next
  auto-fill (`gameLoop._onAutoFill → mergeSequencer.requestCheck()` — the
  post-shot refill catches it one shot later). That's the intended semantics.
- KEEP: `gameLoop._onAutoFill = () => mergeSequencer.requestCheck()` (the ONE
  merge trigger), the merge engine itself (peekMerges/evaluateMerges), the
  free-queue-action gate for bench-store/bench-return (reorder no longer counts).

> **DECISION-NEEDED (do NOT guess — ask the user before implementing):**
> does the **level-start settle** (trigger 3) stay or go? Stay = a level never
> opens on a pre-made unmerged match (current Candy-Crush-style behavior).
> Go = opening matches sit until the first auto-fill. This is a design call the
> design thread has not made. Present both, get the call, then implement.

**Tests:** delete dragdrop-reorder.test.js; rewrite free-queue-action.test.js
(bench-store/return remain the only queue actions); merge-hardening/
merge-autofill/merge-engine stay (engine unchanged) but grep them for
reorder-driven setups. Update SESSION_HANDOFF "Known Design Decisions" (the
"1 free queue action per shot (swap / bench-store / bench-retrieve)" line and
the merge-trigger description).

---

## 3. #4 Lane-clear reward at two ×3-kill shots

**Counter (MAP 3 confirmed nothing existing isolates 3-kill shots):**
- `GameState`: add `threeKillCount = 0` (declare near multiKillCount ~line 64,
  reset in `resetLevel()` ~line 199).
- `GameLoop._resolveShot`: beside the `kills >= 2` block (~line 301), add the
  3-kill counter; at **2** → reset to 0 and arm the reward.
  - Spec shorthand said `kills===3`; **implement `kills >= 3`** (a 4-kill chain
    is a fortiori a ×3 — exact-3 would feel like a bug when a bigger chain
    doesn't count). If the user intended EXACTLY 3, they'll say so at review.
- **Reward: clear an entire LANE** (all cars top to bottom). Implementation
  template is the BOMB booster row-clear: `GameLoop.placeBombOnRow` +
  `boosterState` charge + DragDrop `bombMode` tap-targeting + refund-if-empty
  (tests: game-loop-bomb-row.test.js). Build `placeLaneClear(laneIdx)` the same
  way: kills apply goal progress per car (`gs.applyKillToGoals`), then the same
  post-clear settle as bombs (`_settleAfterClear` — win can trigger).
- **UI:** tap-a-lane targeting with the **bolded chosen-lane highlight** — reuse
  the existing lane highlight (`DragDrop._showLaneHighlight` / bomb-placement
  glow pattern). Earn popup via popupQueue (multi-kill popup duration is 1.4s;
  match that class of brevity).
- **Color-bomb-from-merges STAYS UNCHANGED** (rainbow from 3 banked
  multi-kills, `MULTI_KILLS_PER_BOMB=3` — untouched; this reward is additive).
- **SIM PARITY (hard requirement, §3b/§3c precedent):** the sim models booster
  earns (freeze/bomb/rainbow) via boosterIQ; add the lane-clear earn+use the
  same way in SimulationRunner, else every band under-reports difficulty relief.
  Then re-run the 4-level check — numbers MAY legitimately move here (this is a
  mechanic, not a render lever); if any level leaves its band, report to the
  user with the table BEFORE committing (same gate as every re-tune).

---

## 4. #5 Side-building sprite (single non-repeating siding)

**Axis check (MAP 1): road-span axis, NOT gridRows.** CityEdges sizes buildings
by `hFrac × ROAD_H` and tiles/repeats per-building sprites — that repetition is
the "crowded" complaint. Replace with ONE full-height siding image per side.

**Exact on-screen geometry (shipped, band 565):** road width ≈ 323px centered
→ each side strip ≈ **33.6px wide × ~576px tall** (y 0→BREACH_LINE_Y≈576;
visible band starts at road top 44 but art should fill to y0 for safety).
Aspect ≈ **1 : 17** — extremely tall.

**Art generation (user runs in ChatGPT, global style prefix from
IMPLEMENTATION_PLAYBOOK §6):** request **1024×1792 (9:16)** — the tallest
ChatGPT output — of a continuous vertical strip of connected building facades,
top-down-adjacent side view, no repetition, one per world theme × side:
`siding-world{1,2,3}-{left,right}.png` → save to `sprite-sources/raw/`.
Because 9:16 ≪ 1:17, the processing step CENTER-CROPS a 1024×1792 source to a
~105×1792 column (matching 33.6:576 aspect) — brief the user that the usable
content is a narrow central column, so the prompt should ask for a "narrow
strip composition, subjects centered in a vertical column".
Processing script (follow scripts/process-goal-car-sprites.mjs conventions):
crop → resize to 128×2192 → `public/sprites/designed/`, add to assetManifest
(STRIP-family), integrate in CityEdges as width-fit cover, **no tiling** (the
single image spans the full strip height). Fallback: existing tiled path stays
for missing sprites (Assets allSettled degradation pattern).

**Verify:** screenshot per world (L7/L20/L35), review gate before commit.

---

## 5. Validation recipe (every item)
`npx vitest run` → visual smoke locally if input/geometry touched
(`npm run test:visual` — note ~50-zombie-chrome cleanup: `npm run browser:kill`)
→ 4-level sim check (byte-identity for render changes; band table for mechanic
changes) → screenshots to docs/review/ (wipe + 00-labels.txt per the standing
workflow) → user review → commit → push → `gh run watch` to deploy-green.

## 6. Open items ledger
- **DEVICE VERDICT PENDING:** sister judges ~1.09× car size on a phone. "Good
  now" → car-size closed. "Not enough" → open PROJECT B (bomb-zone redesign).
- **DECISION-NEEDED:** level-start settle merges stay/go (see §2).
- Near-miss drama + repair-animation feel params: tuned constants, may get
  device-playtest tweaks (timeScale 0.35/0.5s; 0.7s repair pop) — three-number
  changes, not redesigns.
- L20 freeze asymmetry: if device playtest reads too easy, retune DOWN
  (recorded in L20 config comment + SESSION_HANDOFF).
