# Controlled Android AdMob production test — November 10, 2026

Current account/billing findings: see [the subscription audit](ADMOB_TEST_ACCOUNT_SUBSCRIPTION_AUDIT.md).
The Stripe mirror conflict is now resolved; see [the reconciliation report](ADMOB_TESTER_RECONCILIATION.md).
Device authorization and the production master flag still gate native requests.

This configuration tests the existing installed Median Android app at the existing
https://onlyfast.app website. No alternate website, app, SDK, ad unit or native build
was created. Deployment and production variables have not been changed.

## Verified configuration and authorization

The existing Vercel project is `onlyfast` (`prj_yPHsgwfcKm4LfEmpzkop9XwHVRmR`), owned
by `team_smopqnOs6cFIL3nxEZ7O9O7Z`, with `onlyfast.app` among its configured domains.
Read-only production-variable inspection found:

| Variable | Current value | Controlled test activation value |
| --- | --- | --- |
| `VITE_MEDIAN_ADMOB_ENABLED` | `false` | `true` |
| `VITE_MEDIAN_ADMOB_MODE` | absent | `android-test` |
| `VITE_MEDIAN_ADMOB_DIAGNOSTICS` | `false` | keep `false`; existing tester-only Settings status remains available |

`android-test` resolves only in a Vite production build with Vercel production build
provenance and the exact origin `https://onlyfast.app`. Preview, localhost and other
origins fail closed. Do not use `production` for this controlled rollout: that existing
future release mode has broader eligibility. Development-only console commands remain
excluded from production builds, including the controlled test build.

Only `test@test.com`'s existing resolved Auth UUID
`4b9864ff-2195-4be0-83a4-39308446577e` may pass account selection, and only on Median
Android. An email comparison or editable metadata cannot authorize advertising. The
current authenticated identity must also have fresh trusted server-owned Rookie
membership. Pro/Team/admin/promotional/ambassador/ad-free grants, unknown membership
and logout remain excluded. Membership freshness, foreground, supported placement,
keyboard/modal/scan exclusions, US release geography and native privacy flow are unchanged.
Native eligibility also checks the underlying trusted membership without a test-tier
override: selecting Rookie in a separate test subscription selector cannot authorize
native ads for an actually paid/admin/promotional account. The existing selector and
subscription entitlement behavior were not changed by this advertising check.

The existing platform-specific Google test-device hashes remain mandatory. The former
account's signed-session authorization was removed; a new session is not automatically
authorized. This mode does not take the broad
production mode's test-device exemption. Missing/zeroed/mismatched IDs, wrong package,
unknown sessions and unregistered phones cannot dispatch ads. iOS cannot activate in
this Android test mode. No device/session allowlists were expanded.

The existing tester-only Settings status is read-only and shows the mode, membership,
native bridge, device authorization, native flow completion, dispatch and cooldown.
Ordinary users cannot see this status or access DEV console commands.

## Preserved advertising behavior

All other Rookie users and ordinary browsers retain their current house advertisements.
The approved tester receives the native banner lane only when its guards pass; this
suppresses the competing house banner/tile. Native dispatch is not an impression or
proof of personalization permission. There is no invented load/display callback or
timer-based no-fill inference. A native interstitial attempt does not stack a house
modal, including when the bridge throws or no interstitial is ready. A failed banner
disable retains the native lane until the disable can be retried successfully.

Manual persisted saves and explicit successful Setup Assist result dismissal retain
ONE shared account-specific 600-second attempt cooldown. Failed/queued/autosaves and
AI generation/errors do not request interstitials. No rewarded ads, extra usage or
subscription changes were added. Ordinary Rookie manual-save house fallback remains.

## Activation and phone acceptance

1. In Google AdMob, verify that the physical Samsung SM-S938U's **current** advertising
   ID remains registered as the existing test device named `phone` (previously confirmed
   by the owner, ID ending `7442`). Do not make repeated requests with the real configured
   units before this is confirmed. App-side authorization is not Google registration.
   Registration could not be re-read in this pass because browser inspection timed out.
2. Review/commit the existing integration fixes together with these controlled-mode
   changes. Set only the activation values in the table above for Vercel **production**.
   Do not push or deploy during the pending billing investigation. After registration/configuration approval,
   manually build/deploy this exact reviewed source to the existing project, retaining
   the previous production deployment as rollback. No deployment occurred in this task.
   Vite variables are embedded at build time; changing them alone does not activate an
   already-built deployment. Confirm the deployment serves `onlyfast.app` and the region
   endpoint reports US before device acceptance.
3. Open the existing Android app as `test@test.com`. If Median omits GAID, this new
   account/login needs separate confirmed phone-session authorization. The former
   rookie@test.com session cannot authorize it. Do not substitute an installation ID
   or bypass a failed device or underlying paid-membership check.
4. Remain on Home and complete any native privacy prompt. Open Settings → AdMob test
   status: expect `android-test`, eligible Yes, bridge Yes, device `matched` or
   `registered-phone-session`, and native consent completed (permission unverified).
   Close Settings: it intentionally suppresses ads while open. Physically observe a
   separate bottom banner labeled **Test Ad**. A request-sent value alone is insufficient.
5. When shared cooldown is zero, manually save one setup successfully while online.
   After the save dialog closes, physically confirm a full-screen **Test Ad**. A missing
   ad may be native no-fill; do not assume success or repeatedly invoke the real units.
   The next save/Assist dismissal inside 600 seconds must not dispatch another native ad.
6. After 600 seconds, dismiss a successful Assist result at its natural pause and confirm
   the same behavior. Display of the Assist interstitial is still unverified. Also verify
   another Rookie gets house ads and Pro/Team/admin/promotional accounts get none.

No device was attached in `adb devices -l` during this task. Repository bridge methods,
saved builder settings and mocked tests cannot prove the currently installed APK's plugin
or native UMP enforcement. Physical Test Ad display on this exact installed version remains
pending. Prior Android display observations are historical evidence only.

A correctly configured existing binary can load these web changes without rebuilding.
A native rebuild is necessary only if the installed app lacks the AdMob module/IDs or an
identified native SDK fix; it is not needed just for this account/configuration gate.
No change to native start URL, signing, production units, iOS, or app-ads.txt is required.

## Disable or roll back

Set production `VITE_MEDIAN_ADMOB_ENABLED=false` (or mode `off`) and manually redeploy,
or restore the preserved previous production deployment. House advertising remains for
eligible Rookie users; paid users remain ad-free. These are build-time flags, not an
instant remote kill switch. Native SDK startup preloading is separately governed by
Median; the web switch controls display commands. Never switch to `production` to
work around failed device authorization in this controlled test.

## Local files changed

This controlled-rollout step changes `src/lib/nativeAdsMode.ts`, `src/lib/nativeAds.ts`,
`src/lib/trustedMembership.ts` (advertising reader only), `tests/nativeAdsMode.test.ts`,
`tests/nativeAds.test.ts`, `tests/nativeAdSettings.mjs`
and adds this document. Previous local fixes in `src/components/RookieHouseAdPage.tsx`,
`src/contexts/AppContext.tsx`, `src/dev/nativeAdmobDiagnostics.ts`, and
`docs/MEDIAN_ADMOB_TESTING.md` are preserved and must accompany any later deployment.

Sources: [Median AdMob](https://docs.median.co/docs/admob-native-ads),
[Google Android test-device configuration](https://developers.google.com/admob/android/test-ads).

## Validation result

- Full automated suite: 555 passed; mounted advertising UI: 5 passed.
- TypeScript app/node checks and normal production build passed.
- Focused advertising lint: zero errors; one existing AppContext fast-refresh warning.
- An additional in-memory production build verified master `true`, mode `android-test`,
  diagnostics `false`, DEV `false`, and Vercel production build provenance. It wrote no
  output files and made no deployment. Its JavaScript excludes the DEV console helper.
- The real singleton test covers registered/unregistered Android devices, the exact
  tester versus another Rookie, iOS/browser exclusion, unknown/paid/admin/promotional
  evidence (including a Rookie test-tier override), native/house separation, and cooldown.
- Concurrent subscription work in the same checkout was preserved. The only change in
  its trusted-membership helper is an optional advertising-read parameter; its default
  behavior and subscription selector still pass their existing tests. Review the combined
  working tree before any later commit/deployment; this task created no commit or push.
- Real Google Test Ad display on the current physical phone remains unverified.
