# OnlyFast — Android and iOS Google demo-ad builds

Both test apps load this same start URL:

**https://onlyfast-admob-test-apex88vents-projects.vercel.app/**

This is the separate `onlyfast-admob-test` Vercel project
(`prj_WXGvVgSNRZl7ytIFK8s4do4wpWA1`), not the live OnlyFast project.
No native APK/IPA or TestFlight upload is produced by the web build.

## Median configuration

Use a separate Median **test** app/configuration based on OnlyFast. Keep the live
app's start URL, application IDs, ad units and store releases unchanged. Use a test
display name such as `OnlyFast Ad Test`; a separate package/bundle identifier such
as `app.onlyfast.admobtest` permits installation alongside the live app. The iOS
identifier must be registered and provisioned in your Apple Developer account.

In the test app's AdMob Native Ads plugin, enable the plugin for both platforms
and enter the platform-specific Google demo identifiers below. Do not enter the
OnlyFast publisher's live ad units in these test binaries.

| Median field | Android | iOS |
| --- | --- | --- |
| AdMob Application ID | `ca-app-pub-3940256099942544~3347511713` | `ca-app-pub-3940256099942544~1458002511` |
| Banner Ad Unit ID (fixed-size demo) | `ca-app-pub-3940256099942544/6300978111` | `ca-app-pub-3940256099942544/2934735716` |
| Interstitial Ad Unit ID | `ca-app-pub-3940256099942544/1033173712` | `ca-app-pub-3940256099942544/4411468910` |
| AdMob Banner Ad Enabled / automatic banner | **Disable** | **Disable** |
| Initial/start URL | Test URL above | Test URL above |

Keep all in-app navigation in that test origin, including the landing, schedule,
saved setups, account and privacy pages. Do not configure a native menu item to
send these screens to `onlyfast.app`. The test authorization rejects any other
origin, including the generated immutable deployment hostname.

For iOS, enable **App Tracking Transparency (ATT)** on Median's **Permissions** tab
and set its tracking usage description, for example:
`OnlyFast requests advertising tracking permission during internal ad testing. You can decline and continue using the app.`
Let Median's existing AdMob plugin provide its Google SDK/UMP integration and iOS
Info.plist configuration; do not add another SDK. The iOS application ID belongs
in the plugin's iOS AdMob Application ID field. The underlying iOS configuration
must include the corresponding `GADApplicationIdentifier`, ATT usage description
and Google's SKAdNetwork entries; use Median's generated configuration.

Sources: [Median plugin settings and bridge](https://docs.median.co/docs/admob-native-ads),
[Android sample app ID](https://developers.google.com/admob/android/quick-start),
[Android demo units](https://developers.google.com/admob/android/test-ads),
[iOS sample app ID](https://developers.google.com/admob/ios/quick-start),
[iOS demo units](https://developers.google.com/admob/ios/test-ads).

## Generate native test binaries

### Android APK

1. Save the separate test configuration above. Keep the existing OnlyFast web,
   authentication and navigation settings except for the test origin/identity.
2. In Median **Build & Deploy**, generate a fresh Android **APK** containing the
   AdMob plugin and Google demo IDs. Do not upload an AAB or APK to Google Play.
3. Download and install that APK on the Android test device. An already installed
   binary with live ad IDs is not suitable merely because its URL can be changed.
4. Open the test URL through this native wrapper, sign in with an existing Rookie
   test account, and complete the normal onboarding if needed.

### iOS device build / internal TestFlight

1. Save the iOS plugin IDs, ATT setting, test URL and registered test bundle ID.
2. Configure the normal Apple signing certificate/provisioning for that bundle in
   Median. For direct installation use an appropriate development/ad-hoc profile
   that includes the test device. A simulator build cannot establish real-device
   ad delivery or ATT behavior.
3. Generate the iOS build in **Build & Deploy**. For TestFlight, use the matching
   App Store Connect app record and a higher build number, then use Median's
   documented App Store Connect upload workflow when you choose to do so. Restrict
   distribution to internal testers; do not submit for App Store release/review.
4. Install on a physical iPhone/iPad, sign in as an eligible Rookie and run the
   checks below. No signing/upload/store action is performed by this repository.

Median's current build entitlement and normal platform signing remain required.
There is no new native source bridge or custom native compilation step.
See [Median build/update workflow](https://docs.median.co/docs/app-updates).

## What this test build authorizes

`npm run build:admob-test` selects a separate build module and loads
`.env.admob-test`, which enables the website's native display toggle. Only the
exact HTTPS test origin above receives the test-only permission override and
iOS display support. It does not grant account access or change membership.

Ordinary `npm run build` selects the production module instead. It cannot use the
test override, even on the test hostname, and retains
`NATIVE_ADS_CONSENT_VERIFIED=false`. Production iOS advertising remains disabled.
The live production environment flag and deployment are not changed.

The controller still calls `median.admob.request.consent()` and, on supported
iOS test wrappers, `median.admob.request.tracking()` before that consent request.
ATT and UMP are separate. ATT denial/restriction is not an ad-display failure;
the native SDK controls identifier availability. Actual responses are retained in
memory without interpreting a consent boolean as ad permission. An unavailable
or unverifiable permission response is not an additional demo-ad release hold.
This is explicit authorization to test Google's demo ads, not evidence of consent
compliance or a claim that re-requesting consent reopens saved privacy options.

The web bridge does not set or verify the binary's ad-unit IDs. Correctly entering
the Google demo IDs in the separate Median test build is mandatory. Only use this
URL with that test binary; do not navigate a live-unit binary to this test site.

## Device acceptance

- Use a currently verified **Rookie** account with no paid, admin, ambassador or
  promotional grant. Pro/Teams/admin/promotional and logged-out sessions get no
  native display calls. Stale or unresolved membership fails closed.
- Banners appear on Rookie landing, schedule and saved setups. They hide during
  editing, timing scans, onboarding, account management, modal dialogs and backgrounding.
- After a successful manual setup save, an available interstitial may show once.
  Queued/offline/failed/autosaves and active editing do not qualify. There is at
  least **600 seconds** between attempts, including no-fill attempts.
- Confirm Google's **Test Ad / Test mode** label. A native banner can take time to
  fill, and Median only shows an interstitial when one has preloaded. No web code
  can guarantee network inventory. iOS may reserve blank banner space on no-fill.
- On iOS test ATT allow and deny paths; both should permit demo-ad testing without
  claiming personalized-ad permission. Re-request privacy through existing Settings.
- Switch to Pro/Teams/admin/promo and log out: no banner or interstitial should
  appear. Return to the test Rookie only after fresh membership verification.

## Reproduce the isolated web deployment

From the primary checkout on main:

1. Run `npm run build:admob-test`.
2. Run `node scripts/prepare-admob-test-deployment.mjs`. It copies only compiled
   test assets into `.vercel/output`, creates SPA routing and refuses to overwrite
   existing output. If old generated output exists, preserve/move it aside first.
3. Deploy that prebuilt output **only** to `prj_WXGvVgSNRZl7ytIFK8s4do4wpWA1`.
   The stable test project's alias must be the exact test origin above. Do not
   deploy it to `prj_yPHsgwfcKm4LfEmpzkop9XwHVRmR` or alias it to `onlyfast.app`.
4. Leave automatic main deployments disabled in `vercel.json`. Do not promote
   this test bundle to the live OnlyFast project or publish the test native apps.
