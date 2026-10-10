# Handoff to the local session (Windows PC + Chrome) — Traffic Bomb publishing

Written 2026-10-10 (Asia/Jerusalem) by the cloud session. Read this, then `docs/CURRENT_STATUS.md`,
`docs/SHARED_SERVICES.md`, `docs/store/LISTING.md` and `CLAUDE.md` (project rules). No secrets are in
this file. `CLAUDE.md` contains a keystore password: NEVER repeat it in any output, prompt, commit or
tester-facing text.

## 0. Why this handoff exists
The cloud session could not touch the owner's PC or browser. This local session can (Chrome extension
is installed and signed in as the owner). The owner dislikes doing console steps by hand: operate the
consoles yourself via Chrome wherever possible. He still does: passwords, 2-step codes, and the final
Publish / Submit / Send-for-review buttons (ask before each one).

## 1. Owner preferences (follow exactly)
- On how something will LOOK or WORK for players: ask him first, before building. Implementation detail needs no consultation.
- "Grill-me" mode on new design/build work: map decisions, ask one branch at a time, restate decisions, no code until aligned.
- Every step he must do himself: exact click path + direct link.
- He is Hebrew/English bilingual; reply in English unless he writes Hebrew.
- Recent work already delegated to Claude by him: "do what you think" on deletion handling, ads mode, shared registry (all done, see §3).
- Do NOT touch the other game (The Math Wolf, com.wolfacademy.lanemath, owned by Codex/GPT). No changes to its AdMob/Play settings, permissions or payment. One shared account, so be careful which app is selected in every console.
- The owner's visual standard: Play Store quality. Any visual change needs an L5+ screenshot (CLAUDE.md screenshot loop).

## 2. Identity and locations
- Game: Traffic Bomb, package `com.nadavw.trafficbomb`. Repo https://github.com/nadavw9/lane-defense, branch `feat/v2-design` (latest pushed: 671280f at time of writing).
- Play developer account "Nadav9" (id 8406370812868001147). Play Console: https://play.google.com/console
- AdMob publisher `pub-3810333742263149` (shared with The Math Wolf). Traffic Bomb app id `ca-app-pub-3810333742263149~3212730463`, rewarded `.../8064409920`, interstitial `.../4284947016`. The last digits are NOT yet verified against the console: https://apps.admob.com/v2/apps/list
- Clean build folder on the PC: `C:\Users\dalit\lane-defense-release` (clone of feat/v2-design). RUN `git pull` first.
- Old folder `C:\Users\dalit\lane-defense` has many uncommitted local changes. Do NOT commit, stash, reset or delete anything there. Do not build from it.
- Signing: gitignored `android/keystore.properties` and `android/lane-defense-release.keystore` (in the OLD folder; the release folder has a copy of what it needs — if the build fails on signing, check, never regenerate the keystore; losing it is permanent). Gradle needs gitignored `android/local.properties` (SDK path; already present in the release folder).
- Python: bare `python` is a Store stub. Use `C:\Users\dalit\AppData\Local\Programs\Python\Python312\python.exe` if needed.
- Live web build: https://nadavw9.github.io/lane-defense/ ; privacy page https://nadavw9.github.io/lane-defense/privacy.html ; developer website https://nadavw9.github.io ; app-ads.txt https://nadavw9.github.io/app-ads.txt (200, correct line, per GPT 2026-10-10).

## 3. What is DONE (do not redo)
Play Console, all App content declarations complete ("You're all caught up"):
- Ads: Yes. Advertising ID: Yes (VERIFIED: merged release manifest contains AD_ID and ACCESS_ADSERVICES_AD_ID).
- Target audience: 13-15, 16-17, 18+ only. Content rating IARC done (ESRB Everyone, PEGI 3, USK 0). Government/Financial/Health: none. Sign-in: no restriction.
- Data safety: Approximate location, App interactions, Diagnostics, Device or other IDs — all collected + shared, required; purposes Advertising, Analytics, Fraud prevention; encrypted in transit; no account creation; deletion by email.
- Closed test "Alpha": draft release with the tester AAB (versionCode 1, versionName 1.0, test ads). NOT sent for review. 0 testers.
Code (on the branch):
- `src/ads/adPolicy.js useTestAds`: live ads ONLY when the build sets `VITE_ADS_MODE=live`; anything else = Google test ads. Tester build: `VITE_ADS_MODE=test`. Store build: `$env:VITE_ADS_MODE='live'`.
- Settings > About shows an anonymous "Data ID" (tap to copy); `public/privacy.html` tells players to email it for deletion. The tester AAB already uploaded does NOT contain this yet.
- `docs/SHARED_SERVICES.md`, `docs/CURRENT_STATUS.md` created.
- Tests: `npx vitest run` = 1537 passing at 671280f.
AdMob consent message (GDPR): created in the editor by an extension session; Traffic Bomb selected; privacy policy URL `https://nadavw9.github.io/lane-defense/privacy.html`; "Do not consent" was being set to ON (recommended). Publish state UNKNOWN — check https://apps.admob.com/v2/privacymessaging and publish if not published.

## 4. TODO list, in priority order (with exact paths)
1. Verify/finish AdMob consent message (above). Name it "Traffic Bomb consent". Consent On, Manage options On, Do not consent On, Close Off. Publish (ask owner).
2. Play Console > Grow users > Store presence > Store settings > Store listing contact details: Website = `https://nadavw9.github.io`; confirm support email. Save.
3. Bump `versionCode` to 2 in `android/app/build.gradle` (versionName e.g. 1.0.1), commit, push, then build a NEW tester AAB so testers get the Data ID screen:
   ```
   cd C:\Users\dalit\lane-defense-release
   git pull
   $env:VITE_ADS_MODE='test'
   npm ci; npm run build; npx cap sync android
   cd android; .\gradlew bundleRelease
   ```
   Output: `android\app\build\outputs\bundle\release\app-release.aab`. Upload: Play Console > Test and release > Testing > Closed testing > Alpha > Releases > Create new release (or edit the draft) > upload the AAB. Check the Play Console accepts the package name `com.nadavw.trafficbomb` and the signing (Play App Signing; upload key = the PC keystore).
   Before upload, verify in the built package that the three AdMob IDs are the intended ones and that no live-ads flag was set.
4. Testers: Alpha > Testers tab > Create email list (needs 12+ Gmail addresses from the owner; ask him; one group can also serve The Math Wolf) > select list > Save. Copy the opt-in link for him to send ("Become a tester" must be tapped by each tester; 14 days opted-in required before production access). Offer to draft the recruiting message.
5. Send the Alpha release for review (Publishing overview > Send changes for review) — ONLY after owner OK. Play may demand the store listing first.
6. Store listing (Grow users > Store presence > Main store listing): draft text is in `docs/store/LISTING.md`. Update its Data Safety table to the four-type version in §3 first. Needs: title, short + full description, 512 icon (`store/icon-512.png` exists), 1024x500 feature graphic (NOT made), phone screenshots from L5+ ONLY (never L1; use `scripts/` Playwright tooling per CLAUDE.md, review captures to `docs/review/` with `00-labels.txt`). Show the owner the graphics before upload. If the right design tool is missing, STOP and tell him the exact install command (CLAUDE.md §2: no workarounds).
7. AdMob checks: confirm the three IDs' last digits; app review status; app-ads.txt crawl status for Traffic Bomb; link the AdMob app to the Play listing AFTER first publish.
8. Firebase/analytics: analytics posts to `https://lanedefense-analytics-default-rtdb.firebaseio.com` (REST, no SDK, no API key in code). Check that database's rules in the Firebase console (read/write exposure) and report to the owner. `android/app/google-services.json` is tracked in git: do NOT parse it or print any key from it (an earlier attempt was blocked as credential materialization). Only whether keys are restricted matters; check in Google Cloud console if the owner agrees.
9. Consent testing on a real device: accept, decline, reopen via Settings > Ad choices, offline. Owner's phone; give him steps.
10. Later: STORE release build with `$env:VITE_ADS_MODE='live'` (never reuse the tester AAB for production), production release after the 14-day closed test.
11. Owner replays bosses L10/L20/L30/L40 on device (preview artifact v21). Not yours.

## 5. Repo rules that bite (details in CLAUDE.md)
- Local code gate: `npx vitest run` only. Never run `npm run test:visual` locally. Never `gh run watch`.
- Pages deploys are cancelled by ANY branch push; push, then leave the remote alone until deploy finishes. Docs-only changes may go to master; deploy/merge-path code goes to a branch and waits for CI.
- Commit author for cloud commits was `noreply@anthropic.com`; on the PC use the owner's normal git identity unless told otherwise. No emojis in commit messages. Add the attribution lines your harness requires.
- Do not edit `docs/VISION.md`. Do not touch `src/director/` without tests.
- Two-attempt rule: after two failed attempts at the same thing, stop, write down confirmed/unconfirmed, move on.

## 6. How to report
After each console action, tell the owner in one line what changed and whether anything differed from this document. Update `docs/CURRENT_STATUS.md` (dated, with evidence) after each completed item. Never claim a console change happened without seeing it on screen.
