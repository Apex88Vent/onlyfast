# OnlyFast native AdMob - original production apps

Updated October 29, 2026. Local layout/banner fixes and a separately gated live mode are prepared.
This task does not authorize deployment, pushing, native builds, or changing production variables.
The existing deployment remains the restricted Rookie-account/registered-device test rollout.

## Limited Rookie test rollout

- `rookie@test.com` resolves in production Auth to `58a1db2f-8d4d-412e-afe5-abadf57f6ae1`.
  Read-only database verification found no subscription row, admin/promo grant, or experimental
  full-access override. Runtime eligibility still requires the existing fresh server-owned
  membership evidence; no email, editable metadata, or default Rookie fallback authorizes ads.
- AdMob has one Android test device named `phone`, advertising ID ending `7442`; the owner
  confirmed it is the test phone. Only its SHA-256 comparison digest is present in the bundle.
  No iOS test device is registered, so iOS display commands remain blocked.
- After the existing ATT/UMP flow, documented `median.deviceInfo()` must report `app.onlyfast`,
  the matching platform, and either a matching nonzero advertising ID or the separately
  authorized Android phone-session fallback described below. Mismatched/zeroed IDs,
  errors, timeouts and host changes deny display. Backgrounding or
  account switching clears device evidence, so changed advertising IDs are rechecked on resume.
- IMPORTANT: Median documents that `gaid`/`idfa` may be omitted without a supported attribution
  plugin (AdMob alone is not listed as sufficient). This rollout does not add such a plugin or
  guess an ID. An omitted Android GAID can use only the owner-confirmed, remotely verified
  phone session; unknown sessions remain blocked. A missing deviceInfo method
  is reported as `device-info-unavailable`. Installation IDs are never substituted for AdMob IDs.
- In the default `test` mode, `VITE_MEDIAN_ADMOB_ENABLED=true` enables only the resolved rollout UUID; other accounts retain
  the existing house post-save fallback. `VITE_MEDIAN_ADMOB_DIAGNOSTICS=true` temporarily logs
  `[OnlyFast AdMob]` snapshots only for that UUID. Read console fields `eligible`, `enabled`,
  `bridgeAvailable`, `device`, `deviceAllowed`, `consentRequestCompleted`,
  `bannerCommandDispatched`, and `interstitialCommandDispatched`. `adDisplayed` stays `unknown`:
  a returned JavaScript command is not evidence of an impression or personalized-ad permission.
- On the confirmed registered Android phone: fully close/reopen OnlyFast, log in with the
  Rookie test account, finish onboarding if needed, close overlays, and remain on the landing
  page while native privacy choices and device checks complete. Confirm the Google Test Ad
  label. Do not repeatedly save/click ads to diagnose missing fill. If no ad appears, inspect
  the scoped console snapshot; do not broaden the account/device gate to force an impression.


## Website behavior

The ordinary production build supports Median Android and iOS at `https://onlyfast.app/`.
`VITE_MEDIAN_ADMOB_ENABLED` remains the master switch, off when absent or anything other than
`true`. Missing `VITE_MEDIAN_ADMOB_MODE` defaults to the existing restricted `test` mode.
`vercel.json` still disables Git deployment for main. No sample units, alternate app identity,
client URL/storage override or source-level permanent consent constant is introduced.

| Configuration | Result |
| --- | --- |
| Master switch absent/false | Native display commands off; existing house promotions remain. |
| Master true; mode absent, empty or `test` | Existing test UUID + registered-device gate, on either platform. |
| Master true; mode `production`; Vite production build; build-time `VERCEL_ENV=production`; origin exactly `https://onlyfast.app` | Fresh trusted Rookie users may request native ads without the test-device/session gate. |
| Requested production mode on local/dev/preview/another origin, or unknown mode | Native display commands off. |

Vite embeds only the non-secret deployment environment enum as `ONLYFAST_ADS_DEPLOYMENT`.
`import.meta.env.PROD` alone cannot authorize live ads because preview builds also set it.
The native IDs remain the real platform-specific Median IDs below in both modes. Test mode does
not magically convert traffic to test traffic: the phone must remain registered in Google AdMob;
the website only admits its existing verified ID/session. The Android fallback is not hardware
attestation. Revalidate registration if the advertising ID or authorized login changes. No iOS
test device is registered yet. Production mode adds no SDK test flag or sample IDs; Google may
still return test ads to a phone registered as a test device, as intended.

Native commands require authenticated, current-account, fresh server-verified Rookie membership.
Pro, Teams, admin, promotional/ambassador/ad-free grants, unknown membership and logged-out
accounts remain excluded. Membership expires after five minutes and is invalidated on backgrounding.
Banners use the authenticated dashboard's home, setup/session, saved, comparison, base-setup,
To Do/notes, parts and schedule views. The native banner remains below the WebView; no HTML
AdMob tile or duplicate per-page banner is created. The shared layout marker, dialog/viewport
observer and keyboard checks hide banners during onboarding, authentication, purchases/account
flows, visible dialogs, open keyboards, active timing scans/save and cramped viewports.
Setup Assist generation retains its existing suspension. Safe-area spacing preserves save bars.
The documented `median.keyboard.listen()` and `median.keyboard.info()` supply actual keyboard
visibility; tapping Done restores banners even when an input retains focus. Older packages use
viewport geometry as fallback. Hidden/non-interacting dialogs no longer suppress banners, and
inline timing review no longer carries a blanket scan suppression marker. Navigation and layout
mutations refresh the same shared controller; no second banner is created. Ordinary browsers
without the Median bridge cannot display native banners. In test mode unregistered iOS devices
remain blocked. Interstitial attempts follow
persisted manual saves or explicit dismissal of successful Setup Assist/What If results,
with ONE existing account-specific 600-second cooldown shared by both triggers. House
promotions and browser/flag-off fallback remain. Nothing is deferred to interrupt later editing.

Manual-save dispatch now runs in a layout effect after React removes the save dialog. The
previous handler invoked the bridge immediately after setting the close state, while the dialog
could still be mounted; its mutable open-state check could also race a synchronous render.
Failed, queued/no-write saves, autosaves, cancelled/stale contexts and intervening activity never
produce native requests. Setup Assist displays its answer normally; only **Dismiss result** on
a successful response creates an opportunity after the result has been removed. Generation,
errors, usage-limit notices and stale account/weekend/session responses cannot authorize ads.
No rewarded behavior or changes to Rookie usage accounting are included.

The existing rollout-only Settings status reports the last interstitial trigger, whether that
request was dispatched, its suppression reason, and a live shared cooldown countdown. The
cooldown retains the existing localStorage key and counts attempts, including possible no-fill.
There is no retry when it expires. `showInterstitialIfReady()` is still the only interstitial
bridge command. Median preloads ads natively and documents that no ad appears when none is ready;
website dispatch diagnostics cannot confirm native display or readiness.

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
3. Compare the installed package/build against the saved native settings before deciding to
   rebuild. These web layout/mode/keyboard changes alone do not require a native rebuild when
   the installed plugin/configuration is correct. Rebuild the same original app only if its
   installed binary lacks required IDs/plugin/ATT/SDK configuration. Preserve identities/signing;
   do not upload or submit a release as part of this task.
4. Register each physical Android/iOS device in AdMob Settings > Test devices before testing real
   units. Confirm Test Ad labels; never click unregistered live ads or generate repeated live
   impressions. Include the iOS app in applicable AdMob Privacy & Messaging configurations.
5. After separate approval, deploy this source with the existing test-mode configuration first.
   Confirm test labels on registered phones. For broad live activation, first resolve each app's
   AdMob readiness/app-ads.txt/Privacy & messaging and store disclosures, and confirm native UMP
   load gating/privacy-options behavior below. Then set the production-scoped mode to
   `VITE_MEDIAN_ADMOB_MODE=production` (master true) and create an authorized production deployment
   with Vercel production build provenance. Do not set that mode for preview/development. Merely
   editing variables does not alter a previously built bundle. None of these external changes
   were made in this local-only task. Rebuilding a shell does not deploy website changes.
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

The installed iPhone package is not accessible here, so its embedded configuration and SDK
cannot be established from the builder's current settings or backup alone. iOS conclusion is
**C: additional configuration/verification** (test-device registration, AdMob review/app-ads.txt,
native privacy checks and real iPhone validation). **B** is necessary only if comparison proves
the installed package lacks the saved required native configuration or a required SDK capability.
**A** applies to these web changes when installed native prerequisites are already present.
Android's banner and manual-save Test Ad are owner-confirmed; unrestricted live serving is not.
Verify Android app readiness/Policy centre too; test serving does not prove live approval.
Confirm App Store privacy labels include the actual advertising/identifier practices, the ATT
purpose is accurate, and refusal of tracking does not block app functionality. No store metadata
or native settings were changed. Settings' consent re-request remains unverified as an actual
saved privacy-options entry point; Median must confirm this where Google requires one.

## Rollback and removed infrastructure

### Restricted Android phone-session fallback and visible status

The device gate originally required a matching GAID, but [Median device info](https://docs.median.co/docs/device-info)
only supplies GAID with supported attribution plugins; AdMob alone is insufficient. The owner
confirmed the Samsung SM-S938U's current production login belongs to the already registered AdMob
test phone. When Android deviceInfo identifies `app.onlyfast` and **omits** GAID, the controller
can authorize only that login's hashed session ID after remote Auth validation of its original
access token and a current-session continuity check. It does not infer GAID, Google test mode,
or personalized-ad permission. Different/zeroed/malformed IDs, unknown sessions and unregistered
iOS devices remain blocked. Auth events/backgrounding discard device evidence; signing out and
back in creates a different session requiring explicit reauthorization. No native build is needed.

Only the rollout Auth UUID sees the temporary live **AdMob test status** section in Settings.
It reports flag, trusted Rookie eligibility, bridge, device authorization source, native consent
completion and banner command dispatch without identifiers or raw consent payloads. Settings
itself suspends banners; close it to test the landing page. A dispatch is not an impression.
The owner subsequently confirmed a visible Google **Test Ad** and a manual-save interstitial
on this Android phone. House upgrades are now restored independently of native banner state:
one inline, scrolling promotion per eligible Rookie dashboard page. `RookieHouseAdPage` is the
single owner; `houseAdMidpoint` measures actual rendered section/record boundaries, including
overflowing lists, and chooses the boundary nearest half the content height. Resize, loaded
images, list filtering/growth and navigation remeasure it; the inserted ad's own height is excluded.
Home uses complete action/weekend/stat/event sections; schedule and To Do use whole records;
saved/base setup lists use complete templates; parts and comparison results use complete table
rows; forms use complete related sections. Empty/short views use the nearest available boundary,
or the end when there is no section. Comparison print output excludes the ad host. Nested page
components add no tiles. The setup/session page shares its single promotion
across its timing, Setup Assist and notes sections; embedded To Do panels add none. The original
design and `/upgrade` navigation are reused, including on iOS, without changing Coming Soon
purchase behavior. Native banners are never inserted inside HTML tiles. Median supplies no
documented display/no-fill callback, and Setup Assist native display remains unconfirmed.

At this inspection, onlyfast.app still pointed to deployment `dpl_7ciuL157WXDmuUUJuPAVZ9Qh8feA`,
commit `fec41a9cf26befed779a360ccd1cb7f7552cdff3`, predating the newer `bb0053db` main changes.
Thus old placements and the older home/schedule/saved-only native banner coverage were still
expected on installed apps loading production. Keep previous deployments available for rollback.
No alias replacement is authorized by this task.
The disposable standalone Vercel project was verified separate (no Git connection, secrets or
connectors; one separate generated domain) and deleted. Its test build/env/alias modules, script,
specialized deployment test and obsolete build guide were removed. Normal regression coverage is
preserved. Generated old test outputs were moved out of deployment/build paths into ignored
`tmp/retired-admob-output/`; recovery backups and unrelated apps were preserved.

Validation results for the local changes are reported with the completion report. Native display
and consent compliance still require physical devices; Setup Assist display remains unconfirmed.

Sources: [Median AdMob](https://docs.median.co/docs/admob-native-ads),
[Median keyboard state](https://docs.median.co/docs/keyboard-state-tracking),
[AdMob app readiness](https://support.google.com/admob/answer/10564477),
[AdMob app-ads.txt verification](https://support.google.com/admob/answer/14538460),
[Google Android UMP](https://developers.google.com/admob/android/privacy),
[Google iOS UMP](https://developers.google.com/admob/ios/privacy),
[Android test devices](https://developers.google.com/admob/android/test-ads),
[iOS test devices](https://developers.google.com/admob/ios/test-ads).
