# Traffic Race — design (2026-10-19)

Owner request: "races with prizes during the game progression like Candy Crush; not too early".
Owner's words on the shape: race other players to finish a number of levels; first place gets a
massive prize; run out of lives and you are out; it should make players want to watch an ad
instead of failing, and play many levels in a row. Prize, numbers and everything not quoted
here were handed to the builder ("you decide"); research and the survival math below set them.

## Why

A reason to play several levels back to back, and a reason the continue offer (rewarded ad or
60 coins) is worth taking. It also gives the map a recurring goal between world unlocks.

## Goals / non-goals / anti-goals

- Goal: a race that a steady player who never watches ads still finishes ~40% of the time, that
  one continue visibly helps (~65%), and that first place pays enough to feel huge.
- Goal: no server. Works offline, in the web build and the Android build.
- Non-goal: real multiplayer, leaderboards, purchases, push notifications.
- Anti-goal: rivals presented as real people ("online", fake profiles, chat). They are cartoon
  racers with names and toy cars. Anti-goal: an ad that is ever required — coins always work,
  and walking away always works. Anti-goal: a prize the player must spend more than it pays to
  win (Lava Quest's known criticism): 3 coin continues = 180 coins < 500 coin prize.

## Rules (all player-visible)

| rule | value | why |
|---|---|---|
| unlock | after beating **L30** (first SUPER HARD big wave) | all mechanics taught by L24; ~1-2 h in |
| racers | you + **4 rivals** | Royal Match Sky Race size; fits one screen |
| goal | first to win **6 NEW levels** | survival math: 8 was 27% for non-continuers |
| hearts | **3**, race-only | the elimination tension; the continue offer saves one |
| a heart is lost | final loss or quit on the player's frontier level | replays never cost or count |
| what counts | a win on the frontier level (the next unbeaten level) | no farming L1; the race pushes the map forward |
| time limit | **24 h** from START | urgency without a daily chore |
| start | player taps START on the race card; next race can start right after | consent; chain races |
| availability | only if at least 6 unbeaten levels remain | a race must be finishable |
| first race | rivals ~35% slower | everyone learns what winning feels like |

Prizes (granted on CLAIM; boosters go to the owned inventory):

| place | prize |
|---|---|
| 1st | 500 coins + 2 COLOR CHANGE + 2 FREEZE + 2 BOMB, "Race Champion" achievement |
| 2nd | 150 coins + 1 FREEZE |
| 3rd | 50 coins |
| 4th-5th (finished) | 20 coins |
| out of hearts / time ran out | nothing |

Survival math (band-centre win rates, 200k simulated races from L26-L101; `race-math.mjs`):
6 wins / 3 hearts finishes 42% with no continues, ~65% continuing half the time, ~86% always.

## Rivals (no server)

Each rival has a progress value 0..6 (wins shown = floor). It moves on two clocks:
1. **Per player attempt** on a frontier level (win or final loss): `+pace * (0.6 + 0.8 * rnd)`.
2. **Real time**: `+drift * hoursElapsed`, applied whenever the race is touched (map open,
   level result), capped at the race end time.

At START, from a seeded RNG: the leading rival needs `A ~ U(5.3, 7.3)` player attempts to finish (calibrated, see the race tests)
(`pace = 6 / A`); the others need `A * {1.15, 1.35, 1.6}` (shuffled). Drift: the leader would
finish on time alone in 12-18 h, the others 18-36 h (some never finish in 24 h). First race:
every `A` and every hour count x1.35. Within one event the player's result is applied first,
then rivals move, so a tie goes to the player. The player's place = 1 + rivals who finished
before. No rubber-banding.

Target, checked by a seeded test against the band-centre player model: a player who finishes
places 1st 40-60% of the time; a first race 60%+.

## Where the player sees it

- **Map** (LevelSelectScreen): a round RACE button with a caption (`RACE!` when one can start,
  `3/6` + hearts while racing, `CLAIM!` when finished). Tapping opens the race card.
- **Race card** (new `RaceScreen`): ribbon "TRAFFIC RACE"; five tracks, each a toy car (the
  game's own car sprites, one colour per racer) moving from START to a finish flag at 6; YOU
  highlighted; hearts; time left; the prize row; one button: START / PLAY NEXT LEVEL / CLAIM /
  OK. Intro version (first time): headline "NEW! TRAFFIC RACE" and the three rules in one line
  each.
- **Auto-open**: once, right after the win that unlocks races (beating L30 the first time), when
  the player returns to the map. Players already past L30 get a red dot on the button instead.
  A finished / out / timed-out race opens the card on the next map visit (result + CLAIM).
- **Win screen**: one more stat row, `RACE  4/6 · 2nd`, when a race is running.
- **Continue offer** (RescueOverlay): during a race on the frontier level the line reads
  `Continue to keep your race heart` (replaces the win-streak line; the streak is also saved).
- **Final loss screen**: the existing hearts row (LoseScreen already supports it) shows the race
  hearts left after the loss.

## Data

`ProgressManager` gets a `race` field (default `null`, validated by the race module, never
trusted): `{ v, id, seed, startedAt, endsAt, wins, hearts, attempts, first, rivals:[{ name,
color, progress, pace, drift, finishedAt }], lastSync, result:null|{ outcome, place }, claimed }`
plus `raceIntroSeen` and `racesWon`. Pure logic lives in `src/game/race.js` (no Pixi, no
storage), driven by GameApp at the existing hook points: `showWin`, `_recordFinalLoss`, the
pause-menu quit, `showRescue`, `showLevelSelect`.

Analytics: `race_start {first}`, `race_end {outcome, place, attempts, hearts}`,
`race_claim {place, coins}`.

## Left to the builder

Exact pixel layout of the card and button (screenshot review loop), racer names and colours,
copy wording, where on the map the button sits so it covers no node.
