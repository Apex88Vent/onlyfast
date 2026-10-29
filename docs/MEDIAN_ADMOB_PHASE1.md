# OnlyFast native AdMob - original production apps

Updated October 28, 2026. No website deployment or ad activation is authorized by this change.

## Website behavior

The ordinary production build supports Median Android and iOS at `https://onlyfast.app/`.
`VITE_MEDIAN_ADMOB_ENABLED` remains the master switch, off when absent or anything other than
`true`. The Vercel production value was left absent. `vercel.json` still disables Git deployment
for main. No test-origin authorization, sample units, alternate app identity, test build mode,
or source-level permanent consent constant remains.

Native commands require authenticated, current-account, fresh server-verified Rookie membership.
Pro, Teams, admin, promotional/ambassador/ad-free grants, unknown membership and logged-out
accounts remain excluded. Membership expires after five minutes and is invalidated on backgrounding.
Banners use home, schedule and saved views. Editing, timing, onboarding, account management,
unsupported routes, overlays and backgrounding suppress banners. Interstitial attempts follow
persisted manual saves only, with the existing account-specific 600-second cooldown. House
promotions and browser/flag-off fallback remain. Nothing is deferred to interrupt later editing.

Before either native display command, the controller awaits `median.admob.request.consent()`;
iOS first awaits `median.admob.request.tracking()`. Tracking denial is not converted into permission
or an automatic ad ban: the native SDK must apply the appropriate privacy restrictions. Consent
responses are retained unmodified in memory and remain labeled `unverified`. Missing/failed native
operations, timeouts, changed identities/bridges and pending forms suppress display commands.
Settings can re-request this same flow while advertising is off, including on iOS. It is not
claimed to reopen saved privacy choices.

## Native privacy limitation

Median's public documentation alternates between `success` and `result` booleans, without defining
Google UMP `canRequestAds`. Neither boolean, ATT authorization, nor a permission-shaped arbitrary
response is treated as a Google authorization signal. Completed native flow permits dispatch of
Median's native display commands; eligibility and restricted/nonpersonalized/limited serving must
be enforced inside the native plugin. No SDK consent override or personalized-ad parameter is set.

Google requires the native host to check UMP `canRequestAds` before loading ads. Google Mobile Ads
initialization alone is not evidence of this check. Median must verify the compiled plugin's UMP
checks and preload order, plus required privacy-options presentation/revocation; the documented JS
bridge cannot inspect or repair them. This remains an activation validation item, not another
permanently false website gate. The website flag controls display commands, not SDK initialization
or background preloading. Automatic native banners must remain disabled.

## Original Median app and real identifiers

Original app: https://median.co/app/dcxfmcnr5b5jv3fh0zcj3cqj5c
Both registered identities are `app.onlyfast`. Preserve their original signing configuration.
Keep the existing production start URL `https://onlyfast.app?nativeApp=true`; its native billing
query parameter is retained. It loads the production root, not a separate website.

| Setting | Android | iOS |
| --- | --- | --- |
| Application ID | ca-app-pub-9431443509195212~9777574822 | ca-app-pub-9431443509195212~1722134918 |
| Banner unit | ca-app-pub-9431443509195212/7957756928 | ca-app-pub-9431443509195212/7067841263 |
| Standard interstitial unit | ca-app-pub-9431443509195212/8022851471 | ca-app-pub-9431443509195212/5469808233 |
| Automatic banner | Disable | Disable |

The real iOS AdMob entry was created for existing App Store ID `6792149373`, not a new Apple app.
Its interstitial has an AdMob-side cap of 1 impression per user per 10 minutes. No rewarded feature
was implemented. iOS AdMob currently reports Requires review / limited serving with an app-ads.txt
verification issue. The live `https://onlyfast.app/app-ads.txt` and `public/app-ads.txt` both contain the publisher line:
`google.com, pub-9431443509195212, DIRECT, f08c47fec0942fa0`.
An immediate AdMob verification retry still reported a mismatch; investigate the App Store developer-site association/crawl before unrestricted live delivery;
do not create a second App Store record or silently publish metadata changes.

## Native builds and device checks

1. Open the original Median app above. Native Plugins > AdMob Native Ads: enable both platform
   modules, use the real IDs above, and set AdMob Banner Ad Enabled to Disable for BOTH platforms.
2. Permissions > App Tracking Transparency: Enable, Consent On Load = Manual, description:
   "With your permission, OnlyFast uses device identifiers to deliver and measure advertising in
   the Rookie plan." Save. Preserve other permissions and signing settings.
3. Build & Deploy: Android APK/AAB > Rebuild, then Download > APK for device installation.
   iOS IPA > Rebuild, then Download. Do not enable automatic App Store Connect uploads or submit
   a release. Preserve bundle/package IDs and the existing Apple team/certificates/profiles.
4. Register each physical Android/iOS device in AdMob Settings > Test devices before testing real
   units. Confirm Test Ad labels; never click unregistered live ads or generate repeated live
   impressions. Include the iOS app in applicable AdMob Privacy & Messaging configurations.
5. After separate approval, deploy this source to the existing production website and enable the
   production master switch. Until that deployment/activation, these native binaries load the
   existing ad-disabled website. Rebuilding a shell does not deploy these website changes.
6. Verify Rookie vs Pro/Teams/admin/promotional/logout, ATT denied/restricted, UMP required/not
   required/error, privacy re-requests, navigation/overlays, editing/scans, resume/account switching,
   manual vs queued/failed/autosaves, cooldown/reload, and native no-fill behavior. Automated tests
   mock the native boundary and do not establish native consent compliance or actual ad delivery.

Native build preparation: Android APK/AAB and a signed iOS IPA were successfully generated in the
original app. Original automatic (API) signing and the Distribution profile are retained. Automatic
App Store Connect upload was changed to Manual; nothing was uploaded or submitted. The signed iOS
`1.0.2` backup (backup 35, October 28 at 9:12 PM local time) was inspected read-only: it preserves
`app.onlyfast`, the production start URL, all three real iOS IDs, automatic banners disabled, ATT
enabled with Manual consent and the approved tracking description. Nothing was restored. Median
nevertheless labeled that IPA OUTDATED after completion; a second, unchanged rebuild also completed
with Download/Upload available but retained the OUTDATED label. This Median status discrepancy
remains unresolved; native device readiness is not fully validated. Do not confuse this label with
absence of a generated IPA.

## Rollback and removed infrastructure

The live Vercel deployment remains `dpl_7ZCgZcjPyAVA2i9kUSoNQkBjHULv`, commit
`5ca8181b74fe85703c1d1f99848d6872646a24ee`, serving onlyfast.app. It was not replaced or deleted.
The disposable standalone Vercel project was verified separate (no Git connection, secrets or
connectors; one separate generated domain) and deleted. Its test build/env/alias modules, script,
specialized deployment test and obsolete build guide were removed. Normal regression coverage is
preserved. Generated old test outputs were moved out of deployment/build paths into ignored
`tmp/retired-admob-output/`; recovery backups and unrelated apps were preserved.

Validation: all 450 automated tests, TypeScript app validation, focused application lint and normal
production build passed. The existing large-bundle warning is unchanged.

Sources: [Median AdMob](https://docs.median.co/docs/admob-native-ads),
[Google Android UMP](https://developers.google.com/admob/android/privacy),
[Google iOS UMP](https://developers.google.com/admob/ios/privacy),
[Android test devices](https://developers.google.com/admob/android/test-ads),
[iOS test devices](https://developers.google.com/admob/ios/test-ads).
