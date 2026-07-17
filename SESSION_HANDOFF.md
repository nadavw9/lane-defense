# Traffic Bomb — Session Handoff

## ⚡ ACTIVE MASTER PLAN
**`docs/superpowers/plans/2026-07-02-master-plan-testing-ui-difficulty.md`** — three approved workstreams (Testing harness → UI overhaul → Difficulty redesign + City Repair meta). It contains an EXECUTION STATUS checklist that is updated after every step; any fresh session resumes from there. User pre-approved the work incl. commits.

## Current State
- Git tip: aa99253 test: fix two CI visual failures from the board re-layout batch (pushed
  2026-07-13/14 — see "BOARD-POLISH BATCH" below for the full 8-commit summary)
- Branch: master
- Last deploy: green (deploy job GATED on vitest only, per .github/workflows/deploy.yml — this
  is intentional, not a gap: `visual-smoke` is a separate non-blocking observability job, see
  the CI-access note below). Live URL confirmed serving the batch.
- Tests: 1100 vitest (unit+audit) — green. Visual smoke: root cause of the standing CI red
  CONFIRMED via `gh run download` + log inspection (2026-07-14, see WATCH-OUT below) — CI's
  GPU-less runners fall back to software WebGL (SwiftShader), and the game's Three.js scene
  costs enough extra wall-clock per frame there that tests were hitting Playwright's own
  timeout mid-animation. Zero test assertions ever failed (grepped full CI logs — no matches
  for any assertion message); failure screenshots showed the game working correctly (one
  mid-combo, with an achievement toast firing) at the moment the clock ran out. Fixed at the
  budget, not the steps: `playwright.config.js` now sets `timeout: 120_000` on CI (was
  60_000, shared with local) + explicit SwiftShader-WebGL launch flags; `game.js`'s boot()
  had its OWN separate hardcoded 45s wait (`waitForFunction` for `window._nav`), raised to
  90s on CI. Verified locally by forcing `CI=true npx playwright test tests-visual/smoke`
  (exercises the same SwiftShader code path + new timeouts on this machine) — green.
- MERGE SYSTEM: hardened + audit-clean as of b6597d8 (plan==apply by construction; drag/merge
  mutual exclusion; no bomb-loss paths; sparse-array write-site guard).
- ⚠ SIM PARITY BUG FOUND + FIXED (2026-07-10, post-retune): SimulationRunner re-multiplied
  car.hp by hpMultiplier — but CarDirector._buildCar already applies it (since 89e7c67), so
  the sim fought ~half-hp heavy cars (L30 tank: live 11 vs sim 6) and floored hp at 1 vs live
  HP_MINIMUM 2. **ALL pre-fix balance reports — including cf62d8f's "mean 76.9%, all in band"
  and docs/balance-report*.md — were measured against that double-discounting sim and are
  SUPERSEDED. Do not trust them.** Corrected sweep of the deployed configs: mean 54.6%,
  28/40 flagged (live game reads much harder than intended, esp. mid/late heavy-car levels;
  FTUE unaffected — rounding absorbs it on small cars). Regression guard:
  tests/boss-infra.test.js (parity formula + a static audit tripwire on the re-multiplication
  pattern). Cross-check that the parity fix was the WHOLE bug: the biased sim effectively
  simulated hp ≈ mult², and the corrected re-retune kept landing near the square of the
  biased-era values (L17 0.66²≈0.44 → found 0.46) — the two rulers agree.
- BALANCE: parity-fixed RE-RETUNE COMPLETE (user-reviewed) — 26 levels lowered to mid-band
  against the corrected sim; 9 of 10 of the old "untouched in-band" set were false readings
  (all retuned; L9 genuinely in band). Sweep: 38/40 OK, mean 74.8%; only L10 boss + L22 flag
  TOO LONG (L22 at 71.4 turns ruled noise — trim on device if it bothers, not now). Low
  multipliers (0.32-0.58 mid/late) are the honest post-fix numbers — do NOT bump for looking
  low. Bosses all read in 40-55 at corrected measurement BEFORE scripted waves: L10 45.0 /
  L20 47.4 / L30 51.4 / L40 50.2 — §3c waves add the designed challenge while staying in band.
- Master plan: WS1 DONE · WS2 2a/2b/2c + 2d (Title 9-slice button plates + Win/Lose frames) DONE ·
  WS3 §3a canonical table + §3c boss specs (both in GAME_DESIGN.md) + §3b booster-aware sim +
  RETUNE APPLIED (cf62d8f). **§3c scripted bosses COMPLETE (2026-07-16)** — all 4 in the
  40-55 band: L10 41.8% (bef3e6c) / L20 44.2% (7eef483) / L30 48.8% (8b53039) / L40 50.0%
  (1e003e8). WS3 traps/constraints live in `docs/superpowers/FABLE_EXIT_BRIEF.md`.
- Live URL: https://nadavw9.github.io/lane-defense/

## ✅ CI-ACCESS GAP RESOLVED (2026-07-14): gh CLI now installed + authenticated
Previously: no `gh` CLI, no `GITHUB_TOKEN` — GitHub's Actions logs/artifact-download endpoints
returned 401/403 unauthenticated, so a red `visual-smoke` job couldn't be diagnosed from this
environment (had to infer from local runs only). **Fixed this session**: `gh` installed via
`winget install --id GitHub.cli` (lands at `C:\Program Files\GitHub CLI\gh.exe` — not on PATH
in already-open shells until they restart; call it by full path, or open a fresh shell), then
`gh auth login --hostname github.com --git-protocol https --web` (device-code browser flow,
authenticated as `nadavw9`). Check `gh auth status` first — the token persists on this machine,
so a fresh session may already be authenticated. With `gh` working: `gh run list --branch
master --limit 5`, `gh run view <id>`, `gh run view <id> --log-failed`, `gh run download <id>`
all work directly — this is how the SwiftShader-timeout root cause (above) was actually
confirmed, not inferred. Still worth running `npx playwright test tests-visual/smoke` locally
too when in doubt (fast, no auth needed) — but CI can now be inspected directly when a local
run doesn't reproduce something.

## ⚠ WATCH-OUT: recurring bug class — stale hardcoded copies of a moved source of truth
Board-polish batch fixed a recurring bug class — hardcoded values left stale after their
source of truth moved to a derived constant (bomb-slot position ×3 copies, merge scale 1.30
vs `MERGE_SCALE`, terminus cap `ROAD_Z_FAR` vs `computeFrustum().topZ`, HP double-discount,
car variant framing). Guard test added for bomb-slot sync. When changing any
geometry/scale/position constant, grep for hardcoded copies of the old value — more
stragglers may exist.

**Extended (2026-07-14): the pattern reaches into TESTS too.** A 4th hardcoded copy of the
bomb-slot position surfaced post-push, in `tests-visual/smoke/boundaries.spec.js`
(`COLUMN_TOP_Y = 552`, itself an admitted approximation — `≈ PositionRegistry
COLUMN_TOP_Y+8` — even before this batch). The re-layout moved the true value to ~585,
eating the test's hit-radius margin from ~40px down to ~15px; still inside the hit radius
(the underlying drag mechanism was never broken — verified with a live manual drag on the
running game, not just a re-run test) but thin enough to intermittently time out under CI
load. Fixed by pointing the test at `pos.slotY[0]` (`getPositions()`, backed by the same
canonical `bombSlotZ` source) instead of a second hardcoded number. **When collapsing a
duplicated constant to one source of truth, grep test files too — a magic number in a test
is the same bug class as a magic number in game code, just harder to notice because the
test still passes most of the time.**

## ⚠ CORRECTION (2026-07-14): "rapid-hop passes on solo/retry" was the wrong mental model
This project's own `Current State` line long described the visual suite's flakes as
"occasionally flaky under parallel load, passes solo/retry" — implying a render-timing race
that clears itself on a second attempt. A real CI run (id 29289038652, downloaded and
inspected via `gh run download`) showed `rapid level hopping (L5→L20→L35) never leaves a
dead board` failing its INITIAL attempt AND its retry, both times with the identical
`Test timeout of 60000ms exceeded` (not a render-state assertion). The actual mechanism is
wall-clock budget under SwiftShader software WebGL (see the resolved CI-ACCESS GAP entry
above) — a fixed 60s/45s ceiling tuned against real-GPU timing, not flaky rendering state. A
retry doesn't reliably help because the SAME slow rendering happens again; it only "passes on
retry" when the runner happens to be under lighter load that attempt. Now fixed at the root
(CI timeouts raised in `playwright.config.js` + `tests-visual/fixtures/game.js`) rather than
relying on retries to paper over it.

## ✅ WS3 §3b RETUNE — DONE (2026-07-10). Next: §3c bosses.
The booster-aware retune landed against corrected post-merge-fix numbers (profile: skill=average,
boosterIQ 0.70). Bands now live in `tools/balance-sim.js` (`bandFor`): tutorial L1-3 win%-exempt
(~100% correct — L3 has no losing mechanism at brisk HP: 3 lanes/2 colors; the tutorial→game
transition marker is L4 at 92.2%) · FTUE L4-9 85-95 · mid L10-26 70-82 · late L27-40 60-75 ·
bosses 40-55 flagged `BOSS §3c`, configs untouched. TOO LONG threshold 25→70 turns (goal-driven
levels legitimately run 35-55). Post-retune sweep: 4/40 flagged (the 4 deferred bosses only),
mean 76.9%. 24 levels changed via per-level INLINE worldConfig (shared presets never edited;
orphaned presets deleted). Bosses L10/20/30/40 get their numbers WITH the §3c scripted waves.

## What Was Shipped This Session (most recent first)
- **§3c COMPLETE — all four bosses now deliver their DESIGNS in play, not just in band
  (2026-07-16, e17eb39 + f225e66 + ec52a19).** Hands-on playtest of all four (tool-less,
  real board states) was the gate:
  - **L10 v2 (e17eb39)** — playtest proved v1's board-cluster premise structurally
    undeliverable (2 colors × 4 lanes: zero locked states in 16 turns; bench never
    needed). v2 moves the lock into the QUEUE: `shooterColorWeights: {Blue:3, Red:1}`
    on a Red goal via new `ShooterDirector.setColorBias` (overdue floor + FR-1/FR-5
    keep the scarce color trickling — scarcity, never starvation; parity by
    construction across GameApp/SimulationRunner/balance-sim). 42.4% @ 500 runs.
    **Bench gate passed: benched unprompted 3-of-4 turns; re-play after the input fix
    benched 3/3, each exposing a red.** Monotonic-knob sim test is now the standard
    (none 46.0 → 3:1 44.0 → 10:1 38.0 → 50:1 34.0).
  - **Bench drop-zone fix (f225e66)** — the row-2 queue slot's 48px hit circle reached
    ~24px into the visible tray and reorder resolves first → releases in the upper
    two-thirds of the tray were SILENT reorders (fatal for L10's named solution).
    Fixed by partition, not reprioritization: one derived boundary (≈694.5, midpoint
    of the row-2 ball's bottom edge and the tray's top edge, from projection
    constants). ⚠ Deliberate behavior change: a reorder released >5px below the row-2
    ball's visual bottom now snaps back instead of landing — explicit bounce beats
    silent misfire.
  - **L20** in band (44.2%); crests read loudly in play (board swings 9→12 in one
    advance) but clean play never needed freeze — the recorded freeze asymmetry is
    real, expect device playtest to say "too easy" and retune DOWN.
  - **L30** — best of the four: the tank wall forces genuine multi-shot planning
    immediately (screen-kill → wound 6→2 → finisher-with-carry executed as planned).
  - **L40** — beat the tool-less playtest at turn 16 in stage 1 (correct for a 50%
    booster-aware finale); loss-skew verified 63% stage-3. Note: staging is
    progress-keyed, so struggling players stay in the bike swarm — the three-act
    structure is a reward for surviving act one; boosters are the intended valve.
  - **Bug D (ec52a19)** — dedicated goal-card color icons (stylized side-view sedans,
    consistency by construction: all six 256×123 @ (127.5,127)); pill now reads
    "destroy N of this color", not "bomb this specific car".
- **`b0c351a` Nightly sampler fix — all-levels car-render check counts strong pixels,
  not region means.** The first nightly after L40 landed failed `L40: boots primed and
  renders cars` on BOTH attempts; the game was fine (CI failure screenshot showed all
  12 seeded bikes rendering). The 12px MEAN-color metric was latently near-failing:
  measured on a real GPU, 3 of 4 L40 lanes sat below the 28 threshold (22-26), one lane
  at 45.7 carried the test, and CI SwiftShader dropped that too. New metric: count
  pixels >80 L1-distance from the road-box mean, lane passes at ≥8 — bikes measure
  23-39 strong pixels, road boxes 0 (real separation, not a loosened threshold).
  **Same recurring theme as the stale-consumer bugs: a metric tuned against one shape
  (wide cars) silently degraded for another (narrow bikes) and only surfaced when a
  config finally stressed it — L40's all-bike opening was the first.** Fixture gained
  additive `strongPixelCount()`; smoke specs untouched. Local full sweep with new
  metric: 39 passed + L15 boot-timeout flaky (known class).
- **§3c SCRIPTED BOSSES — ALL 4 DONE (2026-07-15/16): L10 41.8% / L20 44.2% / L30 48.8% /
  L40 50.0%, all in the 40-55 band.** Each review-gated: sim at --runs=500, board
  screenshots presented, committed only after explicit approval. One boss per commit.
  - `1e003e8` **L40 "Grandmaster Finale"** — INFRA-C 3-stage gauntlet + INFRA-A all-bike
    opening seed: bike swarm (0-33%) → truck wall (33-66%) → tank+bigrig pincer (66-100%).
    hpMultiplier 0.51→0.64, 50.0% at 500 runs. **Loss timing verified, not just win rate**
    (the spec's own criterion): 63% of losses land in stage 3, 24% stage 2, 13% stage 1
    (`scripts/_l40-loss-timing.mjs` probe). The goal shape (Red:4/bigrig:1/truck:1)
    forces play through all 3 stages — bigrig goal needs stage-3 spawns.
  - `cc105ca` **Crash fix + config-shape audit (recurring bug class, again)** —
    `GameApp._levelCarTypes` (car-type intro scanner) iterated spawnScript `weights`
    with for...of as if bandWeights-style arrays; they're `{type: weight}` OBJECTS
    (CarDirector's Object.entries shape). L40 is the FIRST config carrying spawnScript
    weights, so the branch never ran before — crashed level start. New audit test scans
    all 40 levels' spawnScript/initialCars shapes so drift fails in vitest, not runtime.
  - `bef3e6c` **L10 "The Bench Test"** — INFRA-A scripted opening: lanes 0/2 all-Blue,
    1/3 all-Red, 3 rows each; bench-the-mismatch is the designed solution. 41.8% first
    try, no tuning needed (the scripted design carries the difficulty). AvgTurns 70.2
    trips the >70 heuristic by 0.2 — ruled baseline-plus-goals, not pathology (same
    call as L22).
  - `7eef483` **L20 "The Surge"** — first live use of INFRA-C's `rate` field: 7 stages
    alternating crest (rate 3) / lull (rate 1), no per-stage weights. hpMultiplier
    0.78→0.90, 44.2% in band. Parity proven comparatively: the real crest/lull script
    scores ≥ an all-crest variant in the sim (rate isn't silently ignored), plus exact
    rate-sequence and GameLoop._refillLanes stage tests.
  - **⚠ L20 FREEZE ASYMMETRY (also in the L20 config comment):** hpMultiplier 0.90 is
    higher than neighbours because the naive sim clears the surges WITHOUT using freeze
    (62.6% at 0.78). Freeze-on-a-crest is L20's designed solution, so real players who
    use it may find L20 easier than the 44.2% sim figure suggests. If device playtest
    reads too easy, that's the expected direction — retune down rather than assuming
    the sim is wrong.
  - Also: visual-smoke flipped to a blocking deploy gate (`7687656`, `needs: [test,
    visual-smoke]`) — verified live: run 29437681272 had deploy start only after both
    jobs finished green.
- **BOARD-POLISH BATCH (2026-07-13/14, 8 commits, aa99253) — bomb queue clarity + full
  re-layout + 4 bug fixes + CI test fixes.** Pushed and deploy-confirmed green (vitest gate);
  visual-smoke verified via repeated local runs (see CI-ACCESS GAP above), not CI inspection.
  - `4695482` **Bug A** — car-type intro card now fires exactly once per type EVER, at level
    start only (was re-showing mid-level on every refill; `ProgressManager.introducedCarTypes`
    persisted + migrated/backfilled from progression for existing saves).
  - `eff01b8` **Car sprite variant normalization** — color variants (truck/bigrig/van/sedan)
    were sliced inconsistently from source montages (up to 19% off-center, some literally
    cropped with ghost fragments of neighbouring cars); re-sliced from raw art, all colors now
    match red's framing. `scripts/normalize-car-variants.mjs` committed as reusable provenance.
  - `9d9e9e2` **Bug B** — car size/spacing now derived per-type from the projected row pitch
    (`Car3D.spriteScaleFor`, `BODY_FRAC` measured via `scripts/measure-car-bbox.mjs`) instead
    of one global scale — fixed cars touching/overlapping and inconsistent sizing.
  - `857a551` **Bug C + full board re-layout (B=0.82)** — the big one. Bomb badge/number
    rendering fixed at the root (canvas sized to true on-screen resolution, was mip-minified
    ~8x; digit cap height raised to ~54% of ball diameter, match-3 standard; ACES tone mapping
    skipped for badges so digits stay pure white). **Collapsed THREE independent copies of
    "where is bomb slot N"** (Shooter3D's own formula, a hand-mirrored duplicate in
    PositionRegistry, hardcoded pixel constants in ShooterRenderer that DragDrop hit-tested
    against) into ONE canonical `bombSlotZ()/bombSlotScreenY()` in projection.js — this was
    the root cause of the ball/socket/touch-target desync. New `BOMB_ZONE_SCALE=0.82` shrinks
    the whole bomb queue (ball/badge/pitch/clearance, one constant); `DESIGN_ROAD_BOTTOM_Y`
    510→540 grows the car viewport ~5.9% (uniform across all car types). New guard test
    `tests/bomb-slot-position-sync.test.js`. Approved on real-device tap test at this ratio.
  - `601e1ac` **Merge "shrink then return" glitch** — the merge-sequencer's pop-in spring
    animated toward a stale hardcoded 1.30 scale peak that no longer matched the resting
    `MERGE_SCALE` (1.22) the previous commit established; fixed to reference the same
    constant. Verified via a frame-by-frame scale trace: settles to exactly 1.22, holds
    steady, zero dip.
  - `cddbbe8` **Post-clear respawn visibility** — Road3D's decorative "terminus" barrier was
    hardcoded at `ROAD_Z_FAR` (predates `SPAWN_VIEWPORT_EXTRA`, which exists specifically to
    keep spawning cars visible past that point) — it sat on top of the car spawn line, most
    visible when a full-board clear (e.g. a color bomb) respawned every lane at once.
    Investigated first (confirmed normal refill and post-clear respawn use the IDENTICAL
    row-0 placement — never two diverging paths); fixed by repositioning to
    `computeFrustum().topZ`, no new constant. Sim parity confirmed clean by construction
    (zero Road3D references anywhere in GameLoop/GameState/SimulationRunner).
  - `aa99253` **Two CI visual-smoke failures, both diagnosed not masked** (diffs prove no game
    code touched): a 4th stale hardcoded bomb-slot copy in a test (see WATCH-OUT above), and a
    world3 (night) panel-brightness threshold that had never been validated against night
    world's genuinely darker art (per-world threshold now: city/industrial 12, night 8 — panel
    confirmed rendering via screenshot, not loosened blind).
- Multi-kill celebration popup shrunk ~35% (`_buildMultiKillPopup`: burst R 138→90, kill-count
  78→50px, label 23→16px, offsets proportional) — it dominated the lower board. Tier colors,
  ring, and spring pop unchanged. Review shot docs/review/03.
- **Goal-card color icons are now car sprites.** `GoalCounterUI` destroyColor goals show the
  standard car sprite in the goal's colour (`car-{color}-processed.png`) instead of a flat
  colour circle (circle kept as fallback); destroyType icons fixed to per-type sprites
  (small→bike, big→car-processed, jeep→van — the old map pointed small/big/jeep at a
  nonexistent `car-red.png`, latent because no level ships those goal types). New
  `GOAL_ICON_URLS` family in assetManifest (audit-covered, cosmetic tier; includes
  TITLE_INTRO_CAR_URL so it left ALL_SPRITE_URLS' standalone entry). Sizing via Assets.get
  (lazy Sprite.from sized itself against a 1×1 unloaded texture). Review shots:
  docs/review/01 (L8 green+red cars), 02 (L28 yellow car + red truck). 1076 vitest +
  17 visual smoke green.
- **WS3 §3b BOOSTER-AWARE RETUNE (all 40 levels in band).** Measured baseline first (mean 83.6%,
  30/40 flagged vs new bands), then HP-primary one-direction retune: 22 HP raises as un-shared
  inline `worldConfig` (R_3C_MED un-shared across L11/14/18 etc.), L8 the sole DECREASE
  (1.08→0.86 — pre-fix overcompensation), L6 goal-count cut Red:40→22 (grind fix: 116.7→64.7
  turns, hp untouched), L3+L4 solved with hp 0.90 + goal trim 30→26 (user rejected the 1.30/1.12
  first pass as too grindy-per-car; L3 declared tutorial-exempt — no losing mechanism at brisk HP,
  L4 is the transition at 92.2%). Every change binary-searched + sim-verified at --runs=500
  (seed-deterministic, so projected == final). `tools/balance-sim.js` bands restated to the
  average+boosterIQ0.70 profile; 35 orphaned preset consts deleted (grep-verified unreferenced).
  Final sweep 4/40 flagged (deferred bosses only), mean 76.9%. 1076 vitest green.
- 9770c20 — **CRITICAL MERGE FIX (DEFECT 1 + DEFECT 2).** Merges now fire on mid-game auto-fill.
  Previously merge detection ran ONLY on player actions (swap/bench/fire) + the level-start settle,
  so a 3-same-colour line formed by an auto-fill (post-fire refill in `_advanceGrid`, bench refill in
  `_step`) sat UNMERGED until a player move re-triggered it — and when it did fire, the slots refilled
  INSTANTLY (teleport) instead of the built cascade. Both fixed with ONE `_onAutoFill` director→renderer
  signal: `GameLoop` fires it once per shot (end of `_advanceGrid`, normal + FREEZE exits) and once per
  real queue-growth tick in `_step` (before/after count — covers the latent **bench-store** bug, silent
  on steady-state ticks); `GameApp` routes it to the SAME `mergeSequencer.start()` the player path uses,
  so merge POSITION (vertical→top / horizontal→middle), `isMerged` exclusion (no merge-stacking), and the
  2-pass cascade are inherited from ONE path. Race-guarded: `requestCheck()` + `_pending` re-check in
  `_finish()` so a signal arriving mid-animation is evaluated AFTER the current sequence (not dropped →
  would re-introduce DEFECT 1; not overlapped). Investigated with a 3-agent team (merge-engine /
  queue-fill / animation-sequencer). 7 new tests (`tests/merge-autofill.test.js`, incl. a bug-repro
  control that proves the line stays unmerged without the wiring). Cascade proven by screenshot
  (`docs/review/20-merge-*`: merged "18" bomb with visibly EMPTY slots → staggered drop-in). 1069 vitest
  + 17 visual smoke green. No HP/goal/balance changes. Dev hook `_nav._fx.mergeAutoFillDemo` added.
- UI ICON SET (§2c) — **DONE across all screens.** User's 20-icon art arrived as one 4×5
  montage (`sprite-sources/raw/split/20icons.png`); `scripts/process-ui-icons.mjs` gained a
  montage-slicer (largest-blob cleanup kills neighbour bleed) → 20×128px transparent PNGs in
  `public/sprites/ui/`. `UIIcon.uiIcon(name,size,emoji,{flipX,tint,emojiFill})` (emoji glyph
  fallback; `back` ◀ flips to serve `next` ▶). Swapped emoji→sprites one commit per screen:
  HUD (trophy/book/hearts), Title (gear/PLAY/daily/trophies/stats/achievements/streak),
  LevelSelect (star rating/weekly/skull/coin/START), Win/Lose (share/hearts), and the rest
  (Settings/Shop/Daily/CarManual/CarTypeIntro/Onboarding/HpGuide/HowToPlay/FTUE/Tutorial).
  `_addPillBtn`/`_addBtn` gained composed [icon][label] support. Deferred as glyphs (noted in
  playbook §2c): mixed-helper sets (Settings section labels, Pause button), booster legends
  (need booster sprites, not generic icons), baked-in-string emoji (Stats values, floating
  text/toasts, Win/Lose stat panels). Batch 1b icon wishlist logged (explosion/snowflake/
  lightning/car/speaker). Review shots: docs/review/{01-hud,02-title,03a/b-levelselect,
  04a/b-win/lose,05-settings/shop/daily}.png + ui-icons-sliced.png contact sheet.
- 5f0b8ac — **UNIFIED WORLD SCENES (user: "amazing").** User generates ONE full-screen scene per world+variant in ChatGPT (9 scenes: 3 worlds × a/b/c); `scripts/process-scenes.mjs` auto-detects the road band + dispatch-zone edge and slices each into 4 palette-unified surfaces: side strips (width-fit + vertical tile — buildings can never be sliced), per-world ROAD TILE (lane dash painted programmatically; world3 = night-blue road), and a dispatch-zone floor rendered as a **3D plane UNDER the bomb spheres** (`Road3D._buildZoneFloor` — key lesson: a Pixi floor occludes the 3D bombs, front canvas covers back). Variants rotate per level (`sceneVariantForLevel`). Bomb tray moved fully below the breach stripe + rim-only slot sockets (filled Pixi shapes would paint over bomb faces). Visual specs upgraded to color-distance car detection (tinted roads). Art-direction rules encoded in `docs/superpowers/plans/ART_BATCH_S_PROMPTS.md`: decor must RECEDE (calm big shapes, muted, ~30% runtime dim), saturation reserved for gameplay, one palette per scene.
- f647f5f — UI icon pipeline scaffolding (`UIIcon` helper + `scripts/process-ui-icons.mjs`) awaiting Batch-1 icon art (playbook §6).
- 2ade16c — WS2-2a audit fixes: textured bomb-queue tray, shop denied-tap toast+shake+compact banner, ComboGlow verified WORKING (audit was stale).
- 88dcd76/9ab1fb7/6e78a2b/e178aaa/4d0bfe9 — **WORKSTREAM 1 COMPLETE: test harness.** (1) CI now GATES deploy on the vitest suite + runs a Playwright visual-smoke job on every push (non-blocking week 1) + a nightly all-40-level sweep. (2) Static audit tests (suite 778→1062): asset manifest exact-case/gitignore audit (`src/renderer/assetManifest.js` extracted from GameApp), level-config validity (goal colors ∈ palette, destroyType spawnable), deterministic balance smoke (60 runs/level, wide bands). (3) Playwright harness (`tests-visual/`, `npm run test:visual`): 17 smoke specs across L1/L2/L3/L5/L20/L35 — lane geometry, real pointer-drag deploys, level-transition state resets, HUD rect containment/overlap, world panels — every test auto-fails on console.error/404 (tripwire fixture). New `_nav` hooks: `getPositions/getHudBounds/winLevel/getFrustum`. (4) **The harness found a REAL live bug on its first run**: `FRUSTUM_HALF_X = 9.650` (stale mirror from the ROAD_Z_FAR=-22 era; true value 11.237 since the road extension) had every 2D overlay/tap anchor ~17px off at the outer lanes. Fixed by extracting the camera formula to `src/renderer3d/projection.js` — PositionRegistry/roadGeometry/CityEdges/ShooterRenderer now DERIVE from it (side strips corrected 35→49px, which also makes the world panels show whole building fronts; breach stripe aligned to the true 3D breach line; tap→row mapping matches real car positions). Break-it demos verified: case-renamed sprite, off-palette goal color, and a drifted registry constant each trip a test.
- 3f58354 — Title screen polish: logo dark backdrop strengthened (0x000000 α0.65, 30px padding on all sides) so the TRAFFIC BOMB logo reads over the busy AI city background; the "Stop the cars!" subtitle removed. World side panels decoupled from the global `spriteFlags.loaded` flag — `CityEdges._draw` now gates the world panel only on `this._worldPanel` + the panel texture's own availability (checked in `_addWorldPanel`), so a failure of any unrelated critical sprite can no longer blank the panels. Investigation confirmed there is NO per-level/lane/config gate — all 40 levels render their world panel (verified by a 40-level brightness scan + visual checks; the one scan anomaly, L4, was the "New BENCH" FTUE overlay, not a missing panel). 778 tests unchanged.
- 92bc6a1 — AI-generated title screen: ChatGPT/DALL-E city background replaces the sky gradient. Canva-generated Traffic Bomb logo replaces the programmatic gradient text. Road band removed (redundant with the background). Logo + PLAY button + all secondary buttons remain. (Also carried the prior title polish: real-sprite intro bomb-drop that reveals PLAY, PLAY golden glow ring, and the styled loading screen — the latter in GameApp under 0a33599's preload wiring.)
- 0a33599 — AI-generated world side panels: 3 worlds (city L1-13, industrial L14-26, night L27-40) each have left/right panel sprites generated via ChatGPT/DALL-E (`public/sprites/designed/world{1,2,3}-{left,right}.png`). `CityEdges._addWorldPanel` uses cover-crop (scale to fill the strip at natural aspect, anchored to the outer edge, masked to the strip) so building proportions stay natural on narrow 4-lane strips instead of squishing. `worldPanelForLevel(levelId)` selects the world; assets added to the GameApp preload manifest (`TITLE_ART_URLS` + `WORLD_PANEL_URLS`). Reusable `scripts/process-ai-backgrounds.mjs` processes the raw art (bg cover→390×844, logo dark-bg flood-fill→≤350×200, panels→95×844). 778 tests unchanged.
- 7e385f3 — Tutorial how-to-play slides now show real gameplay screenshots instead of the inaccurate looping PixiJS demo animations. 4 captures from L22 (`public/sprites/tutorial/`): `01-goal` (goal counters + cars + queue), `02-shot` (a bomb mid-drag up a colour-matched lane — bomb below, cars above), `03-merge` (3 same-colour bombs stacked in a queue column, pre-merge), `04-boosters` (booster bar with COLOR/FREEZE/BOMB charged). Auto-captured via dev hooks (`startLevel(22)`, a real held pointer-drag, `_fx.mergeSetupVerticalKeep()`, `setBoosters`). `HowToPlayOverlay.js` now loads a static `Sprite` per slide (same pattern as HpGuideOverlay) — removed the dead `ANIMS`/ticker animation loop; dots/title/body/✕/→ unchanged. Images added to the `GameApp` preload manifest (`TUTORIAL_URLS`, cosmetic tier — overlay degrades to a blank frame if one fails). 778 tests unchanged.
- dbd7917 — Spawn refill fix + boss re-tune:
  * **Spawn refill fix** — every active lane now fills to `laneTargetCarCount` each advance. The old `_refillLanes` added at most one car per lane per advance and the `row < 2` spawn-zone throttle could leave a drained lane below target (often at 1, briefly 0) for several advances — most visible on 2–3 lane levels (L2/L3), which is what the "some lanes stay empty" report was. NOTE: the refill already iterated `gs.activeLaneCount` (never hardcoded 4) and was identical on 2- and 4-lane boards — the defect was the per-advance cadence/throttle, not lane iteration. Each new car is placed at the lowest unoccupied spawn row (0,1,…) so multiple fills don't stack; `Lane.addCar` re-sorts by position so the front-car invariant holds. `GameLoop._refillLanes` and `SimulationRunner._refillLanes` kept **byte-aligned** (sim sorts its plain-object lanes descending by row so `cars[0]` stays the front car) — so the sim remains the difficulty ground truth.
  * **L30/L40 boss re-tune** — the denser refill added breach pressure and pushed both bosses just out of the 20–30% band (L30 21.2→19.0, L40 21.0→16.0). Re-tuned: **L30 `Purple:5, bigrig:1` (25.6%)**, **L40 `Red:4, bigrig:1, truck:1` (22.4%)** — both back in band (L40 flagged OK).
  * **Mean win rate stable at ~61%** across 40 levels (was 62.0% pre-fix; within run-to-run noise, still in the 40–65% band). Mid/late levels unchanged (41–58%); FTUE untouched.
  * **+5 spawn-refill tests** (`tests/spawn-refill-active-lanes.test.js`): both active lanes refill to target; inactive lanes 2–3 untouched (no hardcoded 4); all 3 lanes of a 3-lane level get cars (not a random subset); a drained lane is topped up in one advance with the front-car invariant intact; new spawns occupy distinct rows. Suite 773 → **778**.
- aa816b9 — Full balance pass (VISION.md non-negotiable — rule 6 balance sim must pass before Play Store):
  * `SimulationRunner` now models the real per-level goals — wins when every `goalProgress` entry hits 0 (mirrors `GameState.applyKillToGoals`/`isGoalMet`), loses on breach, never on budget exhaustion; cars spawn infinitely (density-only `spawnBudget`). MAX_TURNS safety cap 3000.
  * Base HP reverted to sensible values (small 2 / big 4 / jeep 5 / truck 7 / bigrig 11 / tank 20) after the ×1.5 gridRows-16 bump overshot (tool-less win ~6%); `HP_BASE.max` 30→20.
  * Global `hpMultiplier` ×0.6 applied to ALL `worldConfig` presets in LevelManager.
  * L15 inline `hpMultiplier` fixed 1.30→0.78.
  * L4 `hpMultiplier` fixed 1.80→0.90 (outlier).
  * L19 config bug fixed — goal colour Yellow→Blue (Yellow was not in L19's palette, making the level unwinnable at any count).
  * Per-level goal counts tuned for 24 levels (L8, L10, L15, L16, L18, L20, L22–L29, L31–L39) into the 41–58% band.
  * Boss goals redesigned: L30 → [Purple:6, bigrig:1], L40 → [Red:5, bigrig:1, truck:2] — the old tank goals were unreliable (tank too rare to kill 3 of before a breach; both bosses sat <1%). Now 21.2% / 21.0%.
  * Result: mean 62.0% tool-less win rate across 40 levels — bosses 20–30% (L10 23.4 / L20 25.2 / L30 21.2 / L40 21.0), mid/late 41–58%. New `tools/goal-search.mjs` + goal-aware `tools/balance-sim.js`. 773 tests unchanged.
- 2f56073 — Tutorial slide animations + goal completion burst. (1) Each how-to-play slide (`HowToPlayOverlay`) now has a looping PixiJS demo above the text, driven by the app ticker (works while the game is paused; removed on destroy): GOAL = 2 cars descending toward a breach line with a counter ticking to WIN; HOW TO PLAY = a matching-colour bomb drags to a car → explosion → car vanishes; MERGE = 3 same-colour bombs glow, converge, flash → merged lightning bomb (⚡); BOOSTERS = COLOR/FREEZE/BOMB icons pop in one at a time. Geometric shapes + glyphs only, no new assets. (2) `GoalCounterUI` goal-completion burst: the moment `goalProgress[i]` hits 0 the pill does a scale pop (1.0→~1.4→1.0, 300ms), an 8-particle burst in the goal colour (400ms), a white flash → settles to a green completed tint + border + checkmark, and plays the booster-earned SFX (`onComplete` callback wired in GameApp; `update(goalProgress, dt)` now takes dt). 773 tests unchanged.
- 9e878b1 — Car lane alignment fixed: removed the stale `SPRITE_X_OFFSET` table from `Car3D.js` (it used old image widths 512/448/299 vs the current 280/187/125px sprites, and was wrong-signed). All car types now centre purely on `laneToX()` (`mesh.position.x = 0`). The tender (truck) sat right-of-centre — worst in the right lane; bigrig and bike offsets were also stale. Removing them is strictly better/equal for every type (verified: same-lane stacks of tenders + mixed sizes all share one centre X). Residual is now only each sprite's own tiny art asymmetry.
- 0f5962c — New bomb sprites. 6 glossy regular powerballs (ChatGPT/DALL-E generated, 256×256 transparent PNG) replace the old programmatic spheres at `public/sprites/designed/powerball-{color}.png`. 6 NEW lightning-crack merged variants (`powerball-merged-{color}.png`) — `Shooter3D._getPowerballTex(color, merged)` now loads the merged sprite when `isMerged` (both vertical merge-colour-bombs and horizontal strong-merge bombs), with the existing 2D halo ring still layered on top. All 12 preloaded via `POWERBALL_URLS`. Processed with a new `scripts/process-powerball-sprites.mjs` (reuses the proven flood-fill white-bg removal from `process-sprites-sharp.mjs`, then resizes to 256). NOTE: the source files in `sprite-sources/raw/split/` arrived with 3 typo'd names (pwerball-red, owerball-green, owerball-yellow) + old correctly-named leftovers — the script picks the newest by mtime; worth renaming the sources. Minor: the red regular bomb has a faint saturated reflection blob the white-bg flood-fill left (negligible in-game). 773 tests unchanged.
- acfd731 — Haptic feedback: 9 gameplay events wired via the EXISTING `HapticsManager` (Capacitor `@capacitor/haptics`, Android-only, silent no-op on web; respects the `hapticsEnabled` settings toggle). Extended the manager with `success`/`error`/`warning` (NotificationType); wired through GameApp's callback layer (GameLoop/DragDrop stay pure). Events: bomb drag start → light; car kill → medium; multi-kill (2+) → heavy; wrong-colour bounce → error; breach → heavy ×2 (200ms apart); win → success; booster earned (FREEZE/COLOR CHANGE/BOMB) → medium; danger pulse (car in last 2 rows, once per advance) → warning; merge fires → medium. (Deliberately NOT created the spec's separate `src/audio/HapticsManager.js` — it would have duplicated the manager and ignored the settings toggle.) Haptics only fire on a real Android build — on-device verification still pending. 773 tests unchanged.
- 9b66cb9 — HUD fixes: HP-guide overlay now shows the actual car SPRITES (bike/car/van/tender/bigrig/tank) instead of colour dots; coin score icon repositioned dynamically to sit just left of the number's real left edge, so the gold coin never renders BEHIND a wide (4–5 digit) coin total — fixes the "yellow circle behind the score" seen on device.
- 0f4b7fa — HUD polish + in-game guides. (1) The bottom info bar was removed; volume + level badge now flank the LEFT of the COLOR/FREEZE/BOMB booster buttons and coin score + pause flank the RIGHT — all on a single row sharing the booster bar's full-width bg, vertically centred on the booster cards (HUDRenderer `bringToFront()` lifts the flank elements above the booster bg). (2) The coin score is now a WHITE number beside the gold coin icon (was a gold number that read as a yellow circle behind itself). (3) New 🚗 HP-guide button on the LEFT of the goal bar opens `HpGuideOverlay` — every car type + base HP (Motorbike 3 / Car 6 / Van 8 / Tender 10 / Big Rig 15 / Tank 30) with a "scales by level" note. (4) New ❓ how-to-play button on the RIGHT of the goal bar opens `HowToPlayOverlay` — a 4-slide slideshow (Goal → How to Play → Merge Combos → Boosters) with step dots, → next, ✕ quit. Both buttons follow the pause button's gameplay visibility and pause the game while open. (5) `CarManualScreen` (pause-menu encyclopedia) HP values updated to the new base HP (3/6/8/10/15/30). UI-only — 773 tests unchanged.
- 89e7c67 — HP system fixed + rebalanced for the gridRows-16 grid. (1) `hpMultiplier` is now applied in LIVE gameplay: `CarDirector._buildCar` scales each car's HP by `worldConfig.hpMultiplier` (`Math.max(HP_MINIMUM, Math.round(base × mult))`). Previously this was SIM-ONLY — the live game always spawned raw base HP regardless of level, so difficulty never scaled by level (confirmed live: L1 small=2 @ ×0.5, L20 small/big/jeep/truck = 4/8/10/13 @ ×1.3). (2) Base HP raised for the bigger grid: motorbike 2→3, car 4→6, van 5→8, truck 6→10, bigrig 10→15, tank 20→30; `HP_BASE.max` 20→30 (`HP_MINIMUM` stays 2). (3) Bait/carry-over cars are deliberately LEFT unscaled (they rely on 1–2 HP for the chain-kill mechanic). (4) L16 `hpMultiplier` lowered 1.62→1.20 — it was the outlier and overcorrected once base HP rose (boosterless sim scored 0 kills on one seed at 1.62; clean at 1.20). Tests: director-config max-HP test updated 20→30; all 773 pass. NOTE: these base-HP values are starting points — the per-level goal-count + balance-sim pass still needs to run against the new HP.
- 1ba5e2a — HUD redesign: the goals now own the FULL top band (larger pills, more breathing room, an opaque full-width band so they never overlap the road/cars below). The level badge, coin score, volume (mute), and pause button all moved OUT of the top and into a compact BOTTOM INFO BAR in the gap between the bomb queue and the booster bar (HUDRenderer owns it; pause repositioned from GameApp). The old top kill-progress "N/M" bar + 70px top strip are fully removed (win is goal-driven now). The in-game car-manual (📖) button is hidden during gameplay — still reachable from the pause screen. Bottom bar elements are ≥44px touch targets; the bomb-shots pips sit cleanly in the gap below the bar. Render-only — 773 tests unchanged.
- d88a990 — Level Goal System (infrastructure phase). All 40 levels now carry a `goals` array of mixable goal objects { type, color?, carType?, count }: `destroyTotal` (any car), `destroyColor` (a specific colour), `destroyType` (a specific car type). WIN = every goal's remaining count hits 0 (`GameState.isGoalMet()`); LOSE = breach (unchanged). `GameState` gains goals/goalProgress/isGoalMet()/applyKillToGoals(); `CombatResolver.resolve()` now returns the destroyed cars' colour+type so `GameLoop` credits the right goals on every kill (combat, rainbow color-bomb, BOMB-booster row clear). The old spawnBudget-exhaustion win path was removed (legacy `targetKills` retained only for goal-less levels). New `GoalCounterUI` (top-centre, dark pills) replaces the "Defeat N cars" bar — one card per goal with a type icon (💥 / colour circle / car sprite) + remaining count, switching to a green ✓ and dimming when complete; wraps to a 2nd row past 3 goals. **Infinite car spawn**: `spawnBudget` is now a DENSITY knob only (never depletes); lanes refill to `laneTargetCarCount` forever, so cars stream until goals are met or a breach occurs (NOT endless mode — levels still terminate on goals). `SimulationRunner` terminates on goal/breach/cap instead of budget. +19 tests (new `tests/goal-system.test.js`) → 773. NOTE — still required before ship: (a) balance sim does NOT yet model the real per-level goals/HP (VISION rule 6); (b) goal counts are a mechanical ~2.5× of old spawnBudget and need a per-level tuning pass.
- 3f32b32 — Level-start merge settle no longer dropped when the merge sequencer is still busy from the PREVIOUS level. The animated settle's single fire-once timer would silently no-op if `mergeSequencer.start()` early-returned on an active sequence (and a stale sequence could even apply a merge to the fresh board), so 3-in-a-line at level start only merged after the player's first swap. Fix: added `mergeSequencer.abort()` (drops a stale sequence's state without applying its merge), called at each level start; replaced the fire-once timer with a retry that WAITS for the sequencer to be free instead of dropping. Timing/trigger only — merge detection and the animation sequence are untouched.
- 1c6856b — Reorder highlight + yellow powerball fixes:
  * Reorder/bench drop-target highlight now centred via the CAMERA PROJECTION (`projectSlot` → `getBombSlotScreenXY`), the same fix already used for the merge halo — it was using the 2D slot constant (`getQueueSlotCenter`) and drifting off the 3D bomb. `ShooterRenderer.drawMergeOverlay` falls back to the constant only if no projector is passed.
  * Yellow (and all) powerball PRELOAD URLs lowercased — `POWERBALL_URLS` built `powerball-${c}.png` (capitalised, e.g. `powerball-Yellow.png`) but the files on disk and the 3D runtime loader are lowercase, so the preload 404'd on case-sensitive hosts (GitHub Pages). Runtime rendering was already lowercase (degraded gracefully), so this was a latent preload-only bug; NOT a merge bug. Investigation confirmed the merge ENGINE is fully colour-agnostic — yellow merges identically to red/blue/green (verified by unit test + live vertical L21 and vertical+horizontal L22).
  * +1 test: 3 Yellow bombs in a column → vertical merge fires (`merge-engine`, suite now 754).
- 556ff79 — Screenshot workflow standardised (CLAUDE.md §13): all review/verification captures now go to a single always-fresh folder `docs/review/` — wiped before each batch, numbered `01.png`/`02.png`/…, with a `00-labels.txt` index (`NN=description` per line). Applies to every future task.
- 0a55ad8 / a8e15ae — Full merge animation sequence complete (Candy Crush standard):
  * Highlight (100ms) → travel (150ms) → burst+pop (120ms) → staggered drop-in (150ms per bomb, 50ms stagger) → cascade chain (up to 5).
  * Level start: all bombs appear first, then pre-existing merges animate visibly before the first player move.
  * Only merging bombs are affected — all other queue bombs stay fully visible throughout (per-slot `_animLock`).
  * Implementation: a headless-safe peek→animate→apply pipeline keeps merge DATA synchronous (`GameLoop.peekMerges()` reads merges; `evaluateMerges()` applies at the burst step; `refillQueue()` fills gaps at the drop-in step) so the 753-test suite and economy are untouched. The 3D bombs are driven by the `mergeSequencer` in `GameApp.js`; new accessors `getSlotBaseWorld`/`clearAllAnimLocks` (Shooter3D) + passthroughs (GameRenderer3D). Drop-in uses easeOutBack overshoot; chain re-peeks after each settle, capped at 5.
- 18b14ba — Starting queue settles pre-existing merges (Candy Crush standard). `GameLoop.restart()` now calls `_settleStartingMerges()` right after the initial `fillColumns`: if the director deals a valid merge pattern (e.g. 3-same-colour in a column) at level start, the merge fires BEFORE the player's first move. It SILENTLY (no `_onMerge` burst/SFX) loops fill→`evaluateMerges()`→refill until the board has no merges left, so consumed bombs are replaced and the board is clean. Reuses the existing L5-gated `evaluateMerges()` (merge detection untouched; `fillColumns` untouched), so L1–L4 are a no-op and ongoing in-play fills still do NOT auto-merge — this exception is only the initial board settle. +2 tests (753).
- 65f28e9 — Bug fixes batch (visual + merge-bomb behaviour):
  * Car overlap at gridRows 16 — `Car3D.SPRITE_SCALE` 0.65 → 0.43 (the on-screen row pitch shrank ~10/15, so cars sized for 11 rows were overlapping).
  * Merge bomb halo now CONCENTRIC — the halo centre is derived from the bomb's 3D world position projected through `Scene3D.camera` (`Shooter3D.getSlotWorldPosition` → `GameRenderer3D.getBombSlotScreenXY`), not a linear ortho approximation (which drifted past the breach line).
  * Damage badge black-rectangle bleed fixed — removed the pill background in `drawDamageBadge` (now just a stroked white number) AND added `alphaTest: 0.04` to the badge `SpriteMaterial` so the cleared/transparent canvas texels no longer render as a dark rect.
  * Strong/merge color bomb correctly colour-matches (not rainbow) — `DragDrop._checkColorMatch` and the drag ghost now exclude `mergeColorBomb`, so a vertical merge bomb drops only on a matching lane and renders as a normal coloured bomb (single-target, bounces on mismatch). The earned RAINBOW bomb is unchanged.
- 52b6769 — Turn-economy + gridRows + merge fixes:
  * Turn economy redesign: 1 FREE queue action per shot (swap / bench-store / bench-retrieve). The queue LOCKS after the free action is used and RESETS on the next lane fire (`BoosterState.queueActionUsed`, reset in `GameLoop._startFiring`). A dim overlay (alpha 0.25) covers the queue zone while locked. Wrong-colour bounce does NOT advance cars (confirmed); queue actions / auto-merge never advance.
  * gridRows increased 11 → 16 on all 40 levels (smaller steps per advance, more planning time). Road VISUAL length unchanged (position→screen mapping is gridRows-agnostic). Defaults updated (GameState/GameLoop/SimulationRunner); `Car3D` danger-aura breach row made dynamic.
  * L5 and L6 colour count 2 → 3 (Red/Blue/Green) to reduce accidental merges at the merge-unlock levels; L10 stays 2 (boss design).
  * Merge color bomb fixed: now SINGLE-TARGET, own-colour only, high damage (sum of 3) — NOT rainbow/AoE. New `mergeColorBomb` flag routes it through the regular damage path (colour match → sum damage; mismatch → bounce). No rainbow swirl; solid colour halo + small ★ micro-label above the damage number.
  * +9 tests (`free-queue-action` 8; `merge-engine` rewritten for single-target) → 751.
- e2c4eee — Bomb merge mechanic (Phase 2 complete):
  * Vertical merge (3 same-colour in a column) → COLOR bomb that clears that specific colour (`isColorBomb:true, isMerged:true`, damage = sum stored).
  * Horizontal merge (3 same-colour across adjacent columns in one row; triples [0,1,2] and [1,2,3] on the 4-wide grid) → STRONG single-target bomb (`isColorBomb:false, isMerged:true`, damage = sum of 3) at the middle column front.
  * Queue drag-to-reorder — ANY slot draggable (L5+), swap occupied / move to empty; fire stays top-only.
  * Bench→queue return (L5+) — insert at column bottom; rejected (snap back) if the column is full.
  * Merges are PLAYER-INITIATED only (evaluate after a reorder or bench→queue drop), NOT on director fills/fire; chain merges allowed, capped at 2 passes; vertical resolves before horizontal (horizontal re-checks `isMerged` so it can't consume a just-merged cell).
  * Visuals: 2D color-matched halo ring behind merged bombs, 1.3× scale, particle burst + SFX on merge, merge-ready pulse (a column one swap from a vertical merge pulses 0.7→1.0). Merged bombs don't bob so the halo stays concentric. Reorder/bench drop-target shows a slot-centred green (valid) / red (full) highlight.
  * Gated at L5 (`gs.levelId >= 5`, 1-indexed; daily = 99). L1–L4 entirely unchanged.
  * +27 tests (`merge-engine` 14, `dragdrop-reorder` 7, `bench` +6) → 742 total. New `roadGeometry`-style pure logic kept in GameLoop; `Shooter.isMerged` + `GameState.levelId` added.
- e5e9710 — BOMB booster Y-boundary fix: taps on the frontmost row (closest to the breach line) were being clamped out of bounds and silently dropped. The frontmost row's car centre sits ON `ROAD_BOTTOM_Y` (510), so the `y > ROAD_BOTTOM_Y` gate in both `DragDrop` (bomb mode) and `GameApp.onBombPlaced` rejected taps on its lower half. Now: the accepted Y band extends half a row past the breach line (`FRONT_ROW_TAP_MARGIN ≈ 23px`) and the new pure, headless-testable `screenYToRow(y, gridRows)` clamps the result to `[0, gridRows-1]`, so those taps map to the last row instead of overflowing. Extracted the vertical road geometry (`ROAD_TOP_Y/BOTTOM_Y/HEIGHT`, `posToScreenY`, `screenYToRow`, `FRONT_ROW_TAP_MARGIN`) into new `src/renderer/roadGeometry.js` (no Pixi import) re-exported by `LaneRenderer.js` — every existing import path unchanged. Row-clear logic, regular bomb drops, rainbow color bomb, and BRUSH all untouched. +5 tests (`tests/screen-y-to-row.test.js`).
- 20593cd — BOMB booster redesigned: now destroys ALL cars in the targeted row regardless of colour (was incorrectly colour-filtered before). The tap Y maps to a row index across the whole board (`placeBombOnRow` + inverse-of-`posToScreenY`), so it works even when tapping empty space in a row that has cars in other lanes; an empty row refunds the charge. Deleted the dead `placeBomb(bombPos)` method. VISION.md item 8 corrected to match the intended design ("destroys ALL cars in the targeted row, regardless of color"). Rewrote `tests/game-loop-bomb-row.test.js` (8 tests) for the new behaviour and removed the now-redundant `tests/bomb-booster-target.test.js` (net test count unchanged at 710).
- db10eab — BOMB booster row targeting fixed. It was always blasting the front car's row regardless of where the player tapped (worst on upper-road taps). `onBombPlaced` now picks the car nearest the release Y via `posToScreenY(car.position)` (same road↔Y coordinate system as regular drops) and passes it to `placeBombOnLane(laneIdx, targetCar)`, which uses that car's row + colour (front-car fallback when none supplied). Destroy-all-cars-in-row logic and regular drops unchanged. +1 test (`tests/bomb-booster-target.test.js`).
- 1651000 — Power Up (pre-level) screen visual polish: big gold "POWER UP?" header over a warm radial glow, dark gradient panel, three escalating tier rows (purple → cyan → gold), a "BEST VALUE" gold pill + gentle shimmer on the Tier 3 jackpot, large booster emoji (🎨 ❄️ 💣) each with a Recolor/Freeze/Bomb label, and a muted secondary SKIP. Tier 1's lone icon is centred in the right portion (not edge-pinned). Animation via the screen's existing `update(dt)`; trigger/dismiss flow unchanged.
- d182d6e — Level-select popup booster SWAP → 🎨 BRUSH (`colorchange` key, purple identity, ad-count parity via `AD_COSTS`). Also: the pre-level "Power Up?" screen now appears on level-to-level progression — the win screen's NEXT LEVEL routes through `_showPreLevel` (was jumping straight to `_startLevel`), mirroring the map-tap flow.
- cee6f15 — CANCEL label centred in the booster bar: when a booster is active, its badge text ("×N" → "CANCEL") is now centred on the card with the corner badge hidden, instead of overflowing the top-right corner.
- c5fdee9 — Added 62 headless tests across 7 new files (suite now 709): `car-advance` (grid advance, breach, spawn vs spawnBudget, 3-car opening density), `damage-chain` (carry-over, multi-kills, exact-HP edge, color-bomb clear-through), `booster-earn` (COLOR CHANGE consecutive combo, FREEZE 3-kill, rainbow color bomb), `bench` (4 slots, store/retrieve vs queue, reset, unlock-gate contract), `rescue` (breach→over, rescue restore, second-breach final, RETRY), `win-condition` (budget-clear + legacy kill-goal + boss config), `color-change-booster` (activation lifecycle + recolor + new-colour combat). Real GameLoop/GameState/CombatResolver/models — no Pixi/Three/DOM. No existing tests modified.
- 0e61c7b — Empty-lane bomb drop now bounces back instead of being silently consumed. Fix in `DragDrop._checkColorMatch`: a lane with no front car now returns false (was true), so the drop routes through the existing wrong-colour bounce-back (`onColorMismatch` + `_snapBack`, no `col.consume()`) — the queue no longer advances on a wasted drop. The empty-lane check now runs before the color-bomb short-circuit, so a color bomb on an empty lane is fixed the same way (a rainbow on a lane WITH a car is unchanged). +4 tests (`tests/dragdrop-empty-lane.test.js`). No change to GameLoop resolution or the bounce animation.
- be61ddd — COLOR CHANGE booster tooltip reworded to "Tap a car, pick a color — ALL cars of that color transform!" (the `colorchange_use` feature banner fired when the button is tapped). Style/positioning/timing unchanged.
- a220495 — ShopScreen now sells COLOR CHANGE instead of the removed SWAP: replaced the booster def (key/label/icon/desc + purple identity, same 20-coin price), the owned-count badge (reads live `boosterState.colorChange`), and the purchase branch. Also cleaned the dead `swap` token out of the FREEZE purchase (`setBoosters(0, …)`). ProgressManager's `swap` field left as a separate cleanup.
- 4a707ce — COLOR CHANGE earn condition reworked: removed the per-level coin threshold entirely (`colorChangeThreshold`/`colorChangeEarned`, `colorChangeThresholdForLevel` deleted). Now earns on TWO strictly-consecutive multi-kills (2+ kills, then another 2+ on the very next shot) via `GameLoop._updateColorChangeCombo` — resets on any shot killing <2 (including a wrong-colour miss), can earn multiple times per level, resets at level start. Notification: "2× COMBO! Color Change ready!". Tests updated (replaced 2 threshold tests with 3 combo tests → 643).
- 50f205d — COLOR CHANGE visual desync fixed: `Car3D` now resyncs a car's sprite when its colour is mutated in place. The booster recoloured cars in GameState (e.g. blue→red) but the sprite kept its old colour while combat already treated it as the new colour; the renderer now detects `car.color` changes per-frame and swaps the powerball/sprite texture.
- 457113a — Retired the stash mechanic — the bench (`BenchRenderer`) is now the sole bomb-storage UI. Hid the empty stash rings (the "ghost slots" that rendered above the bench tray) in both `Shooter3D` (3D `ringMesh`) and `ShooterRenderer` (2D fallback), and disabled the stash drop path (`DragDrop._hitTestStashArea` returns false). `_handleStashDrop` left defined but unreachable for reference.
- 2a95fa6 — Bench slots now render the powerball bomb sprite (same art as the live bomb queue) instead of the old shooter-idle robot; added `POWERBALL_URLS` to the Pixi preload manifest. Also removed the combo music speed-up: `AudioManager.updateMusicPhase` now plays one steady `gameplay_calm` track all level (no calm→pressure→climax escalation).
- 45b2b8e — Multi-kill popup celebration: warm radial-gradient burst behind a large, tier-coloured kill count (2× gold `#FFD700`, 3× orange `#FF8C00`, 4×+ red/pink `#FF1744`) with a spring scale-pop entry (0.7→1.0, ~120ms). Fired from the existing multi-kill trigger through `PopupQueue`; `_fx.multiKill(n)` dev hook added for capture.
- f47a988 — Bench Fix A+B. A: unified the bench gate so the input hit-test respects the renderer's visibility (`DragDrop._hitTestBenchArea` returns false when the bench is hidden — no more consuming bombs into an invisible bench). B: gave the empty bench tray a visible dark panel and raised empty-slot opacity (14%→35%) so it reads as a storage area.
- 00486f8 — Impact explosion X now uses `PositionRegistry.getLaneScreenX` (active lane count) instead of the hardcoded 4-lane `laneCenterX`, fixing the 2D impact VFX landing left of the car on 1/2/3-lane levels (it was ~106px off at lane 0 on 2-lane levels).
- 2baf790 — Bench now unlocks at L4 (was L6): moved the visibility gate (`benchUnlocked`), the "Bench unlocked" FTUE banner, and the bench tutorial (`UNLOCK_LEVELS`) all to L4.
- 67716ea — Booster redesign: removed SWAP entirely and replaced it with a COLOR CHANGE booster (tap a car → pick a color → all on-screen cars of that color recolor; `ColorPicker.js`). Added a free RETRY to the rescue overlay (`RescueOverlay.js`). Fixed the rescue bug where the board resumed depleted — the breach skipped the lane/column refill — via `GameLoop.prepareForRescue()`. Car-type intro cards now only show when a car of that type is visible on the road, with a minimum of 3 grid advances between cards. Added a pre-level "Power Up?" ad screen (`PreLevelScreen.js`). Booster counts now reset to 0 each level. COLOR CHANGE is earned at a per-level coin threshold; FREEZE on a 3+ car chain kill. +9 regression tests (`tests/booster-colorchange.test.js`).
- 4b21d69 — Bomb now travels from the player's release point to the target car (ease-in lerp across the road plane + sine throw-arc) instead of dropping from above.
- e8a4470 — Updated CLAUDE.md test count (478 → 633) and test command (`npm test` → `npx vitest run`).
- c73b384 — Added 173-test regression suite covering level start contracts, shot resolution rules, and level goal reachability across all 40 levels.
- c8319c3 — Compressed all 73 sprites from 46MB to 1.84MB, reducing mobile cold load from roughly 15s to 1-2s.
- 3e48f52 — Made sprite loading resilient with `Assets.load` allSettled behavior, so one missing cosmetic sprite no longer blanks the whole game scene.
- ef67720 — Fixed UI audit issues: LEVEL COMPLETE clipping, rainbow bomb size, color bomb single advance, em-dash banners, and lose screen polish.
- c44d8b0 — Wired win screen stats so coins earned and best combo now show real level values.
- 75aa10a — Added live privacy policy page at `/lane-defense/privacy.html`.
- 6b3b734 — Fixed production placeholder bug by deploying tree, grass, and panel sprites that were previously gitignored and 404ing on the live site.
- dd972d1 — Renamed Android package ID to `com.nadavw.trafficbomb`.
- e769f66 — Changed app display name from Lane Defense to Traffic Bomb.
- 3b37318 — Removed obsolete bike-processing scripts that did not generate any live game sprites.
- b4617f5 — Ignored one-off screenshot and inspection scripts so throwaway tooling stays out of commits.
- 87afc96 — Preserved reusable sprite-processing scripts for live vehicle assets.
- 786469f — Ignored Codex/agent local artifacts and review folders so assistant workspace files stay out of git.
- a9670ee — Removed stale tracked level screenshots from the repository.
- d41899f — Upgraded Tutorial City visuals with warm building sprites, cleaner building detail, and park-style grass beside the bomb zone.
- 5953ac1 — Centered the road line correctly and made L1 trees fit better between tutorial buildings.
- 76c3ba1 — Replaced the segmented breach marker with one bold hazard stripe.
- c3242f5 — Added clearer onboarding modal cards and fixed input/z-order behavior.
- d4748d3 — Fixed L1 car centering, made FREEZE turn-based (1 shot), fixed color-bomb explosion targeting, changed color bomb to 5-correct-shot streak reward.
- 49e9799 — Ignored raw sprite sources and dev-server logs.
- 62038ac — Rebalanced all 40 levels around discrete turn-based play (ltcc 1/boss-3/else-2, gridRows=11).
- d64ec71 — Removed simulator free-kill shortcut that caused stalls.
- 2fcec17 — Made balance simulator turn-based and speed-agnostic.
- d0a2ac6 — Fixed simulator to respect each level's actual lane counts.
- 1ca6d60 — Added full 40-level balance sweep tool.
- 34a7de3 — Corrected simulation movement to advance per correct shot.
- e059155 — Renamed player-facing "shooter" language to "bomb."
- 53c28fd — Improved level select: title spacing, city buildings, map paths.
- e478ec6 — Added real booster bar icons and readable labels.
- 59b3df2 — Fixed win/lose screens: button overlap, background dimming, toast layering.
- 923b811 — Added world-specific building sets for tutorial, industrial, and night themes.
- 80049ce — Added per-color tank sprites for visual color matching.
- e101c08 — Unified grid to 11 rows, 1-car opening, updated discrete sim model.
- 4d26d8b — Fixed shared stash so any bomb can go in any stash slot, usable on any lane.
- 168c5ca — First major visual/balance batch: city edges, bomb zone panel, car centering, color bomb visuals.

## IMMEDIATE PRIORITIES (next session, in order)
1. On-device review (title screen + world panels).
2. Colorblind mode.
3. Agent team quality audit.
4. Real-device playtest checklist: L8/12/16/33/37 + bosses L10/20/30/40 (all 4 now §3c
   scripted; L20 has a known freeze asymmetry — if it plays too easy that's the expected
   direction, retune DOWN, see the L20 config comment).
5. Signed AAB build.
6. Play Store assets + submission.

## Active Backlog
- Replace COLOR CHANGE placeholder glyph with a real paintbrush sprite (drop `public/sprites/designed/booster-colorchange.png` — picked up automatically; also add it to BOOSTER_URLS preload in GameApp.js once it exists)
- Real-device playtest: Tier 1 floor levels L8/L12/L16/L33/L37 and bosses L10/L20/L30/L40
- PLAYTEST WATCH: goal progress pre-decremented on FIRST level navigation — seen once at L8
  (10/12 immediately after title→startLevel), never reproduced on restart. Possible first-nav
  transition artifact; confirm on real device it is NOT a kill-crediting bug.
- Signed AAB build for Play Store
- Play Store assets (5 screenshots, feature graphic, short + long descriptions)
- Agent team quality audit (next session)
- AdMob integration — verify on real device
- Higgsfield gameplay trailer
- feature/sprites remote branch can be deleted (same SHA as master, kept as safety bookmark)
- Level select scaffolding buildings too visually busy at small size — simplify in-progress state
- Sprite compression script (`scripts/compress-sprites.mjs`) — rerun if new sprites are added to `public/sprites/designed/`
- Regression suite now at 642 tests — run before every APK build

## Known Design Decisions (locked — do not change without Claude Chat)
- Bomb merge: 3 same-colour VERTICAL (a full column) → a SINGLE-TARGET, own-colour, high-damage bomb (`mergeColorBomb`; damage = sum; NOT rainbow/AoE — see the dedicated decision below); 3 same-colour HORIZONTAL (adjacent columns, one row) → a STRONG single-target bomb with damage = sum of the 3. Unlocks at L5 (L1–L4 unchanged). Bench bombs are EXCLUDED from detection. Merges are player-initiated (reorder / bench→queue), never on director fills. Chain merges allowed, max 2 passes; vertical resolves before horizontal. "+" shape deferred to v1.1.
- No HP bars on cars (VISION.md)
- Color bomb earned via 5 consecutive correct shots
- laneTargetCarCount: 1 (L1) / 3 (bosses L10/20/30/40) / 2 (all others)
- gridRows = 16 unified across all 40 levels (was 11; raised for smaller steps / more planning time)
- HP scaling: car HP = base HP (CarTypes.js) × `worldConfig.hpMultiplier`, applied at spawn in `CarDirector._buildCar` (`Math.max(HP_MINIMUM, Math.round(base × mult))`). This is the SAME value the balance sim uses — so live difficulty now scales by level (was a live no-op before 89e7c67). Bait/carry-over cars are deliberately UNSCALED (1–2 HP) to preserve the chain-kill mechanic. Base HP (post-gridRows-16): small 3 / big 6 / jeep 8 / truck 10 / bigrig 15 / tank 30; HP_BASE.max 30, HP_MINIMUM 2
- Wrong-colour bounce = NO car advance (cars only advance on a correct lane shot)
- 1 free queue action per shot (swap / bench-store / bench-retrieve). A second queue action is BLOCKED until the next lane fire resets it; lane fires are not queue actions and always work
- Merge color bomb = single-target, own-colour only, high damage (sum of 3). NOT rainbow/AoE. The earned RAINBOW color bomb (3 multi-kills) is the only any-colour clear
- Sim = competent tool-less floor; boosters lift real play above numbers
- speed.base is vestigial (turn-based game, no clock)
- Wrong shots are free (no penalty) — skill = planning, not accuracy
- `Assets.load` uses allSettled — cosmetic sprites degrade gracefully, critical sprites (cars/bombs/boosters) gate `spriteFlags.loaded`
- Regression suite covers all 40 levels — do not change laneTargetCarCount, gridRows, car intro ordering, or color bomb behavior without updating regression tests
- SWAP booster removed — replaced by the COLOR CHANGE booster (tap a car, then pick a color; all on-screen cars of that color recolor)
- Boosters reset to 0 at the start of every level — they do NOT carry over. Starting boosters come only from in-game earns or the pre-level "Power Up?" ad screen
- COLOR CHANGE is earned by chaining TWO strictly-consecutive multi-kills (2+ cars each, on back-to-back shots) via `GameLoop._updateColorChangeCombo`. No coin threshold; can be earned multiple times per level. (Replaced the old per-level coin threshold this session — 4a707ce.)
- FREEZE is earned on a 3-car chain kill (a single shot that destroys 3+ cars via carry-over)
- BOMB booster and rainbow COLOR BOMB are TWO DISTINCT SYSTEMS — do not conflate:
  - **BOMB booster** — earned at **10 total kills** this level (`gs.killsTowardBomb` counter; +1 per kill, charge every 10). Tap a road row to destroy **every car in that row, regardless of colour** (`placeBombOnRow`; refunds if the row is empty).
  - **Rainbow COLOR BOMB** (a queue item, not a booster) — earned after **3 banked multi-kills** (`gs.multiKillCount`; a multi-kill = 2+ cars destroyed in one shot). When fired it clears every car of one colour (hits any colour car).
- **City Repair (§3e): LevelSelect buildings source from `progress.cityState`, NOT stars.**
  Per the VISION ("every beaten level repairs one building"), ANY win → repaired (2);
  a beaten level replayed-and-lost → scaffolding (1, damage); never-beaten → rubble (0).
  Star-mastery lives on the level NODE (the star row under the number), not the building.
  The OLD stars-proxy (`stars>=3 ? 2 : stars>=1 ? 1 : 0`) was a pre-cityState stand-in, NOT
  a design — do NOT "fix" buildings back to star-gating. Rubble carries a deliberately
  subtle amber rim-light (legibility, not an alert) so the broken city reads as pending
  against the dark map; primary broken/fixed signal is lit-windows (repaired) vs dark
  (rubble). `damageBuilding` fires only at FINAL loss (same definition of failure as DDA).

## Tool Workflow
- Claude Chat: design judgment, visual approval, prompts, roadmap
- Claude Code: implementation, screenshots, commits (approval required)
- Codex: read-only audits, verification, SESSION_HANDOFF updates (approval required)
- Rule: nothing commits without Claude Chat approval
- Screenshots before every visual commit

## Key Files
- src/renderer/CityEdges.js — city edges, buildings, trees, park grass
- src/renderer3d/Car3D.js — car sprites, lane centering, laneCount
- src/renderer3d/Road3D.js — road geometry, breach line, center line
- src/renderer3d/Shooter3D.js — bomb zone, stash slots, color bomb visuals
- src/renderer/HUDRenderer.js — HUD elements
- src/renderer/BoosterBar.js — booster icons, labels, counts
- src/screens/WinScreen.js — win/lose modals
- src/screens/LevelSelectScreen.js — level map
- src/game/LevelManager.js — level configs, balance (40 levels)
- src/director/CarTypes.js — car types, HP, weight bands
- tools/balance-sweep.mjs — full 40-level balance sweep (reusable)
- src/simulation/SimulationRunner.js — discrete per-shot sim, speed-agnostic
- scripts/compress-sprites.mjs — rerun after adding new sprites
- tests/regression-level-start.test.js — level config contracts
- tests/regression-shot-contract.test.js — shot rule contracts
- tests/regression-level-goals.test.js — goal reachability
