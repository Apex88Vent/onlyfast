# Android release source preparation

Status: main/release source compiles with Median plugin 1.3.0 and its existing RevenueCat SDK 10.3.0. No new APK/AAB was signed, installed, purchased through, uploaded, or deployed. Both transaction holds remain false. This is prepared source, not a validated store release.

The existing debug extension proved named offering retrieval and one genuine local-only sandbox purchase. The release extension reuses those SDK calls, not the debug application subclass, localhost operator server, one-shot permit, diagnostic page, or debug manifests.

## Supported packaging path

Use the downloaded licensed Median source and Android Studio/Gradle, preserving `app.onlyfast`, signing identity, authentication, photo picker and all other Median functionality. Median documents [Android source builds](https://docs.median.co/docs/build-android-from-source) and [source customization](https://median.co/faq). Source changes here do **not** become part of a Median App Studio cloud build. A cloud build needs Median to integrate a [custom native plugin](https://docs.median.co/docs/native-plugins-overview); that service/access has not been established on this plan. Local licensed source builds are the path verified here.

From this worktree in PowerShell, choose a **new, nonexistent output directory** whose parent exists:

```powershell
node scripts/prepare-median-release-source.mjs --source 'C:\Users\c_mar\OneDrive\Desktop\Apex88\OnlyFast\App\racing-setup-dirt (1)\android' --output 'C:\Users\c_mar\.codex\worktrees\native-revenuecat-release\onlyfast\tmp\median-release-review'
```

The script refuses existing/overlapping paths, copies vendor source without debug sources, diagnostics, builds, environment files or signing key files, adds the main Kotlin extension, injects a small pre-navigation hook into `MainActivity`, and pins the already-used SDK. It verifies the registered package, production initial origin, and active licensed RevenueCat plugin. Application ID and signing declarations stay unchanged. Supply the existing authorized signing material privately later; it is not copied or committed. Never install an identically signed release over a customer's production app for this test.

Compile without generating a signed release:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
# Optional: reuse the existing Gradle cache; no tools need reinstalling.
$env:GRADLE_USER_HOME = 'C:\Users\c_mar\OneDrive\Desktop\Apex88\OnlyFast\App\racing-setup-dirt (1)\android\.gradle-user-home'
Set-Location 'C:\Users\c_mar\.codex\worktrees\native-revenuecat-release\onlyfast\tmp\median-release-review'
.\gradlew.bat :app:compileNormalReleaseKotlin :app:compileNormalReleaseJavaWithJavac --offline --console=plain --no-daemon
```

## Manual release review

1. Keep the standard plugin installed, but ensure it does not independently auto-configure RevenueCat. The extension fails closed if a different owner already configured the SDK; it does not silently adopt an anonymous user. The new web integration is the only OnlyFast billing entry point.
2. Use the Android WebView engine. GeckoView and WebViews without `WEB_MESSAGE_LISTENER` cannot provide this extension and must leave purchases unavailable. The hook does not replace Median authentication, navigation, RevenueCat listeners, or file-picker handling.
3. Confirm the production URL remains HTTPS onlyfast.app and the release source is `src/main`, not the old `src/debug` overlay. No cleartext/local networking exception is added.
4. Verify package/signing/certificate, Play Console app configuration, Play Billing compatibility and dependency resolution in the eventual reviewed release artifact. SDK 10.3.0 is compiled here; Play policy compliance at upload time is a separate check.
5. Review RevenueCat restore/transfer policy before testing cross-account restores. The bridge prevents silent restoration and identity mismatches; it cannot change the store account or replace the dashboard's transfer policy.
6. Leave `TRANSACTIONS_ENABLED=false` and web `NATIVE_PURCHASES_READY=false`. Do not enable either for public users as part of packaging review.

## Remaining execution tests

First run this new extension with catalog-only access in an isolated, restricted test build. It currently binds to production Auth and origins, so it deliberately rejects local synthetic JWTs. Do not direct sandbox purchases at production. Prepare a separately reviewed test flavor with fixed local/testing Auth configuration, approved diagnostic origin and existing trusted synthetic tester authorization, then use the existing free local Supabase sandbox environment. Do not add an arbitrary client-selectable Auth URL or production service-role key. Android ADB reverse can reuse ports 8086/54321 in that separate localhost-only test flavor.

After explicit approval for another transaction, test installed Play-track/license-testing behavior, both displayed package selections, eligible/ineligible trials, cancellation, pending/deferred payment, renewal, expiration, offline recovery, explicit restore, account switch while a sheet is open, resume after pending approval, and server synchronization. Verify Pro/Teams with the membership resolver, including Stripe/promotional preservation. An existing Pro account must not be prompted into an additional subscription. No such new transaction was performed in this task.
