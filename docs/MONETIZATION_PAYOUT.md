# Getting paid for ads — Traffic Bomb (checked 2026-10-18)

## How the money flows

Players watch ads in the app → the AdMob SDK reports impressions to Google → Google credits the
AdMob account (publisher `pub-3810333742263149`) → once a month Google pays the balance to the
bank account on the payments profile. **The game never touches money.** There is no server, no
in-app purchase and no payout code; nothing in this repo needs to be built for payouts.

## Account state (AdMob → Payments, read-only check)

| item | state |
|---|---|
| Payments account | AdSense (Israel), paid monthly, threshold **₪400** |
| Payments profile | Individual; name, address, phone filled in |
| Payments users | 1 (nadavwolfsonw@gmail.com, primary contact) |
| Israel tax info | **empty** |
| United States tax info | **empty** |
| Payment method (bank) | not added yet; AdMob asks for it at the payment-method threshold |
| Identity verification | not requested yet; asked once earnings pass the verification threshold |
| Traffic Bomb app | `ca-app-pub-3810333742263149~3212730463`, *Requires review / Limited ad serving: add store* |

## Steps, in the order Google asks for them

1. **Now:** fill in **United States tax info** (non-US individual → Form W-8BEN in the AdMob
   tax wizard; claim the Israel treaty rate). Without it Google may withhold US tax on earnings
   from US viewers. Tax info must be in before the 20th to be paid that month.
2. **Now:** ask an Israeli accountant whether to fill **Israel tax info** (withholding exemption
   letter from the tax authority) and how to report the income. Not something to guess.
3. **When the app is public on Play (after production):** AdMob → Apps → Traffic Bomb → *Add
   store* to link the Play listing. This lifts *Limited ad serving*. Not possible while the app
   is closed-testing only (the store page is 404 to the public).
4. **Identity verification** (earnings ≈ $10): upload ID in AdMob → Payments → Verification. The
   name must match the payments profile and the bank account.
5. **Address PIN** (after identity): a 6-digit PIN arrives by post to the profile address in
   2-3 weeks; enter it in AdMob within 4 months or ads stop serving.
6. **Payment method** (earnings ≈ $10): add the bank account (IBAN / SWIFT, account holder name
   = payments profile name). Google may send a small test deposit to confirm it.
7. **Payout:** if the balance on the 20th is ≥ ₪400 and there are no holds, payment is issued
   around the 21st of the following month. Below the threshold it rolls over.

## Security checklist (no code needed)

- **Two-step verification** on nadavwolfsonw@gmail.com (it owns Play Console, AdMob and the
  payments profile). This is the single most important control.
- **Never tap your own live ads**, and never ask friends to. Invalid clicks get the AdMob account
  suspended and earnings clawed back. Tester builds use **test ads** (`VITE_ADS_MODE=test`, the
  default in `android-release.yml`); only the store build is made with `VITE_ADS_MODE=live`.
- Keep **payments users** to the owner only; add other people to AdMob with *standard/read-only*
  roles, never admin.
- Bank details are entered only on Google's own Payments page, never sent to anyone.
- Watch **Policy center** in AdMob after launch for any app-level issue.

## Is a server-side "interface" needed? No.

Google's server-side verification (SSV) for rewarded ads matters when a reward has real value
on a server (a shared economy, purchasable currency). Traffic Bomb's coins and boosters live in
local storage on the device and buy nothing outside the game, so a cheater can only cheat
themselves. The client callback (`AdManager.showRewarded` → `RewardAdPluginEvents.Rewarded`) is
the right design. Revisit SSV only if the game ever adds in-app purchases, cloud saves or
leaderboards with prizes.

Already in place: Google UMP consent before any ad request (`AdManager.init`), an "Ad choices"
link in Settings (shown when UMP requires it), `app-ads.txt` live at https://nadavw9.github.io/app-ads.txt, and the
GDPR message "Traffic Bomb consent" published in AdMob.

Sources: [Payment thresholds](https://support.google.com/admob/answer/2772208),
[Address PIN](https://support.google.com/admob/answer/2772302),
[Steps to getting paid](https://support.google.com/admob/checklist/2998383),
[US tax info](https://support.google.com/admob/answer/2772513),
[Non-US tax info](https://support.google.com/admob/answer/14135099),
[Rewarded SSV](https://support.google.com/admob/answer/9603226).
