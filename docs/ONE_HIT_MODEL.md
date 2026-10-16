# One-Hit Ladder Model — design and numbers

Status: IMPLEMENTED on branch `feat/one-hit-model` (owner-approved direction 2026-10-12). Not merged.
`docs/VISION.md` is amended only after the owner approves the wording (section 9).

## 1. Why

- A bomb carried a number (2-8) and a car had HP (2-12). 94% of matched shots one-shot a car, so the
  bomb number was decorative: the owner's "no connection between bomb power and car HP".
- Bosses (every tenth level) did not read well and added a whole mechanic (colour sequences,
  re-plating, colour change on a boss, boss tests).

## 2. The model (as built)

1. Every bomb is exactly ONE hit and shows only a colour. No numbers anywhere (3D bombs, bench,
   fallback 2D drawing, onboarding).
2. A car's hit points are its size. Each matching hit shrinks it one rung, same colour, with a pop:

   | vehicle | hits to destroy |
   |---|---|
   | van (jeep) | 3 |
   | car (big) | 2 |
   | motorbike (small) | 1 |

   Truck, bigrig and tank are retired from spawning (their weight is folded into the van in
   `CarTypes.bandWeights`). No new art: every type already exists in every colour.
   `displayTypeFor(type, hp)` picks the sprite; `Car3D` rebuilds the entry when the rung changes.
3. EVERY correct shot still advances traffic (owner rule, mandatory). To make that survivable with
   multi-hit cars the road is longer in steps, not in size: a step is HALF a car length
   (`STEPS_PER_ROW = 2`). Road length, car size and spawn spacing (one car length) are unchanged.
   Speeders move two steps. Breach when `row > gridRows - 1`. Legacy `stepsPerRow = 1` is the default
   for configs that do not opt in (tests, old sims); every level and the daily challenge opt in.
4. Hot Streak: destroy a car with 3 shots in a row (a non-destroying shot resets the run) and the next bomb is charged. The charged bomb hits TWICE and
   carries through any colour (resolver support unchanged). A hit that only shrinks a car neither adds
   to nor breaks the count.
5. Traits keep their rules, with one change: a mender repairs ONE rung after TWO traffic moves
   without a hit (it used to heal every move, which made a shrunk mender unkillable).
6. Bosses are gone. L10/20/30/40 and L50/60/70/80/90/100 are "big wave" levels: a heavier
   destroyTotal goal, `milestone: true`, win band ten points below the neighbouring levels.
7. Colour Bomb (earned by multi-kills) replaces the top bomb whose colour matches the FEWEST cars on
   the board (it used to pick the lowest-damage bomb; all damage is 1 now).
8. BOMB booster still clears the targeted lane; COLOR CHANGE recolours matching front cars (no boss
   special case any more).

## 3. Calibration

Measured with `tools/balance-sim.js` (skill average, boosterIQ 0.7):

- Every-correct-shot advance with 1-3 hit cars and the old 8-row, 1-row steps: ~0% win. A lane of
  multi-hit cars outruns the road.
- Half-row steps alone: ~99% win. Ladder with unchanged goals: mean win 21% and 40-60 shots a level.
- So goals shrink to roughly half and `tools/tune-levels.mjs` fits the rest per level.

Tuner order of freedom per level (all 100 levels, band centre target from `tools/bands.mjs`):
raise heft when full goals are too easy; else shrink goals (`scaleGoal`, floors 6 for destroyTotal and 2
for side goals, never below x0.4); else ease heft; for trait goals pick the trait mix with the best win
rate; last, thin the trait mix. Results live in `src/game/lateTuning.js` (generated, covers L1-100;
`LevelManager` applies L1-40 on load, `levelDsl.lv()` applies L41+). Authored goals stay in
`cfg.baseGoals` so the tuner always starts from the design.

Result at 300 runs: 100/100 levels inside their band except L4 (98% against 85-95, heft already at
maximum). Average 24.5 turns a level (baseline before the change: 22.0).

Coins: levels hold about half the cars, so `COINS_PER_CAR` went 2 -> 4 to keep a win worth the
same.

## 4. Deleted with it

Bomb damage numbers and their rendering; `DAMAGE_WEIGHTS`/skew/boost config (dead, left for cleanup);
depth-bait pairs; fairness rules FR-3 and FR-4 (FR-1, FR-2, FR-5 stay); boss code (`makeBoss`,
`hitBoss`, sequences, roof panel drawing is dead code in `Car3D`, colour change on a boss, boss
tests); the car damage tint and tilt (size is the health now); the truck/bigrig/tank rows in the car
guide and the car manual.

## 5. Risks

- GameLoop/DragDrop/CombatResolver are on the CI-sensitive deploy/merge path: branch only, merge on green.
- The sim bot is not a human. The bands are a first calibration; device play is the real test.
- The tester AAB already uploaded (1.0.1) has the old model; testers get this build only after merge.
- Dead config and `Car3D` boss drawing remain for a cleanup pass.

## 6. Owner checks on device

1. L1-L5: does a hit read clearly (car shrinks and pops), and is the road still readable, not crowded?
2. Do half-steps feel like "every shot moves traffic"?
3. Big waves (L10, L20, ...): hard but fair?
4. Power shot: every 3rd destroyed car, too frequent or too rare?

## 7. Not changed on purpose

Colour palette, lane count, bench, boosters, economy structure, ads, store listing.

## 8. Phases

Done: model, half-steps, ladder, boss removal, rendering, retune, tests. Remaining: QA bots on a
worktree, CI on the branch, owner device play, VISION.md amendment.

## 9. VISION.md amendments needed (after approval)

Remove "Bosses (V2)" and the boss level names; rewrite rule 5; add the one-hit ladder section.
