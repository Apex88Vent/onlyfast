# Median AdMob Phase 1 — Android release hold

Native ad display is **disabled by default and held disabled even when the feature flag is true**.
No production AdMob IDs are embedded in the website. Unit IDs remain native Median configuration.
No rewarded ads, iOS ads, deployment or Median configuration changes are included.

Focused consent follow-up: the documented Promise form of `median.admob.request.consent()` is now
called before advertising opportunities at eligible Android screens, only with the master flag on.
Requests are coalesced, bounded, and scoped to the current account/bridge; actual responses are retained
in memory for device verification. Settings provides a native consent re-request action using that
same documented method. Neither `success:true` nor `result:true` releases ads or implies personalization.
This is not a verified UMP privacy-options/revocation implementation. The authorization hold remains:
the public contract still does not define ad-request permission or how to reopen saved privacy options.

## File inventory

Created: `src/lib/nativeAds.ts`, `tests/nativeAds.test.ts`, `docs/MEDIAN_ADMOB_PHASE1.md`.

Modified:
- `src/lib/ads.ts`, `src/lib/trustedMembership.ts`, `src/lib/subscription.ts` — ad-only verification/freshness.
- `src/contexts/AppContext.tsx`, `src/components/AppLayout.tsx`, `src/components/SettingsModal.tsx` — lifecycle, screen/modal restrictions and privacy disclosure access.
- `src/components/SetupDashboard.tsx` — placement registration and confirmed manual-save hook.
- `src/components/RookieAdSlot.tsx` — immediate membership-change subscription for existing house content.
- `src/components/CookieConsent.tsx`, `src/pages/PrivacyPolicy.tsx`, `src/components/LegalModal.tsx` — consistent advertising disclosures in both privacy surfaces.
- `src/vite-env.d.ts` — optional default-off flag typing.
- `tests/iosSubscriptionUI.test.ts` — isolate the new layout effect in the existing static-render test harness.

`src/lib/membership.ts`, `src/components/RookieHouseAdContent.tsx`, racing calculations, setup fields,
subscription permissions/prices, onboarding, payment flows and Median settings are unchanged.

## Implemented behavior

- Advertising requires an authenticated account with verified, matching-user membership evidence.
  The ad-only evidence expires after five minutes and is invalidated during refresh and on backgrounding.
  Existing subscription entitlements and default membership behavior are unchanged.
- Server-authorized `promo_access_level` grants are conservatively excluded, including `ambassador`
  and ad-free promotions. User-editable metadata never establishes eligibility. Any other exemption
  representation must be verified and added to the ad-only gate before activation.
- One native controller owns the bottom banner on the main landing (`home`), race schedule (`schedule`)
  and saved setup (`saved`) views, on `/` only. Editing, timing, unsupported routes, settings, login,
  legal/class modals, onboarding/unmount and backgrounding hide the banner. Existing inline house
  promotions remain in web content; no duplicate native banner containers are inserted.
- Manual save completion supplies a short-lived opportunity while the save dialog still owns the
  interaction, before editing resumes. Only an actual database write with no queued operations can
  request an interstitial. Autosaves, failed/empty/queued saves never request one. Intervening input,
  navigation, logout/account switching and backgrounding cancel the opportunity; nothing is deferred.
- Requests consume a persisted account-specific 600-second cooldown before bridge dispatch. Unknown
  storage, clock rollback or storage failures suppress the request. Attempts count even on no-fill or
  bridge failure, since the bridge does not report display success.
- Ordinary browsers, disabled-flag sessions and unsupported bridges retain the house post-save modal.
  Supported Android sessions blocked by consent/cooldown suppress the modal to avoid stacking ads.

## Feature flag and local validation

The only recognized enabling value is `VITE_MEDIAN_ADMOB_ENABLED=true`; absent or any other value is off.
For a local test bundle, set the variable in an ignored `.env.local`, restart Vite or rebuild, then remove
the value when finished. It is a build-time Vite setting. Do not set it on production Vercel yet.
The flag alone **does not display ads**: `NATIVE_ADS_CONSENT_VERIFIED` remains false with no runtime,
query-string, storage or cookie-consent bypass. Automated tests inject a fake consent capability only
into isolated controller instances; no Google SDK or production ad requests are involved.

Run `npm test`, `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` and `npm run build`.
Tests execute the actual eligibility modules, controller and extracted dashboard save routines with
isolated network/browser boundaries. Native SDK/device behavior has not been validated by these tests.

## Verified API and consent blockers

Verified commands: `median.admob.banner.enable()`, `median.admob.banner.disable()`,
`median.admob.showInterstitialIfReady()`. The injected bridge is checked immediately and through the
documented `median_library_ready` callback, preserving any previous handler. Methods are checked before
use. No delayed-navigation interstitial, guessed readiness, load, reward or completion method is used.

- [Median AdMob documentation](https://docs.median.co/docs/admob-native-ads)
- [Bridge readiness documentation](https://docs.median.co/docs/javascript-bridge)
- [Official AdMob bridge source](https://github.com/gonativeio/median-javascript-bridge/blob/main/src/plugins/admob.ts)
- [Google UMP requirements](https://developers.google.com/admob/android/privacy)

Median documents `median.admob.request.consent()` but describes its response inconsistently as `success`
and `result`. The public npm AdMob module has no consent method. Neither source establishes a reliable
JavaScript can-request-ads signal, privacy-options access, or whether automatic native preloading waits
for updated UMP consent. `median.admob.request.tracking()` is documented for iOS ATT and is not Android
advertising consent. Only `request.consent()` is invoked; ATT remains unused and iOS remains disabled.

The website cannot guarantee that an AdMob SDK already compiled into the Median binary makes no
requests: the feature flag controls website-issued display commands, not SDK initialization/preloading.
Automatic banners must remain OFF. Review the installed binary's behavior independently with Median.
The Settings Privacy Policy link is disclosure access, **not** a substitute for UMP privacy options.
The new consent re-request action likewise cannot be claimed to reopen previously saved choices until
Median verifies that behavior. A United States launch does not bypass applicable state privacy options.

## Before any device or live delivery

1. Obtain build-specific confirmation from Median of UMP initialization/preload order, the actual
   consent result contract, can-request-ads gating, consent refresh/revocation and privacy-options
   presentation. Add only verified coordination, with tests, before lifting the source-level hold.
2. Create an isolated Android test build configured in Median with Google test units (fixed banner
   `ca-app-pub-3940256099942544/6300978111`, interstitial
   `ca-app-pub-3940256099942544/1033173712`), using the appropriate banner format for that build.
   See [Google test ads](https://developers.google.com/admob/android/test-ads). Do not use or click live
   units for QA. No test build/configuration was created as part of this implementation.
3. Rebuild/install Android if the plugin or saved settings were added after the installed binary.
   Website-only changes do not require another native build once its capabilities are present.
   See [Median app updates](https://docs.median.co/docs/app-updates).
4. Configure AdMob Privacy & Messaging for applicable regions, including EEA/UK/Switzerland and
   applicable US-state requirements; validate withdrawal and required privacy-options access.
   Validate test geography with Median-supported native diagnostics, never a fabricated JS callback.
5. Test physical-device Rookie/Pro/Teams/admin/authorized ambassador/promo accounts; slow and failed
   membership loads; account switching; banner navigation, overlays, keyboard, rotation and resume;
   failed/offline/autosaves, rapid saves, cooldown/reload and no-fill. Confirm Test Ad labels.
6. Check authorized exemption representations, store advertising/privacy declarations and developer
   domain `app-ads.txt` crawlability. Set an AdMob-side one-impression-per-ten-minutes interstitial cap
   as a backstop to the website's attempt cap. Do not enable automatic banners.
7. Only after review and approval, replace test units with the supplied Android configuration and
   enable the flag in the intended release. Keep the rewarded unit unused and iOS disabled.

Production Android configuration supplied by the owner (not changed here): application
`ca-app-pub-9431443509195212~9777574822`, banner `ca-app-pub-9431443509195212/7957756928`,
interstitial `ca-app-pub-9431443509195212/8022851471`.
