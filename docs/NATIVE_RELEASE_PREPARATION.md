# Native RevenueCat release preparation — 2026-10-17

Follow-up: the main-source Android bridge has now passed actual emulator catalog,
identity, account-switch and background/resume checks. See
[Android runtime validation](ANDROID_RELEASE_BRIDGE_RUNTIME_VALIDATION.md).
No additional purchase or restore was performed; the preparation record below
describes the original `86e794f4` work.

Prepared on `codex/native-revenuecat-release`, from production main `9ae29d685bc68c265ef2c363e0943acb49573c3e`, in a new isolated worktree. No merge, push, deployment, store upload, production subscription write, or additional transaction was performed. Public purchases and restoration remain held.

## Reused and verified

- Preserved `codex/onboarding-release-preparation` at `e27bf775484be1cf1025dc152ecc8e854440bf45` and its worktree. No branch merge/cherry-pick was used to bring unfinished staging/diagnostic code into this release branch.
- Read the separate Median Android debug source and `android/diagnostics/SINGLE_PLAY_PURCHASE_STATUS.md`. The prior genuine Pro sandbox purchase was verified through RevenueCat, local Supabase sync and the local membership resolver. That existing evidence is retained; no repeat purchase was attempted.
- Reused the proven SDK 10.3.0 named-offering retrieval, actual package/product serialization and explicit native purchase capability. Median plugin 1.3.0 remains installed. The production extension is a main-source WebView handler, not the debug application subclass or one-shot local operator permit.
- Preserved the existing authenticated `sync-revenuecat-subscription` endpoint and membership resolver. The endpoint verifies the caller and fetches RevenueCat server-side. Teams outranks Pro; expiration and sandbox rejection are server decisions. No functions, migrations, secrets or schema were changed.
- Inspected RevenueCat configuration through read-only tools. `onlyfast_monthly_v1` contains both correct platform products/packages. `default` remains the current offering. `OnlyFast Pro` includes Pro and Teams products; `OnlyFast Teams` includes Teams. No configuration was changed. [Offerings](https://app.revenuecat.com/projects/79983fe3/product-catalog/offerings), [entitlements](https://app.revenuecat.com/projects/79983fe3/product-catalog/entitlements).

## New implementation

The versioned OnlyFast bridge explicitly selects the named offering and chosen plan. It replaces the old generic Median current-offering/paywall scaffold; the original plugin's `getOfferings()` and `presentPaywall()` do not supply the required named selection contract. See the [official Median JavaScript bridge source](https://github.com/gonativeio/median-javascript-bridge/blob/master/src/plugins/revenueCat.ts).

- Web controller requires authenticated UUID/session, matches native identity, serializes requests, invalidates stale account callbacks, validates both exact products and displayed catalog, and distinguishes cancelled/pending/error/success. A native transaction result never grants membership; existing server synchronization and membership reload are required.
- Transport uses a dedicated correlated channel, ignores malformed/unmatched responses and prevents retry after timeout. No fallback to a diagnostic bridge or generic vendor paywall exists.
- Plan selection can consume actual localized prices, ISO subscription periods and store-returned pricing phases once activation is separately approved. Eligibility is explicitly unknown where the native SDK cannot establish it; the seven-day trial is never inferred as a guarantee. Existing public Coming Soon, Rookie continuation and Stripe checkout remain unchanged.
- Android extension verifies the real Supabase Auth session natively, configures with that UUID and the verified public Android key, owns SDK initialization, selects the named catalog, binds a five-minute catalog token to identity, and implements explicit selected-option purchase and authenticated restore. It preserves offering attribution and rejects stale identity/results. It does not overwrite Median SDK listeners or photo-picker/auth/navigation behavior.
- Separate web `NATIVE_PURCHASES_READY=false` and native `TRANSACTIONS_ENABLED=false` prevent OnlyFast purchases/restores. A Vite flag alone cannot activate them. The vendor plugin's APIs remain in the binary; the native hold is enforced on the new extension, not represented as removal of all vendor APIs.
- A non-overwriting source-preparation script creates a separate Android source copy, excludes debug/credentials/build outputs, injects the pre-load handler and pins the already-installed SDK. The downloaded source, debug implementation and reports were preserved.

Protocol and full field definitions: [native/BRIDGE_PROTOCOL.md](../native/BRIDGE_PROTOCOL.md).

## Android packaging status

**Ready for source/signing review; not yet validated as a new installed store build.** The extension and real Median `MainActivity` hook compiled as `normalRelease` Kotlin and Java against SDK 10.3.0. No signed release APK/AAB was produced. Existing release package/signing declarations remain unchanged; signing keys were excluded from the prepared copy.

Prepared compile workspace (ignored, uncommitted): `tmp/median-release-source-verified/`. Log: `tmp/median-release-verified-compile.log`. The source copy's startup URL remains production HTTPS. Its native Auth binding intentionally rejects local synthetic JWTs; do not use it to send sandbox purchases to production.

The supported verified route is a licensed [Median Android source build](https://docs.median.co/docs/build-android-from-source). Code in this repository is not automatically included in App Studio cloud binaries; that requires Median [custom plugin integration](https://docs.median.co/docs/native-plugins-overview). Check actual WebView message-listener support and ensure the standard plugin does not independently initialize the SDK. GeckoView has no extension here and fails closed.

Detailed manual steps and compile commands: [native/android/README.md](../native/android/README.md).

## iOS packaging status and required input

**Blocked for native implementation and packaging.** The supplied directory contains Android and web source, with no iOS workspace/plugin source or lockfile available. A Mac/Xcode environment, licensed Median iOS source, Apple signing/provisioning and In-App Purchase capability are required. No iOS SDK version is guessed from the Android dependency.

The iOS RevenueCat app/public key and product identifiers were verified, and web contract fixtures validate the expected iOS catalog. No real iOS bridge exists in this change, and no StoreKit/TestFlight transaction was performed. Full requirements: [native/ios/README.md](../native/ios/README.md).

## Validation

| Check | Result / scope |
| --- | --- |
| Unit/regression tests | 366 passed, zero skipped, using serialized test files |
| Mounted UI + disposable PostgreSQL integration | 63 passed, zero skipped; no live database/data |
| TypeScript application check | Passed |
| Focused lint of changed integration/test/script files | Passed |
| Vite production build | Passed; existing large-chunk advisory |
| Android normalRelease Kotlin + Java compilation | Passed in separate copied source tree; no signing/store execution |
| New bridge runtime purchase/restore | Not run; further transaction approval required |
| iOS compilation/StoreKit | Blocked by missing source and Mac/Xcode |

One concurrent test run had 365/366 pass: the unchanged membership expiration test relies on a 65 ms deadline and missed its notification under parallel build/test CPU load. All 366 passed with test-file concurrency set to one. The failure log is retained in `tmp/native-unit.log`; the passing run is `tmp/native-unit-serial.log`. This is a test timing limitation to resolve separately, not evidence of new native runtime validation.

Reproduce checks in PowerShell (existing external QA tools were reused, no production dependency added):

```powershell
node --experimental-strip-types --test --test-concurrency=1 tests/*.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json
$qaRoot = Join-Path $env:TEMP 'onlyfast-onboarding-qa'
$env:PGLITE_MODULE = Join-Path $qaRoot 'node_modules/@electric-sql/pglite/dist/index.js'
$env:REACT_TEST_RENDERER_MODULE = Join-Path $qaRoot 'node_modules/react-test-renderer/index.js'
node --experimental-strip-types --test tests/*.mjs
npm.cmd run build
```

These integration scripts execute disposable in-memory PostgreSQL and mounted React components, not Supabase CLI migrations or production endpoints. Backend tests cover editable-metadata rejection, expiration, webhook ordering/deduplication, Stripe/promotional preservation and server-side sandbox rejection. Bridge fixtures cover explicit Pro/Teams selection, both platform ID mappings, missing/expired catalogs, identity failures, logout/switching, stale completions, cancelled/pending/error replies, native/web holds and message timeouts. Source preparation tests ensure no vendor modification, debug/credential copying or overwrite of existing output.

## Before any activation or store submission

1. Review this branch and Android source diff. Do not merge/deploy until approved. Preserve both transaction holds and the existing native purchase readiness hold.
2. Supply the iOS source and Mac/Xcode build/signing access, or arrange Median custom-plugin packaging if cloud builds are required. Implement and compile the actual iOS adapter before claiming compatibility.
3. Prepare a separately reviewed restricted sandbox flavor that uses the **existing free local Supabase/Docker environment**, fixed development origins/Auth endpoint, synthetic tester UUIDs and trusted server-side tester authorization. Do not use the production Auth binding for that test. Keep production `REVENUECAT_ALLOW_SANDBOX=false`. Use no production customer records. Do not create paid resources or route sandbox events into production subscriptions.
4. Obtain approval before any new purchase. Test the new Android extension in the dedicated emulator/Play test installation, then an actual iOS StoreKit/TestFlight environment. Confirm displayed terms match the chosen transaction; test both plans, trial eligibility differences, cancellation, pending approval, renewals, expiration, offline recovery, account switching and explicit restore. Review RevenueCat restore/transfer policy before cross-account testing; do not change it silently.
5. Verify trusted server access after each authorized test, Stripe/promotional retention, no duplicate purchase for an existing subscriber, and authentication/photo-picker regressions in the actual native wrappers. Do not rely on client entitlement JSON.
6. Review release signing/certificates, package/bundle identity and current store requirements. Produce binaries only after build approval. Public activation requires a separate approval and coordinated native/web holds; this task does not remove them.

## Intended source manifest

- `src/lib/releaseNativeBilling.ts`, `src/lib/releaseNativeTransport.ts`: new versioned controller and transport.
- `src/lib/nativePurchaseController.ts`, `src/lib/nativePurchases.ts`: retained hold/error type, replace generic paywall wiring, preserve server refresh.
- `src/components/PlanSelection.tsx`, `src/components/MembershipPaidAction.tsx`, `src/components/NativeSubscriptionControls.tsx`: selected catalog/plan wiring behind hold.
- `native/BRIDGE_PROTOCOL.md`, `native/android/README.md`, `native/android/src/main/java/app/onlyfast/billing/OnlyFastBilling.kt`, `native/ios/README.md`: source extension, protocol, packaging and blockers.
- `scripts/prepare-median-release-source.mjs`: isolated source preparation.
- `tests/releaseNativeBilling.test.ts`, `tests/medianReleasePreparation.test.ts`, `tests/nativePurchaseReadiness.test.ts`, `tests/revenuecat.test.ts`: contract/safety coverage; obsolete generic-paywall controller tests replaced, backend tests retained.
- This report.

No Supabase, Stripe checkout implementation, Android binary/vendor source, environment/secret, staging baseline or diagnostic purchase file is included. Generated source copies, logs, build outputs and the dependency junction stay ignored in the new worktree.
