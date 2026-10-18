# Android native release bridge runtime validation — 2026-10-17

Follow-up: [minified runtime and iOS adapter completion review](NATIVE_BRIDGE_COMPLETION_REVIEW.md), with separate debug-signed minified QA evidence and picker limitations. This report describes the earlier non-minified run.

**Result: catalog, authenticated identity, account switching and held public UI passed in the actual Median Android runtime. No purchase or restore was performed.**

Reviewed bridge: `86e794f440e84b658e170d190693ec7c76aa7eec`, branch `codex/native-revenuecat-release`. The release Kotlin bridge, pre-navigation Median hook, web controller/transport and readiness constants were not changed for this task. New tracked files are confined to `native/android/qa/` and this report.

## Runtime results

| Check | Result |
| --- | --- |
| Median starts / local application loads | Passed on existing `OnlyFast_RevenueCat_API36`, API 36 emulator |
| Native source placement | Main source set; release bridge class present in APK; old `LocalCatalogApplication` absent |
| Bridge | Actual `window.onlyFastBilling` replies, protocol 1, Android, native transactions disabled |
| RevenueCat initialization | Passed: native identify returned the authenticated UUID; subsequent live SDK catalog request passed the bridge's configured/non-anonymous/exact-user checks |
| Offering | Actual `onlyfast_monthly_v1` loaded; no current-offering fallback |
| Pro | `$rc_monthly`, `pro:pro`, **$4.99 USD**, `P1M`, 4,990,000 micros |
| Teams | `$rc_custom_teams_monthly`, `teams:teams`, **$7.99 USD**, `P1M`, 7,990,000 micros |
| Applicable terms | Selected native options `pro` and `teams` returned monthly infinite-recurring phases; no free-trial phase returned in this store session |
| Trial eligibility | `unknown`, with actual eligibility limitation text preserved; no invented seven-day eligibility |
| Native Auth errors | Invalid token and valid-token/wrong-UUID requests rejected with `AUTH`; these were intentional negative tests |
| Account switching | Real local A → B → logout → A passed; A's delayed real native response rejected after switching; logged-out catalog denied |
| Native background/resume | Same authenticated A session retained; named catalog refreshed successfully |
| Public UI | Actual PlanSelection and NativeSubscriptionControls mounted: paid buttons disabled/Coming Soon, restore disabled, Continue Free enabled |
| Navigation/auth resets | No unexpected route/origin change or session reset during the checks and background/resume |
| Crashes | Android crash buffer empty during validation; no bridge/SDK error in the successful run beyond intentional Auth denials |
| Transactions | Recorded purchase operations: **0**; restore operations: **0** |

Actual store responses and redacted identity evidence: [runtime-evidence.json](../native/android/qa/runtime-evidence.json). Full private local report: `tmp/android-release-bridge-qa/runtime-report.json`. The catalog serialization deliberately returns the selected native option's applicable phases; it does not claim every possible offer or eligibility for a different Play account. Existing Play account history is independent of the synthetic Supabase UUID.

The first QA harness incorrectly tried to use the old Median manager's initialization state as an assertion for the independently owned SDK. Median's supplied bytecode shows its own `configured` field. That assertion was removed from the QA harness; initialization was verified through the new authenticated native identify/catalog path. No second SDK configuration was added. Initial local WebView/Vite forwarding warm-up was resolved with the local server/restart and loopback forwarding checks; no production URL or release network policy was changed.

## Artifact and isolation

Installable internal debug APK:

`C:\Users\c_mar\.codex\worktrees\native-revenuecat-release\onlyfast\tmp\android-release-bridge-qa\app\build\outputs\apk\normal\debug\app-normal-debug.apk`

SHA-256: `57DF5F7D3984A8E3C5AFC59D99A43407FB6A39E9D6F74BC1EF0E3D62A204AC9F`.

- Application ID `app.onlyfast`, versionCode 44, Android Debug certificate. The registered ID is necessary for real store catalog resolution. This is an emulator QA artifact, not a public release.
- Before install, the emulator's existing APK matched the exact previously exported one-purchase sandbox APK. It was pulled to `tmp/android-release-bridge-qa/installed-before-qa.apk`, and both debug certificates were compared. `install -r` preserved app data; no customer installation was touched.
- The licensed vendor source was copied to a new worktree-local ignored directory. The existing Android download, debug source, APKs and purchase reports were not edited. Its Gradle cache/toolchain were reused.
- The release-compatible class runs from `src/main` through the normal Median MainActivity hook; the old debug application subclass/operator-permit purchase implementation is excluded.
- QA-only fixed local Auth/public-key/origin bindings and an additional server-managed synthetic tester gate were applied **only in the generated QA copy**. The release class retained its original production binding and hold. No service-role or RevenueCat private REST key was embedded.
- Only the existing free local Supabase environment was used. The existing approved synthetic A account was reused and one new synthetic B tester was created locally for switching. B received no paid membership or full-access override. Neither account was created in production.
- Port 8086 Vite and port 54321 local Supabase used ADB reverse. Private local files and unauthenticated QA operator requests returned HTTP 403. The QA web module is injected by a serve-only plugin and has no production entry-point import.

Reproduction and setup: [QA README](../native/android/qa/README.md). Build log: `tmp/qa-android-build.log`; APK evidence: `tmp/qa-apk-evidence.json`; screenshots: `tmp/qa-emulator-passed.png` and `tmp/qa-emulator-screen.png`.

## Regression checks

- 366 unit/regression tests passed, zero failures/skips (serialized files to avoid the known existing timing-sensitive test).
- 63 mounted React and disposable PostgreSQL integration tests passed, zero failures/skips.
- Application plus QA client TypeScript check passed; QA script/client lint passed.
- Production Vite build passed with the existing large-chunk advisory. QA code, local credentials and QA endpoints are excluded from its entry graph.
- Android `assembleNormalDebug` passed using the existing licensed source, Median RevenueCat plugin 1.3.0 and SDK 10.3.0.

No Supabase schema/function deployment, production setting, RevenueCat offering/entitlement/paywall, Stripe checkout, production web deployment, native binary upload or other branch was changed. `NATIVE_PURCHASES_READY=false`, Android transaction hold and production sandbox rejection remain intact. iOS files and unfinished work remain untouched.

## Before a release-ready Android AAB

1. Review these runtime results and retain the release bridge's production bindings; exclude QA overlays, local origins/Auth, scripts, diagnostics and credentials from legitimate packaging.
2. Confirm the approved production signing/upload material, package identity, appropriate version code and existing authentication/photo-picker behavior in the actual minified release variant. This task generated a debug APK, not a signed/minified AAB, and did not exercise the photo picker.
3. Run a minified release artifact smoke check for lifecycle, WebView transport, named catalog and login/logout. The successful debug runtime exercises the main-source bridge, but does not establish R8/signing/distribution behavior.
4. Keep both transaction holds and public Coming Soon until separate activation approval. Purchase, pending-payment and restore execution through this new bridge remain untested by design; the earlier successful sandbox purchase evidence is preserved, not repeated. Any further transaction testing requires separate approval.
5. Upload/submit only after explicit build/distribution approval. No additional purchase, paid resource or new credential was required to complete this catalog/identity validation.
