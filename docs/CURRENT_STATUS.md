# Traffic Bomb — Current Status (publishing)

As of 2026-10-10. Owner: Claude (this repo). Sister game The Math Wolf is owned by Codex/GPT; its status lives in Base44 `docs/CURRENT_STATUS.md`. No secrets in this file.

Evidence tags: VERIFIED (checked in code/file/UI), REPORTED (user screenshot or statement), ASSUMED.

## Identity
| item | value | tag |
|---|---|---|
| Package | com.nadavw.trafficbomb | VERIFIED (build.gradle) |
| Play developer | Nadav9 / 8406370812868001147 | REPORTED |
| Branch | feat/v2-design, last pushed b147a67 | VERIFIED |
| versionCode / versionName | 1 / 1.0 | VERIFIED |
| AdMob app | ca-app-pub-3810333742263149~3212730463 | VERIFIED in code; last digits not user-checked in console |
| Rewarded / interstitial | .../8064409920, .../4284947016 | same as above |

## Play Console
- App content: all declarations complete ("You're all caught up") — REPORTED.
- Declared: ads Yes; Advertising ID Yes; audience 13-15, 16-17, 18+; IARC result ESRB Everyone / PEGI 3 / USK 0.
- Data safety: Approximate location, App interactions, Diagnostics, Device or other IDs; all collected + shared, required; purposes Advertising, Analytics, Fraud prevention; encrypted in transit; no account creation; deletion by email.
- Closed test "Alpha": draft release with AAB (test-ads build, code 1) — REPORTED. NOT sent for review. 0 testers; need 12 opted in for 14 days.
- Store listing text, screenshots (L5+), 1024x500 feature graphic: NOT done. 512 icon exists (store/icon-512.png).

## Open items (next owner in brackets)
1. AD_ID permission vs "Advertising ID: Yes" — check merged manifest of the AAB build [user runs, Claude reads result].
2. Deletion by email: analytics uses a random install ID the player never sees, so a request cannot be matched. Decide: show ID in Settings + say so in privacy policy, or change the answer [ask user].
3. Test/live ads: currently VITE_TEST_ADS=1 flag; GPT suggests an explicit mode so a forgotten flag cannot flip behaviour. Also verify IDs inside the final package [ask user].
4. AdMob GDPR message (Privacy & messaging) not created; test consent/decline/reopen/offline on device [user + Claude].
5. Analytics DB (`lanedefense-analytics` RTDB) rules unchecked; SHA-1 vs API-key Firebase wording unclear; google-services.json is tracked in git (only key restrictions matter) [Claude/user].
6. Developer website on listing = https://nadavw9.github.io [user].
7. 12 testers [user]; one tester group could serve both games.
8. Store release build must be made WITHOUT VITE_TEST_ADS [Claude/user, later].
9. Boss replays L10/L20/L30/L40 on device [user].

## Shared services (cross-game)
Publisher pub-3810333742263149; app-ads.txt at https://nadavw9.github.io/app-ads.txt returns 200 with the DIRECT line (GPT, 2026-10-10). AdMob reading it for Traffic Bomb: unverified.

## Change log
- 2026-10-10 Claude: useTestAds + VITE_TEST_ADS, tests, commit b147a67 (pushed).
- 2026-10-10 Claude: this file created.
