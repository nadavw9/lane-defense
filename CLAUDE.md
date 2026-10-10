# Traffic Bomb — Project Context

> **For Claude Code: auto-loaded on every session. Read in full before any task.**

## 0. ACTIVE WORK — continue from here (any model)

An approved 3-workstream master plan is in progress (WS1 testing DONE → WS2 UI → WS3 difficulty):
1. **Status/tracker:** `docs/superpowers/plans/2026-07-02-master-plan-testing-ui-difficulty.md`
2. **Per-task HOW + work guidelines + model routing + art prompts:** `docs/superpowers/plans/IMPLEMENTATION_PLAYBOOK.md`

Route mechanical spec-execution to cheaper models; reserve Fable/Opus for design judgment
(playbook §2).

### PLAY THE GAME BEFORE CALLING IT DONE — QA bots (2026-09-28)

The owner found an L1 soft-lock in 5 seconds of play that 1300 green unit tests never saw.
Run the game, not just the suite. The bots drive the REAL input path (DragDrop handlers,
real canvas taps) against a dev server and flag stalls, not balance:

| script | what it proves |
|---|---|
| `scripts/autoplay.mjs <out> 1 41` (41 = daily) | every level playable to win/lose: emptyBoard, noMove, turnStuck, pauseStuck, dropRefused, rescue resumes, boosters spend, loss history |
| `scripts/ftue-play.mjs <out> 6` | brand-new save: title → map → card → real mouse drags → win → NEXT |
| `scripts/booster-qa.mjs <out>` | colour change / freeze / bomb through real taps + armed-bomb-vs-pause regression |
| `scripts/economy-qa.mjs` | shop → inventory → level → settle |

Run them against a **worktree of the commit under test on port 5174** (`QA_URL=http://localhost:5174/`),
never the dev server you are editing — HMR reloads kill a run mid-level. Headless is ~1 fps under
load at DPR 2: wait on state (`getScreens()`, `dbgRescue().built`), never on time, and use DPR 1.
Bugs these found on 2026-09-28: L1 empty-road soft-lock (row-0 staging), L4 bench tutorial input
lock, CONTINUE after a boss breach = unwinnable level, queue reorder grabbing the wrong bomb,
rainbow bombs recoloured to 0 damage.

### VALIDATION — the gates cost more than they caught; these are the rules (2026-08-08)

**1. Docs-only changes go straight to master.** No branch, no CI wait. A markdown file cannot
break the game. Includes handoffs, plan docs, register updates, and this file.

**2. Never run visual smoke locally. `npm run test:visual` is CI's job.** It does not attribute
failures on this machine and produces noise rather than signal — measured across three
consecutive clean runs with nothing else executing: a feature branch failed `layout.spec.js:77`
and `transitions.spec.js:63` twice, `master` failed three *different* specs
(`layout.spec.js:22`, `viewport-fit`, `worlds` L20) plus five flaky, and **every one of them
passes in isolation**, including both of the branch's when the two spec files are run together.
CI runs the same suite properly on clean runners. **The local gate for code is `npx vitest run`,
nothing else.**

**3. Never `gh run watch`.** Push, move to the next task, read the result when you start the
task after it. Sitting in a watch loop burns session time for no information.

**4. Branch + CI only for the deploy/merge path** — `GameLoop`, `DragDrop`, the merge sequencer,
`CombatResolver`. That surface is genuinely CI-sensitive (see below). Everything else commits to
master; if CI goes red, fix forward.

**5. Two-attempt rule.** After two failed attempts at the same thing, stop, write down what is
confirmed and what is not, move on. No third instrument, no third fix.

`CI=true` + SwiftShader ×3 locally is **retired** — it was the same ~15-minute job CI already
does, was the largest single source of wall-clock waiting, and never once caught what CI caught.

**Pages deploys are cancelled by ANY branch push** (`concurrency: group: pages,
cancel-in-progress: true` is repo-wide). Push master, then leave the remote alone until the
deploy finishes, or it dies half-way and the live bundle silently stays on the old hash.

### KNOWN LOCAL ISSUE — not a code defect

**`layout.spec.js:77` and `transitions.spec.js:63` fail in local full-suite runs.** Attributed
2026-08-08 and confirmed NOT to be a regression: they failed twice on `fix/bomb-blast-lane-shape`
(including at `a716040`, before the DragDrop guard change existed, which rules that change out),
did **not** fail on `master` — which failed three unrelated specs instead — and **both pass when
their two spec files are run together**, 9/9. Branch CI's `visual-smoke` was green on the same
commits. This is local full-suite instability under parallel workers, not a defect. Do not
"fix" it by changing game code.

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
locally — full vitest, full visual-smoke, and (under the retired recipe) `CI=true` + SwiftShader
across 3 repeats. **That local SwiftShader triple never once caught what CI caught**, which is
the other half of why it was dropped; see the validation recipe above. Two of
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

Hybrid-casual mobile puzzle-defense game. Cars in colored lanes advance toward the player one row per correct shot. Player drags color-coded bombs onto lanes — color must match the front car to deal damage. Turn-based grid, not real-time. 100 levels across 7 worlds (L1-40 hand-tuned, L41-100 authored in `src/game/LateLevels.js` and sim-tuned). Live on GitHub Pages; native Android via Capacitor.

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

One `OrthographicCamera` in `Scene3D.js` renders everything. There is no perspective or dual-camera setup. `CameraFX.js` is **shake-only** (2026-10-03): **the camera never zooms** — zoom is always 1. Combo zoom-out, breach zoom pulse, level-intro zoom and the Pixi breach scale pulse were removed because the Pixi layer (sockets, taps, sparks, goal band) is anchored to rest geometry and cannot follow a zoomed 3D camera: the bomb zone drifted off its sockets for seconds after a kill, backdrop edges showed, and taps misaligned. Shake is a pure translation: `GameRenderer3D.update` sets a **zone offset** (camera shake offset + Pixi stage shake px / `PX_PER_WU`) on `Shooter3D` (balls + zone floor) and `Road3D` (depot overlay / zone floor) so the bomb zone stays locked to its sockets. GameApp pushes the stage offset every frame via `setStageOffset`. Do NOT add zoom/scale effects to the camera or stage without also moving every Pixi anchor. Dev hooks: `_nav.getRenderer3D()`, `_nav.getStage()`, `_nav.forceStageShake(t)`; verify with the NDC probe (ball vs socket deviation must be 0.00 px under shake).

### 3D Scene Coordinate System — SINGLE SOURCE: `src/renderer3d/projection.js`

```
Z = -26  ROAD_Z_FAR   — car spawn line (far/top of screen)
Z = -2.6 POS_NEAR_Z   — position-100 car stop line (front car anchor)
Z =   0  ROAD_Z_NEAR  — breach line (3D stripe anchor)
Z = bombSlotZ(0..2)     — three visible queue slots, computed from breach clearance and pitch
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
| L31-45 | nightHighway | near-black sky, neon fog (World 3) |
| L46-60 | desert | World 4 Sun Valley (art: backdrops baked, no side strips) |
| L61-75 | frost | World 5 Frost Pass |
| L76-90 | harbor | World 6 Harbor Lights |
| L91-100 | cosmos | World 7 Starlight Strip |

---

## 6. Current State

### Tests
**1533 passing**, 1 skipped, 5 todo — 81 files (+2 skipped). Run: `npx vitest run`. All headless (no
render tests).
Visual smoke (`npm run test:visual`, Playwright) is separate and is a blocking CI gate.

#### DELEGATE SEARCH AND MAPPING TO A HAIKU SUBAGENT — this is a rule, not a suggestion

**FIRST, CHECK WHETHER DISPATCH IS EVEN ALLOWED — these are TWO switches, not one.**

`CLAUDE_CODE_SUBAGENT_MODEL=haiku` only names **which model a subagent would use if one
were started**. It does not grant permission to start one. If the session config carries an
instruction like *"do not call the Agent tool unless the user requested it"*, dispatch is
blocked outright and every threshold below silently never fires — the rule then looks
broken when it is actually gated.

That is exactly what happened on 2026-08-06. A long session mapped 216 stash references
across 10 files, swept the tree for stale constants and inventoried dead code, and spawned
**zero** subagents. The first diagnosis written here — "habit, not task shape" — was WRONG,
asserted without checking whether dispatch was permitted. It was permission, not habit.

So: if delegation never seems to trigger, **verify the permission switch before tuning the
threshold**. When dispatch IS available, the triggers below apply.

**Spawn a haiku subagent when ANY of these is true — do not deliberate, just do it:**

1. The step needs **reading or grepping more than 3 files** to answer one question.
2. It is a **pure search / map / inventory** step whose output is a LIST, and no edit
   happens inside it (find every reference to X; which files define Y; does Z appear
   anywhere).
3. It is a **pre-edit survey** — establishing blast radius before touching code.
4. It is **auditing docs against code** across more than 2 documents.

**Do NOT delegate:** anything that edits files, anything needing this session's accumulated
context to interpret, measurement whose *method* is the hard part (the harness, the
projection probes — those failed repeatedly on subtle instrument bugs that a cold subagent
would repeat), or a judgement call the user asked ME for.

**Why a threshold rather than "consider delegating" — ONCE dispatch is permitted:** a soft reminder is exactly what was in
place, and it produced zero delegations across a very long session. Inline always feels
cheaper in the moment — the context is already loaded and the grep is two seconds. The cost
is invisible per-step and only shows up on the bill. A number removes the judgement call.

Report which steps were delegated when summarising work, so this stays visible.

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

**HISTORICAL DEAD SURFACE — stash retirement is complete.** The stash was unreachable and caused
the queue-fit and slot-capacity drift recorded above. Its runtime code was removed in the
stash-retirement work; `Shooter3D.SLOT_COUNT` is now 3 and the bench is a separate four-slot
storage area. Remaining stash references in this incident log are provenance, not live code.

#### HISTORICAL INCIDENT — tests that assert outcomes can miss presentation entirely
**A suite that only checks state cannot fail on a defect the player can see.** This shipped,
and then survived six weeks of the owner re-reporting it against green evidence.

The BOMB booster was converted from a ROW clear to a LANE clear. The kill model was converted
correctly and pinned by `tests/bomb-lane-only.test.js` — nine tests, all green, plus a device
check confirming "4/4 kills in-lane, 0 outside". **Every one of them asked which cars die.**

This incident is closed in the current renderer: the lane-targeted explosion path is also
implemented. The old all-lanes visual behavior described below is retained as provenance only.

At that time, the explosion had not been converted. `Particles3D.spawnBombExplosion` still fired a burst in
*every* lane, 80ms apart, left to right, and `Road3D.spawnBombRing` was centred at road centre
with a radius wider than a lane. So the player kept seeing a blast sweep the full road width and
kept reporting, correctly, "it hits 2 rows, not 1 lane" — while every test passed and every
kill-counting verification agreed the fix was in. The reviewer and the suite were measuring the
same half of the change.

Root cause was the recurring one: `placeBombOnLane` called `_onBombExplode(car.position, 1)`.
`position` is a **row scalar**. The lane was never passed, so no downstream effect *could* draw
itself in the right place — same shape as every other entry in the register above, one layer out.

**Rules when converting a mechanic:**
- Check what the PLAYER SEES, not only what the state records. Capture the frame; a kill count
  is not a picture. The screenshot loop below exists for this and is not optional.
- **Grep the VFX for the old behaviour, and read the docstrings.** `spawnBombExplosion`'s
  docstring still said *"Covers all 4 lanes with a wide shockwave"* — the bug described itself
  in plain English for six weeks and nobody grepped for it.
- A mechanic change that touches no renderer file is a red flag, not a clean diff. `bd2348d`
  ("pin BOMB to lane-only") touched `SimulationRunner.js` and two test files and no renderer at
  all. That is exactly what a half-converted mechanic looks like in `--stat`.
- When the owner keeps reporting something the tests say is fixed, **believe the owner and ask
  what the tests are not looking at.** Three separate "fixed" reports on the ball/socket bug and
  this one all had the same root shape: the assertion and the complaint were about different things.

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
- **100 levels**: L1–L40 in `LevelManager.js`, L41–L100 in `LateLevels.js` (authored with `levelDsl.js`, heft/trait/goal scales generated into `lateTuning.js` by `node tools/tune-levels.mjs --write`). Seven worlds; worlds 4-7 art is baked (`render-3d-sprites.mjs backdrop|map`, `render-world-tiles.mjs`).
- **Seven traits** (`TrafficRules.js`): speeder, armored, chameleon, plated, mender, volatile, phantom; goal types destroyTotal/Color/Type/Trait + defeatBoss. Bands in `tools/bands.mjs`; every level is checked in-band (2026-10-01).
- **Economy (2026-10-01)**: 2 coins per car (was 10), shop 20-40, continue-with-coins 60 (`RESCUE_COIN_COST`); one booster store (`inventory`). Interstitials paced by `src/ads/adPolicy.js`. Daily/streak use the local day (`src/game/dateKeys.js`). Adaptive 3D render scale (`AdaptiveQuality.js`), reduce-motion setting (`MotionPrefs.js`).
- **Car type intro cards** (`src/screens/CarTypeIntroCard.js`) — fires at: L1 small, L2 big, L5 jeep, L9 truck, L13 bigrig, L15 tank
- **V2 redesign (2026-09-27, branch `feat/v2-design`)** — Hot Streak (3 kill shots →
  supercharged bomb: x2 damage, carry-over through any colour), special cars (speeder,
  armoured, chameleon), boss vehicles with colour sequences (L10/20/30/40), a new 40-level
  table capped at 4 colours. Rules live in `src/director/TrafficRules.js`, shared by
  GameLoop, DragDrop and SimulationRunner. Tune levels with `node tools/tune-levels.mjs`.
  V2 art: `node scripts/render-3d-sprites.mjs v2`; review captures: `scripts/v2-shots.mjs`.
- **AdMob** — `src/ads/AdManager.js` with PRODUCTION unit IDs (publisher ca-app-pub-3810333742263149 (Traffic Bomb app created 2026-10-09 in the nadavwolfsonw account, same publisher as Lane Math); test ads unless the build is made with `VITE_ADS_MODE=live` (explicit opt-in; missing/misspelt = test ads). Tester builds: `VITE_ADS_MODE=test`. STORE build: `$env:VITE_ADS_MODE='live'` before `npm run build`). Console side (app review, app-ads.txt, UMP message, Play declarations) is unverified
- **Signed release keystore** — `android/lane-defense-release.keystore` (gitignored). **Never delete.**
- **Balance simulator** — `tools/balance-sim.js`
- **Car rendering** — normal cars use pre-rendered 3D toy sprites (see §10 Art
  pipeline) as billboards on flat `PlaneGeometry` + `MeshBasicMaterial`; the boss
  uses a procedural `CanvasTexture`.
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
- Verify AdMob console state for com.nadavw.trafficbomb (app status, units exist, app-ads.txt, UMP message, Play Ads/Data Safety/AD_ID declarations)
- Signed release APK for Play Store
- Play Store listing (screenshots, feature graphic, privacy policy, Data Safety form)
- Closed test track ≥ 12 testers × 14 days
- World 2 / World 3 themes exist in ThemeRegistry; their visuals have not been art-directed
- **City repair meta loop** — implemented through `ProgressManager` city state, level-select
  damage states, and the repair animation. Final W2/W3 art direction remains open.

---

## 7. Mandatory Self-Audit Before Every Commit

Take screenshots from: **L5+** (L5 is the 3-lane afternoon reference), **L9** (sunset), **L13**
(misty), **L17** (industrial / World 2). Four-lane compatibility remains a structural benchmark,
not the production geometry of L5.
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

- `src/director/` — changes need matching test updates
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

Toy Town palette (2026-09-27, owner-approved direction A). Re-picked for
separation: the old red/orange/yellow sat within ~25° of hue and green was olive.

```
Red:    #FF3D3D   (0xFF3D3D)
Blue:   #2F8CFF   (0x2F8CFF)
Green:  #2FCC55   (0x2FCC55)
Yellow: #FFD42A   (0xFFD42A)
Purple: #A35CFF   (0xA35CFF)
Orange: #FF8A1C   (0xFF8A1C)
Boss:   #CC44CC   (0xCC44CC)
```

Duplicated across renderer/screen files (grep any value to find them all) and in
`tools/art/studio/studio.js` (PALETTE) + `tools/art/vehicles.mjs`. Update all if
changing any colour, then re-bake the sprites.

### Art pipeline (Toy Town, 2026-09-27)

The art is GENERATED, never hand-painted PNGs:

| what | source | bake command |
|------|--------|--------------|
| vehicles, bombs, booster icons | 3D toy models in `tools/art/studio/` (Three.js, rendered offline, ink outline composited in 2D) | `node scripts/render-3d-sprites.mjs ship` |
| side verges (all worlds, scene variants a/b/c) | 3D dioramas in the same studio, same camera tilt + light | `node scripts/render-3d-sprites.mjs scenery` |
| road tiles, bomb-zone floors | SVG in `tools/art/worlds.mjs` | `node scripts/render-world-tiles.mjs` |
| HUD chrome | `src/renderer/ToyStyle.js` helpers (ink outline, lip, gloss) | — |

The 3D bakes need the Vite dev server on :5173 (it serves the studio page).
Previews: `render-3d-sprites.mjs sheet <png>` / `verges <png>`. `ship` also
GENERATES `src/renderer3d/carSpriteGeometry.js` (aspect + body bbox) — Car3D
imports it; never hand-copy those numbers. Legacy file names are kept, so every
screen picks up new art without path changes.

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

*Historical incident and merge logs in this file are provenance; the active sections above are
the current source-of-truth summary.*

*2026-10-03 subsystem review: input pointer ownership + `DragDrop.cancel()`, frozen-board refill/reveal in `_advanceGrid`, booster spend settled by USE, weekly key = `W${rawWeekIndex()}`, audio buses `_out`/`_master`/`_musicGain` (tutorial ding via `audio.play`), `ProgressManager._load` type sanitiser, L4 bench unlock marked on first bench-store, reduced motion gates flash/chroma. Tests: `game-loop-edge-cases`, `input-manager`, `progress-load-hardening`, `weekly-key`.*

*Last updated: 2026-10-03 (previous: 2026-10-01 — levels 41-100, worlds 4-7, traits, economy and settings brought up to date.*)

*2026-10-09 boss pass (owner device play of L10): every boss now advances EVERY turn (`moveEvery: 1`, pinned by `boss-infra.test.js`) on the unchanged 8-row lane (longer lanes shrink cars). Sequences shortened to fit: L10 4 lights, L20 2 + armored 0.20, L30 4, L40 2+2 (armoured titan row 0, plain row 1); sim 40/52/43/49%. COLOR CHANGE on a boss rewrites its CURRENT light (`GameLoop.changeBossColor`, picker flow in GameApp). Preview artifact has an on-page gate with an unlock-to-L40 button (`scripts/build-preview.sh`). Bosses must be re-played on device. Open clarity ideas not built: glow on matching bombs, move countdown, per-light hit pop, guaranteed boss-colour bomb.*
