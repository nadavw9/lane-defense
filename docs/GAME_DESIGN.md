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

| L  | Lanes | Colors   | Car Mix              | Difficulty  | New Feature   | Design Goal                            |
|----|-------|----------|----------------------|-------------|---------------|----------------------------------------|
| 1  | 1     | R        | Bike only            | Easy        | Tutorial      | Learn drag mechanic                    |
| 2  | 2     | R+B      | Bike+Sedan           | Easy        | Sedan intro   | Learn color matching, 2 lanes          |
| 3  | 2     | R+B      | Bike+Sedan           | Medium      | None          | Reinforce color matching               |
| 4  | 3     | R+B      | Bike+Sedan           | Medium      | 3 lanes       | Multi-lane management                  |
| 5  | 3     | R+B      | Bike+Sedan+Van       | Hard        | None          | Make bench feel needed (no bench yet)  |
| 6  | 3     | R+B      | +Van                 | Easy        | Bench+Van     | Relief: bench solves L5 pain           |
| 7  | 3     | R+B+G    | Bike+Sedan+Van       | Medium      | Green color   | 3-color pattern recognition            |
| 8  | 4     | R+B+G    | Bike+Sedan+Van       | Medium      | 4 lanes       | Full width management                  |
| 9  | 4     | R+B+G    | +Truck               | Hard        | Swap+Truck    | Truck intro, swap solves color lock    |
| 10 | 4     | R+B+G    | Bike+Sedan+Van+Truck | Easy        | None          | Relief level                           |
| 11 | 4     | R+B+G    | +BigRig              | Medium      | BigRig intro  | Learn BigRig HP                        |
| 12 | 4     | R+B+G    | All except tank      | Hard        | Peek          | Peek solves BigRig planning problem    |
| 13 | 4     | R+B+G    | All except tank      | Hard        | None          | Pressure level                         |
| 14 | 4     | R+B+G    | All except tank      | Boss-Hard   | Freeze        | Rescue moment, freeze saves you        |
| 15 | 4     | R+B+G+Y  | +Tank                | Easy        | Tank+Yellow   | Relief: new color, meet the tank       |
| 16 | 4     | R+B+G+Y  | All                  | Medium      | None          | 4-color mastery                        |
| 17 | 4     | R+B+G+Y  | All                  | Hard        | None          | Autumn theme, full pressure            |
| 18 | 4     | R+B+G+Y  | All                  | Hard        | None          | Combo level (designed for combos)      |
| 19 | 4     | R+B+G+Y  | All                  | Boss-Hard   | None          | Pre-final boss                         |
| 20 | 4     | R+B+G+Y  | All (tank heavy)     | Boss-Hard   | None          | Final level                            |

---

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
