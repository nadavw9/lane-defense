# Traffic Bomb — Master Plan: Testing → UI → Difficulty

> **HANDOFF DOCUMENT.** If this session dies (token limit, crash), a fresh session continues from here.
> Read CLAUDE.md + SESSION_HANDOFF.md first, then this file. Work top-to-bottom through EXECUTION STATUS;
> the full design rationale for every step is in the plan body below. User pre-approved all work in this
> plan (commits included — use descriptive conventional messages, `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer,
> push after each coherent unit). Checkpoints marked [USER] still require showing results before proceeding.

## EXECUTION STATUS (update after every completed step)

- [x] Step 0 — baseline commit `05e146e` (thin-ribbon panels + aspect-preserving processing), pushed
- [ ] WS1-1a — CI gate: tests block deploy in `.github/workflows/deploy.yml`
- [ ] WS1-1b — audit tests: `src/renderer/assetManifest.js` refactor + `tests/audit-assets.test.js` + `tests/audit-level-config.test.js` + `tests/audit-balance-smoke.test.js`
- [ ] WS1-1c — Playwright harness: `playwright.config.js`, `tests-visual/` (tripwire fixture → layout specs → state-reset specs → HUD specs), new `_nav.getHudBounds()` + `_nav.winLevel()` hooks
- [ ] WS1-1d — CI visual smoke job (non-blocking week 1) + nightly full sweep
- [ ] WS1 exit — break-it demo: broken lane formula / renamed sprite / removed goal color each trips a test [USER]
- [ ] WS2-2a — fix 3 BROKEN items (black void below road, ComboGlow, shop lower half)
- [ ] WS2-2b — widen side strips ~35→60-70px (CityEdges `_roadHW`/`MIN_STRIP_PX` + consumers), verify via harness [USER]
- [ ] WS2-2c — icon set Batch 1: provide prompts to user → process → `UIIcon` helper → swap ~120 emoji [USER generates art]
- [ ] WS2-2d — screen chrome Batch 2: Title buttons, Win/Lose art, Level-Select city map w/ damage states [USER generates art]
- [ ] WS2-2e — apply + per-screen screenshot review [USER]
- [ ] WS3-3a — canonical 40-level design table, update GAME_DESIGN.md [USER reviews before retuning]
- [ ] WS3-3b — sim upgrade: booster/streak modeling + recalibrate bands
- [ ] WS3-3c — wave redesign + 4 designed bosses
- [ ] WS3-3d — DDA fail-streak mercy + near-miss drama
- [ ] WS3-3e — City Repair meta-loop (World 1 first)
- [ ] WS3-3f — full validation sweep, update balance-report-realistic.md

**Key session facts a fresh session needs:** tests must stay green (`npx vitest run`, currently 778); dev server usually already running on :5173 (`reuseExistingServer`); Bash cwd resets between calls — always `cd /c/Users/dalit/lane-defense` first; screenshots reviewed via `docs/review/` (wipe first, numbered + 00-labels.txt, full path at end of response); never touch `android/lane-defense-release.keystore`; sprite paths always `${import.meta.env.BASE_URL}sprites/...`.

---

## Context

Traffic Bomb (lane-defense) is feature-complete for a first Play Store push, but three things stand between it and a top-tier hybrid-casual game:

1. **Bugs keep escaping** — 778 headless tests are green, yet 7 classes of bugs recur (hardcoded 4-lane assumptions, asset 404s on Pages, coordinate drift, tap boundaries, unwinnable configs, stale level-transition state, HUD overlap). All are *visual/integration* failures invisible to the logic suite. Worse: **CI deploys without running any tests** (`deploy.yml` only builds).
2. **UI reads as programmer-art** — 18 of 23 screens are pure rounded-rects + text; 23 distinct emoji serve as icons (~120 instances); zero real button art. Game entities (cars/bombs/shooters/panels) are fully sprited — the *chrome* is not. Plus 3 documented "BROKEN" items (black void below road, ComboGlow disabled, empty shop lower half) and the side-panel "cut buildings" issue on 35px strips.
3. **Difficulty passes the sim but isn't *designed*** — mean 61% win rate is in band, but the design contract (VISION.md / GAME_DESIGN.md) defines difficulty as *emotional rhythm* (wave per 8-level block, relief slots, pain-before-tool booster unlocks, designed bosses) and the docs have drifted from the implementation. The sim doesn't model boosters (the escape valves). And the designed retention pillar — the **City Repair meta-loop** — was never built.

**User decisions (locked):** sequence = testing → UI → difficulty · difficulty has full redesign license · UI targets top player-exposed screens first · CI yes · no player data yet · **City Repair is in scope** as the retention pillar · uncommitted panel work is committed as baseline in Step 0.

Everything below builds on verified exploration (3 Explore agents) + the full prior session context.

---

## Step 0 — Baseline commit (5 min)

Commit the working tree as-is so all workstreams start clean:
- `public/sprites/designed/world{1,2,3}-{left,right}.png` (thin-ribbon panels, aspect-correct)
- `scripts/process-ai-backgrounds.mjs` (fill → aspect-preserving fix)

Suggested message: `feat: thin-ribbon world side panels (aspect-preserving processing)`. Push. The remaining "buildings cut on 35px strips" complaint is addressed properly in WS2 (strip widening).

---

## Workstream 1 — Test harness (build first; everything after is verified by it)

**Goal:** catch the 7 recurring bug classes automatically, locally and in CI.

### 1a. CI gate (quick win, ~30 min)
- Edit `.github/workflows/deploy.yml`: add `npm ci && npx vitest run` as a job that **gates** the build/deploy job (`needs:`). Deploy never ships red again.

### 1b. Static audit tests — pure vitest, fast, run with the 778 (~1 day)
New `tests/audit-*.test.js` files (headless, no browser):
- **Asset manifest audit** (bug class B): export the URL arrays from `GameApp.js` (small refactor: move `CAR_URLS`/`POWERBALL_URLS`/`WORLD_PANEL_URLS`/etc. to a new `src/renderer/assetManifest.js` imported by GameApp), then assert every URL resolves to a file on disk with **exact-case** match, and that no referenced file lives in a gitignored path (runs `git check-ignore`).
- **Level config audit** (bug class E): for all 40 levels — every `destroyColor` goal color ∈ level palette; every `destroyType` car type spawnable at that level band (`CarTypes.bandWeights`) with weight > 0; `worldConfig`, `laneCount`, `gridRows` sane. Extends the existing `tests/regression-level-goals.test.js` pattern.
- **Balance smoke** (bug class E): sim at 100 runs per level asserts win-rate within a WIDE band (e.g. 5–95% non-FTUE) — catches "accidentally unwinnable/trivial" per-commit without the cost of the full 500-run sweep.

### 1c. Visual/integration harness — Playwright Test (~2–3 days)
Standalone Playwright Test suite (NOT vitest — keeps the 2s unit loop fast):
- `playwright.config.js` with `webServer` (auto-starts `vite dev`), viewport 390×844, chromium.
- `tests-visual/` directory; npm scripts `test:visual` (smoke) and `test:visual:full`.
- **Shared fixture** (the tripwire): every test auto-fails on `console.error` and on any 404/failed request. This alone would have caught the powerball-case and gitignored-sprite bugs.
- **Structural assertions over golden pixels** (golden diffs deferred; brittle across Windows-dev/ubuntu-CI rendering): sample canvas pixels at coordinates *computed from the game's own source of truth* — e.g. car sprite must be non-background at `PositionRegistry.getLaneScreenX(lane)`, side panels non-dark at strip centers, HUD elements inside bounds.
- **Smoke level set** (per-commit): L1 (1-lane), L2 (2-lane), L3 (3-lane), L5 (4-lane W1), L20 (boss W2), L35 (W3). Nightly/manual: all 40.
- **Checks per bug class:**
  - A (lane-count): boot L1/L2/L3/L5 → for each active lane, deploy a shot via `_nav.deploy`, assert kill/advance happened in the *intended* lane (`_nav.getGs()`), assert car pixels at each `getLaneScreenX`.
  - C (coordinates/stale state): level→level transition test (win L1 → start L2 → assert board reset, no stale merge state via `_fx`/`getGs`); merge halo concentricity via `_fx.mergeSetupVertical` + pixel sample at projected slot center.
  - D (boundaries): `tapStage` at row 0 and last-row edge pixels for BOMB targeting; lane-edge taps resolve to correct lane via `getLaneFromScreenX` vs actual.
  - F (transitions): rescue-resume board refill; restart-level cleanliness.
  - G (HUD overlap): bounding-box overlap assertions between HUD containers (expose a tiny `window._nav.getHudBounds()` hook listing named HUD rects); coin counter with 5-digit score doesn't overlap icon.
- **New dev hooks needed** (add to `GameApp.js` `_nav`): `getHudBounds()`, `winLevel()` (force goal completion for transition tests). Everything else exists.

### 1d. CI jobs (staged rollout)
- **Job 1 — unit+audit** (every push, ~1 min): `npm ci && npx vitest run` (778 + new audits). **Gates deploy** immediately.
- **Job 2 — visual smoke** (every push, ~3 min): cache node_modules + Playwright chromium, run smoke set, upload failure screenshots as artifacts. **Non-blocking for week 1** (observe flakiness), then flipped to a deploy gate once stable.
- **Job 3 — nightly full sweep** (cron): all 40 levels, 2–3 actions each, screenshot + tripwires.

### 1e. Build order (architect-reviewed)
1. Node audits (1–2h) — instant payoff, catches B/E in 2s
2. Playwright config + shared tripwire fixture (2–3h) — `webServer: { command: 'npm run dev', reuseExistingServer: true }`, `retries: 1`, failure `outputDir`
3. Layout/coordinate specs — L1/L2/L3/L5 lane math + tap boundaries (4–6h, catches A/C/D)
4. State-reset specs — rescue-resume, level-transition cleanliness (2–3h, catches F)
5. HUD-overlap specs via `getHudBounds()` hook (2–3h, catches G)
6. Full 40-level parameterized sweep (1–2h)
7. CI wiring + `tests-visual/README.md` (1–2h)

Total: ~2.5 focused days. Smoke set final: **L1, L2, L3, L5, L20, L35** (all lane counts + all 3 worlds + a boss); nightly = all 40.

**Exit criteria:** CI blocks red deploys; the 6-level visual smoke passes; deliberately breaking a lane formula / renaming a sprite / removing a goal color each makes a test fail.

---

## Workstream 2 — UI to the next level

**Goal:** the top player-exposed surfaces stop reading as programmer-art; every change verified by WS1 harness. Use `lane-defense-design-system` skill for all screens.

### 2a. Fix the 3 documented BROKEN items (before new art)
1. Black void below road (fill with themed ground/extension).
2. ComboGlow disabled — restore combo feedback (×4 combo currently has zero juice).
3. Shop screen empty lower half (layout rebalance + booster art).

### 2b. Side panels done right
- **Widen the side strips**: reduce road width on 4-lane levels so strips go ~35px → ~60–70px each (change `_roadHW()` / `MIN_STRIP_PX` in `CityEdges.js` + the road geometry consumers — `LaneRenderer`, `Scene3D` frustum use, `PositionRegistry` stays the single source of truth). Cars are 40px wide in ~45px lanes today; verify playability at narrower lanes via harness lane-tap tests + a manual playtest.
- The thin-ribbon art (committed in Step 0) then shows whole building fronts. If 60px still cuts, regenerate panels with SET-A prompt at shallower depth.

### 2c. AI asset generation — Batch 1: the icon set (kills ~120 emoji instances)
Generate as **individual images** (ChatGPT/DALL-E, transparent bg or flood-fillable, style-locked to the powerball/booster glossy look). Priority order:
1. Star (filled + empty) — used 24×
2. Play ▶ / back ◀ chevrons
3. Heart (life), coin, gem
4. Booster set refresh where needed (colorchange/freeze/bomb exist; add shield)
5. Gear, trophy, chart, book/info, share, gift, fire-streak, timer, target, checkmark, close-X
→ Process via a new `scripts/process-ui-icons.mjs` (reuse flood-fill pipeline), one `sprites/ui/` folder + preload entry, and a tiny `UIIcon` helper (`new UIIcon('star', size)`) that falls back to the emoji if texture missing. Swap emoji → UIIcon across screens incrementally.

### 2d. AI asset generation — Batch 2: screen chrome for the big four
- **Title**: keep bg/logo; generate a wooden/glossy button set (9-slice-able primary + secondary).
- **Win screen**: celebration art (burst frame, star trio art, coin shower) — the victory moment must feel premium.
- **Lose screen**: dramatic-but-warm frame art.
- **Level Select / City Map**: THE big one — designed together with City Repair (WS3): a top-down city map background where each level node is a building plot with **3 damage states (rubble → scaffolding → repaired)**. Generate: map background per world region + building set with damage states + path/node chrome. This is generated ONCE and serves both the UI facelift and the meta-loop.

### 2e. Apply + verify
Each screen updated → visual harness run + `docs/review/` screenshots for your approval (existing workflow). Screens beyond the big four (Shop, Settings, Daily, Achievements, Pause) get the icon-set swap now, full art in a later batch.

**Exit criteria:** zero emoji icons on Title/LevelSelect/Win/Lose/HUD; 3 BROKEN items fixed; side panels show uncut buildings; all harness checks green.

---

## Workstream 3 — Difficulty & gameplay to top-tier (full redesign license)

**Goal:** difficulty as designed *emotional rhythm* + the retention meta, not just win-rate bands.

### 3a. Reconcile the design contract (docs ↔ code)
GAME_DESIGN.md's master table has drifted from the shipped 40 levels (booster unlock levels, boss slots, color intro schedule). Produce the **canonical 40-level design table** (one row per level: design goal, feel, tier, mechanic focus, palette, car mix, goal shape) and update GAME_DESIGN.md. VISION.md rules stay locked.

### 3b. Upgrade the simulator to model the escape valves
Biggest known sim gap: boosters/streak unmodeled → hard levels are tuned blind to their rescue tools.
- Add to `SimulationRunner`: streak-shot double damage (exists partially), FREEZE usage on near-breach (simple heuristic: if any car within 2 rows and freeze available → use), COLOR CHANGE on 3+ same-color front cars, BOMB on fullest row when charged. Skill profiles gain booster-usage probability.
- Recalibrate tier bands with boosters on (expect hard/boss real win rates to rise; retune goal counts/HP to the *designed* first-attempt pass rates: Easy 85–95 / Medium 60–75 / Hard 35–50 / Boss 20–35).

### 3c. Redesign the wave, per the contract
- Enforce the 8-block wave (Easy→Med→Med-Hard→Hard→Relief→Med→Hard→Boss) across all 40 with the new sim; every 5th level relief; booster-unlock levels easier than their predecessor; "pain-before-tool" — the level before each booster unlock is designed to make the player *feel* the missing tool.
- **Bosses become designed challenges** (VISION rule 5, currently stat-bumps): L10 two-color bench-test puzzle, L20 tank-wall + freeze showcase, L30 five-color overload with designed merge setup, L40 grandmaster (scripted spawn sequence via a per-level `spawnScript` the Director already almost supports through initialCars/weights). Each boss gets a named intended solution, verified reachable by sim.
- **First-session hook:** L1–L5 timing pass (target: first win < 60s, first *near-loss drama* at L4, first booster taste by L6).

### 3d. New pacing mechanics (license granted)
- **Fail-streak mercy (DDA):** after 2 consecutive fails on a level → invisible hpMultiplier ×0.9 + guaranteed pre-level booster offer; resets on win. Standard hybrid-casual; keeps boss frustration bounded. Implemented in `LevelManager`/`GameApp` pre-level path + `ProgressManager` fail counters.
- **Near-miss drama:** when goal is ≥80% done AND a car is within 2 rows — slow-mo + heartbeat audio moment (renderer-side, hooks exist).
- Both sim-neutral (mercy modeled as a separate sim profile).

### 3e. City Repair meta-loop (the retention pillar)
Build per VISION spec, art from WS2d:
- `ProgressManager.cityState` (per-building damage state, saved).
- Level Select renders building states; win → repair animation (rubble→scaffold→repaired); breach-loss → visible damage.
- Scope: World 1 map fully functional first (15 buildings), Worlds 2–3 reuse the system.

### 3f. Validate
- Full sim sweep (500 runs, with-boosters profile) → all 40 in designed bands → update `docs/balance-report-realistic.md` (it's stale).
- Visual harness green. Real-device playtest checklist (existing: L8/12/16/33/37 + bosses).

**Exit criteria:** canonical design table matches shipped levels; sim (booster-aware) puts all 40 in designed first-attempt bands; 4 bosses have named designed solutions; DDA + City Repair shipped.

---

## Order of execution & checkpoints

```
Step 0 (commit baseline)
→ WS1: 1a CI gate → 1b audit tests → 1c visual harness → 1d CI visual job   [checkpoint: break-it demo]
→ WS2: 2a broken fixes → 2b strips → 2c icons (you generate Batch 1) → 2d chrome (Batch 2) → 2e apply  [checkpoint: screenshot review per screen]
→ WS3: 3a design table → 3b sim upgrade → 3c wave+bosses → 3d DDA → 3e City Repair → 3f validate  [checkpoint: design table review before retuning]
```

Each workstream lands as a series of small approved commits (existing commit discipline). Art generation is the only user-blocking dependency (Batches 1–2 prompts will be provided ready-to-paste).

## Verification (end-to-end)

- `npx vitest run` green (778 + new audit tests) — every commit.
- `npm run test:visual` smoke green — every commit; full sweep nightly/manual.
- CI: push to a scratch branch with a deliberately broken lane formula → deploy blocked, failure screenshot artifact present.
- Balance: `node tools/balance-sim.js --level=all --runs=500` (booster-aware) all-bands table in review.
- Manual: `docs/review/` screenshot batches at each UI checkpoint; real-device pass before AAB.
