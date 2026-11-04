# Traffic Bomb on the App Store (iPhone) — prepared 2026-10-25

Everything the App Store needs that can exist before the Apple Developer membership is active.
Bundle ID `com.nadavw.trafficbomb` (same as Android). iPhone only, portrait.

## What is already done (branch `feat/ios`)

| piece | where |
|---|---|
| iPhone project (Capacitor 8.3, Swift Package Manager, no CocoaPods) | `ios/` |
| App icon 1024 (opaque) + launch image | `ios/App/App/Assets.xcassets/` (`node scripts/render-app-icons.mjs ios`) |
| Ads: Apple tracking prompt, Google's 50 SKAdNetwork IDs, AdMob app ID as a build setting | `ios/App/App/Info.plist`, `src/ads/AdManager.js` |
| iOS ad units from build variables; test ads until both exist (even in a live build) | `AdManager.adUnitIds / testAdsFor` |
| Sound starts on the first touch (iPhone only allows audio after a gesture) | `src/audio/AudioManager.js` |
| Build on GitHub's macOS runners: unsigned compile check now, TestFlight upload later | `.github/workflows/ios-release.yml` |
| 8 screenshots, 1320x2868 (App Store 6.9" iPhone) | `docs/store/appstore/appstore-iphone-1..8.png` (`node scripts/store-art.mjs <raw> docs/store/appstore ios`) |
| Privacy policy covers the iPhone tracking prompt | `public/privacy.html` |

## Steps for the owner once Apple activates the membership

1. **Register the bundle ID** — https://developer.apple.com/account/resources/identifiers/list
   `+` > App IDs > App > Description `Traffic Bomb`, Bundle ID **Explicit** `com.nadavw.trafficbomb` > Continue > Register.
2. **Create the app in App Store Connect** — https://appstoreconnect.apple.com/apps
   `+` > New App > iOS, Name `Traffic Bomb: Color Match`, language English (U.S.), bundle ID from step 1,
   SKU `trafficbomb`, User Access: Full Access > Create.
3. **API key for the GitHub build** — https://appstoreconnect.apple.com/access/integrations/api
   Team Keys > `+` > name `github-ci`, Access **Admin** > Generate > **Download** the .p8 (only once).
   Note the Key ID (in the row) and the Issuer ID (above the table).
4. **Team ID** — https://developer.apple.com/account > Membership details > Team ID.
5. **Put them in GitHub** — https://github.com/nadavw9/lane-defense/settings/secrets/actions
   Secrets: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8_BASE64` (the .p8 file in base64: on Windows
   PowerShell `[Convert]::ToBase64String([IO.File]::ReadAllBytes("AuthKey_XXXX.p8"))`).
   Variables tab: `APPLE_TEAM_ID`.
6. **First TestFlight build** — Actions > *iOS build / TestFlight* > Run workflow, `upload = testflight`
   (Claude can dispatch it). Apple processes the build for ~15-30 minutes.
7. **Test on the iPhone** — App Store Connect > the app > TestFlight > Internal Testing > `+` group,
   add yourself; install **TestFlight** from the App Store on the iPhone and accept the invite.

### iPhone ads (can be done any time, independent of Apple)

AdMob > Apps > Add app > iOS > "not listed on a store yet" > name `Traffic Bomb iOS`
(https://apps.admob.com/v2/apps/create). Then Ad units > Add: one **Rewarded**, one **Interstitial**.
Put into GitHub *Variables*: `IOS_ADMOB_APP_ID` (the `~` app ID), `VITE_IOS_REWARDED_AD_ID`,
`VITE_IOS_INTERSTITIAL_AD_ID` (the `/` unit IDs). Until both units are set, iPhone builds show only
Google test ads, whatever the ad mode.

## Listing (App Store Connect > the app > App Store tab)

- **Name (30):** Traffic Bomb: Color Match
- **Subtitle (30):** Stop the traffic jam!
- **Promotional text (170):** Match the color, drop the bomb, stop the traffic before it breaks through. 200 levels, no timers, plays offline.
- **Description:** the full description in `LISTING.md` (same text as Google Play).
- **Keywords (100):** `traffic,puzzle,bomb,color match,casual,cars,turn based,offline,strategy,brain`
- **Support URL:** https://nadavw9.github.io/lane-defense/
- **Privacy policy URL:** https://nadavw9.github.io/lane-defense/privacy.html
- **Category:** Games > Puzzle; secondary Games > Casual.
- **Price:** Free. **In-app purchases:** none.
- **Screenshots:** iPhone 6.9" display: `docs/store/appstore/appstore-iphone-1..8.png` (Apple scales them for smaller iPhones).
- **App icon:** comes from the build (no separate upload).
- **Copyright:** 2026 Nadav Wolfson

### Age rating questionnaire

Every content question: **None**, except: **Advertising: Yes**. No user-generated content, no chat,
no web browsing, no gambling, no contests, no in-app purchases, no medical or location features.
The bombs destroy toy cars with no people and no injury, so "Cartoon or Fantasy Violence" is None;
if review disagrees, "Infrequent/Mild" is the honest fallback.

### App Privacy ("nutrition label") — as published 2026-11-05

Answers taken from the privacy manifest of the ad SDK actually in the build (GoogleMobileAds 12.14.0,
`PrivacyInfo.xcprivacy`) plus the game's own anonymous analytics (random install id + gameplay events
to Firebase Realtime Database: Device ID + Product Interaction, Analytics). Collect data: Yes.

| type | purposes | linked | tracking |
|---|---|---|---|
| Device ID | Third-Party Advertising, Developer's Advertising or Marketing, Analytics | yes | **yes** |
| Coarse Location | same three | yes | no |
| Advertising Data | same three | yes | no |
| Product Interaction | same three | yes | no |
| Performance Data | same three | no | no |
| Other Diagnostic Data | same three | no | no |
| Crash Data | Analytics | no | no |

Re-check the SDK manifest when GoogleMobileAds is upgraded.

### Review notes (App Review Information)

No login. Ads are test ads in builds made before the iOS AdMob units are set. Contact:
nadavwolfsonw@gmail.com.

### Export compliance

`ITSAppUsesNonExemptEncryption = false` is in Info.plist (HTTPS only), so App Store Connect does
not ask per build.

## Status 2026-11-03 (filled through the App Store Connect API, `TrafficBomb-owner/ios-signing/tools/fill-appstore.cjs`)

Done: description (the LISTING.md text, with bridges), keywords, promotional text, support + marketing URL,
subtitle, privacy policy URL, copyright, category Games > Puzzle + Casual, age rating (4+; Advertising yes),
content rights (no third-party content), review contact + notes, price Free, availability 175 territories,
8 screenshots 1320x2868 (APP_IPHONE_67; `scripts/store-capture.mjs` + `store-art.mjs ios`; #2 = bridges),
build 18 attached (export compliance answered by Info.plist).
Done 2026-11-04/05: AdMob iOS app ca-app-pub-3810333742263149~6260031759 (units /9118341412 rewarded, /5218412821 interstitial, GitHub variables), build 20 (ads=live, friends=no) attached, privacy label published, SUBMITTED for review 2026-11-05 (`tools/submit-appstore.cjs`). Was open (owner): AdMob iOS app + Rewarded + Interstitial units -> GitHub variables (then a build with
ads=live replaces build 18, which serves test ads); App Privacy label on the website. Then the submission.
