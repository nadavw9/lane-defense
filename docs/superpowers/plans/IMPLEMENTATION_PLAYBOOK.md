# Traffic Bomb — Implementation Playbook (model-agnostic)

> Companion to `2026-07-02-master-plan-testing-ui-difficulty.md` (strategy + EXECUTION STATUS
> tracker). THIS file is the how: per-task specs detailed enough that a Sonnet-class session
> executes them without re-deriving design decisions. Fable-class judgment is already encoded
> here — do not re-litigate decisions, just implement, verify, commit, tick the tracker.

---

## 1. WORK GUIDELINES (every task, every model)

1. **Session start:** read CLAUDE.md → SESSION_HANDOFF.md → master-plan EXECUTION STATUS →
   the task's section here. Nothing else up front.
2. **Loop per task:** implement → `npx vitest run` (1062+ must pass) → `npm run test:visual`
   (17+ must pass; REQUIRED for any change under src/renderer*, src/screens, src/input) →
   for visual changes capture `docs/review/` screenshots (wipe first, `01.png…` + `00-labels.txt`,
   end response with full paths) → commit → push → tick the tracker checkbox in the master plan.
3. **Commits:** small, one concern each, descriptive conventional message, end with
   `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Never commit `docs/review/`,
   root `*.png`, or scratch scripts (`_*.mjs`).
4. **Coordinates:** NEVER write a numeric screen coordinate that mirrors the 3D projection.
   Derive from `src/renderer3d/projection.js`. If you need a new conversion, add it THERE.
5. **Assets:** new sprites go in `public/sprites/<family>/`, lowercase filenames, added to
   `src/renderer/assetManifest.js` (the audit test enforces existence + case + not-gitignored).
   Always `${import.meta.env.BASE_URL}sprites/...`.
6. **Sim is the balance gate** (VISION rule 6): any LevelManager/CarTypes/SimulationRunner
   change → `node tools/balance-sim.js --level=all --runs=500`, all levels in band, paste table.
7. **When BLOCKED or a decision isn't covered here:** stop, write the question + options into
   the tracker under "OPEN QUESTIONS", ask the user. Do not improvise design.
8. **Windows shell quirk:** Bash cwd resets between calls — every command starts with
   `cd /c/Users/dalit/lane-defense`.

## 2. MODEL ROUTING (save Fable for judgment)

| Task type | Model |
|---|---|
| Mechanical execution of a spec below (code exists to copy-pattern) | **Sonnet** |
| Repo exploration / fact-finding (grep-and-report) | **Sonnet** (Explore agent) |
| Asset processing runs, screenshot capture, test runs, doc updates | **Sonnet or Haiku** |
| New design decisions, balance TUNING judgment, art direction changes, anything touching VISION.md, debugging that resists 2 attempts | **Fable/Opus** |
| Boss mechanic design (3c), DDA parameter choice validation (3d), canonical design table content (3a) | **Fable/Opus** (specs below give the frame; final numbers need judgment + sim iteration) |

Rule of thumb: if the spec below answers "what and how", route cheap. If the task is choosing
the "what", route smart.

---

## 3. WS2 — UI TASK SPECS

### 2a-1. Shooter-zone black band (audit: "bottom 30% pure black — no background")
- Audit refs: docs/design-audit-phase2.md lines ~97-140 (`grep -n BROKEN docs/design-audit-phase2.md`).
- The bomb-queue/shooter area behind the powerballs (below `BREACH_LINE_Y`, above BoosterBar)
  is flat dark. CityEdges already tiles park-grass on the SIDE strips; the CENTER band
  (road-width, y ≈ 521..752) needs a themed surface.
- Fix: in `ShooterRenderer._drawTray` region (or a new underlay in CityEdges), draw a themed
  workshop surface: `panel-workshop-surface.png` exists in `public/sprites/designed/` and is
  already preloaded (ENV_URLS). TilingSprite across the tray width, alpha ~0.9, under the
  powerball slots. Theme-tint per world is a nice-to-have, not required.
- Verify: `npm run test:visual` + screenshot L5/L20; the band must show texture, not #0d1117.

### 2a-2. ComboGlow (audit: "permanently disabled — combo has zero feedback")
- VERIFY FIRST — may be stale: `src/renderer/GameApp.js:2116` now reads
  `comboGlow.update(dt, gs.combo)` (not the `0` the audit quotes). Boot L5, run
  `window._nav.getGs().combo` after 3 quick kills, and watch for the vignette
  (`src/renderer/ComboGlow.js` — screen-edge escalating glow).
- If it fires: mark item done in the audit doc, move on. If not: check `gs.combo` is actually
  incremented (GameState kill path) and that ComboGlow's layer isn't hidden; re-enable with a
  minimal diff. Also check `git log -S "comboGlow.update" --oneline` for the disable commit.
- Verify: capture a combo ≥4 moment via `_nav.deploy` kills; screenshot shows the vignette.

### 2a-3. Shop screen (audit: "bottom 40% empty black; price buttons don't react")
- File: `src/screens/ShopScreen.js`. Two fixes:
  a) Layout: distribute the 4 cards across the full height (or add a decorative footer band:
     coin-pile art + "more coming soon" plaque). Cheapest good fix: increase card height/gaps
     to fill, add a subtle background texture (reuse `panel-workshop-surface.png` tiled, alpha 0.15).
  b) Juice: pointerdown scale-pop on price buttons (copy the pattern from TitleScreen `_addPillBtn`
     hover/press or BoosterBar press anim) + a brief green flash on successful purchase,
     red shake on insufficient coins.
- Verify: screenshot before/after; buttons visibly react in a capture (or at least code-reviewed).
- NOTE audit also flags FTUE banners overlapping the road (CLUTTER BROKEN ~line 120) — separate
  small task: route new banners through PopupQueue priorities so only ONE shows at a time.

### 2b. Side strips — REVIEW ONLY (was: widen strips)
- The projection fix (`6e78a2b`) already corrected strips 35→49px and panels now show whole
  building fronts (docs/review/01-L5.png at that commit). The original "widen by narrowing the
  road" change is probably UNNECESSARY now.
- Task: show the user current L5/L20/L35 screenshots and ask: good enough, or widen further?
  Widening further = reduce `roadHalfWPure()` margin or lane CELL — REQUIRES Fable + full
  balance/tap-target re-verification. Do not do this without explicit user go.

### 2c. Icon set — kill the ~120 emoji
Pipeline (mechanical once art exists):
1. User generates icons with the prompts in §6 (one image per icon, ~1024², styled per prompt).
2. Save to `sprite-sources/raw/split/icon-<name>.png`.
3. New `scripts/process-ui-icons.mjs`: copy the flood-fill white/dark-bg removal from
   `scripts/process-ai-backgrounds.mjs` (logo section), trim, resize to 128×128, output
   `public/sprites/ui/icon-<name>.png`.
4. Add `UI_ICON_URLS` family to `src/renderer/assetManifest.js` (audit test then guards it).
5. New `src/renderer/UIIcon.js`:
   ```js
   // Returns a Sprite for the named icon, or a Text fallback with the emoji when
   // the texture is missing (never blocks a screen on a missing icon).
   export function uiIcon(name, size, fallbackEmoji) { ... Assets.get(url) ... }
   ```
6. Swap emoji → `uiIcon()` screen by screen, ONE COMMIT PER SCREEN, priority order:
   HUD/BoosterBar → TitleScreen → LevelSelect → Win/Lose → Pause/Shop/Daily/Achievements/Stats.
   Keep glyph fallbacks. Icon names ↔ emoji table is in §6.
- Verify per screen: visual SMOKE subset + screenshot into docs/review for user approval;
  run the FULL 40-level sweep ONCE after the final swap commit (per-commit smoke gives
  clean bisection since sprite bounds differ from glyph bounds).
- Actual source arrived as ONE montage (`sprite-sources/raw/split/20icons.png`, 4×5 grid),
  not 20 files; `process-ui-icons.mjs` gained a montage-slicing mode (largest-blob cleanup
  removes neighbour bleed). 'back' ◀ is reused as 'next' ▶ via `uiIcon(..., {flipX:true})`
  (no 21st icon); 'share' reserved for share actions only.

**§2c progress (per-screen swap):**
- [x] Foundation — montage sliced → 20 icons, manifest + preload + uiIcon flip/tint.
- [x] HUD — 🏆 trophy toast (screenshot-verified); 📖 book btn + ♥ no-hearts modal
  (code-verified only, both currently unreachable in-game).
- [ ] Title → LevelSelect → Win/Lose → the rest.

**OPEN QUESTIONS (from §2c):**
- `_showNoHeartsPanel` (GameApp.js) exists with **no caller** — is the hearts/lives
  gate planned-but-unwired, or dead code? Decide: wire it into the pre-level path
  (lives system) or delete it. Icon swap applied either way, so non-blocking.

**BATCH 1b — icons to generate for a fully emoji-free game (deferred, low priority):**
- `explosion` / burst — for the 💥 goal-counter badge (`GoalCounterUI.js`).
- `snowflake` — for the ❄ FROZEN pill (`HUDRenderer.js`) and freeze theming.
- (optional) a dedicated `next` ▶ chevron if flipping `back` ever reads wrong.

### 2d. Screen chrome — Batch 2 art (needs user generation, prompts in §6)
- Title buttons: 9-slice glossy button plate (green primary + slate secondary) → replace
  Graphics rects in TitleScreen `_addPillBtn`/PLAY. Use Pixi NineSliceSprite.
- Win screen: burst frame + 3D star trio + coin shower sprite; wire into existing WinScreen
  star fly-in animation (keep the animation, replace the procedural star shapes).
- Lose screen: dramatic frame art behind the panel.
- Level Select city map: WAIT for WS3e schema (below) so damage states are designed in.
  Generate per §6 "CITY MAP" prompts (map bg per world + building set with 3 damage states).

---

## 4. WS3 — DIFFICULTY TASK SPECS

### 3a. Canonical 40-level design table (Fable for content; Sonnet for doc mechanics)
- Produce a table in GAME_DESIGN.md: `L | tier(wave slot) | design goal (one sentence) |
  mechanic focus | colors | car mix | goal shape | sim band`.
- Wave slots per 8-block: Easy, Med, Med-Hard, Hard, Relief, Med, Hard, Boss (bosses L10/20/30/40
  per VISION rule 5; every 5th level relief; booster-unlock levels easier than predecessor).
- Source current truth from `src/game/LevelManager.js` PROGRESSION comments + configs; where doc
  and code disagree, CODE is current truth, the TABLE is the new contract; list deltas for user
  review BEFORE retuning anything.

### 3b. Simulator booster modeling (spec is fixed; implementation mechanical)
Add to `SimulationRunner` (all behind `skill` profile flags, default off for `optimal`):
- FREEZE: if any lane's front car row ≥ gridRows-3 AND freeze available → use (skip next advance).
  Grant freezes by the real earn rule (3-kill chain → +1, cap 2).
- BOMB: earn +1 per 10 kills (cap 3); use on the row with most cars when ≥3 cars share a row.
- COLOR CHANGE: earn per the 2-consecutive-multi-kill rule; use when ≥3 front cars share one
  color ≠ available bomb colors.
- STREAK: model the shipped double-damage streak (3 consecutive correct → next shot 2×).
- Profile params: `boosterIQ` (probability the sim uses an available booster optimally:
  beginner 0.3 / average 0.7 / skilled 0.95).
- Then re-run `--runs=500 --level=all`; expect hard/boss win rates to RISE; retune goal counts/HP
  to the GAME_DESIGN first-attempt bands (Easy 85-95 / Med 60-75 / Hard 35-50 / Boss 20-35).
  Tuning judgment = Fable; the mechanical band-fitting loop can be Sonnet using
  `tools/goal-search.mjs` (already exists).

### 3c. Bosses as designed challenges (Fable designs; keep VISION rule 5)
Frame (fill in with sim iteration): L10 two-color bench-test puzzle (already stripped palette);
L20 tank-wall + FREEZE showcase (tank spawn script front-loads CLIMAX); L30 five-color overload
with a designed merge setup (initial queue seeded for a vertical merge); L40 grandmaster scripted
finale (staged waves: bikes swarm → truck wall → tank + bigrig pincer). Mechanism available today:
`initialCars` (LevelManager) + CarTypes band weights; if a per-level `spawnScript` is needed,
add it to CarDirector as an ordered queue consumed before weighted picks (small, testable change).

### 3d. Fail-streak mercy (DDA) — exact spec
- `ProgressManager`: track `failStreak[levelId]` (increment on loss, reset on win).
- On level start: if `failStreak ≥ 2` → effective `hpMultiplier ×= 0.9` (compounding cap ×0.73 at 5 fails)
  AND PreLevelScreen offers 1 free booster (no ad). Invisible to the player (no "easy mode" label).
- Implementation point: `GameApp._startLevel` where cfg is read; do NOT mutate LevelManager
  configs — apply the multiplier on the copy passed to the Director.
- Tests: unit test the multiplier schedule; sim unaffected (sim models base difficulty).
- Near-miss drama (separate commit): in GameLoop, when `goalProgress` total ≤ 20% of target AND
  any front car row ≥ gridRows-2 → fire `onNearMiss` callback once per level; GameApp: 0.5s
  slow-mo (gs.timeScale exists) + heartbeat SFX + red vignette pulse (ComboGlow pattern).

### 3e. City Repair meta-loop — integration facts + spec
- Save: `ProgressManager` (localStorage key `lane-defense-v1`), add `cityState: { [buildingId]: 0|1|2 }`
  (0 rubble / 1 scaffolding / 2 repaired). API: `getCityState()`, `repairBuilding(id)`,
  `damageBuilding(id)` — follow the existing `recordWin(levelId, stars)` pattern (ProgressManager.js:118).
- Hooks: win commit site is `GameApp.js` ≈ line 1371 (`progress.recordWin(levelId, stars)`) →
  also `repairBuilding(buildingForLevel(levelId))`. Breach loss path (the `_onEnd(false)` /
  showLose flow) → `damageBuilding(...)` (only downgrade 2→1, never to 0 — losses sting, not erase).
- Map: LevelSelectScreen renders building sprite per level node by state; WinScreen already has
  a 3-state building-repair graphic — reuse its states/logic for the map.
- Scope order: schema+hooks+tests (Sonnet, no art needed — placeholder tints) → map art (2d batch)
  → repair animation on level-select entry after a win (scaffold→building pop, reuse WinScreen anim).
- VISION quote to honor: level select IS the city; every beaten level repairs one building; state saved.

### 3f. Validation recipe
`npx vitest run` → `npm run test:visual:full` → `node tools/balance-sim.js --level=all --runs=500`
(booster-aware) → update `docs/balance-report-realistic.md` (STALE today — rewrite from the new run)
→ real-device checklist (L8/12/16/33/37 + all bosses).

---

## 5. STANDING RECOMMENDATIONS

1. After ~1 week of green visual-smoke CI runs: flip `.github/workflows/deploy.yml` deploy job to
   `needs: [test, visual-smoke]` (one-line change).
2. `docs/balance-report-realistic.md` and parts of GAME_DESIGN.md are STALE vs code — fix via 3a;
   until then trust code + current sim output, not those docs.
3. The audit doc lists more FIX items beyond the 3 BROKEN (grep `| FIX |` in
   docs/design-audit-phase2.md) — fold them into 2e screen passes opportunistically.
4. Keystore reminder stands: never touch `android/lane-defense-release.keystore`.
5. Before Play Store: AdMob production IDs, signed AAB, listing assets, 12 testers × 14 days
   (CLAUDE.md §6 production gates).

---

## 6. ART GENERATION PROMPTS (ready to paste into ChatGPT)

**Global style prefix (paste before every prompt):**
> Mobile game UI art, Royal Match / Toon Blast quality: glossy, chunky, saturated, soft
> top-light, subtle outline, readable at 48px. Single object centered on a PLAIN WHITE
> background, no text, no watermark, square 1024×1024.

**Batch 1 — icons** (one generation each; save as `sprite-sources/raw/split/icon-<name>.png`):

| name | prompt after prefix | replaces |
|---|---|---|
| star-filled | golden five-point star, glossy, slight 3D bevel | ⭐ (24×) |
| star-empty | same star as neutral grey empty socket/outline | ☆ |
| play | green right-pointing rounded play triangle button gem | ▶ |
| back | slate-blue left chevron arrow button gem | ← |
| heart | vivid red glossy heart with highlight | ♥ lives |
| coin | gold coin, face-on, embossed star emblem | 🪙 |
| gear | steel-blue settings gear | ⚙️ |
| trophy | golden trophy cup on small base | 🏆 |
| book | small open manual/book, blue cover | 📖 |
| share | curved share arrow, teal | 📤 |
| chart | tiny bar chart, 3 rising golden bars | 📊 |
| gift | red gift box, gold ribbon | 🎁 |
| fire | small lively flame, orange-red | 🔥 streak |
| timer | round stopwatch, blue steel | ⏱ |
| target | red-white archery target with dart | 🎯 |
| check | thick green glossy checkmark | ✓ |
| close | thick soft-red X | ✕ |
| shield | blue shield with gold trim | 🛡 |
| skull | cartoon purple skull, mischievous not scary | 💀 boss marker |
| hand | pointing hand cursor, cartoon glove | 👆 tutorial |

**Batch 2 — chrome** (portrait/landscape as noted):
- `button-primary.png`: wide rounded-rectangle button plate, juicy green with darker green
  bevel edge and glass top highlight, EMPTY (no label), landscape 1024×512. (9-slice source.)
- `button-secondary.png`: same shape in deep slate blue, subtler. 1024×512.
- `win-burst.png`: radial celebration burst frame — golden rays, confetti ring, open center
  (transparent-friendly white bg), 1024×1024.
- `win-stars.png`: three golden stars trio, middle one larger and forward, 1024×512.
- `lose-frame.png`: cracked dark-bronze frame border with warm edge light, open center, 1024×1024.

**Batch R — per-world ROAD TILES (unblocks continuous-scene Part 2 — code already wired):**

⚠️ NOT a full road with markings. Road3D tiles the texture at ONE LANE per tile
(repeat = width/CELL) and offsets by half a tile so the tile's centre dash becomes
the lane dividers. Each image must be:
> a SEAMLESS square texture tile of road surface viewed straight top-down, exactly
> one lane wide, with a single short white dashed-line segment vertically centred
> (dash ~15% of tile height, centred, gap above and below so vertical tiling forms
> a dashed line). Edges must tile seamlessly left-right AND top-bottom. No cars,
> no text, square 1024×1024.

- `road-world1.png`: clean warm-neutral city asphalt, fine grain, subtle wear
- `road-world2.png`: industrial concrete, hairline cracks, faint oil stains, gritty
- `road-world3.png`: dark night asphalt with subtle blue/purple neon reflection sheen
Save to `sprite-sources/raw/split/`, run `node scripts/process-ai-backgrounds.mjs`,
then fill `WORLD_ROAD_URLS` in `src/renderer/assetManifest.js` (3 lines — audit
guards the files; Road3D/GameApp wiring is already live and falls back until then).

**Batch 3 — CITY MAP (generate only after WS3e schema exists):**
- Per world (3×): top-down cartoon city district map background, winding path with 13-15 round
  empty plots, parks/rivers between, no labels — portrait 1024×1792. Style: world1 sunny suburb /
  world2 industrial brick-steel / world3 neon night.
- Building set (per world, 5 buildings × 3 states in ONE sheet each): same cartoon building in
  three states side by side — collapsed rubble pile → wooden scaffolding half-built → gleaming
  repaired with lit windows. 1536×512, white bg.

---
*Written by Fable 2026-07-04 so any model can continue. Update this file when a spec changes.*
