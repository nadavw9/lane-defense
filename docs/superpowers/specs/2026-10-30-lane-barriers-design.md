# Lane barriers, waves and honest difficulty — design

Status: owner-approved direction 2026-10-30 ("everything else approved; the numbers sound right,
refine them after trying"). Branch `feat/lane-barriers`.

## 1. Why (what the owner played)

"Levels are too short and too easy. I never once failed to finish a level. The bomb combo
(supercharge) is too strong, maybe make it harder to get."

Measured on master (2026-10-30, `tools/balance-sim.js`, 200 runs):

| finding | evidence |
|---|---|
| The tuner shortened levels to its floor | `lateTuning.js` goal scale 0.4 on L4, L5, L7-L10 (authored 18-22 cars -> 7-9), and heft lowered too |
| The reference bot plays a different game | profile `average`: 18% of drops are mis-drops that CONSUME the bomb, plus column "cycling". In the live game a mismatched drop bounces back and nothing cycles |
| The live game rescues the player invisibly | CRISIS assist (`GameLoop` 6.5, `ShooterDirector.triggerCrisis`): a car past 70% of the lane -> 70% chance of a matching bomb injected at the top of its column, every 15 s, in 62% of the level. The simulator never models it |
| No steady state exists | every correct shot moves all traffic 1/4 row; 3 lanes -> 4 shots per row; if the average front car needs more than 1.33 hits the board loses ground whatever the player does. Levels can only be sprints to a small goal before an inevitable breach |
| Supercharge is constant | 3 destroying shots in a row charge it; a 1-hit motorbike counts, so on light traffic it is nearly always on. Plus a lane-clear BOMB every 6 kills and a FREEZE per 3-kill combo |

Profile comparison on current levels (win %, 200 runs): L5 average 79 / human (no mis-drops,
no cycling) 65; L10 64 / 48; L15 60 / 50. The human profile is WEAKER than the bot the levels
were tuned for, and then the crisis assist hands the human the win. Nothing in this is
"difficulty"; it is noise plus a hidden rescue.

## 2. Goals

- A level is a RUN with a middle: 2-3 waves, 30-45 shots on an ordinary level (today 12-20).
- A level can be lost by a focused player, and the loss is seen coming (a barrier goes first).
- Difficulty comes from traffic (weight, density, crests), not from colour luck or a short goal.
- The simulator plays the player's move set, and is the tuning reference again.
- Supercharge is an event, not a state.

Non-goals: new car types, new boosters, art for new worlds, changing lane/column counts,
the one-hit ladder, the chain reaction, the economy.

Anti-goals: an invisible helper of any kind (crisis assist, mercy that the player cannot see);
a level that is hard because the right colour never comes.

## 3. The model

### 3.1 Lane barriers (one free breach per lane)

Every lane starts each level with ONE barrier at the breach line (the hazard stripe). When a car
crosses the last row:

- barrier intact -> the car crashes into it: car and barrier are both destroyed, the level goes
  on. The crashed car counts for NOTHING (no goal credit, no coins, no score, no streak). A big
  on-screen moment (smash, debris, shake, "BARRIER DOWN!" tag), the lane now shows no barrier.
- barrier gone -> loss, as today (rescue offer unchanged).

Rules: barriers are per level, all lanes, every level including L1-3 and the daily challenge.
A CONTINUE pushes traffic back as today and restores NO barrier. Boosters do not restore
barriers. The race, hearts, stars and coins are unchanged. The simulator applies the identical
rule (`TrafficRules.breachWithBarriers`, shared).

Teaching: a reactive card on the FIRST smash ever ("BARRIER DOWN! Each lane has one. The next
car through that lane ends the level"), any level (the smash is the moment; a fixed level cannot
be chosen because nobody knows where it happens first). `introSchedule` REACTIVE_WINDOW
`barrier_down`: [1, 200].

Reference: Plants vs Zombies lawnmowers. Proven shape: it makes long hard levels survivable
without hiding anything.

### 3.2 Waves

A level from `FINALE_FROM` (10) on runs as waves keyed on goal progress p (0..1), replacing the
single final rush. `TrafficRules.waveHeft(heft, p, waves)` and `waveLaneTarget(base, p, waves)`
are shared by `CarDirector`/`GameLoop` and the simulator.

Two waves (ordinary level), `waves: 2`:

| p | heft offset | lane target |
|---|---|---|
| 0.00-0.20 calm | -0.15 | base |
| 0.20-0.40 wave 1 | +0.10 | base + 1 (if base <= 2) |
| 0.40-0.55 lull | -0.10 | base |
| 0.55-0.80 wave 2 | +0.25 | base + 1 |
| 0.80-0.90 lull | 0 | base |
| 0.90-1.00 final | +0.35 | base + 1 |

Transitions are smoothstepped over 0.05 of p so the mix never jumps. Big-wave levels
(`milestone: true`) use `waves: 3` (crests at 0.2, 0.5, 0.8 and the final). L1-9 stay flat.
Heft is clamped to [0, 1] as today. The player sees a "WAVE 1" / "WAVE 2" / "FINAL WAVE" tag
(PopupQueue AMBIENT, same tag style as CHAIN xN) at each crest start.

### 3.3 Supercharge and earned boosters

- `STREAK_TO_CHARGE` 3 -> 5. Copy: "Destroy 5 cars in a row".
- `KILLS_PER_BOMB` 6 -> 10.
- Freeze per 3-kill combo: unchanged (it needs timing, not volume).

### 3.4 Crisis assist: removed

`GameLoop` step 6.5, `ShooterDirector.triggerCrisis`, `CRISIS` config, `crisisEnabled` in
`IntensityPhase`, `_onCrisis` and its renderer flash go. The viability guard (FR-1: at least one
column matches a front car) stays: that is the honest floor. SDR / DDA fail mercy stays (it
only engages after repeated fails and is the industry norm).

### 3.5 The simulator plays the player's game

New profile `human` (reference for tuning): accuracy 1.00 (a mismatch is never a shot), no
column cycling, boosterIQ 0.90. `balance-sim`, `tune-levels` and `tune-stars` use it. Known gap,
accepted: the bot does not use the bench (L13+), so a human is a little stronger than measured
on bench levels; device play decides the last few points.

### 3.6 Bands (human profile) and length

| levels | ordinary | hard (x5, L10/L20 big waves) | super hard | relief |
|---|---|---|---|---|
| L1-3 | 90-100 (tutorial) | | | |
| L4-9 | 70-80 | | | |
| L10-26 | 62-72 | band -15 (L10: -8) | | band +6 |
| L27-45 | 58-68 | -15 | -25 (from L50) | +6 |
| later worlds | -2 per world, floor 50-60 | | | |

Tuner order of freedom (unchanged shape): authored goals are the anchor at scale 1.0; the goal
scale may now go UP to 2.5 (floor 0.5) before heft moves, so a level that is too easy gets
LONGER first and heavier second. Target 30-45 shots on an ordinary level; the report prints
the average turns and the owner judges the feel.

### 3.7 Drop zone and pending drops (owner bug report)

"If you send the bomb to the correct lane it is not always sent." Two causes found:

1. `DragDrop._hitTestLane` rejects a release below the front car's CENTRE line
   (`ROAD_BOTTOM_Y`): the lower half of the front car and the hazard stripe are dead. Fix: a
   legal drop is anywhere in the lane from the goal band's bottom edge to the bottom of the
   breach stripe (`BREACH_LINE_Y` + stripe half-width).
2. `_deployWouldBeRefused` snaps the bomb back whenever the previous shot is still in flight
   (flight + hit-stop, a few hundred ms), so a quick second drag is silently refused. Fix: the
   drop becomes PENDING: the ghost waits at the release point and fires the instant the lane is
   free (up to 0.8 s). If by then the colour no longer matches (the board changed), it bounces
   back with the mismatch cue.

## 4. What the player sees

- Barriers: a toy road block per lane on the hazard stripe (striped beam on two posts, the
  Toy Town ink outline), drawn in 3D (`Road3D`), one per active lane. Smash: the car explodes
  on it, the beam splinters (`Particles3D`), camera shake, "BARRIER DOWN!" tag; the posts stay
  as a stump so the missing barrier reads.
- Waves: "WAVE 1" tag at the first crest, "WAVE 2", "FINAL WAVE". The step ruler is unchanged.
- Supercharge: unchanged look; it simply comes less often.
- Level card: unchanged. Win screen: unchanged (no barrier bonus yet; candidate for later).

## 5. Tests

- `tests/barriers.test.js`: first breach destroys car + barrier and continues; second in the
  same lane loses; a breach in another lane uses that lane's barrier; crashed car gives no goal
  credit / coins / streak; continue keeps barriers as they are; simulator parity (same seed,
  same outcome) on a level with breaches.
- `tests/waves.test.js`: profile values at the table's anchor points, clamps, smooth joins,
  flat before L10, three crests on milestones; sim and GameLoop read the same function.
- `tests/streak.test.js` / booster tests: 5 and 10.
- Drop: `_hitTestLane` accepts the stripe band; pending drop fires when the lane frees, bounces
  when the colour changed, expires.
- Crisis: every reference removed (grep test), `intro-schedule` fixtures seed `barrier_down`.
- `tests/final-rush.test.js` updated to waves. All 200 levels in band after retune
  (`tests/level-config-audit`).

## 6. VISION.md amendments (approved by the owner 2026-10-30, applied to docs/VISION.md)

- Rule "one breach = loss" becomes "one breach per lane is absorbed by the lane's barrier; the
  second breach in a lane is the loss".
- "Hot Streak: 3 destroying shots" becomes 5.
- Add: "No invisible help. Every assist the player gets is on screen (barriers, boosters, cards)."
- Add the waves shape (calm, WAVE 1, lull, WAVE 2, lull, FINAL WAVE) under the level design rules.

## 7. Rollout

Branch `feat/lane-barriers` -> CI -> PR -> merge (pre-approved after green) -> Android internal
+ TestFlight builds with release notes. Owner plays L4-L20 and names the numbers to refine.
