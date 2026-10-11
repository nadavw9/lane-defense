# One-Hit Ladder Model — design and numbers

Status: DESIGN, owner-approved direction 2026-10-12 (bomb numbers removed, car shrinks per hit,
bosses removed, "Claude is the guide"). Branch: `feat/one-hit-model`. Not merged. `docs/VISION.md`
is amended only after the owner approves the final wording (section 9).

## 1. Why (measured, not felt)

- Today a bomb carries a number (2-8) and a car has HP (2/3/4/5/7/12). Shipped note in
  `CarTypes.js`: 94% of matched shots one-shot a car, so the bomb number is decorative. That is the
  owner's "no connection between bomb power and car HP".
- Baseline sim (200 runs, 100 levels, average skill): 22.0 turns/level, 1.11 kills per shot (carry-over).
  L5: 20 cars in 15.8 turns.

## 2. The model

1. Every bomb is exactly ONE hit. Bombs show a colour only. No numbers anywhere.
2. A car's hit points are its size. Each hit in the matching colour shrinks it one rung, same colour:

   | rung | vehicle | hits to destroy |
   |---|---|---|
   | 4 | truck | 4 |
   | 3 | van | 3 |
   | 2 | car | 2 |
   | 1 | motorbike | 1 |

   Bigrig and tank are retired from spawning (their sprites stay for armour/boss-free special use).
   No new art: every type already exists in every colour. A shrink is a sprite swap plus a pop.
3. Traffic moves when a car is DESTROYED, not on every hit. A hit that only shrinks a car does not
   move traffic. Wrong colour still does nothing.
4. Hot Streak: every 3rd car you destroy charges the next bomb. The charged bomb hits TWICE and carries
   through any colour (resolver already supports damage 2 + pierce). A non-killing hit no longer resets
   the streak (with multi-hit cars that made the streak nearly unreachable).
5. Armour (any colour strips it, no shrink) and the other traits keep their rules unchanged in this
   phase. Mender heals back UP one rung per traffic move (readable without text).
6. Bosses are removed as a mechanic. L10/L20/L30/L40 become ordinary "big wave" levels with a
   destroyTotal goal and a heavy mix.

## 3. The numbers

Expected hits per car (heft 0.5, existing band tables, bigrig/tank folded into truck = 4):

| level | phase | old avg HP | new avg hits |
|---|---|---|---|
| L1 | any | 2.00 | 1.00 |
| L3 | BUILD / CLIMAX | 2.60 / 2.85 | 1.60 / 1.85 |
| L6 | BUILD / CLIMAX | 3.05 / 3.80 | 2.05 / 2.80 |
| L9 | BUILD / CLIMAX | 3.55 / 4.40 | 2.55 / 3.40 |
| L12 | BUILD / CLIMAX | 4.10 / 5.90 | 2.90 / 3.90 |
| L16+ | BUILD / CLIMAX | 4.55 / 8.35 | 3.00 / 3.95 |

Late bands average 3-4 hits per car, which is too many shots per level. The band tables get re-weighted
for four types (target 1.0 at L1, ~2.0 at L5-8, ~2.6 late) and goal counts are re-scaled by the sim.

Sim prototype (damage 1, ladder 1/2/3/4, other rules untouched):

| rule for traffic | L5 win | L12 win | verdict |
|---|---|---|---|
| every hit moves traffic (today's rule) | 0-28% even with a 3-car goal | 1-52% | impossible: a lane of 4-hit trucks outruns an 8-row road |
| traffic moves on a kill | 98% (goal 20) | 88-96% | winnable, easy; difficulty levers (density, lane length, traits) still apply |

Why "moves on a kill": it keeps the number of board advances per level ~ equal to cars killed, exactly
as today, so every level's pacing, speed and trait pressure carries over. Only shots per level change
(about x2), which the goal re-scale absorbs. The player rule is one sentence: "destroy a car and traffic
moves".

## 4. Deleted with it (less code, not more)

- Bomb damage numbers and their rendering; `DAMAGE_WEIGHTS`, `damageSkew`, `HP_DAMAGE_BOOST`,
  depth-bait pairs (weak/strong), CRISIS damage logic keeps the colour assist only.
- Fairness rules FR-3 and FR-4 (both are about damage vs HP). FR-1, FR-2, FR-5 stay.
- `hpMultiplier` as a difficulty lever (already 1 on every authored level). DDA softens with `heft`.
- Boss code: `makeBoss`, `hitBoss`, boss sequences, boss rendering, the colour-change-on-boss flow,
  boss tests. Removed in its own commit after the model works.
- HP guide overlay and car-manual HP numbers become "hits".

## 5. Phases (each ends green on `npx vitest run`)

1. Model: Shooter damage 1, ladder HP, advance-on-kill in GameLoop and SimulationRunner (one shared
   rule), streak by kills, band tables, DDA by heft.
2. Rendering: Car3D downgrade sprite swap with pop, bombs without numbers, intro cards, manual.
3. Bosses out, L10/20/30/40 rebuilt as big-wave levels.
4. Retune 100 levels with `tools/tune-levels.mjs` against `tools/bands.mjs`.
5. QA bots (autoplay, ftue, booster, economy) against a worktree on port 5174, then branch CI.
6. Owner plays on device. VISION.md amended after he approves the wording.

## 6. Risks

- GameLoop/DragDrop/CombatResolver are on the CI-sensitive deploy/merge path: branch only, merge on green.
- ~1500 tests assert damage/HP/boss values; many change by design. Each changed assertion is an
  intentional behaviour change, not a loosened check.
- Sim bot is not a human. Difficulty is a first calibration; device play is the real test.
- The tester AAB already uploaded (1.0.1) has the old model. Testers get this build only after merge.

## 7. Open points for the owner

- Streak "every 3rd kill" vs keeping the old "3 kills in a row". Chosen: every 3rd kill.
- Tank/bigrig: retired from spawn. Could return later as a 5th rung if the late game feels flat.

## 8. Not changed on purpose

Colour palette, lane count, bench, boosters, economy, ads, store listing.

## 9. VISION.md amendments needed (after approval)

Remove "Bosses (V2)" and the boss level names; rewrite rule 5; add the one-hit ladder section.
