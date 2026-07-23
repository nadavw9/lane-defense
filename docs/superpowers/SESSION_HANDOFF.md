# Session Handoff — car-size/spacing complaint arc (2026-07-17 → 2026-07-22)

Written for whichever session picks this up next — human or model. There is also a live
Claude Code conversation (Sonnet 5) that did all the work described here and can be resumed
directly if available; it has full working memory of every investigation, every render, every
number below, and can answer follow-up questions about *why* something was ruled out without
re-deriving it. This doc exists so a **fresh** session (no access to that conversation) isn't
starting from zero. Read this before touching `projection.js`, `LevelManager.js`, or any bomb
queue file.

Also read: `docs/superpowers/plans/GEOMETRY_MECHANICS_BATCH.md` (§0 especially — the car-size
ceiling's first-pass history lives there) and `docs/superpowers/FABLE_EXIT_BRIEF.md` (general
codebase traps — note the correction in §3 below, one of its claims is now stale).

---

## 1. The complaint, in the user's words

The user's sister playtests on a real device. Feedback arc:
1. Shipped ~1.04× car-size bump (commits `69e2485` + `8c4eba3` fix) → sister: **"still too small."**
2. Investigated whether the bomb queue could be compacted to free road-band pixels for bigger
   cars (**"Project B"**) → **killed before building**: the aspect-trap coupling means freed
   queue-space still has to go through the same `DESIGN_ROAD_BOTTOM_Y` lever that squeezes
   side panels, and the achievable gain (+2.5%) doesn't move the verdict either way. Full
   writeup: `https://claude.ai/code/artifact/64697215-a7cb-4f23-b5a8-d06537f7f7b8`
3. Investigated two "escape the frustum trap" angles (decouple the panel-brightness gate from
   the frustum; redesign the frustum to zoom vertically without squeezing panels) → **both ruled
   out**, with the math. Full writeup:
   `https://claude.ai/code/artifact/29fe0b0a-b51d-4222-8f99-49e4f2aa992c`
   - Side effect: found the panel-brightness CI gate itself was flaky (fragile single-pixel
     sample on a repeating tiled texture, not a real defect signal) — fixed as its own commit,
     unrelated to car size. **Shipped**: `32956ca`, deploy-green confirmed.
4. Sent sister a plain-language question (not a verdict): "physically bigger" vs. "hard to
   see/tell apart" — because those have different fixes and only one is a dead end.
5. **Her answer: both.** Not big enough AND not spaced enough. This closes off "maybe it's a
   readability problem, not a size problem" — it's genuinely size + spacing, and every cheap
   lever is now proven exhausted.
6. Investigated the one option that attacks the root cause directly: **dropping to 3 lanes**
   instead of 4. Full writeup: `https://claude.ai/code/artifact/0bc574e4-0fca-44e3-a3dc-0aed2c8b3436`
   — **this is the current open decision, described in §2 below.**

**Nothing about lanes, geometry, or level configs has been built or committed.** The only
commits that landed this arc are the Issue-1/Issue-2 render fixes (§4) and the brightness-gate
test fix (§3). Everything else is investigation-only, verified with real renders and real sim
runs, explicitly not built per the user's repeated "propose, render, prove — do NOT build yet."

---

## 2. THE OPEN DECISION — 3-lane feasibility

**UPDATE 2026-07-23 — no longer open.** The user decided: go all-in on 3-lane
(`docs/superpowers/plans/THREE_LANE_REDESIGN_BATCH.md`, Fable exit). Phase 1 (band lookup) and
Phase 2 (L4–L8 pilot retune) are implemented, verified, and approved for commit; L4–L8 are now
3-lane and going to the sister's device. **Two numbers below turned out wrong once actually
measured/executed — read the corrections, don't carry the original numbers into Phases 3–6:**

- **Band is 730, not 680.** 680 (this doc's §2, below) was a demonstration pick, never validated
  precisely — it only delivers **1.25× car growth** against the shipped baseline, short of the
  1.3× target. 730 delivers 1.338× with real margin and passed the actual fixed-median
  brightness sampler. See `THREE_LANE_REDESIGN_BATCH.md` §1's RESULT note for the full sweep.
- **`spawnBudget` is NOT a viable re-tune knob — it's vestigial in the current sim.** §2 below
  lists it among "knobs to re-tune"; that assumption was never verified against the actual
  `SimulationRunner` code. Swept L4's `spawnBudget` 8→48: **zero effect on win rate** —
  `_refillLanes()` tops every lane to `laneTargetCarCount` every advance with no budget gate.
  **`laneTargetCarCount` is the real per-lane density lever** (all 5 pilot levels converged on
  2→4). `speed.base` also has no sim effect (turn-based sim, no real-time component) — matters
  for device feel, not for hitting a win-rate band. See `THREE_LANE_REDESIGN_BATCH.md` §2a's
  CORRECTED step 4a.

Two production bugs were also found and fixed while making band lane-count-keyed: frozen
2D-chrome geometry constants (PositionRegistry/roadGeometry/CityEdges computed once at import
time, back when band was a true constant) and a frozen CameraFX resting camera position that
silently reverted the correct per-level camera Z every frame — this second one made 3-lane
levels render with **zero visible cars** until found via direct Three.js scene inspection. Full
writeup: `THREE_LANE_REDESIGN_BATCH.md` §7a.

The rest of this section is preserved as the historical record of what was known BEFORE the
pilot executed — useful for how the decision was reached, but don't re-derive the band value or
retune methodology from it; use the corrected versions above and in the batch doc instead.

**Bottom line (as of the original investigation, now superseded above): it works geometrically
and is real evidence-backed. It costs a full difficulty redesign of 37 of the game's 40
levels.** The user has not yet decided whether that cost is worth it. This is where the next
session picks up — do not assume an answer either way.

### What's proven

- **Geometry works.** Real render (L13 forced to 3 lanes, band pushed to 680) shows visibly
  bigger cars with panels still intact (47.8px per side — MORE than the shipped 40.7px at 4
  lanes) and comfortably clears the ~1.3× growth target. Confirmed both by direct pxPerWu
  calculation and by an actual screenshot, not a projection.
- **Lane count alone does nothing.** A control render (3 lanes, band left at the shipped 540)
  shows cars at the SAME size as today — just a narrower road and wider panels. The growth
  comes entirely from the band/frustum lever; 3 lanes just removes the constraint that was
  capping how far band could safely go (the 4-lane road's own width hits the 390px screen
  around band≈650-700; a 3-lane road doesn't hit that wall until band≈922).
- **The cost is real and large.** Ran the actual balance sim against real, currently-shipped
  level configs with ONLY `laneCount`/`colCount` changed 4→3 (goals, spawn budget, gridRows,
  everything else untouched):

  | Level | Win% as shipped (4-lane) | Win% naive 3-lane | Delta |
  |---|---|---|---|
  | L5 (FTUE) | 90.0% | 100.0% | +10.0pp |
  | L13 (mid) | 79.7% | 99.0% | +19.3pp |
  | L20 (boss) | 43.0% | 76.3% | +33.3pp |
  | L30 (late) | 46.3% | 90.3% | +44.0pp |

  The swing is large AND non-uniform (10pp at L5, 44pp at L30) — there's no single compensating
  knob. This is the same *class* of finding as the already-rejected `gridRows < 12` sizing
  attempt (§0a of the batch doc) — a structural flood-dynamics break, not a tuning miss.
- **37 of 40 levels are currently 4-lane.** Only L1 (1-lane), L2 (2-lane), L3 (3-lane) — a pure
  tutorial ramp — differ. Making 3-lane "the normal game" touches nearly the entire level
  roster, each level needing individual re-tune + re-verification (spawn budget, goals,
  gridRows, possibly the whole difficulty curve shape per level).
- **The rendering/input layer is NOT the risk.** DragDrop, ShooterRenderer, Shooter3D,
  PositionRegistry, GameLoop, GameState all already key off `activeLaneCount`/`activeColCount`
  (dynamic, set per-level via `setActiveCounts()`), not a hardcoded 4 — proven both by code
  read and by the fact that L1/L2/L3 already run at non-4 lane counts today, live, in
  production. BenchRenderer is intentionally fixed at 4 slots regardless of lane count (a
  shared reserve, not per-lane) — already correct at 3 lanes since it's already correct at
  1/2/3 lanes today. The merge sequencer drives animations via live slot-position queries, not
  hardcoded coordinates. **None of this needs rework.** The entire cost is on the
  balance/content side, not engineering.
- **Mixed lane-count already works technically** (proven daily by L1-L3 vs L4+). Whether to do
  ALL 37 levels or SOME is a product/taste call, not a technical question — a partial rollout
  likely doesn't satisfy "the whole game feels too small," but that's the user's call.

### What's NOT yet decided or investigated

- Whether the user wants to actually commit to this (it's a multi-session content-design
  effort, not a geometry patch).
- If yes: which levels get 3-lane (all 37, or a subset), and what the concrete band value should
  be (680 was a demonstration pick that clears 1.3×+ with room to spare — not yet validated
  against the panel-brightness gate at that exact value, though the brightness-gate fix from §3
  makes that check reliable now; also not yet checked for the same `MIN_STRIP_PX`-clamp /
  road-alignment edge case flagged in the car-size-ceiling report at very high band values —
  band=680 is comfortably clear of where that risk zone started (~560-600 for 4 lanes; the
  3-lane equivalent hasn't been computed but has much more headroom).
- Exact re-tune methodology for 37 levels — likely needs a systematic sim-driven pass (similar
  to how `docs/balance-report-realistic.md` was originally produced), not manual per-level
  guessing. Nobody has scoped how many sim-iteration cycles that actually takes.
- Whether `spawnBudget`/`goals`/`gridRows` are even the right knobs to re-tune, or whether
  3-lane needs a structurally different difficulty model (worth 30 minutes of design thought
  before diving into 37 levels' numbers).

**If the user decides NOT to pursue this**, the honest closing answer (already partially
delivered to the sister) is: cars are at the game's architectural ceiling at 4 lanes; a further
size increase requires the 3-lane redesign above, which is a scoped-but-large content effort,
not something that ships this week. That's a legitimate, evidence-backed stopping point, not a
failure to find a lever — three independent investigations converged on the same wall from
different angles (bomb-queue compaction, brightness/frustum tricks, now the 4-lane width
itself), and the ONE lever that empirically delivers the actual ask (3-lane) has a real,
quantified, large cost attached, correctly surfaced instead of hidden.

---

## 3. Shipped this arc (already live, deploy-green)

1. **Commit `c4ce3b6`** — opening board renders settled immediately (skips the spawn-glide
   animation for the initial deal; mid-play refills after a kill still glide normally). Fixes
   the device-reported "half-cut cars at spawn" bug. Unrelated to car size.
2. **Commit `06eefb8`** — benched merged bombs now route through the canonical bomb-geometry
   source instead of two independent hardcoded copies (wrong texture + wrong size bug). Also
   unrelated to car size; extends `tests/bomb-slot-position-sync.test.js` with a bench-drift
   guard.
3. **Commit `32956ca`** — fixed the flaky night-world panel-brightness CI gate
   (`tests-visual/smoke/worlds.spec.js`). It sampled a single fixed 12px point on a *repeating
   tiled* strip texture; proven (5 points 15px apart at ONE band swung from 6.68 to 21.53
   brightness) that pass/fail was dominated by sampling luck, not real panel state. Now samples
   5 points across the strip and takes the median. **This was a genuine test-quality fix, done
   on its own merits — explicitly NOT a car-size change** (car size is still the shipped
   ~1.04×). Do not conflate this with the car-size question if you see it in git log.

All three: full vitest + full local `tests-visual/smoke` + real `gh run watch` to deploy-green,
per the project's standard validation recipe (§5 of the batch doc).

---

## 4. Key architectural facts worth knowing before touching any of this

- **`src/renderer3d/projection.js` is the single source of truth** for the 3D camera frustum,
  every 2D screen-space anchor, hit-testing targets, and bomb-slot geometry. Never hardcode a
  mirror of anything computed there — this project has been burned by that class of bug at
  least 8+ times (documented in the batch doc §0c).
- **`computeFrustum()` couples horizontal and vertical zoom**: `halfX = halfZe × (width/height)`.
  Growing `DESIGN_ROAD_BOTTOM_Y` (the only lever that grows on-screen car size beyond per-type
  FIT scaling) shrinks `halfZe`, which shrinks `halfX`, which squeezes the side panels — this
  is a fixed-aspect-ratio ortho camera, not a bug, and it's why every "just push the band
  further" idea eventually hits the same wall.
- **The 4-lane road's own width is what actually caps car growth**, not the bomb queue and not
  panel brightness (both were red herrings investigated and ruled out — see §1.2-3 above). At
  4 lanes, `roadHalfWPure(4)=8.4` world units means the road alone fills the 390px screen around
  band≈650-700. This is arithmetic, not tunable without changing lane count.
- **Lane count IS already a first-class, dynamic, per-level parameter** (`activeLaneCount`,
  `activeColCount`, set via `PositionRegistry.setActiveCounts()`), proven by L1 (1-lane), L2
  (2-lane), L3 (3-lane) already running correctly today alongside L4-L40 (all 4-lane). This is
  NOT new infrastructure to build if 3-lane is pursued — it already exists and already works.
- **Car size and lane count are currently decoupled.** Each lane is a fixed `CELL=4.0` world
  units wide regardless of `laneCount` — removing a lane narrows the total road, it does not
  automatically widen the remaining lanes or grow cars. The only way lane-count reduction
  translates into bigger cars is by *then* also pushing the band lever further, now that fewer
  lanes have removed the width constraint that used to cap it.
- **Investigation methodology established this session** (reusable pattern for any future
  render-lever question): temporarily patch the relevant constant (`projection.js`'s
  `DESIGN_ROAD_BOTTOM_Y`, or `LevelManager.js`'s per-level `laneCount`), spin up an **isolated
  throwaway `vite` dev server on a scratch port** (not the main dev server on 5173 — a prior
  attempt that reused one long-lived server via Vite's hot-reload produced non-monotonic,
  unreliable readings; a fresh server process per value is the only reliable approach found),
  screenshot/measure via Playwright, then revert the source file in a `finally` block no matter
  what. Scripts were named `scripts/_*.mjs` and always deleted after use (never committed) —
  this project's convention for throwaway investigation tooling.
- **`docs/superpowers/plans/GEOMETRY_MECHANICS_BATCH.md` §0** has the full history of the
  car-size lever exhaustion prior to this arc (FIT ceiling ~1.04-1.05×, band's "safe range"
  finding, why gridRows-based sizing was rejected). Read it before re-deriving any of this.
- **Correction to `FABLE_EXIT_BRIEF.md`** (dated 2026-07-08): it claims "the sim always
  simulates 4 lanes/4 columns, even for levels that are narrower in the real game." **This is
  now stale** — `balance-sim.js` and `SimulationRunner` correctly consume `cfg.laneCount` per
  level (confirmed directly: the §2 difficulty-swing table above required the sim to respond to
  `laneCount`, which it does). Someone fixed this after the Fable brief was written; the brief
  itself was never updated. Don't trust that specific line if you read it.

---

## 5. Standing project conventions (already in `CLAUDE.md` / user memory, restated for emphasis)

- **Nothing ships without the user's explicit review-and-approve gate.** Screenshots go to
  `docs/review/` (wiped + renumbered + `00-labels.txt` per batch, per the standing workflow),
  or — for larger investigative reports like the three linked above — a published HTML artifact
  with embedded real screenshots (not mockups) is preferred; this session's convention was a
  small self-contained blueprint/technical-report visual style, real data tables, real render
  plates, no invented numbers.
  - Note: `docs/review/` is used as a *scratch* location for staging screenshots before they get
    embedded into an artifact and then deleted — it is not meant to accumulate stale PNGs
    between investigations. It should be empty right now; if you find files in it, they're
    probably leftover from an interrupted run and safe to clean up (check git status first,
    they're gitignored/untracked either way).
- **Empirical over theoretical, always.** Every claim in the three linked reports is backed by
  either a real screenshot, a real sim run, or a real measured value — not an estimate. Several
  findings this arc (the brightness-gate fragility, the road-width hard ceiling) only surfaced
  because something was actually measured instead of assumed.
- **One commit per logical change, full validation recipe before each** (vitest → full local
  `tests-visual/smoke` → sim check if balance-relevant → push → `gh run watch` to REAL
  deploy-green, not inferred from local checks — this project has been burned once by a
  regression that passed every local check and only CI caught, see batch doc §0a).
- **Never leave temp investigation scripts or source-file patches committed.** Every script in
  this arc (`scripts/_*.mjs`) was deleted immediately after use; every temporary edit to
  `projection.js` or `LevelManager.js` was reverted in a `finally` block and confirmed clean via
  `git status` before moving on.
