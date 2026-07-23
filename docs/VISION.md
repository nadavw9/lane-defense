# Traffic Bomb — Vision Contract

## Status: LOCKED. Do not modify without explicit user approval.

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

## The Signature Mechanic: Streak Shot
Fire the correct color 3 times in a row without a miss →
next bomb does double damage AND slows the hit car for 1 shot.

Visual: bomb queue glows hotter (yellow → orange → red) with each
consecutive correct hit. On the power shot: dramatic impact flash,
car briefly shudders.

This mechanic is discovered naturally at L17 (level designed to reward it),
never in a tutorial card. The player figures it out.

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
3. Streak Shot must be a real mechanic, not a visual-only effect
4. City repair meta MUST save state and show visual progress
5. Boss levels MUST have designed challenges, not just hpMultiplier bumps
6. The balance simulator MUST pass for every level before it ships
7. Wrong-color shots do NOT advance cars (already shipped — never revert)
8. BOMB booster destroys ALL cars in the targeted row, regardless of color (corrects the earlier "color-matching only" note, which was wrong)

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
