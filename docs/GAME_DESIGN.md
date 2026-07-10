# Lane Defense — Game Design Document

> **For agentic workers:** Read this file in full before making ANY change to gameplay mechanics, level configs, car types, or booster behavior.

**Goal:** Define the design pillars, known bugs, difficulty model, and level master doc so every code change reinforces — not undermines — the player's core skill loop.

**Architecture:** Turn-based grid. Color-recognition is the skill. The meta loop is why players return.

**Tech Stack:** PixiJS v8 (screens/HUD), Three.js (road/cars), Vitest (tests), Vite (build)

---

## Core Design Pillars

1. **COLOR RECOGNITION IS THE SKILL** — the player's brain learns lane colors and bomb colors as patterns. Every mechanic must reinforce this, not bypass it.
2. **EVERY SHOT HAS STAKES** — wrong moves must feel costly, right moves must feel satisfying.
3. **DIFFICULTY IS A WAVE, NOT A RAMP** — pattern: easy → medium → hard → relief → harder. Never 5 hard levels in a row.
4. **TEACH WITH PAIN BEFORE GIVING THE TOOL** — the level before a booster unlocks should make the player feel the problem the booster solves.
5. **THE META LOOP IS WHY PLAYERS RETURN** — the core loop gets them in, the meta loop brings them back tomorrow.

---

## Known Design Bugs (fix before shipping)

### CRITICAL — breaks the skill loop

**WRONG COLOR SHOT** *(fixed 2026-05-14)*: A missed shot (color mismatch) no longer advances cars. Color mismatch = wasted bomb slot, no ground lost.
- Files: `src/game/GameLoop.js` (`_resolveShot`)

**ROW BOMB COLOR BLINDNESS** *(fixed 2026-05-14)*: Row bomb now only kills cars in the row that match the front car's color. Strategic skill — wait for same-color row alignment.
- Files: `src/game/GameLoop.js` (`placeBombOnLane`)

### HIGH — reduces strategic depth

- **COMBO IS ACCIDENTAL**: no level is designed around building a combo. Combos should feel like a deliberate skill, not a lucky side effect.
- **BOOSTER TIMING IS ARBITRARY**: boosters unlock on a schedule, not in response to player-felt pain.

---

## Difficulty Curve Rules (enforce in every level design)

Pattern per 8-level block:

| Slot | Difficulty | Notes |
|------|-----------|-------|
| N   | Easy | Onboarding or relief |
| N+1 | Medium | |
| N+2 | Medium-Hard | |
| N+3 | Hard | |
| N+4 | Relief | Easy, sometimes introduces new mechanic |
| N+5 | Medium | Player uses new mechanic |
| N+6 | Hard | |
| N+7 | Boss-Hard | Rescue ad moment |

**Target pass rates by difficulty tier:**

| Tier | 1st-attempt pass rate |
|------|----------------------|
| Easy | 85–95% |
| Medium | 60–75% |
| Hard | 35–50% |
| Boss-Hard | 20–35% (rescue ad triggered here) |

---

## Level Master Document

> ⚠️ **The old L1–20 "Level Master Document" table was STALE** (wrong lanes/colors/tiers vs
> shipped code) and has been replaced by the **Canonical 40-Level Design Table** below,
> derived directly from `src/game/LevelManager.js` PROGRESSION on 2026-07-08 (WS3 §3a).
> **Code is the source of truth.** This table is the new design contract; where an earlier doc
> disagreed, this wins. Proposed changes are in "§3a Proposed Deltas" — NOT yet applied.

## Canonical 40-Level Design Table (code-derived — WS3 §3a)

Legend: **Tier** = wave-slot role from the block pattern. **hp/spd** = `worldConfig.hpMultiplier`
/ `speed.base` (the preset each level uses; presets are shared by reference — see FABLE_EXIT_BRIEF
§1). **dens** = `laneTargetCarCount`×`spawnBudget`. All levels are 4-lane/4-col EXCEPT L1 (1×1),
L2 (2×2), L3 (3×3). Colors: R B G Y P O.

| L | Tier (wave slot) | Colors | Goals (type×count) | hp/spd | dens | dur | Design intent | Flags |
|---|---|---|---|---|---|---|---|---|
| 1 | Easy (FTUE) | R | total×13 | 0.30/3.0 | 1×5 | 60 | Learn drag+shoot; near-unlosable | |
| 2 | Medium | R B | total×25 | 0.90/7.5 | 2×10 | 70 | Color-match cost; 2-lane | preset over-tuned for 2-col sim bias — do NOT "fix" |
| 3 | Medium | R B | total×30 | 0.72/6.5 | 2×12 | 90 | Third lane management | |
| 4 | Hard | R B | total×30 | 0.54/8.0 | 2×8 | 90 | Full board, first pressure | hp lowered 1.80→0.90 historically (outlier) |
| 5 | Easy (Relief) | R B G | total×33 | 0.54/5.8 | 2×13 | 100 | Breathe; sets up bench need | ✅ clean 5th-level relief |
| 6 | Medium | R B G | Red×40 | 0.60/5.5 | 2×16 | 100 | BENCH unlocks | |
| 7 | Hard | R B G | Red×14, Blue×14 | 0.78/6.5 | 2×11 | 100 | GREEN arrives (3-color) | |
| 8 | Boss-Hard | R B G | Green×12, Red×12 | 1.08/7.5 | 2×8 | 90 | Green-density rescue moment | highest hp in game (1.08); not a VISION boss |
| 9 | Easy (Relief) | R B G | Blue×18, Green×17 | 0.45/4.6 | 2×14 | 100 | Recovery; SWAP unlocks | |
| **10** | **Medium — BOSS** | R B | Red×35, truck×11 | 0.60/5.5 | 3×17 | 100 | "Bench Test" — stripped palette forces bench | ⚠ VISION-boss: no scripted wave; design = palette+density+goal only |
| 11 | Medium | R B G | Red×13, Green×12 | 0.66/5.5 | 2×10 | 100 | BigRig intro | |
| 12 | Hard | R B G | Blue×12, Green×11 | 0.78/6.5 | 2×9 | 95 | BigRig pressure | |
| 13 | Easy (Relief) | R B G | Red×18, Blue×17 | 0.43/4.2 | 2×14 | 100 | Breather after L12 | |
| 14 | Medium | R B G | Red×12, Blue×11 | 0.66/5.5 | 2×9 | 100 | FREEZE unlocks | |
| 15 | Hard — mini-boss | R B G | Green×8, Red×8 | 0.78/5.0 | 2×7 | 100 | "Meet the Tank" (tank intro) | code-commented BOSS but NOT a VISION boss; slow speed = plan time |
| 16 | Boss-Hard | R B G | Red×10, Green×9 | 0.72/7.5 | 2×6 | 90 | World-1 climax | hp lowered 1.62→1.20 historically |
| 17 | Easy (Relief) | R B G | Blue×14, Green×14 | 0.45/4.0 | 2×11 | 100 | Color-bomb discovery; BigRig-heavy | VISION: streak/color-bomb discovered here, no tutorial |
| 18 | Medium | R B G | Red×12, Blue×12 | 0.66/5.5 | 2×8 | 100 | Combo mastery | |
| 19 | Medium | R B G | Green×12, Blue×11 | 0.63/5.2 | 2×9 | 100 | Pre-surge; freeze essential | |
| **20** | **Hard — BOSS** | R B G | Red×8, truck×3 | 0.78/6.5 | 3×18 | 100 | "The Surge" — wave pressure, freeze is key | ⚠ VISION-boss: no scripted wave; design = density+budget+goal only |
| 21 | Easy (Relief) | R B G Y | Red×13, Yellow×12 | 0.46/3.8 | 2×10 | 100 | YELLOW arrives | |
| 22 | Medium | R B G Y | Blue×15, Green×14 | 0.55/4.5 | 2×11 | 100 | 4-color flow | |
| 23 | Hard | R B G Y | Yellow×5, Red×5 | 0.71/5.6 | 2×8 | 95 | 4-color pressure, tanks | |
| 24 | Boss-Hard | R B G Y | Green×6, Blue×6 | 0.69/5.8 | 2×8 | 90 | Industrial gate | hp ×0.9 balance tweak (0.77→0.69) |
| 25 | Easy — mini-boss | R B G Y P | Red×9, Blue×9, Green×9 | 0.45/3.5 | 2×11 | 100 | "Color Overload" — PURPLE, 5-color mismatch | code BOSS, NOT VISION boss; Easy-tier honors relief cadence |
| 26 | Medium | R B G Y P | Red×7, Purple×7, Yellow×6 | 0.53/4.0 | 2×11 | 100 | Purple integrated | |
| 27 | Medium | R B G Y P | Purple×9, Green×9 | 0.53/4.0 | 2×11 | 100 | 5-color rhythm | |
| 28 | Hard | R B G Y P | Yellow×6, truck×5 | 0.60/4.5 | 2×9 | 90 | Industrial grind | |
| 29 | Easy (Relief) | R B G Y P | Red×11, Blue×11 | 0.45/3.5 | 2×11 | 100 | Reset before L30 | |
| **30** | **Medium — BOSS** | R B G Y P | Purple×5, bigrig×1 | 0.53/4.0 | 3×20 | 100 | "Industrial Finale" — tank-heavy | ⚠ VISION-boss: "40% tanks" claim NOT in visible config (shared R_5C_MED); verify spawn weights |
| 31 | Hard | R B G Y P O | Red×3, Green×3, bigrig×3 | 0.54/4.0 | 2×11 | 90 | ORANGE arrives; Night Highway opens | |
| 32 | Boss-Hard | R B G Y P O | Red×3, Orange×3, bigrig×3 | 0.57/4.5 | 2×11 | 85 | Highway storm | |
| 33 | Easy (Relief) | R B G Y P O | Green×7, Purple×7 | 0.42/3.0 | 2×14 | 100 | Nightfall; eyes adjust | |
| 34 | Medium | R B G Y P O | Red×6, Orange×5 | 0.47/3.5 | 2×10 | 95 | Highway patrol | |
| 35 | Medium — mini-boss | R B G Y P O | Blue×6, truck×5 | 0.47/3.5 | 2×10 | 90 | "Night Rush" speed boss | ⚠ CONFIG MISMATCH: comment says "INSANE speed, LOW hp" but config = plain R_6C_MED |
| 36 | Hard | R B G Y P O | Yellow×3, Green×3, bigrig×3 | 0.54/4.0 | 2×11 | 90 | Neon siege | |
| 37 | Easy (Relief) | R B G Y P O | Purple×8, Red×7 | 0.42/3.0 | 2×14 | 100 | Last breath | |
| 38 | Medium | R B G Y P O | Orange×6, truck×4 | 0.47/3.5 | 2×10 | 90 | Storm warning | |
| 39 | Hard | R B G Y P O | Blue×3, Green×3, tank×3 | 0.54/4.0 | 2×11 | 85 | Pre-finale, no mercy | |
| **40** | **Boss-Hard — BOSS** | R B G Y P O | Red×4, bigrig×1, truck×1 | 0.51/4.0 | 3×24 | 120 | "Grandmaster Finale" — all mechanics | ⚠ VISION-boss: no scripted wave; design = budget+duration+goal only |

### VISION-rule-5 violation flags (boss levels "MUST have designed challenges, not just hp bumps")

- **The 4 canonical VISION bosses (L10, L20, L30, L40)** all currently rely on SHARED difficulty
  presets + high `laneTargetCarCount`/`spawnBudget` + a goal-shape twist. That is *more* than an
  hp bump, but **none has a scripted wave or boss-specific mechanic** — which is what VISION rule 5
  and WS3 §3c intend. **This is exactly Task 3's scope.**
- **L30's "~40% tanks" design comment is not visible in its config** (it uses the shared
  `R_5C_MED` preset; any tank weighting must come from CarTypes band weights). Verify against
  `CarDirector`/`CarTypes` before designing L30's boss wave — the intent may currently be unrealized.
- **L35 "Night Rush" is a config/design mismatch**: the code comment promises a reflex speed-boss
  ("cars die in 1-2 shots but advance every second") but the config is a plain medium (`R_6C_MED`,
  0.47/3.5). It is NOT one of the 4 VISION bosses, so this is optional flavor — but it currently
  delivers none of its stated identity.

### Structural conflicts — RESOLVED (user decision 2026-07-08)

1. **Boss count → 4 canonical + 3 mini.** L10/20/30/40 are the 4 canonical bosses that get
   scripted-wave designs (§3c below). L15/25/35 stay as named "mini-boss" flavor moments
   (config identity only, no scripted wave). `LevelManager.js`'s 7-boss header comment should be
   reworded to match when someone next touches that file (non-urgent).
2. **Relief cadence → 8-block (VISION updated).** VISION.md rule updated to the shipped 8-block
   cadence (relief at L5/13/21/29/37). L15/25/35 are explicitly mini-bosses, not relief.

### §3a Proposed Deltas (current → proposed → why → expected sim effect) — NOT APPLIED

> Deliberately minimal + design-anchored. I am NOT proposing a blind numeric retune across levels —
> that is the §3b booster-aware sim loop's job (the current sim can't model boosters, so its numbers
> are a floor, per FABLE_EXIT_BRIEF §1). These deltas fix places where the shipped config *contradicts
> a stated design intent*. Every numeric change must pass `--runs=500` before commit (VISION rule 6).

- **D1 — L35 speed-boss fidelity.** Current `R_6C_MED` (0.47/3.5) → proposed dedicated
  `R_L35_SPEED` ≈ **hp 0.38 / speed ~4.7** (low hp, high speed). *Why:* realize the documented
  "reflex, not planning" identity; today L35 is indistinguishable from L34/L38. *Expected on
  baseline:* faster advance lowers sim win-rate; target keep it in **Medium 60–75%** (it's a
  mini-boss, not a rescue-ad boss) — MUST re-sim before applying.
- **D2 — 4 canonical bosses → scripted waves (Task 3).** Not a numeric delta here; L10/20/30/40 get
  `spawnScript`-style designed challenges in §3c. *Expected on baseline:* bosses should land in
  **Boss-Hard 20–35%** first-attempt after §3b booster modeling; numbers finalized by sim iteration.
- **D3 — L30 tank intent.** Verify/realize the "tank-heavy" claim (CarTypes band weight or explicit
  script) rather than leaving it a comment. *Expected:* raises effective difficulty at L30; fold into
  its §3c boss design so it's tuned once.
- **D4 — No change to L2/L4/L16/L24 "outlier" presets.** Their inline comments document deliberate
  post-sim corrections (2-col bias, outlier lowering). Flagged here only so a future pass does not
  "normalize" them and silently break balance.

---

## Boss Design — Scripted Waves (WS3 §3c) — executable specs for L10/20/30/40

Written for a Sonnet-class session to implement WITHOUT re-deriving design. VISION rule 5: bosses
are *designed challenges with a named intended solution the player discovers*, not hp bumps. Each
boss below states its identity, the exact wave script, the code hooks, and what must NOT change.
**Every numeric change re-runs `node tools/balance-sim.js --level=<N> --runs=500` before commit.**
Mini-bosses L15/25/35 are OUT of scope.

> **BOSS TARGET BAND (2026-07-10, supersedes the "20–35%" numbers below): 40–55% at the
> booster-aware reference profile (skill=average, boosterIQ 0.70) — equivalently ~20–35%
> tool-less. Same difficulty, two measurement profiles.** The per-boss "Sim band: 20–35%"
> lines were written before §3b shipped booster modeling; the sim's default profile now
> plays boosters, so bosses are tuned to 40–55% as flagged by `tools/balance-sim.js`
> (`bandFor`). Do not re-litigate: a boss at 45% booster-aware IS the designed 25%-ish
> tool-less boss.
>
> **SIM PARITY IS PART OF INFRA-B/C'S DEFINITION (hard requirement).** `SimulationRunner`
> must consume `spawnScript` + per-level `bandWeights` identically to the live game (it
> already instantiates the real `CarDirector`, so implement the logic INSIDE CarDirector —
> parity by construction, like `bandWeights`), with tests asserting director == sim.
> Same precedent as the byte-aligned `_refillLanes`. Without it the sim cannot measure
> bosses and VISION rule 6 breaks. The L20 surge uses an optional `rate` field on the
> stage table ({ untilPct, weights?, rate? }) — rate = per-stage lane-fill target;
> do NOT fake density via type weights.

### Shared infrastructure these specs need (build once, three small testable changes)

- **INFRA-A — fix the `initialCars` consumer.** `GameLoop._primeInitialCars` (≈L945) currently
  only places `initialCars` in **lane 0** and ignores `def.lane`/`def.color` (honors only
  `row`/`type`). To script a per-lane opening board, make it honor `{ lane, row, type, color }`
  per entry (place into `gs.lanes[def.lane]`, set `car.color = def.color` from `gs.colors`, keep
  the "no budget decrement" rule). Unit-test: a 4-entry `initialCars` lands one car in each named
  lane with the named color/type. Needed by: L10, L40 stage-1 seed.
- **INFRA-B — per-level car-type weights.** `CarTypes.bandWeights(level)` (CarTypes.js:89) already
  keys on level. Add explicit level branches for boss mixes (e.g. L30 tank-heavy). Pure data, no
  new plumbing. Needed by: L30.
- **INFRA-C — `spawnScript` (staged/timed waves).** New optional level field consumed by
  `CarDirector` BEFORE its `weightedPick` (CarDirector.js:80). Simplest testable form: a
  **stage table keyed on kill-progress** — `spawnScript: [{ untilPct: 0.33, weights:{bike:…} },
  { untilPct: 0.66, weights:{truck:…} }, { untilPct: 1.0, weights:{tank:…, bigrig:…} }]`. On each
  spawn, pick the first stage whose `untilPct ≥ goalProgress/goalTotal` and use its weights instead
  of `bandWeights`. (An ordered per-car queue also works but the stage table is fewer moving parts
  and deterministic for the sim.) Needed by: L20 (surge crests), L40 (bike→truck→tank stages).

### L10 — "The Bench Test" (canonical boss · Medium tier · R+B only · 3×17)

- **Identity / intended solution:** Only two colors, but the board is COLOR-CLUSTERED so a column's
  bomb is frequently the wrong color for the car in front of it → the player must **BENCH** the
  off-color bomb and wait for a matching row instead of firing it wastefully. Bench (unlocked L6)
  is the escape; brute-forcing loses to the truck goal.
- **Wave script (v1, uses INFRA-A only — no new code beyond the fix):** scripted opening board via
  `initialCars` — lanes 0 & 2 open all-**Blue**, lanes 1 & 3 open all-**Red**, 3 rows each
  (`[{lane:0,row:0,color:'Blue'},…]` ×12). Ongoing spawns stay weighted (keep the `truck×11` goal —
  trucks force multi-shot sequences that punish a mis-benched board). Keep `laneTargetCarCount:3`.
- **What NOT to touch:** must stay **R+B only** (the whole puzzle is the 2-color lock); do not add
  Green; do not lower density below 3/lane; keep the `destroyType:truck` goal.
- **Optional v2 (deeper, needs a ShooterDirector per-level bias knob):** make the SHOOTER queue
  drift toward one color so the lock is in the bomb supply, not just the board — richer but requires
  a new ShooterDirector hook; ship v1 first, sim-verify, then decide.
- **Sim band:** Boss-Hard **20–35%** first-attempt after §3b (bench modeling). v1 without bench
  modeling will read harder than felt — expected.

### L20 — "The Surge" (canonical boss · Hard tier · R+B+G · 3×18)

- **Identity / intended solution:** Relentless spawn CRESTS with brief lulls — the player can't
  clear steadily; they must **FREEZE** (unlocked L14) on a crest to buy a free turn and reset.
- **Wave script (INFRA-C):** `spawnScript` pulsing density — e.g. stages that alternate a heavy
  burst (high per-advance spawn) and a short lull, 3–4 cycles across the level. Concretely: stage
  weights don't change *type* much (keep R+B+G bikes/sedans/vans) — the surge is about **rate**, so
  the stage table modulates spawn COUNT per advance (crest = 2–3 cars/advance, lull = 0–1). Keep
  `laneTargetCarCount:3`, `spawnBudget:18`.
- **What NOT to touch:** keep 3 colors (adding a 4th changes the identity); the challenge is
  *timing a freeze*, not color load. Don't raise base speed into reflex territory — L20 is pressure-
  management, L35 is the reflex level.
- **Sim band:** Boss-Hard **20–35%** after freeze modeling (§3b). Freeze is the designed escape;
  without it modeled the sim under-reports.

### L30 — "Industrial Finale" (canonical boss · Medium tier · 5-color · 3×20)

- **Identity / intended solution:** **Tank-heavy** — tanks are high-HP, so the player must plan
  **multi-shot sequences** (streak-shot for double damage, color-bomb to clear a locked color, bench
  to hold the right bomb). Its "~40% tanks" design intent is currently a COMMENT NOT IN CONFIG (flag
  above) — this spec realizes it.
- **Wave script (INFRA-B, pure data):** add an L30 branch to `CarTypes.bandWeights` raising tank
  weight to ≈40% of spawns (from the band default), with the remainder bigrig/truck/van so the board
  is genuinely heavy. Keep the 5-color palette and `destroyType:bigrig×1 + Purple×5` goal.
- **What NOT to touch:** do NOT raise `speed.base` (currently 4.0) — tanks + speed is unfair; the
  designed challenge is *planning under weight*, not reaction. Keep 5 colors (Purple is the newest;
  overload is part of it).
- **Sim band:** Boss-Hard **20–35%**. Tank weight will raise effective difficulty vs today's shared
  `R_5C_MED`; sim-verify the weight number, don't guess-and-ship.

### L40 — "Grandmaster Finale" (canonical boss · Boss-Hard · 6-color · 3×24 · 120s)

- **Identity / intended solution:** A staged gauntlet that forces EVERY mechanic in sequence — the
  finale. Named solution: color-cycle the bike swarm, bench+streak the truck wall, color-bomb+freeze
  the tank/bigrig pincer.
- **Wave script (INFRA-C, 3 stages keyed on goal-progress):**
  - **Stage 1 (0–33%) — Bike Swarm:** weights heavy on `bike` (fast, low HP). Tests reflex + rapid
    color cycling. (Optionally seed the opening board with bikes via INFRA-A.)
  - **Stage 2 (33–66%) — Truck Wall:** weights heavy on `truck`/`van` (mid HP). Tests bench + streak
    double-damage.
  - **Stage 3 (66–100%) — Tank+BigRig Pincer:** weights heavy on `tank`+`bigrig` (high HP). Tests
    color-bomb (clear locked color) + freeze (survive the crest).
- **What NOT to touch:** keep `duration:120` (the gauntlet needs the runway), all **6 colors**, and
  the multi-goal shape. Don't flatten the stages into a uniform mix — the *sequence* is the design.
- **Sim band:** Boss-Hard **20–35%** after §3b. The staged difficulty ramps within the level, so
  watch the sim's *loss timing* (should skew to stage 3), not just the win-rate.

### Boss implementation order (for the executing session)

1. Build **INFRA-A/B/C** with unit tests first (director/game layer — has 1062-test coverage; add
   matching tests). 2. **L30** (INFRA-B only, pure data — smallest, validates the pipeline).
   3. **L10** (INFRA-A scripted board). 4. **L20** then **L40** (INFRA-C staged waves).
   After each: `--runs=500` for that level, confirm the band, screenshot L10/20/30/40 boards, commit
   one boss per commit. Do NOT batch all four into one commit — bisection matters if a band regresses.

## Feature Introduction Rules

- Never introduce a feature until the player has felt the pain it solves
- Never introduce 2 new features in the same level
- Every new booster gets a dedicated "teaching level" before it AND a "using it" level after it
- New car type always appears on a relief level (lower overall pressure)

---

## The Meta Loop (not yet built — required before App Store)

Players need a reason to return tomorrow. Options in priority order:

1. **City repair**: each level win repairs a damaged city building visible on the level select screen. Visual progress = emotional investment.
2. **Daily challenge**: one specially designed hard level per day, leaderboard score. Creates daily habit.
3. **Collection**: unlock car skins or bomb skins. Even cosmetic progression drives return visits.

**Minimum viable**: option 1 (city repair) with 20 buildings matching 20 levels.

---

## Simulation-Driven Balancing

Before shipping any level, run the headless balance simulator:

```bash
node tools/balance-sim.js --level=N --runs=500
```

**Targets:**

| Metric | Target |
|--------|--------|
| Win rate | Within ±15% of tier target |
| Std deviation | < 25% of mean shots |
| Unwinnable seeds | 0 in 500 runs |

If any target fails, adjust level config (`LevelManager.js`) — not the simulator.

**Current results:** See `docs/balance-report.md`

---

## Before Committing Level Changes

Before committing any change to `LevelManager.js` or `src/director/CarTypes.js`:

1. Run `node tools/balance-sim.js --level=N --runs=500` for affected levels
2. Confirm win rate is within the target band for that level's difficulty tier
3. If not — adjust level config, not the simulator
