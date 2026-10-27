# Internal Android runtime QA (catalog and identity only)

This harness runs the reviewed release bridge inside the actual Median Android application. It does not call purchase, restore, paywall or subscription synchronization. Public readiness stays false. It is not a production route or a production Vite plugin.

`prepare.mjs` creates a **new** vendor source copy using the existing release preparer. The extension remains under `app/src/main/java/app/onlyfast/billing/OnlyFastBilling.kt`, and Median's normal application class/lifecycle remains in use. It does not include the old debug `LocalCatalogApplication`.

The only native QA differences are fixed localhost origin/Auth/public-key bindings and an **additional** server-managed experimental synthetic tester check. Debug-only assets set the local startup URL, label and localhost-only network exception. An explicitly invoked Gradle init script removes the debug package suffix solely to retrieve the registered `app.onlyfast` Play catalog on the dedicated emulator. Release assets, signing and downloaded vendor source are untouched. Native `TRANSACTIONS_ENABLED=false` stays unchanged.

The Vite `server.mjs` binds IPv4 loopback on 8086, sets explicit local Supabase/public configuration and serves the actual web application plus a serve-only QA module. The private operator endpoint checks origin, host and a random instance nonce. Local credentials/reports under `tmp` are denied through Vite's file server. Service-role credentials are used only inside the local Node process to prepare a second synthetic tester; none are returned to the browser or APK. The existing first synthetic tester is reused. The second account gets tester authorization only, never a paid-access override.

The QA client imports the actual versioned controller/transport and real PlanSelection/NativeSubscriptionControls. Its private catalog controller is enabled only after trusted local tester checks; the production `NATIVE_PURCHASES_READY` constant remains false. Its transport rejects purchase/restore operations before sending them. A deliberately delayed **actual native catalog reply** verifies stale-result rejection during a real local A → B account switch. This is not a simulated store response.

## Reproduce from this worktree

Use the existing running `onlyfast-disposable-staging` Docker environment. No database reset or cloud command is needed. Choose a nonexistent output directory under this worktree's `tmp` folder:

```powershell
node native/android/qa/prepare.mjs --source 'C:\Users\c_mar\OneDrive\Desktop\Apex88\OnlyFast\App\racing-setup-dirt (1)\android' --workspace 'C:\Users\c_mar\OneDrive\Desktop\Apex88\OnlyFast\App\racing-setup-dirt (1)\onlyfast\tmp\staging-database' --tester 'C:\Users\c_mar\OneDrive\Desktop\Apex88\OnlyFast\App\racing-setup-dirt (1)\android\diagnostics\local-tester.local.json' --output 'C:\Users\c_mar\.codex\worktrees\native-revenuecat-release\onlyfast\tmp\android-release-bridge-qa-new'

$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$env:GRADLE_USER_HOME = 'C:\Users\c_mar\OneDrive\Desktop\Apex88\OnlyFast\App\racing-setup-dirt (1)\android\.gradle-user-home'
Push-Location tmp/android-release-bridge-qa-new
.\gradlew.bat :app:assembleNormalDebug -I qa.init.gradle --offline --console=plain --no-daemon
Pop-Location
node native/android/qa/server.mjs tmp/android-release-bridge-qa-new
```

Use only AVD `OnlyFast_RevenueCat_API36` (`emulator-5554` in this run). Confirm its name and `ro.kernel.qemu=1`, inspect the APK/debug certificate, and preserve/check any installed APK before an update. During this run the installed file matched the exact old sandbox APK by SHA-256, and its debug certificate matched the new QA APK. It was backed up and updated with `adb -s emulator-5554 install -r`; no uninstall or app-data clear occurred.

Configure `adb -s emulator-5554 reverse tcp:8086 tcp:8086` and `reverse tcp:54321 tcp:54321`. Start `app.onlyfast/co.median.android.MainActivity`. The local-only harness signs in synthetic testers and runs automatically. No Google login, billing confirmation or store interaction is required. A localhost IPv6-to-IPv4 proxy was also running for 8086 on this Windows host; if ADB reverse cannot reach IPv4-only Vite, start `node native/android/qa/loopback-proxy.mjs` in another terminal. It binds only `::1` and forwards to IPv4 loopback, preserving the approved origin without opening the server to the LAN. Do not start a duplicate if that loopback listener already exists.

The report appears in the app and is written to `<QA output>/runtime-report.json`. It includes actual native prices/phases, validated identities, negative Auth checks, public holds and background/resume checks. Keep full local credential files private. `runtime-evidence.json` is a redacted archive of the successful run, not a mock fixture or a promise of eligibility on another store account.

For background/resume, send the emulator Home key and bring the same activity back without force-stopping. The harness verifies the same authenticated account and reloads the named catalog. The report receives a separate resume result.

Before any legitimate AAB packaging, omit all of these QA scripts, local bindings, debug assets and credentials. Use the unchanged production release bridge and normal approved signing/build process. See [the runtime validation report](../../../docs/ANDROID_RELEASE_BRIDGE_RUNTIME_VALIDATION.md).

## Photo-picker follow-up

**Latest follow-up:** the separate R8/minified QA artifact was debug-signed and installed with explicit user approval, preserving app data. See [minified runtime evidence](minified-runtime-evidence.json) and [completion review](../../../docs/NATIVE_BRIDGE_COMPLETION_REVIEW.md). The historical failure below remains relevant; it is not a claim that the latest bridge crashed.

The serve-only client now offers a manual `image/*` file input after synthetic Auth/account-switch checks. Use only `ONLYFAST-QA-photo.png`; selection records name/type/size and revalidates the synthetic account, without uploading/reading file content. Cancellation also revalidates Auth. The additional manual check has its own `manualPhotoPicker` status (initially `not-run`); the base `report.passed` alone does not prove it was exercised. It is not imported into the production build.

During the October 17 follow-up, the native chooser opened but selecting Photos crashed the API 36 emulator's **system process** (`IntentFilter.getDataType` → `DataManager.reportShareTargetEvent`); the selection/cancel checks remain incomplete. No new APK was signed or installed. See [the source-resolution/Android preparation report](../../../docs/IOS_SOURCE_BLOCKER_RESOLUTION.md) before retrying on a stable runtime. Do not clear emulator data or change production photo-picker behavior to bypass this failure.

The latest serve-only harness offers separate image-only and unrestricted file inputs. Image-only chooser cancellation preserved Auth. Choosing Photos & videos through the alternate file chooser opened DocumentsUI; selecting the synthetic PNG returned its metadata through Median's actual WebView callback, with no upload, Auth loss or navigation reset. An empty `change` after a previous selection is classified as cancellation, matching Median/WebView behavior. This validates an alternate path; the original image-only Photos selection remains unresolved and needs a stable target/physical-device check before release.

## Minified emulator-only artifact

In a NEW prepared QA copy, the explicitly opted-in init script adds `internalMinifiedQa` from `release`, with R8 enabled, inspection/debug enabled, QA-only assets/manifest, and no signing configuration. It refuses signing tasks. Production release sources/assets/signing are untouched:

```powershell
Push-Location tmp/android-minified-runtime-review
.\gradlew.bat :app:assembleNormalInternalMinifiedQa -I ..\..\native\android\qa\minified.init.gradle --offline --console=plain --no-daemon
Pop-Location
```

The resulting unsigned APK is under `app/build/outputs/apk/normal/internalMinifiedQa/`. Android requires signing for installation. With the user's subsequent explicit approval, a separate `onlyfast-minified-qa-debug-signed.apk` was signed using the existing Android debug keystore. Both certificates were compared against the installed emulator app; they matched. `adb -s emulator-5554 install -r` succeeded. No uninstall/data clear, production signing key, AAB, distribution or upload was used.

This QA variant proves R8 execution with the local synthetic gate; it is deliberately debuggable and uses local bindings. It does not prove a final non-debuggable, production-signed AAB. Exclude the init script, local assets and harness from release packaging. Never silently uninstall to bypass a certificate mismatch.
