# Traffic Bomb — store listing draft (2026-10-01)

Draft copy and form answers for Google Play and the App Store. Nothing here is submitted;
the owner reviews it at the publishing stage. App id `com.nadavw.trafficbomb`.

## Title and short text

- **Title (30 max):** Traffic Bomb
- **Subtitle / short description (80 max):** Match the colour. Drop the bomb. Stop the traffic jam before it breaks through.
- **Alt short descriptions:**
  - A colourful puzzle where every bomb has to match its car.
  - 100 levels of colour-matching traffic chaos. One bomb at a time.

## Full description (EN)

Cars are rolling toward your city and only YOU can stop them. Drag a colour-coded bomb onto
a lane: if the colour matches the front car, boom. If not, it bounces and traffic keeps coming.

Every shot is a turn, so you can think as long as you like. Plan your queue, chain kills into
combos, and charge a Hot Streak for a double-damage supercharged bomb.

WHAT YOU GET
- 100 hand-built levels across 7 worlds: Toy Town, Steel Yards, Neon Nights, Sun Valley,
  Frost Pass, Harbor Lights and the Starlight Strip
- 10 boss vehicles that you beat by hitting their roof lights in the right colour order
- Seven special cars that change how you play: speeders, armoured and plated cars,
  chameleons, menders, volatile fuel trucks and phantoms
- Boosters: recolour a whole colour, freeze traffic for a turn, or blast an entire lane
- A new daily challenge every day, a weekly playlist, trophies and a daily reward
- Repair your city one building at a time as you win
- Colourblind shapes and a reduce-motion option

No timers. No energy. Just you, a queue of bombs and a very busy road.

## Keywords / tags

traffic, puzzle, bomb, colour match, color match, casual, strategy, turn based, cars, relaxing,
offline, brain teaser (Apple 100 chars: `traffic,puzzle,bomb,color match,casual,cars,turn based,offline,strategy,brain`)

## What's new (release notes)

- 100 levels across 7 worlds, with 6 new bosses
- Four new special cars: plated, mender, volatile and phantom
- New daily challenges, a refreshed economy and a continue-with-coins option
- Reduce motion and colourblind improvements, faster start-up

## Category and rating

- Google Play: Games › Puzzle. Apple: Games › Puzzle (secondary Casual).
- Expected IARC / ESRB: Everyone (cartoon vehicles being "destroyed" by bombs; no blood, no
  humans, no gambling, no user-generated content, no chat). Answer the questionnaire as:
  violence — mild cartoon only (vehicles, no characters); no sexual content, language,
  controlled substances or simulated gambling; ads present; in-app purchases: see below.
- Target audience: 13+ / general audience (NOT designed for children). This keeps the privacy
  policy statement ("not directed at children under 13") true and avoids Families-policy ad
  restrictions. Decision recorded 2026-10-01; revisit only if the owner wants the Families programme.

## Google Play Data Safety (matches `public/privacy.html`)

| Question | Answer |
|---|---|
| Collects or shares user data? | Yes |
| Data encrypted in transit? | Yes (HTTPS) |
| Users can request deletion? | Yes — by email (address in the privacy policy) |
| **Device or other IDs** | Collected: random install ID (analytics) and advertising ID (AdMob). Purposes: analytics, advertising. Shared with: Google AdMob / Firebase. Not optional for ads; analytics follows consent where required. |
| **App activity** | Collected: levels played, win/lose, duration, moves, boosters used. Purpose: analytics. Not linked to identity. |
| **App info and performance** | Crash logs/diagnostics only if crash reporting is added (see TODO). |
| **Approximate location** | Collected by AdMob via IP address. Purpose: advertising. |
| Personal info, financial info, health, messages, photos, contacts, audio | Not collected |

TODO before submission: re-check this table against whatever SDKs ship in the final build
(Firebase Analytics/Crashlytics, AdMob, any purchase SDK). If in-app purchases are added, the
"purchase history" line and the privacy policy both need updating.

## Apple App Privacy ("nutrition label")

- Data used to track you: none, unless the iOS build shows personalised ads and requests ATT
  consent; if it does, Device ID + Advertising Data are "used to track".
- Data linked to you: none (no accounts).
- Data not linked to you: Identifiers (device/advertising ID), Usage Data (product interaction),
  Diagnostics (if crash reporting is enabled).

## Screenshots to capture (phone portrait, 1080x1920 minimum; use L5+ only)

1. Gameplay with a combo at L12 (Toy Town)
2. Boss fight, L30
3. Neon Nights traffic, L38
4. Sun Valley desert, L50
5. Frost Pass with a phantom, L65
6. Harbor Lights container yard, L80
7. Level map with repaired buildings
8. Boosters in action (lane bomb)

Capture with `scripts/screenshot.mjs`; no UI overlays from dev builds.

## Support and policy links

- Privacy policy: https://nadavw9.github.io/lane-defense/privacy.html
- Support email: nadavwolfsonw@gmail.com
