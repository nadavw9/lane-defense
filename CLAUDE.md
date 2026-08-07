# Traffic Bomb — Project Context

> **For Claude Code: auto-loaded on every session. Read in full before any task.**

## 0. ACTIVE WORK — continue from here (any model)

An approved 3-workstream master plan is in progress (WS1 testing DONE → WS2 UI → WS3 difficulty):
1. **Status/tracker:** `docs/superpowers/plans/2026-07-02-master-plan-testing-ui-difficulty.md`
2. **Per-task HOW + work guidelines + model routing + art prompts:** `docs/superpowers/plans/IMPLEMENTATION_PLAYBOOK.md`

Route mechanical spec-execution to cheaper models; reserve Fable/Opus for design judgment
(playbook §2). Every task: vitest green (1193+) + `npm run test:visual` green (18) before commit.

### OPEN, BLOCKED ON OWNER INPUT — do not investigate further until it arrives

**Desktop "top of the HUD is cut off" (2026-08-07). STOP INVESTIGATING.** Reported twice from
real screenshots; **not reproduced in 14 configurations** — real browser-window heights *with*
browser chrome (955/880/760/739/625/600/595/500), DPR 1 / 1.25 / 1.5 (Windows 125% and 150%
display scaling), against **both** the dev server and the live Pages build. The fitted canvas box
is exact in every one (e.g. 1280×595 @ DPR 1.5 → 275×595 against an expected 275×595, top 0,
bottom 595), and the goal cards render complete. So it is **neither** candidate cause: not CSS
overflow past the fitted box, and not a mis-sized box. Both are ruled out, not merely untested.

The *bottom* half of the same report was real and is fixed (`d804019`): booster cards had 2px of
clearance above the stage bottom, labels 5px — at desktop stage scale ~0.7 that is 1.4 and 3.5
CSS px, which reads as cut off without anything being clipped.

**Needed to proceed, and nothing else will do:** the owner's window size (or simply
fullscreen-vs-windowed), **browser zoom level** (Ctrl+0 = 100% — the one environment variable
never modelled), and whether the screenshot was the live URL. Probes are committed and ready
(`scripts/_desktop-clip-probe.mjs`, `_dpr-clip-probe.mjs`, `_live-clip-probe.mjs`, `_l8-edges.mjs`)
— re-deriving them is the expensive part, so re-run them with the real numbers rather than
rebuilding. A 15th blind configuration is not evidence; see the two 2026-08-07 probe failures in
§6, which is *why* the earlier sweeps looked clean.

### BRANCH-FIRST FOR THE DEPLOY / MERGE PATH — local green proves nothing there
**Anything touching the deploy → auto-fill → merge path goes to a BRANCH and waits for CI
before it reaches master.** Do not validate locally and push to master.

Three changes have now failed CI on the same two L5 deploy tests after passing *everything*
locally — full vitest, full visual-smoke, and `CI=true` + SwiftShader across 3 repeats. Two of
them reached master and had to be reverted; the third was caught on a branch, which is the
whole point. That path is the most CI-sensitive surface in the project: it is timing-dependent,
and CI's software renderer runs the game loop ~12× slower than a dev GPU, so windows that never
open locally open reliably there.

Same lesson as the SwiftShader and wait-condition rules below, one level up: **the local
environment is not a proxy for CI on this path.** Push the branch, let CI judge, merge on green.
If diagnosis outruns your budget, leave the branch pushed and unmerged with findings — that is a
clean handoff, not an unfinished task.

The workflow supports this as of `ec5b14b`: gates run on every branch, and `deploy` is gated to
`refs/heads/master` so a branch can never publish to Pages.

### BOSSES MUST BE PLAYED, NOT JUST SIMMED

**After ANY change to lane count or row count, the four canonical bosses (L10 / L20 / L30 /
L40) must be PLAYED on a real device before the change is called done.** In-band sim is
necessary and NOT sufficient.

The sim measures one thing: win rate. It cannot see whether the boss's *intended solution*
still works. A boss built around "save a column for the final wave" or "chain three merges
across lanes" can hold its win rate while the actual play pattern that made it that boss has
become impossible — fewer lanes means fewer parallel setups, and fewer rows means fewer turns
to build one. The number stays green while the identity quietly dies.

Full gate and per-boss identity notes: `THREE_LANE_REDESIGN_BATCH.md` §4.

**Device playtesting is the USER's** (changed 2026-07-26; previously the user's sister). The
loop is tighter now — he plays each deploy himself, so ship to green and tell him what to look
at.

---

## 1. THE STANDARD

Every visual change must meet **Play Store quality** before being approved. This is a hard gate, not an aspiration.

**Approval process:**
1. Screenshot from **L5 or higher** (never L1 — single lane, not representative)
2. Ask: *"Would a player downloading this from the Play Store think this looks and feels like a professional game?"*
3. If no → keep fixing. Do not commit.
4. Reference bar: **Royal Match, Color Block Jam, Toon Blast.**

---

## 2. NO COMPROMISE ON TOOLS

When the best tool for a task is not available, STOP.
Do not find a workaround. Do not use an inferior alternative silently.

The correct behavior:
1. Stop immediately
2. State clearly: "I need [tool] to do this properly.
   Please install it with: [exact install command]"
3. Wait for the user to install it
4. Only then continue

Examples of what is NOT acceptable:
- sharp not installed → using Playwright to convert SVGs (worse output, fragile)
- canvas not installed → drawing with ASCII art or inline HTML
- Figma tokens exceeded → switching to Canva without asking
- A package missing → rewriting logic to avoid needing it

The user would rather wait 2 minutes to install the right tool
than get a worse result immediately.

This applies to: npm packages, system tools, MCP connections,
API access, or any capability gap.

Exception: if two tools are genuinely equivalent in output quality,
Claude may choose either. But "it works" is not equivalent to
"it produces the best result."

---

## 3. What This Is

Hybrid-casual mobile puzzle-defense game. Cars in colored lanes advance toward the player one row per correct shot. Player drags color-coded bombs onto lanes — color must match the front car to deal damage. Turn-based grid, not real-time. 40 levels across 3 worlds. Live on GitHub Pages; native Android via Capacitor.

- **Live URL:** https://nadavw9.github.io/lane-defense/
- **Repo:** https://github.com/nadavw9/lane-defense
- **App ID:** `com.nadavw.trafficbomb`

---

## 4. Mandatory Reads

Before any design, level, or gameplay change, read these in full:

- `docs/VISION.md` — **locked design contract. Do not modify without explicit user approval.**
- `docs/GAME_DESIGN.md` — level master table, difficulty rules, known bugs
- `docs/balance-report-realistic.md` — difficulty ground truth per level

Files this applies to: `LevelManager.js`, `GameLoop.js`, `ThemeRegistry.js`, `LevelSelectScreen.js`, `CarTypes.js`.

### External tooling (installed OUTSIDE this repo — NOT dependencies of Traffic Bomb)

These live in `C:\Users\dalit\tools\` and are deliberately **not** in this project's
`package.json`. **Traffic Bomb does not depend on either** — do not add them, and do not
conclude from their presence that it does.

| tool | location | invoke | when it's actually relevant |
|------|----------|--------|------------------------------|
| **OmniRoute** v3.8.50 | `C:\Users\dalit\tools\omniroute` | `node C:\Users\dalit\tools\omniroute\bin\omniroute.mjs` | An AI **gateway/router**: one endpoint in front of many providers, with auto-fallback and token compression. Relevant only when a task needs a NON-Claude model or must survive a provider outage — the existing routing (Claude.ai plans, Claude Code executes, sub-agents on haiku) already covers orchestration and model choice inside Claude. Adds provider breadth and fallback, not agent coordination. |
| **CrewAI** v1.15.12 | `C:\Users\dalit\tools\crewai-venv` (dedicated venv) | `C:\Users\dalit\tools\crewai-venv\Scripts\python.exe` or `...\Scripts\crewai.exe` | Multi-agent role/task orchestration. Verified: imports, constructs a real Agent/Task/Crew, CLI reports its version. **Needs an LLM API key to actually RUN a crew** — construction alone was smoke-tested, nothing executed. Be specific about when it earns its place: the Task-tool sub-agents already cover most orchestration inside Claude, so CrewAI is for multi-agent workflows that must run OUTSIDE a Claude session or against non-Claude models. |
| **ponytail** v4.8.4 | five on-demand skills live in `~/.claude/skills/`; the always-on ruleset is **staged, NOT active**, at `C:\Users\dalit\tools\ponytail-staged\ponytail` | `/ponytail-review`, `/ponytail-audit`, `/ponytail-debt`, `/ponytail-gain`, `/ponytail-help` — all verified loading and running | Over-engineering review: finds what to DELETE (reinvented stdlib, unneeded deps, speculative abstractions, dead flexibility). **The always-on `ponytail` skill is deliberately NOT installed.** Its description is "use on ANY coding task", so copying it into `~/.claude/skills/` IS activation — there is no separate off switch for a skill. **Rule: ON for implementation and feature work, OFF for investigation and audit work**, where the goal is complete findings rather than a small diff; running it mid-audit biases toward under-reporting. **To activate:** copy `ponytail-staged\ponytail` into `~/.claude/skills/`. **To deactivate:** delete it again. `%APPDATA%\ponytail\config.json` is set to `{"defaultMode":"off"}` so it will not auto-activate at session start even once installed — turn it on per session with `/ponytail`. |

**Python status (RESOLVED 2026-08-06).** A standalone CPython is now installed:
`C:\Users\dalit\AppData\Local\Programs\Python\Python312\python.exe` — 3.12.10, pip 25.0.1,
installed user-scope with `winget install Python.Python.3.12 --scope user` (no admin needed).

**The Microsoft Store stubs are still first on PATH**, so bare `python` / `python3` in a
plain shell still error out. Call the interpreter by FULL PATH, or use a venv's
`Scripts\python.exe`. Don't be misled by the stub's error into concluding Python is absent.

**The QGIS-bundled Python (`C:\Program Files\QGIS 3.42.2\apps\Python312`) was NOT used and
must not be** — installing unrelated packages into a GIS application's runtime breaks QGIS
and hides the dependency. Verified clean: `crewai` is absent from the QGIS interpreter.

---

## 5. Architecture

### Directory layout

- `src/director/` — headless game brain. **Never imports pixi.js or three.js.**
- `src/renderer/` — PixiJS 2D: screens, HUD, bench, drag-drop, all 2D UI.
- `src/renderer3d/` — Three.js 3D: road, cars, bombs, sky, environment.
- `src/game/` — glue: GameLoop, GameState, CombatResolver, LevelManager.
- `src/screens/` — menu/dialog/overlay screens (PixiJS).
- `src/input/` — DragDrop and pointer handling.
- `src/ads/` — AdMob wrapper (`AdManager.js`).
- `src/analytics/` — Firebase analytics.

**Director never modifies render objects. Renderers never mutate GameState.**

### Dual-renderer canvas stack

PixiJS canvas (z-front) overlays the Three.js canvas (z-behind). They share no WebGL context.

### Camera — single top-down orthographic

One `OrthographicCamera` in `Scene3D.js` renders everything. No perspective camera, no dual-camera setup. `CameraFX.js` wraps the camera for transient juice only (shake, breach zoom pulse, combo zoom-out, level-intro zoom) — steady-state zoom is 1.

### 3D Scene Coordinate System — SINGLE SOURCE: `src/renderer3d/projection.js`

```
Z = -26  ROAD_Z_FAR   — car spawn line (far/top of screen)
Z = -2.6 POS_NEAR_Z   — position-100 car stop line (front car anchor)
Z =   0  ROAD_Z_NEAR  — breach line (3D stripe anchor)
Z = +1.4 to +7.0      — bomb queue slots (Shooter3D slotZ = (s+0.5)·CELL·0.70)
Z = -65  ROAD_Z_VANISHING — visual road extension (no gameplay)
```

Lane width = `CELL = 4.0` world units. For 4 lanes: X = −6, −2, +2, +6.

**All world↔screen math lives in `src/renderer3d/projection.js`** (pure, no Three/Pixi — safe for tests and input code). The camera, PositionRegistry, roadGeometry, CityEdges, and ShooterRenderer all derive from it. **NEVER hardcode a projected value** (a stale `FRUSTUM_HALF_X = 9.650` mirror once shifted every 2D overlay/tap anchor ~17px; the visual harness caught it). `laneToX(idx, n)` / `posToZ(position)` (Scene3D) and `worldXToScreenX` / `zToScreenY` / `posToScreenYProjected` (projection.js) are the only correct ways to compute positions.

### Position Registry (CRITICAL — never bypass)

`src/renderer/PositionRegistry.js` is the single source of truth for lane/column screen positions. Called from `GameApp._startLevel()` before renderers initialize. All hit-testing and overlay positioning must use the registry.

### Popup Queue

`src/renderer/PopupQueue.js` — all popups/banners/toasts route here.  
Priorities (highest first): CRITICAL, TUTORIAL, CAR_TYPE, ACHIEVEMENT, COMBO, AMBIENT.  
**No ad-hoc popup spawning.** Ever.

### Sprite paths

Always `${import.meta.env.BASE_URL}sprites/...`. Hardcoded `/sprites/...` causes GitHub Pages 404.

### Themes (ThemeRegistry.js)

| Levels | Theme | Notes |
|--------|-------|-------|
| L1–4   | morning | warm cream-gold |
| L5–8   | afternoon | deep blue sky |
| L9–12  | sunset | indigo-orange |
| L13–15 | misty | cool grey; fog near=20 minimum — do not lower |
| L16–30 | industrial | steel grey + orange hazard (World 2) |
| L31+   | nightHighway | near-black sky, neon fog (World 3) |

---

## 6. Current State

### Tests
**1186 passing**, 5 todo — 47 test files. Run: `npx vitest run`. All headless (no render tests).
Visual smoke (`npm run test:visual`, Playwright) is separate and is a blocking CI gate.

#### STALE-VALUE REGISTER — the project's most-repeated bug class (7 shipped instances)

**A value copied from, or captured before, its canonical source.** Every instance passed
tests, because tests asserted the value against itself. Shipped so far:

| # | where | what drifted |
|---|-------|--------------|
| 1 | `Car3D._breachRow` | captured before configure |
| 2 | `goalCounterUI.setGoals` | called before `setActiveLaneCount` |
| 3 | `setActiveColCount` | not re-applied on rebuild |
| 4 | `BenchRenderer.benchY` | derived from ball radius, not socket extent |
| 5 | `Shooter3D._baseZ` | lazy latch, never cleared — survived every band change |
| 6 | queue-fit solver | solved for slot 3, the RETIRED stash slot |
| 7 | `DROP_START_Z` | absolute world Z; travel varied per row AND per band |

**Audited 2026-08-06. Still present, CORRECT today but fragile — check these first when
something looks misplaced:**

- **`CameraFX._baseP`** (`CameraFX.js:33`) — captured in the constructor; refreshed only by
  the explicit `setLaneCount()` hook. Correct today. Breaks the moment another path moves
  the camera without calling it. Its own comment records this bug being caught in the pilot.
- **`Shooter3D:507` stash `_baseScale`** — the same `== null` latch shape as `_baseZ`, on the
  dead stash path (see below). Harmless only because the code it serves is unreachable.
- **`APP_W = 390` / `APP_H = 844`** — hand-copied into `GameApp`, `CityEdges`,
  `TutorialOrchestrator`, `ShooterRenderer`, `SettingsScreen` rather than imported from
  `projection.js`. Stable in practice; a stage-size change would need all of them.
- **`projection.BOOSTER_BAR_TOP_Y` ↔ `BoosterBar.BAR_Y`** — a deliberate duplicate
  (projection.js must stay Pixi/DOM-free), guarded by `tests/bomb-slot-position-sync.test.js`.

**KNOWN DEAD, NOT YET REMOVED — the stash.** `DragDrop._hitTestStashArea()` returns `false`
unconditionally, so the stash is unreachable in play. But `Column.stash`/`stashBomb`, three
DragDrop paths, per-level Shooter3D stash meshes, `ShooterRenderer`, `PositionRegistry` and
`projection.stashZ` are all still wired. **This remnant has already caused two bugs** (#6
above, and `SLOT_COUNT` being 4). Removing it spans ~10 files and is a feature-removal
decision — it needs the owner's approval, not a cleanup commit.

#### SCREENSHOT REVIEW LOOP — MANDATORY before reporting ANY visual change
**Not optional. Not conditional on the change seeming small.** Before reporting any change
that alters what the player sees:

1. **Clear `docs/review/`** of prior screenshots — a stale image next to a fresh one is worse
   than no image.
2. Place the **BEFORE and AFTER** images for whatever changed this session. **The pair is the
   point** — the user needs to see what CHANGED, not just what the current state is. An
   "after" alone hides regressions; it also hides the case where nothing actually moved.
3. Write **`00-labels.txt`**: for every file, what it shows and **what to look for**.
4. **Present them for review**, with the full paths, and stop for the user's eyes.

**Why this is load-bearing, not ceremony.** Several defects in this project were caught ONLY
because the user looked at actual pixels, after headless gates and measurements had passed
clean: cars sliced by the goal band, socket rings 41% oversized at band 600, and bombs
rendering out of their slots after a band transition. Each had green tests either side of it.

It is also the loop that keeps long autonomous runs honest — without it those sessions drift
into measurement churn and instrument-building instead of shipped, verified work. If a change
is genuinely invisible (docs, tests, sim-only), say so explicitly instead of skipping silently.

**Capture the condition that reproduces the bug, not a convenient one.** The 2026-08-02
ball/socket misalignment does NOT appear on a fresh level load — only after a band transition
(L13 -> L5). A rest screenshot of L5 alone would have "proved" a bug-free queue.

#### READ THE CALL SITE — don't infer a sequence from a symptom
**Verify WHERE a callback fires before building a fix around WHEN it fires.** Two diagnoses in
the 2026-07 arc asserted call ordering without reading the actual call site, and both looked
right:
- *"`col.consume()` fires `_onAutoFill` before `_startFiring` sets `firingSlots`"* — the
  callback is not in `deploy()` at all. Its call sites are in the refill/advance paths, which
  run after `_startFiring`. A fix was authorised on this premise and would have changed nothing.
- *"the first-shot hitch is a per-level warm-up cost"* — it is **session**-scoped. Measured
  1699ms on the session's first shot, then 188ms on a different level and 274ms on the same
  level re-entered. A per-level warm-up was built against it and measured no improvement.

Same family as the four create-before-configure bugs (§0c of `GEOMETRY_MECHANICS_BATCH.md`):
unverified assumptions about *when* things happen. Grep the call sites; don't reason backwards
from the symptom.

#### VERIFICATION COST MUST BE BOUNDED — stop after two failed attempts and escalate
**If confirming a fix costs more than the fix, stop and report.** This is the most expensive
lesson in the project's history and it is a process failure, not a technical one.

The merge-ordering gate is a handful of lines with a mechanism confirmable by reading
`GameLoop`. Verifying it consumed **six sessions** and produced: five instruments that gave wrong
readings, one "live production bug" escalated to top priority and then retracted, a sanity check
that raised its own false alarm, and two reverts — while the fix the user reported sat unshipped
the whole time. No single probe was unreasonable. The failure was continuing to refine
measurement with no limit.

**The rule:** after **two** failed verification attempts on the same claim, STOP. Report (1) what
is confirmed, (2) what is not, (3) the cheapest remaining path. **Do not build a third instrument
without explicit approval.**

Weigh what a fix actually needs. A change whose mechanism is confirmed by code reading, gated by
the full test suite, and trivially revertible does not always need a bespoke harness. **The
user's own device observation is legitimate evidence** — he reported the merge animating over the
bomb shot, and that report was never in doubt while six sessions went into trying to reproduce it
synthetically.

**Bounded is not the same as cheap — FUND a budget, don't shrink the sample (2026-07-31).**
Two CI failures in a row on `boss-infra.test.js` were `Test timed out in 5000ms` — vitest's
default — not assertion failures. Both were fixed by giving the test an explicit budget, and
both are deliberate:

| test | cost | budget | why not just sample less |
|------|------|--------|--------------------------|
| L10 supply-bias | 600 sims (2 configs x 300 seeds) | `30_000` | seeds were raised 150→300 precisely so a 2pt margin is signal rather than noise; cutting them back would make the number untrustworthy and the gate meaningless |
| L20 crest/lull   | 300 sims (2 scripts x 150 seeds) | `30_000` | **always** unfunded — it sat just under the 5s default and only tipped over once the L10 test in the same file grew. Not a new cost, a pre-existing one that surfaced |

The distinction that matters: shrinking a sample to fit a timeout **changes the measurement**
and calls the resulting noise a result. Raising the budget changes only how long CI waits.
When a heavy sim test times out, fund it. This is also the third instance of the project's
"green locally, red in CI" shape — a dev box absorbs the cost, a loaded runner does not.

#### ASSERT THE REAL STATE, NEVER A PROXY — and wait on signals, not intervals
Five diagnostic instruments in this arc produced wrong readings. Two mistakes, every time:

**1. Reading state after a guessed time window.** Every wrong reading came from sampling N ms
after an action and assuming resolution had finished. Wait on something only completion produces.
`gs.turnCount` exists for exactly this — it increments once per completed turn at
`_advanceGrid`, including under FREEZE.

**2. Inferring "the game is running" from a proxy.** **Four things pause the loop:**

| source | sets `dragDrop.inputBlocked`? |
|---|---|
| `_modalActive` (hint / colour-bomb cards) | yes |
| colour picker | yes |
| **`TutorialOrchestrator.show(pauseGame)`** | **NO FLAG AT ALL** |
| player pause / tab-hidden / WebGL context-lost | no |

A harness inferring pause from `inputBlocked` sees only the first two and **counts runs frozen by
the others as CLEAN**. That is what produced "8/9 shots deal no damage" and "0/23 turns advanced"
— a paused game, not a broken one. `TutorialOrchestrator` resumes only via `completeIfActive(id)`
(needs the player's actual required action, e.g. a real drag) or `dismiss()`; **tapping a pixel
does nothing**, which is how harnesses got stuck on the "drag the bomb" screen.

**Use `_nav.getGameLoop().paused` and `_nav.dismissTutorial()`** (dev-only hooks). Assert
`!paused` at every sample; discard and COUNT any run paused for a reason you did not cause.

`boardAdvanced` is structurally unusable as a canary: `_advanceGrid` skips car movement under
FREEZE by design, so "the board didn't advance" is satisfiable by a correctly-frozen game as well
as a broken harness. (In principle — freeze was not what occurred in the traces above, but the
ambiguity is real and disqualifies the metric.)

**Prefer a time-series of raw state over a derived metric.** A derived metric can be true on both
the success and failure path; a sequence shows which occurred. `scripts/harness.mjs` is the
validated reference implementation — it reports a baseline of 1 turn and 1 damaged lane per
deploy, which is what a working game does. Any instrument whose baseline does not look like a
working game is still wrong; fix it, do not report from it.

#### DIAGNOSTIC PROBES MUST ASSERT THEIR PRECONDITIONS — the wait-condition rule applies to TOOLING
The rule below is about tests. It applies just as hard to the throwaway probes used to diagnose
a bug, and that is where it keeps being forgotten. **A probe that cannot tell you it was
contaminated will report the contamination as a finding.**

Worked example, 2026-07-30. Probes dismissed intro cards by clicking a fixed pixel (195, 430).
That cannot distinguish *dismissed* from *missed* — the exact antipattern this file already
warns about, reproduced in the diagnostic tooling. Earning a colour bomb enqueues a modal, and
`_runNextModal()` calls **`gameLoop.pause()` until a real tap dismisses it**. A paused loop never
resolves a shot, so every sample read zero damage regardless of the code under test. That was
reported as "the merge gate suppresses damage, 5/6 shots lost" and escalated as a live product
bug. Re-measured excluding contaminated samples: **2 of 5 samples were modal-blocked, and clean
shots damaged 3/3.** The bug did not exist. The user noticed the probe window sitting on an
undismissed colour-bomb screen.

**Three findings in ONE session traced to instrument flaws, not code:**
1. **~6fps everywhere** — headless Chromium falls back to SwiftShader (see below).
2. **"4/5 shots lose damage" with no pause at all** — a raw lane-hp total, where refill spawns a
   replacement and hides the kill. Caught only because the number was absurd.
3. **"gate suppresses damage"** — modal-paused loop, above.

**Two more, 2026-08-07 — both silently voided a whole investigation, not one sample:**

4. **`window._nav` DOES NOT EXIST IN PRODUCTION.** The hook block is wrapped in
   `if (import.meta.env.DEV)` (`GameApp.js`). Every probe that waits on `_nav` therefore times
   out against the live Pages build — and a `waitForFunction` timeout reads as "the live site is
   broken / unreachable", not as "wrong instrument". The desktop-clipping investigation ran
   **nine viewport sweeps that were all dev-server-only** while being reported as covering the
   build the player actually runs. **If a probe targets the live URL, it may not depend on
   `_nav`;** wait on `canvas:not(#three-canvas)` and read the DOM. (`canvas` alone matches
   `#three-canvas` first, which is `display:none` on the title screen — so even the wait selector
   has a wrong-thing-shaped trap in it.)
5. **`_nav.dismissTutorial()` is not sufficient to unpause a level.** Measured at L8: `paused`
   stayed `true` through 15 calls, refills stopped, and a ball-position time-series recorded
   **zero displacement** — reported as "no bug" when in truth nothing had fired. Six real canvas
   taps cleared it. This does not contradict the tutorial rule above; it means the pauser was a
   different one of the four (a modal, which `_runNextModal` holds until a **real tap**), and
   `dismissTutorial()` cannot tell you that it was not the blocker. **Assert
   `!_nav.getGameLoop().paused` after attempting dismissal — never assume one dismissal API
   cleared whatever is actually holding the loop.**

**The shared lesson in 4 and 5:** both probes returned a clean, plausible, *quantitative* result
(`clipped=false` everywhere; `0` displacement samples). Neither could distinguish "measured the
thing and it is fine" from "never measured the thing". **A zero is not evidence until the probe
has proven its stimulus fired** — verify the deploy landed, the queue depth changed, the loop is
running. Three of this project's void measurements were zeros of exactly this shape.

**Rules:**
- Assert preconditions before sampling, and **exclude contaminated samples explicitly** rather
  than assuming they are absent. Report how many were excluded.
- Prefer an **existing observable** over inferring state from pixels or elapsed time:
  `dragDrop.inputBlocked` (modal/merge), `gs.hitStopRemaining`, a tagged object leaving a
  collection. These already exist — reach for them before inventing a heuristic.
- Sanity-check every number against what the game would have to be doing for it to be true. "The
  game runs at 6fps" and "most shots deal no damage" both describe an unplayable game; both were
  instrument artefacts.
- A control run is worth more than a bigger sample. Change one variable, keep the instrument
  identical.

#### A POLLING SAMPLER CANNOT TELL "PERSISTS" FROM "RECURS"
Prefer an **edge-triggered** instrument for any "did X happen at the moment of Y" question.
Worked example: an 8ms poll reported *107 merges animating mid-flight*. The real number was
**2** — `mergeSequencer.start()` calls `gameLoop.pause()`, which freezes an in-flight shot with
`firingSlots` still occupied for the whole animation, so one legitimate merge produced ~100
samples. Re-measuring at the single instant `start()` fires gave 2 of 2 before a candidate fix
and 0 of 6 after. A wrong instrument here produces a wrong root cause and a wrong fix.

#### HEADLESS FPS IS NOT EVIDENCE — measure performance in HEADED Chromium only
Headless Chromium has no GPU here and falls back to **SwiftShader** (software
rasterisation), which pins this game at **~6fps regardless of what the code does**. A headless
measurement tells you about the rasteriser, not the game.

```js
// Perf harnesses MUST launch like this:
chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] })
```
Verified 2026-07-26: headless reports `SwiftShader driver`; headed reports
`Intel(R) UHD Graphics ... D3D11`. Same build, same level — 6fps vs 66fps.

**This is the second time SwiftShader has corrupted a conclusion in this project.** It also
underlies the "slow CI" flakes: `.github/workflows/deploy.yml`'s visual-smoke runs on software
WebGL, which is why timeout-shaped failures there are usually a budget problem rather than a
real regression (see FABLE_EXIT_BRIEF §1 "Real regression vs. load-flake"). If a number looks
impossibly bad, check what is drawing before you believe it.

#### Wait conditions that are also true on failure — CHECK THIS WHEN WRITING ASYNC TESTS
A test that waits for state X before asserting is **broken if X is reachable by a failure
path**. It will not flake — it will confidently report the wrong thing.

`firingSlots[lane] === null` is true both after a bomb lands *and* when it never launched. A
drag whose pickup was swallowed by an overlay satisfied that wait instantly, so the test read
an unchanged board and reported a product bug ("drag deploy did not land") that was actually a
setup failure. **This has now bitten three times**, each time on the same instinct:
1. `5d80ebd` replaced fixed-timeout waits with this very poll (an improvement that carried the
   flaw in).
2. 2026-07-25, `boundaries.spec` — overlay ate the pickup; reported as a targeting bug.
3. 2026-07-25, `layout.spec` — `GameLoop.deploy()` rejects outright while ANY lane has a shot
   in flight, and `dismissOverlays()` taps the road, which can launch one. The deploy was
   never accepted; the test called it "no effect on lane 0".

**A CI-only assertion failure is STILL this antipattern — not a new category.** A slow
environment does not produce assertion failures on its own. It produces them when a wait gives
up early and the assertion then reads a state the failure path also satisfies. Resist widening
this to "assertion failures can be environmental"; that weakens a rule that exists for good
reason. **Before treating any CI-only assertion failure as environmental, identify which wait
is giving up and what state it leaves behind.**

Third instance, same test (2026-07-27): `boundaries.spec` L5 drag deploy failed in CI on a
**docs-only commit**, which proved no diff caused it. Measured under SwiftShader: the FIRST
shot of a level resolves in ~4.6–4.8s (later shots ~0.7–0.9s) because the game loop advances
only ~0.10s of game time per ~3.9s of wall clock while one-time GPU work compiles. The budget
was 5000ms — ~95% consumed — so a marginally slower runner blew it, the wait gave up, and the
assertion read an unchanged board and reported "drag deploy did not land". Always lane 0, never
lane 2, because lane 0 is the first shot. Fixed by measuring the real budget AND asserting
"never resolved" separately from "resolved but missed".

**When choosing a wait signal, ask what else makes it true.** Prefer a signal only the success
path can produce. Two that look right and are not: `firingSlots[lane] !== null` is a transient
in-flight window a poll can miss (so it retries an already-successful action), and
`shooters.length` dropping is erased by the queue's immediate refill. The durable one is the
**tagged bomb object** leaving the queue. Also check the action's own PRECONDITIONS — if the
API can reject the call, wait for it to be acceptable first (`game.waitForIdle()`), rather than
inferring rejection from an unchanged board.

### What is done
- **40 levels** configured in `LevelManager.js` (L1–L40, three worlds)
- **Car type intro cards** (`src/screens/CarTypeIntroCard.js`) — fires at: L1 small, L2 big, L5 jeep, L9 truck, L13 bigrig, L15 tank
- **Streak Shot** — `streakCount` + `streakActive` in `GameState.js`; 3 consecutive correct hits → double-damage power shot
- **AdMob** — `src/ads/AdManager.js` with Google **test** IDs for rewarded video and interstitial
- **Signed release keystore** — `android/lane-defense-release.keystore` (gitignored). **Never delete.**
- **Balance simulator** — `tools/balance-sim.js`
- **Car rendering** — flat `PlaneGeometry` + `CanvasTexture` + `MeshBasicMaterial`. No GLB models.
- **Danger Aura** — red pulse on cars within 2 rows of breach gate
- **Fairness rules** (FR-1 through FR-5) enforced in `GameLoop._enforceViableMove()`
- **Wrong-color shot = no advance** (shipped — never revert)
- **Bomb hits color-matching cars only** (shipped — never revert) — this is the QUEUE
  bomb the player drags onto a lane. It is not the BOMB booster; see the next entry.
- **BOMB booster clears the targeted car's LANE**, any colour, any row (shipped
  2026-07-31 — never revert). Mirrors `docs/VISION.md` item 8, amended by the owner on
  the same date. It was a ROW clear; device play rejected that ("hits a vertical left to
  right line and not a car lane"). The bomb travels to the tapped car, then clears that
  car's lane. Sim models the decision as THREAT, not yield — a lane clear's yield is
  deterministic, so yield degenerates into "fire at the fullest lane, any time";
  `BOMB_THREAT_ROWS = 2` matches the Danger Aura's existing 2-row warning.

### What is NOT done (production gates)
- Replace AdMob test IDs with production unit IDs
- Signed release APK for Play Store
- Play Store listing (screenshots, feature graphic, privacy policy, Data Safety form)
- Closed test track ≥ 12 testers × 14 days
- World 2 / World 3 themes exist in ThemeRegistry; their visuals have not been art-directed
- City repair meta loop (city visible on level select, state saved to ProgressManager — see VISION.md)

---

## 7. Mandatory Self-Audit Before Every Commit

Take screenshots from: **L5** (4-lane afternoon), **L9** (sunset), **L13** (misty), **L17** (industrial / World 2).  
**Never use L1** as a visual benchmark (single lane, no representative load).

Check each frame:
- Are car colors vivid and instantly readable by color? (no washed-out tints)
- Do car shapes differ visibly by type? (bike narrow, tank wide with turret, bigrig long)
- Are cars visible throughout the road in misty theme?
- Are bomb columns aligned under their lanes?
- Is the breach line visible as a real danger threshold?
- Does the Play Store standard question (section 1 — THE STANDARD) get a YES?

Fix any NO before committing.

Before committing any change to `LevelManager.js` or `CarTypes.js`:
1. Run `node tools/balance-sim.js --level=N --runs=500` for affected levels
2. Win rate must be within target band for that level's difficulty tier
3. If not — adjust level config, not the simulator

---

## 8. What NOT to Touch

- `src/director/` — 633 tests cover it; changes need matching test updates
- `src/models/` — data classes; shape changes cascade everywhere
- Vite config base-path logic
- `BASE_URL` sprite path patterns
- `docs/VISION.md` — locked contract; do not modify without user approval
- The Play Store standard in section 1 — never downgrade this requirement
- Test files (unless adding tests or updating assertions for intentional behavior changes)

---

## 9. Anti-Patterns (Forbidden)

- Spawning popups outside `PopupQueue`
- Computing lane/column positions without `PositionRegistry`
- Hardcoded X/Z world coords instead of `laneToX()` / `posToZ()`
- Adding new top-level `src/` folders without discussion
- Band-aid patches when a structural fix is correct
- Preserving "for compatibility" code that no longer serves a purpose
- **Do not re-add HP bars to cars** — intentionally removed; damage shown via emissive glow only
- **Do not re-add a start gate above the road** — intentionally removed from Road3D.js
- **Do not re-add survival/endless mode** — incompatible with turn-based grid; was removed
- **Do not commit visual changes without a screenshot from L5+**
- **Do not reference L1 as a visual quality benchmark**

---

## 10. Color Palette

```
Red:    #E24B4A   (0xE24B4A)
Blue:   #378ADD   (0x378ADD)
Green:  #639922   (0x639922)
Yellow: #EF9F27   (0xEF9F27)
Purple: #7F77DD   (0x7F77DD)
Orange: #D85A30   (0xD85A30)
Boss:   #CC44CC   (0xCC44CC)
```

Duplicated in: `Car3D.js`, `Shooter3D.js`, `Projectile3D.js`, `src/input/DragDrop.js`. Update all four if changing any color.

---

## 11. Fairness Rules (Director enforces — never violate)

1. **FR-1** At least 1 column top must color-match at least 1 front car.
2. **FR-2** At most 3 of 4 front cars share the same color.
3. **FR-3** Average shooter damage ≥ 50% of average front car HP.
4. **FR-4** No car HP exceeds 2.5× the highest available shooter damage.
5. **FR-5** At least 2 distinct colors in the top shooter row.

Viability guard also checks bench slots (L6+).

---

## 12. Coding Preferences

- Pure JavaScript (no TypeScript)
- ES modules, Node 18+ (CI: Node 24)
- No frameworks for game logic — plain classes, plain functions
- Single-concern modules, one class per file
- Explicit over clever
- No emojis in commit messages
- Inline styles for HTML-based UI (no Tailwind)

### Commit Scope Rule
When deciding what to commit:
1. Always commit `src/` changes
2. Always commit new files in `src/` or `scripts/`
3. Skip: `docs/level-screenshots/`, `public/sprites/raw/`, `*.png` in project root
4. When uncertain: commit it. Easier to revert than to lose work.

Never spend more than 30 seconds deciding what to commit.

---

## 13. Tooling

### Screenshot Standard
Always use `scripts/screenshot.mjs` for Playwright screenshots.
Path: `docs/level-screenshots/current/[name].png`
Read back with: `Read docs/level-screenshots/current/[name].png`

```js
import { takeScreenshot } from './screenshot.mjs';
const filepath = await takeScreenshot(page, 'L5-gameplay');
// then: Read tool on filepath
```

### Screenshot Workflow (review captures — ALWAYS follow)
All review/verification screenshots (the ones shown to the user at the end of a task) go to a single, always-fresh folder:

1. **Location:** `C:\Users\dalit\lane-defense\docs\review\` (`docs/review/`).
2. **Always fresh:** DELETE every existing file in `docs/review/` BEFORE saving a new batch, so the folder only ever holds the current review set.
3. **Names:** short numbered files — `01.png`, `02.png`, `03.png`, …
4. **Labels:** add `00-labels.txt` describing each number, one per line — e.g. `01=reorder highlight, 02=yellow merge pop`.
5. Applies to ALL future screenshot captures in this project, every task — not a one-off.

End the response with the full absolute path(s) under `docs/review/`.

### Playwright PixiJS Clicks
Use `scripts/pixi-coords.mjs` for all game canvas interactions.
Stage dimensions: **390 × 844**.
Always target: `canvas:not(#three-canvas)` — the Three.js canvas (`#three-canvas`) has `pointer-events:none` and swallows all events silently.
Never recalculate coordinate math from scratch.

```js
import { tapStage, getPixiRect, stageToClient } from './pixi-coords.mjs';
await tapStage(page, 195, 470);  // PLAY button
```

### Active Skills (exact invocation names)
Run `claude skill list` to see all. Key skills for this project:

| Skill | When to use |
|-------|-------------|
| `requesting-code-review` | Before every commit |
| `lane-defense-audit` | Visual quality audit |
| `systematic-debugging` | Any bug or unexpected behavior |
| `lane-defense-design-system` | UI/screen design work |
| `brainstorming` | Before new feature/component work |
| `verification-before-completion` | Final check before marking done |

---

## 14. Useful Commands

```bash
npm run dev            # Vite dev server (--host for LAN/phone)
npx vitest run         # full Vitest suite (must be green)
npm run build          # production build → dist/
npm run browser:kill   # clear stuck Playwright Chrome (BEFORE a session only)
node tools/balance-sim.js --level=N --runs=500   # regenerate level difficulty
window._nav.startLevel(5)   # dev API — jump directly to L5 in browser
```

---

## 15. Token Rules (Claude Code)

- `/clear` between unrelated tasks
- `/compact` when context grows long
- Batch multiple file edits into single prompts
- Name exact files; don't explore unnecessarily
- `.claudeignore` excludes: node_modules, dist, android, .git

---

## 16. KEYSTORE — NEVER DELETE

`android/lane-defense-release.keystore` is NOT in git (gitignored).  
Path: `C:\Users\dalit\lane-defense\android\lane-defense-release.keystore`

**LOSING THIS FILE = LOSING THE ABILITY TO UPDATE THE APP ON PLAY STORE FOREVER.**  
Password: `lanedefense2024`

---

*Last updated: 2026-05-25 — added Tooling section (screenshot standard, PixiJS coords, active skills), commit scope rule.*
