# Native bridge implementation and minified runtime review — October 17, 2026

**Android minified catalog/identity runtime passed. The iOS Swift adapter is implemented in source but remains uncompiled and untested on iOS. Original image-only Photos selection remains unresolved. Public purchases and restores remain held.**

Work is confined to `codex/native-revenuecat-release`, based on `d0d43c5bf695aa44350b94472694c0be3467f138`. No push, merge, production deployment, store upload, purchase, restore, production Auth/database operation or billing configuration change occurred. The user's later approval permitted only a separate debug-signed QA APK on the named emulator; no production signing key was used. Protected branches/worktrees and original downloaded native sources/archives remain intact.

## 1–4. iOS adapter, functions, plugin preservation and blockers

`native/ios/OnlyFastBilling.swift` implements protocol 1: capabilities, authenticated identify, named catalog, exact selection purchase, explicit restore, immediate invalidation and owned-identity clearing. Public iOS SDK key only; Supabase Auth validates the UUID against a fixed endpoint. No editable metadata or client entitlement grants paid access. The SDK is configured only after identity verification and never anonymously. Another existing SDK owner causes `SDK_OWNER`; Median's instance is not reconfigured or reset. No generic Median configure/purchase/paywall call is introduced.

Catalog uses actual SDK 5.96.0 `offerings().all["onlyfast_monthly_v1"]`, `$rc_monthly` → `app.onlyfast.pro.monthly`, and `$rc_custom_teams_monthly` → `app.onlyfast.teams.monthly`. It returns product title, localized price/currency/period, introductory metadata and best-effort eligibility. Unknown eligibility stays unknown; applicable phases contain introductory terms only when eligible. Store terms are not invented. Exact native Packages are cached for five minutes with user/generation/token binding and consumed on purchase. Success, cancellation, pending and errors are represented separately. Transactions reverify Auth and do not retry automatically.

Main-frame approved HTTPS origin checks run natively and in the injected script. Per-document nonces reject late navigation replies. Identity generations reject stale account results. Background invalidates the cached selection. Resume and the owned `customerInfoStream` emit payload-free `subscription-updated` events; the existing web lifecycle/server sync determines membership. The stream preserves Median's delegate. Both native and existing web readiness holds remain false, rejecting purchase/restore before transaction calls.

The preparer operates on a NEW copy of verified revision 16. It changes only:

1. New `LeanIOS/OnlyFastBilling.swift`.
2. `LeanIOS/LEANUtilities.m` — attach before navigation, including pooled views.
3. `LeanIOS/LEANWebViewController.m` — idempotent attach for adopted/restored views.
4. `OnlyFast.xcodeproj/project.pbxproj` — source registration.

The final prepared copy is `C:\Users\c_mar\.codex\worktrees\native-revenuecat-release\onlyfast\tmp\ios-release-adapter-final`. Its manifest records hashes. File comparison confirmed exactly those four native differences and **307 unchanged copied files**; the original downloaded archive's SHA-256 still matches intake. Existing Median RevenueCat **1.1.2**, official SDK **5.96.0**, dependency manifests/locks, generated header imports, app identity/signing and vendor delegate remain unchanged. No second dependency was added. API inspection used [the exact official SDK source](https://github.com/RevenueCat/purchases-ios/blob/5.96.0/Sources/Purchasing/Purchases/Purchases.swift); the existing Median plugin package/binary headers were inspected without mutation. Source preparation is documented in [the iOS README](../native/ios/README.md).

**Compilation blocker:** Windows has no Swift/Xcode. Module visibility through the existing transitive SDK linkage, generated Objective-C header exposure, actor isolation, plugin ownership, lifecycle and runtime StoreKit behavior still require an actual macOS/Xcode compile and runtime test. The vendor interface was built with Swift 6.2.3; choose compatible Xcode. No IPA, signing, hosted build workflow or paid macOS service was created. Mock/JS tests are not Swift compilation evidence.

## 5. Android photo-picker findings

The previous API-36 failure was a **system-process** NullPointerException in `IntentFilter.getDataType` → `DataManager.reportShareTargetEvent` / share prediction, followed by DeadSystemException in resolver/media/SystemUI. It was not an OnlyFast/RevenueCat app stack. Components are present and storage recovered without wiping the emulator. This locates the failure in the Android system chooser/prediction path but does not distinguish emulator instability from an OS/Median legacy-intent interaction. No upstream known-bug attribution is claimed.

The installed minified app passed image-only chooser cancellation with Auth intact. A safe alternate QA input (`*/*`) opened the native chooser → Photos & videos → DocumentsUI, selected the local synthetic PNG, and returned its metadata through Median's actual WebView callback. Cancellation after that selection also passed, as did Home/resume. The PNG was not uploaded or read by the web harness. Median reports an empty `change` on cancellation after selection; the QA harness was corrected to classify this as cancellation. The original failure report is preserved under ignored `tmp`.

**Original image-only Photos selection is still unverified.** The alternate callback does not prove that path works. No vendor picker rewrite or navigation/resume protection change was made; a stable emulator/approved physical-device check and further intent/OS triage remain before release.

## 6. Android minified runtime

The isolated `normalInternalMinifiedQa` variant derives from release with R8 enabled, QA debug inspection enabled, local-only bindings and independent transaction hold false. Unsigned compilation passed (37 tasks). After explicit approval, a separate copy was signed with the existing Android debug key. Its certificate matched the installed emulator app; `install -r` succeeded without uninstalling or clearing app data. Only AVD `OnlyFast_RevenueCat_API36` / `emulator-5554` was used.

Artifact: `C:\Users\c_mar\.codex\worktrees\native-revenuecat-release\onlyfast\tmp\android-minified-runtime-review\onlyfast-minified-qa-debug-signed.apk`.

SHA-256: `2346898E8499DAEFBD1516DBF0FBB3AE9E6ACD2C8E9CC7AAFFB799D2882822B0`.

Passed: Median launch, local synthetic Auth, actual protocol-1 native bridge, initialized/exact non-anonymous UUID, named offering, both products, invalid-session/wrong-UUID rejection, A→B→logout→A, delayed-A-result rejection, background/resume and catalog refresh, free Rookie, disabled public Coming Soon/restore controls. Actual store response: Pro **$4.99 USD/P1M**, Teams **$7.99 USD/P1M**, regular recurring phase only; eligibility **unknown**, no trial promised. Zero purchase/restore operations. No new fatal crashes observed; the crash buffer retains the older 17:28 system crash.

[Redacted runtime evidence](../native/android/qa/minified-runtime-evidence.json) contains the checks and limitations. Private raw evidence is `tmp/android-minified-runtime-review/runtime-report-final.json`. This is real minified execution, but it is not final production-signed/non-debuggable release proof. QA overlays are served only by the explicitly started private server; the production build must exclude them.

## 7. Remaining Android AAB steps

Resolve/verify the original image-only Photos path on a stable target. Review production release versionCode/versionName and signing securely; the QA artifact still uses source version 44 / 1.0.0 and a debug key. Prepare a fresh production source copy with production origin/Auth bindings and no QA init scripts, localhost assets, synthetic credentials or overlay. Verify authentication and picker/resume again in a non-debuggable minified target. Only after review/approval generate the production-signed AAB. Do not upload, enable holds, or repeat the earlier sandbox purchase without separate approval.

## 8. Remaining iOS IPA steps

Obtain approved compatible macOS/Xcode access and existing Median registry authorization. Compile the prepared generated workspace unsigned first (`CODE_SIGNING_ALLOWED=NO`); fix actual compiler/linker findings. Verify SDK ownership and the bridge in an isolated QA source copy using the local backend, trusted synthetic gate and an approved Apple test device/runtime. Review bundle/version/signing and QA exclusion before any signed IPA/TestFlight build. StoreKit/TestFlight transaction testing, product submission and public activation remain separate approvals; no real iOS purchase has been tested. Production sandbox rejection remains unchanged.

## 9. Changed files and validation

New: Swift adapter, `scripts/prepare-median-ios-release-source.mjs`, `tests/iosReleaseBridge.test.ts`, `native/android/qa/minified.init.gradle`, redacted minified evidence, and this report. Updated: QA client/README, iOS README, shared protocol, and links from the two historical reports. No application `src`, backend, migrations, SDK dependency, signing or production configuration changes.

- Unit suite: **373 passed**, 0 failed/skipped (includes six new iOS checks).
- Mounted component / disposable PostgreSQL integration suite: **63 passed**, 0 failed/skipped.
- Final focused iOS rerun: **6 passed** after source review. Executes the actual embedded JS bootstrap and preparer, plus static Swift boundaries and mocked Apple contract states; it does not execute Swift or StoreKit.
- TypeScript app + QA: passed. Focused ESLint: passed.
- Production Vite build: passed (1,853 modules). Output scan found no QA operator/nonce/overlay markers or local 8086/54321 URLs. Existing large-chunk warning remains; it is not a build failure.
- Android unsigned R8 QA compile: passed; approved debug-sign/install and actual minified checks passed with picker limitation above.

Review stop: no production/release signing approval is inferred from emulator-only debug signing. No deployment, upload, purchase or restore is authorized by this report. Public `NATIVE_PURCHASES_READY=false`, Android transaction hold and new iOS transaction hold remain false. Existing Stripe/backend membership behavior was not changed.
