# Median AdMob activation and device testing — November 10, 2026

Local changes only. No deployment, native build, environment edit, AdMob ID creation,
store submission or app-ads.txt change was performed.

## Cause and behavior

The stock singleton had `houseOnly: true`. Its alternative native path also required
a `nativeAdPermission` dependency that was never supplied; that same missing dependency
prevented region preparation and automatic consent. Thus the documented commands were
present but unreachable. Those unconditional blockers are removed. The release still
requires the existing master flag, mode/account/device policy, trusted Rookie membership,
US region response, foreground/safe dashboard, and completed native privacy flow.

The stock bridge uses exactly `median.admob.banner.enable()`,
`median.admob.banner.disable()` and `median.admob.showInterstitialIfReady()`.
Native UMP runs before display commands; iOS ATT runs before UMP. No response boolean
becomes permission to personalize or proof of UMP `canRequestAds`. A real native permission
reader, if explicitly supplied, still fails closed. Otherwise Median's native SDK owns
consent enforcement, restricted serving and background preloading. This website cannot
audit or override the installed SDK's load gating or reopen saved privacy options through
an undocumented API.

House bottom banners remain in browsers and when native commands are unavailable/blocked.
When the controller selects its native banner lane, the bottom house banner and inline
house tile are suppressed. This is lane selection, not proof of Google display. No-fill
cannot be inferred; there is no timer that replaces an allegedly displayed native ad.
A thrown disable command retains the native lane until a subsequent disable succeeds.
Native interstitial dispatch does not stack a house interstitial on possible no-fill/error.
The existing manual-save and successful Assist-result dismissal opportunities and one
persisted 600-second attempt cooldown remain. No rewarded events or usage grants exist.

## Official Google test configuration

Use the existing real native units ONLY on a phone registered under AdMob Settings →
Test devices. This is an official Google testing configuration, not live testing.
The app-side test allowlist is an additional restriction; it does not register devices
with Google or convert live ads into test ads. Verify the device's current advertising
ID still matches its Google registration before making requests. Stop if a Google ad
does not have the Test Ad/Test mode label. Do not repeatedly invoke real units on an
unregistered phone. Mediation networks require their own test configuration.

The existing Android test UUID/device hashes and owner-confirmed signed-session fallback
are retained. A new login session, reset advertising ID, missing deviceInfo, or unknown
phone stays blocked. The fallback is session authorization, not hardware attestation.
The repository has no registered iOS test-device hash. Do not enable unknown iPhones.
Google's sample unit IDs cannot be selected using these parameterless JS commands; using
sample native units would require changing/building the host. No host IDs were changed.

## Independent development tests

1. Confirm Google's test-device registration first. In a development environment only,
   set `VITE_MEDIAN_ADMOB_ENABLED=true` and `VITE_MEDIAN_ADMOB_MODE=test` in the process
   running Vite. Start `npm run dev -- --host 0.0.0.0` (port 8080). Do not set broad live mode.
2. The same Median app must load this development web content **inside its WebView**.
   A normal Chrome browser cannot exercise the native plugin. With a USB-debuggable
   installed package, use Chrome `chrome://inspect/#devices` to inspect its WebView.
   An available local route is `adb reverse tcp:8080 tcp:8080`, then navigate that
   WebView's console to `location.assign('http://127.0.0.1:8080/?nativeApp=true')`.
   This requires the package to permit that development origin, library injection and
   cleartext localhost. If it does not, use an already permitted HTTPS development
   origin; do not weaken the production package's rules. No development host or
   debug-enabled installed binary has been verified here.
3. Log in as the existing authorized Rookie tester. Remain on a safe dashboard screen,
   complete native privacy prompts and wait for device authorization. A changed login
   may not match the previously authorized phone session. Do not bypass a mismatch.
   The localhost origin has separate Auth storage: when Median omits GAID, logging
   in there normally creates a different session and the old production-session
   fallback cannot authorize it. That specific case needs explicit confirmation
   and reauthorization of the physical registered phone's new signed session
   through the existing mechanism before independent DEV requests can be tested.
4. In the development WebView console, use `onlyfastAdmobTest.status()` to inspect gates.
   `onlyfastAdmobTest.consent()` re-requests the existing flow if needed.
   `onlyfastAdmobTest.hideBanner()` hides; `onlyfastAdmobTest.banner()` requests the
   banner; `onlyfastAdmobTest.automatic()` restores ordinary banner control. Repeating
   enable while already selected does not dispatch another enable.
5. With shared cooldown zero and no keyboard/modal/scan, call
   `onlyfastAdmobTest.interstitial()`. It uses the same native method and 600-second
   cooldown as manual saves/Assist, and still requires all native privacy, device,
   membership and lifecycle conditions. No successful save or AI usage is required.
   Read the returned request/suppression diagnostics; physically confirm the Test Ad.
6. Check manual save and Assist dismissal after the shared cooldown expires. Failed,
   queued or automatic saves and AI generation/errors must not request interstitials.
   Verify Pro/Team/admin/promotional/unknown/logout never enable ads. Restore the normal
   app URL after development testing. The console helper is absent from production builds.

## Release and installed-binary prerequisites

No production deployment/configuration was changed. The master flag and existing mode
rules still apply: default/test admits the one tester + registered device; production
mode additionally requires a Vercel production build at exactly https://onlyfast.app.
Production retains its US region endpoint and all trusted membership/privacy checks.
Development skips the release geography policy without claiming a US location, and
always retains registered-test-device authorization. The web flag controls display
commands, not the native SDK's startup preloading.

Repository JS method presence and saved Median settings cannot prove the installed
Android binary contains a functioning plugin. Check the real app's bridge and physically
observe both a bottom Test Ad and a full-screen Test Ad. Prior Android observations do
not validate the currently installed version. A new native build is needed only if that
installed binary lacks the module/IDs or the debugging capability required for DEV testing.
These web changes themselves do not require a rebuild of a correctly configured shell.
The iOS Marketing URL/app-ads.txt verification and Google app-readiness review remain
external prerequisites; iPhone test-device authorization and actual display are unverified.

Sources: [Median documentation, last modified November 7, 2026](https://docs.median.co/docs/admob-native-ads),
[Google Android test ads](https://developers.google.com/admob/android/test-ads),
[Google iOS test ads](https://developers.google.com/admob/ios/test-ads),
[Median Android debugging](https://docs.median.co/me/docs/android-debugging).
