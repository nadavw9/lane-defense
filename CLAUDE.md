# Lane Defense — Project Context

## What This Is
A hybrid-casual mobile puzzle game. Split-screen: top half has 4 lanes of advancing color-coded cars, bottom half has 4 columns of color-coded shooters. Player drags shooters to lanes to destroy cars before they breach. Color must match for damage. Survive the timer to win.

## Core Documents
- `docs/GDD_v1.0.docx` — Full game design document (32 sections)
- `docs/DirectorSpec_v1.0.docx` — Director algorithm specification (15 sections)
- Both are the source of truth. If this file conflicts with the docs, the docs win.

## Current Phase
**Phase 1: Director Module** — Building the game's brain as a standalone testable JS library before any rendering code.

## Number Scale (v1.1 — FINAL)
- Shooter damage: **2–8**
- Car HP: **4–20**
- Fire duration: **1.5–2.5 seconds**
- Colors: 6 total (Red, Blue, Green, Yellow, Purple, Orange). Levels use subsets.
- Lane distance: 100 units. Car speeds: 5–9 units/sec by world.

## 5 Fairness Rules (NEVER VIOLATE)
1. **FR-1**: At least 1 top shooter must color-match at least 1 front car at all times.
2. **FR-2**: At most 3 of 4 front cars can share the same color.
3. **FR-3**: Average shooter damage ≥ 50% of average front car HP.
4. **FR-4**: No car HP exceeds 2.5x the highest available shooter damage.
5. **FR-5**: At least 2 distinct colors in the top shooter row.

## Director State Machine
CALM → BUILD → PRESSURE → CLIMAX → RELIEF
- Phase transitions interpolate over 3 seconds (no sudden spikes).
- CRISIS assist: 70% probability, 15s cooldown, requires player activity (2+ deploys in 10s).
- Silent Difficulty Reduction: -10% at 3 fails, -20% at 5 fails, -30% at 8 fails.

## Project Structure
```
lane-defense/
├── CLAUDE.md              ← this file
├── package.json
├── src/
│   ├── director/
│   │   ├── CarDirector.js
│   │   ├── ShooterDirector.js
│   │   ├── FairnessArbiter.js
│   │   ├── IntensityPhase.js
│   │   └── DirectorConfig.js
│   ├── models/
│   │   ├── Car.js
│   │   ├── Shooter.js
│   │   ├── Lane.js
│   │   └── Column.js
│   ├── simulation/
│   │   └── SimulationRunner.js
│   └── utils/
│       └── SeededRandom.js
├── tests/
│   ├── fairness.test.js
│   ├── director.test.js
│   ├── carryover.test.js
│   └── simulation.test.js
└── docs/
    ├── GDD_v1.0.docx
    └── DirectorSpec_v1.0.docx
```

## Coding Preferences
- **Pure JavaScript** (no TypeScript for v1 — speed over type safety).
- **ES modules** (import/export). Node 18+.
- **No frameworks** for game logic. Plain classes, plain functions.
- **Test-first** where possible. Use Vitest or plain Node assert.
- **Single-concern modules**. One class per file. No god objects.
- **Explicit over clever**. Readable code beats compact code.
- **No external dependencies** for core game logic. SeededRandom is hand-written, not a library.
- **Comments explain WHY, not WHAT**. The code should be readable without comments.

## Testing Requirements
- Every fairness rule must have a dedicated test that tries to break it.
- The SimulationRunner must support headless execution: run N levels, report stats.
- Target simulation stats for a well-tuned director:
  - Standard level win rate (perfect play): 95–100%
  - Standard level win rate (average play simulation): 70–80%
  - Fairness rule violation rate: 0% (hard rules), <10% (soft rules before correction)
  - Carry-over frequency: 15–25% of kills
  - CRISIS trigger rate: 1–3 per standard level
  - Average combo length: 3–5 kills

## Key Design Decisions (Do Not Change Without Discussion)
- Wrong color = 0 damage in World 1–2. Interference (20% slow) from World 3+.
- Combos give BOTH fire speed boost AND coin bonus.
- Rescue offer = +10 seconds (+15 for boss). 70–80% of rescues should result in wins.
- Deploy time dilation: all cars slow to 60% for 0.3s on every shooter deploy.
- Boss color cycle is deterministic (fixed sequence), not random.
- Seed = hash(level_id, attempt_number). Different attempt = different sequence.

## What NOT To Build Yet
- Rendering / PixiJS / visuals (Phase 2)
- UI / menus / HUD (Phase 2)
- Sound / haptics (Phase 3)
- Firebase / backend / saves (Phase 3)
- Monetization / ads (Phase 3)
- Capacitor / mobile packaging (Phase 4)

## Communication Style
- Be direct. No enterprise theater.
- If something in the spec seems wrong or unbalanced, say so and propose a fix.
- When running simulations, show the data first, then interpret.
- Flag any edge case where a fairness rule might be violated.
