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
- NEW TESTER AAB READY 2026-10-10 (not yet uploaded): versionCode 2 / versionName 1.0.1, built with VITE_ADS_MODE=test, signed. `android/app/build/outputs/bundle/release/app-release.aab`, 57.16 MB. Pre-upload checks all VERIFIED by reading inside the package: shipped bundle inlines VITE_ADS_MODE:"test"; rewarded .../8064409920 and interstitial .../4284947016 present; AdMob app id ca-app-pub-3810333742263149~3212730463 in the manifest; no other publisher id; zero Google test IDs; both AD_ID permissions present; merged manifest versionCode="2" versionName="1.0.1". This build contains the Data ID screen — code 1 does not.
- Store listing: text drafted (docs/store/LISTING.md, Data Safety table corrected to the four declared types). Screenshots CAPTURED 2026-10-10 to docs/review/ (01-07 gameplay L12/L30/L38/L50/L65/L80 + level map, all 1170x2532, L5+ only). 512 icon exists (store/icon-512.png). STILL MISSING: 1024x500 feature graphic.

## Open items (next owner in brackets)
1. DONE 2026-10-10: merged release manifest contains com.google.android.gms.permission.AD_ID and android.permission.ACCESS_ADSERVICES_AD_ID (user's PC, release build). "Advertising ID: Yes" is correct; keep it.
2. DONE 2026-10-10. privacy.html is LIVE — run 38055849492 (master d1b185a) deployed it and https://nadavw9.github.io/lane-defense/privacy.html now returns "Last updated: 10 October 2026" plus the Data ID deletion sentence (VERIFIED by fetch). Only that one file was cherry-picked to master; the live game build is unchanged. Two text defects fixed first: the policy named "Settings > Ad privacy choices" but the real row is "Ad choices" (SettingsScreen.js:178), and the date predated the Data ID paragraph. Settings > About captured on screen for the first time — docs/review/08.png.
3. DONE + VERIFIED 2026-10-10. Built with VITE_ADS_MODE=live and read the output bundle: VITE_ADS_MODE:"live" is inlined at the AdMob.initialize call, both live unit IDs present, ZERO Google test IDs (ca-app-pub-3940256099942544). useTestAds fails safe — anything but exactly "live" yields test ads. STORE build must still set $env:VITE_ADS_MODE='live'.
4. AdMob GDPR message (Privacy & messaging) not created; test consent/decline/reopen/offline on device [user + Claude].
5. PARTLY ANSWERED 2026-10-10 without the console: unauthenticated reads of the `lanedefense-analytics` RTDB return **401** at the root and at /sessions.json, so the database is NOT world-readable. Writes were deliberately NOT tested — a write would inject junk into production data. Side finding: `AutoTuner` (AutoTuner.js:52, wired at GameApp.js:381 -> LevelManager.js:386) does an unauthenticated READ of /sessions.json that is 401-blocked and swallowed, so **difficulty auto-tuning is inert in production** — shipped difficulty is purely the hand/sim-tuned table. Owner decision 2026-10-10: leave it off, do not open the database; remove the dead read later in a separate small commit. Still open: whether the API keys are restricted (Google Cloud console) [user].
6. Developer website on listing = https://nadavw9.github.io [user].
7. 12 testers [user]; one tester group could serve both games.
8. Store release build must set VITE_ADS_MODE=live [Claude/user, later].
9. Boss replays L10/L20/L30/L40 on device [user].

## Shared services (cross-game): see docs/SHARED_SERVICES.md

Publisher pub-3810333742263149; app-ads.txt at https://nadavw9.github.io/app-ads.txt returns 200 with the DIRECT line (GPT, 2026-10-10). AdMob reading it for Traffic Bomb: unverified.

## Change log
- 2026-10-10 Claude: useTestAds + VITE_TEST_ADS, tests, commit b147a67 (pushed).
- 2026-10-10 Claude: this file created.
- 2026-10-10 Claude (local PC session): privacy.html text fixes + cherry-pick to master (d1b185a) -> Pages run 38055849492 success, live page verified. Branch commit 553dc76. versionCode 2 / 1.0.1 tester AAB built and verified from inside the package. Store screenshots captured (docs/review/, 00-labels.txt). LISTING.md Data Safety table corrected. RTDB read exposure tested (401). vitest 1537 passing. NOTE: no browser automation in this session — AdMob and Play Console items untouched, awaiting chrome-devtools-mcp.
