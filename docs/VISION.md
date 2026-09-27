# Traffic Bomb — Vision Contract

## Status: LOCKED. Do not modify without explicit user approval.

> **2026-09-27 — V2 redesign, owner-approved.** The owner handed the game over
> for a redesign ("take the game as if an old designer produced it... do as many
> changes as you feel are necessary and create a top game store game"). The
> Hot Streak, Special Cars, Bosses sections and rule 9 below record that redesign.

## What This Game Is
A spatial puzzle game where the skill is reading the board 3 moves ahead.
Players scan 3 lanes, see danger approaching, and sequence their bomb queue
like a chess player — not reacting, anticipating.

## The Three Worlds

WORLD 1 — The Tutorial City (L1-15)
- Visual: sunny suburban streets (existing morning/afternoon themes)
- Mechanic focus: color matching, queue reading, booster basics
- Ends with: Tank first appearance at L15

WORLD 2 — The Industrial Zone (L16-30)
- Visual: gritty industrial environment (new theme — steel grey, orange
  hazard lights, overcast sky with factory silhouettes)
- Mechanic focus: Streak Shot mastery, booster combinations
- Streak Shot introduced organically at L17
- Ends with: first 5-color level as the boss at L30

WORLD 3 — The Highway (L31-40)
- Visual: night highway (new theme — dark sky, neon lights, headlights,
  rain-slicked road)
- Mechanic focus: all 6 colors, tank-heavy, designed puzzle levels
- Each level has a specific designed solution
- Ends with: Grandmaster Finale L40 — all car types, all 6 colors

## The Signature Mechanic: Hot Streak (V2 — owner-approved redesign, 2026-09-27)
Destroy at least one car on 3 shots in a row → the next bomb is SUPERCHARGED:
double damage, and its carry-over smashes through cars of ANY colour behind the
first one (armour and bosses still stop it). A hit that destroys nothing resets
the streak. Live from L4 (L1-L3 teach the basics).

Visual: three flame pips on the breach stripe light yellow → orange → red; at
three the pill reads SUPERCHARGED and a fire ring pulses around every bomb the
player can fire next. On the power shot: POWER SHOT flash, thump, shake.

*Superseded:* "fire the correct colour 3 times in a row". Wrong-colour drops are
rejected before they fire, so "correct 3 in a row" was automatic and meant
nothing. Kills are a real choice. Also superseded: "discovered at L17, never in
a tutorial card" — it is introduced at L4 with one line, because a hidden rule
reads as randomness.

## Special Cars (V2)
Special cars change a RULE, not just HP. One trait per car; each arrives alone,
then they mix.
- **Speeder** (L7) — moves 2 rows a turn; never passes the car ahead.
- **Armoured** (L11) — steel plates take the first hit from ANY colour, no damage.
  The one time an off-colour bomb is useful.
- **Chameleon** (L17) — flips between two colours every turn; a roof lamp shows
  the next colour so the shot can be timed.

## Bosses (V2)
L10 / L20 / L30 / L40 are boss VEHICLES: one giant truck with a colour sequence
on its roof. Each bomb of the current colour knocks out one light (a
supercharged bomb knocks out two); clear the sequence to win. The boss moves a
row every 2-3 turns and its lane carries no other traffic.
- L10 The Hauler — learn the sequence while the side lanes keep coming
- L20 Iron Hauler — re-plates after every light: any bomb, then the colour
- L30 Chameleon King — the longest sequence, with speeders on both flanks
- L40 Twin Titans — two bosses at once, one of them armoured

## The Meta Loop: City Repair
Level select IS a city viewed from above.
Every level beaten repairs one building — rubble → scaffolding → gleaming.
Buildings take damage when a car breaches.
Players are defending THIS city, not abstract lives.
Saves to ProgressManager under 'cityState'.

## The Danger Aura
Cars within 2 rows of the breach gate emit a soft red pulsing glow.
NOT an HP bar. Communicates spatial urgency only.
"That car is about to breach" — visible instantly without reading numbers.

## The 40 Level Design Rules
- L10, L20, L30, L40 are BOSS LEVELS — designed with a specific intended
  solution the player discovers, not just harder numbers
- Each 8-level block has a RELIEF level at its 5th slot — L5, L13, L21, L29, L37 —
  easier than the level before it. (Shipped 8-block cadence, user-approved 2026-07-08;
  supersedes the earlier "every 5th level" wording. L15/25/35 are mini-boss flavor
  moments, not relief. See the canonical table in GAME_DESIGN.md.)
- Booster unlock levels are always EASIER than the level before them
- No level is designed by numerical ramp alone — each has a named
  design goal (see Level Master Table in GAME_DESIGN.md)

## NON-NEGOTIABLE RULES
These cannot be changed to fit existing code. If code needs changing, change the code.

1. All 40 levels must be visible and playable on the level select screen
2. World 2 and World 3 MUST have distinct visual themes — not palette swaps
   of existing themes
3. Hot Streak must be a real mechanic, not a visual-only effect
4. City repair meta MUST save state and show visual progress
5. Boss levels MUST have designed challenges, not just hpMultiplier bumps
6. The balance simulator MUST pass for every level before it ships
7. Wrong-color shots do NOT advance cars (already shipped — never revert)
8. BOMB booster destroys ALL cars in the TARGETED CAR'S LANE, regardless of color
   — **owner amendment, 2026-07-31.** The bomb travels to the tapped car and clears
   that car's entire lane, any colour, any row.
   - *Superseded:* "destroys ALL cars in the targeted ROW" (which itself corrected an
     earlier "color-matching only" note). The row-clear shipped and was rejected on
     device: it reads as a horizontal band across all lanes rather than a lane, and it
     never matches the one thing the player is tracking — the lane about to breach.
   - This is a deliberate amendment of a locked contract by its owner, not a drift.
     The lane-clear is now the locked behaviour; do not revert it to a row-clear.
   - Known consequence, accepted: a lane clear removes breach risk rather than the most
     cars (yield per fire 3.00 → 2.00, win rate up), so L4–L8 were retuned to hold the
     85–95 FTUE band. Boss colour-scarcity levels are affected too — see the L10/20/30/40
     margins recorded with that work.
9. No level shows more than FOUR colours (V2, 2026-09-27). With three bomb
   columns, five and six colours turned play into waiting for the right bomb.

## How To Use This Document
Before making ANY change to:
- LevelManager.js
- GameLoop.js
- ThemeRegistry.js
- LevelSelectScreen.js
- CarTypes.js

Ask: "Does this change move toward or away from the vision above?"
If away → do not make the change. Redesign the approach.
If toward → proceed.

If you encounter existing code that conflicts with this vision:
CHANGE THE CODE. Do not change the vision.

## Pre-Phase Checklist
Before starting any implementation phase, answer these in writing
(in a comment at the top of your first commit message):

[ ] I have read VISION.md in full
[ ] I have read GAME_DESIGN.md in full
[ ] My planned changes move toward the vision, not away from it
[ ] I have NOT adjusted the vision to fit existing code constraints
[ ] The balance simulator will be run on all affected levels
[ ] I have identified which VISION.md rules my work touches

If any box cannot be checked → stop and redesign the approach.
