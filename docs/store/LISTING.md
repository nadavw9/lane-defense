# Traffic Bomb — store listing (updated 2026-10-17)

Copy and form answers for Google Play (and later the App Store). App id `com.nadavw.trafficbomb`.
Updated for the current game: one-hit bombs, big board, traffic lights, gift cars, convoys,
HARD / SUPER HARD levels, win streaks. US spelling throughout (the game uses it).

## Title and short text

- **Title (30 max):** Traffic Bomb: Color Match
- **Short description (80 max):** Match the color, drop the bomb, stop the traffic before it breaks through!
  (74 characters)
- **Alternatives:**
  - A colorful traffic puzzle: every bomb must match its car. 100 levels!
  - Drag, match, boom! Stop the traffic jam in 100 bright puzzle levels.

## Full description (EN, under 4000)

Cars are rolling toward your city and only YOU can stop them!

Drag a color bomb onto a lane: if it matches the car in front, BOOM. Every shot moves the
traffic closer, so pick your target wisely. Clear the road before a single car crosses the red line.

EASY TO PLAY, HARD TO PUT DOWN
• One finger, one drag, one boom
• Big cars take more hits: each hit shrinks them down
• Turn-based: think as long as you like, no timers

100 LEVELS ACROSS 7 WORLDS
• Toy Town, Steel Yards, Neon Nights, Sun Valley, Frost Pass, Harbor Lights and the Starlight Strip
• HARD and SUPER HARD levels for when you want a real challenge
• Repair your city one building at a time as you win

TRAFFIC THAT FIGHTS BACK
• Traffic lights that hold a lane on red
• Gift cars that drop free boosters
• Motorbike convoys, speeders, armored and plated cars, chameleons, menders, volatile fuel trucks and phantoms

POWER UP
• Hot Streak: three kills in a row charges a super bomb
• Color Swap, Freeze and lane-clearing Bomb boosters
• Win streaks start your next level with free boosters
• Daily rewards, a daily challenge and trophies to collect

Colorblind shapes and a reduce-motion option included.

## Keywords / tags

traffic, puzzle, bomb, color match, casual, strategy, turn based, cars, offline, brain teaser
(Apple 100 chars: `traffic,puzzle,bomb,color match,casual,cars,turn based,offline,strategy,brain`)

## What's new (release notes, 500 max)

- Bigger, chunkier cars and a busier road
- New: traffic lights, gift cars and motorbike convoys
- HARD and SUPER HARD levels, with a final rush at the end of every level
- Win streaks give free boosters; double your coins after a win
- Shorter, clearer tips and a quicker first level

## Category and rating

- Google Play: Games › Puzzle. Apple: Games › Puzzle (secondary Casual).
- Expected IARC / ESRB: Everyone (cartoon vehicles being "destroyed" by bombs; no blood, no
  humans, no gambling, no user-generated content, no chat). Answer the questionnaire as:
  violence — mild cartoon only (vehicles, no characters); no sexual content, language,
  controlled substances or simulated gambling; ads present; in-app purchases: see below.
- Target audience: 13+ / general audience (NOT designed for children). This keeps the privacy
  policy statement ("not directed at children under 13") true and avoids Families-policy ad
  restrictions. Decision recorded 2026-10-01; revisit only if the owner wants the Families programme.

## Google Play Data Safety — AS DECLARED IN THE CONSOLE (2026-10-10)

This is the version actually submitted, not a proposal. Four data types, each marked
**collected AND shared**, **required** (not optional), with purposes **Advertising,
Analytics, Fraud prevention**. Encrypted in transit: yes. Account creation: none.
Deletion: by email. Do not "correct" this table toward the app's own code — see the note below.

| Question | Answer |
|---|---|
| Collects or shares user data? | Yes |
| Data encrypted in transit? | Yes (HTTPS) |
| Users can request deletion? | Yes — email the anonymous Data ID from Settings > About (path is in `public/privacy.html`) |
| **Approximate location** | Collected + shared, required. Derived by AdMob from IP address. |
| **App interactions** | Collected + shared, required. Levels played, win/lose, duration, moves, boosters used. |
| **Diagnostics** | Collected + shared, required. Screen size and session timing; AdMob SDK diagnostics. |
| **Device or other IDs** | Collected + shared, required. Random install ID (analytics) and advertising ID (AdMob). |
| Personal info, financial info, health, messages, photos, contacts, audio, purchase history | Not collected |

Why the declaration is broader than the code: Play requires declaring what the bundled SDKs
collect, not only what app code sends. AdMob covers location, IDs and diagnostics on its own.
Over-declaring is safe; under-declaring is the policy violation. So leave these four in place
even though `src/analytics/Analytics.js` by itself would only justify App interactions + IDs.

TODO before submission: if in-app purchases or crash reporting (Crashlytics) are ever added,
re-open this table — purchase history and a broader Diagnostics scope would both need declaring,
and `public/privacy.html` would need matching text.

## Apple App Privacy ("nutrition label")

- Data used to track you: none, unless the iOS build shows personalised ads and requests ATT
  consent; if it does, Device ID + Advertising Data are "used to track".
- Data linked to you: none (no accounts).
- Data not linked to you: Identifiers (device/advertising ID), Usage Data (product interaction),
  Diagnostics (if crash reporting is enabled).

## Screenshots and graphics (generated 2026-10-17)

Made by `scripts/store-art.mjs` from real game captures (`scripts/store-capture.mjs`, DPR 3),
1080x1920 each (Play: 9:16, under 2:1), plus the 1024x500 feature graphic. Files: `docs/store/art/`.
Upload set: `icon-512.png` (app icon), `feature-graphic.png`, `screenshot-1..8.png` (phone).
1. Match the color, drop the bomb (L12)  2. Beat the traffic lights (L35)  3. Gift cars (L13)
4. 7 worlds, 100 levels (L55)  5. Special cars (L65)  6. Repair your city (Toy Town map)
7. Win streaks (win screen)  8. Harbor Lights (L88)

## Support and policy links

- Privacy policy: https://nadavw9.github.io/lane-defense/privacy.html
- Support email: nadavwolfsonw@gmail.com
