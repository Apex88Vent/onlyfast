# Median test subscription verification

Verified November 10, 2026 (America/Los_Angeles), against the live production website and existing Median simulator builds. No application, native wrapper, database schema, pricing, RevenueCat configuration, advertising configuration, or deployment was changed by this verification task.

## Results

| Requested check | Result |
| --- | --- |
| 1. Android configuration | Live App Studio configuration: package `app.onlyfast`, version `1.0.2`, production startup URL, `median` user-agent suffix, JavaScript bridge injection enabled, stock RevenueCat plugin enabled. Existing Pixel 9 Pro / Android 16 cloud emulator opened production and passed the tier cycle. |
| 2. iOS configuration | Live App Studio configuration: bundle `app.onlyfast`, version `1.0.2`, same production startup URL and bridge/plugin settings. Existing iPhone 14 Pro / iOS 26 cloud simulator opened production and passed the tier cycle. |
| 3. Production URL | Shared startup URL is `https://onlyfast.app?nativeApp=true`; no platform-specific alternate backend/startup URL or forced user agent was found. `/app` returned HTTP 200. |
| 4. Supabase environment | The live main asset references only `https://thpyjvwtfvfxiufchrxn.supabase.co`. Native UI changes were independently read back from this production project's tester-tier record. |
| 5. Native override | Both actual cloud native runtimes passed **Team → Rookie → Pro → Team** using `test@test.com`. Final saved tier and authenticated membership resolver both returned Team. No active native-specific hardcoded Team override was found. |
| 6. Checkout bypass | Neither native tier cycle opened checkout. Mounted Android/iOS tests, including mock purchase activation and onboarding entry points, assert zero offering, purchase, restore, or RevenueCat subscription-sync calls for every authorized test tier. |
| 7. Ad eligibility | Rookie is eligible for existing house ads; its house banner was observed on Android. Pro removed that banner; Team dashboard also had no Rookie banner. Both-platform automated checks confirm the tier-based rule. Existing AdMob rollout, consent, region, device, and underlying paid/promotional exemptions remain additional gates; no AdMob activation or impression test was performed. |
| 8. Automated tests | **169/169** checks passed on current main: 128 focused checks, including expanded Android/iOS mounted controls and real disposable-PostgreSQL selector tests in web/Android/iOS contexts, plus 41 Median/RevenueCat integration checks. The earlier isolated release package separately passed 120 relevant checks across the core and mounted runs. |
| 9. Real native / physical devices | Actual native code ran in Median's cloud iOS simulator and Android emulator, rather than only browser user-agent simulation. **No physical phone was tested.** Android Restart App retained its signed-in Team selection. iOS restart persistence remains unverified because its five-minute session expired. |
| 10. Rebuild requirement | **No native rebuild is required for this fix.** Existing production wrappers load the updated production website. No native-specific correction was necessary; the existing production deployment should work in both Median wrappers. |

## Production identity observed

The originally supplied isolated release was `4c0f37a9cdbb44b0a2fd04b4e2488dd7675f410e`, with Supabase migration recorded as `20261111003124`. That migration was not reapplied.

During verification a separate task enabled automatic deployment from main. The final production check therefore identified:

- Commit: `c0a7a6e221bb36f8358d5cf32f592de42f8acf2f`
- Deployment: `dpl_4NQ6fUiksrxWaNzFBmeCUSMi9RHn`, READY, Git source
- Live main asset: `/assets/main-Bem24SGh.js`
- Test-tier getter and setter present in that served asset

The native simulator runs used the live production URL. This task did not initiate that deployment or change `vercel.json`.

## Source and simulated-wrapper verification

The active path is the stock Median integration described in `native/README.md`. The retained custom adapters are historical development material and were not built, installed, or activated.

- Native detection uses the current document's URL, Median/GoNative user agent, or bridge evidence. A stored browser flag cannot grant test privileges.
- Supabase Auth provides the same account UUID to the subscription resolver in both wrappers. Each native WebView needs its own sign-in; the desktop browser's cookies are not shared. The user manually signed in inside each native simulator; no credentials or session tokens were copied into a native app.
- `TestSubscriptionGate` resolves authorization from the server before mounting checkout children. Its tier selection does not depend on RevenueCat bridge initialization or native purchase activation.
- `NativeSubscriptionControls` presents the current test tier and no-payment selector link before purchase controls. `useNativeSubscription` skips offering loads and rechecks the server-authorized tier before purchase/restore actions.
- `watchNativePurchases` hydrates server membership and skips native RevenueCat synchronization when `status.testTier` is present. A legitimate RevenueCat row cannot force an authorized selected Rookie or Pro tier back to Team.
- Trusted membership is bound to the authenticated identity. Logout/account changes clear it. Server reads, not editable profile fields or cached Team values, rehydrate it.
- Existing lifecycle tests cover login, focus, visibility changes, network recovery, coalesced resume events, stale responses, and identity changes while purchases are held. The database-backed UI tests clear the authorization cache, remount components, and simulate logout/login after repeated tier changes in all three contexts. These are automated simulations, not physical-device restart claims.
- Existing normal-account paywall and entitlement tests retain their provider paths. A production normal user was additionally exercised under the authenticated PostgreSQL role in a rolled-back transaction: getter returned null and setter raised `TEST_ACCOUNT_REQUIRED`. No normal account's selection was changed.
- Database checks enforce Rookie/Pro single-class restrictions and Team unlimited classes, plus existing usage limits, while preserving subscription and saved-setup fixtures. No production usage quota or saved setup was consumed or edited.

## Actual native observations

**iOS:** The user signed in inside the existing cloud simulator. Settings correctly showed its saved Pro tier and the no-payment link. Team was selected to establish the requested starting point, then Team → Rookie → Pro → Team completed. Each selected label was observed. Continue returned to the dashboard with Team. An independent production read confirmed Pro during the cycle. The session expired before a restart result could be confirmed; this is not reported as a passed iOS restart test.

**Android:** The user signed in inside the existing cloud emulator and saw the Team selection saved from iOS, confirming that both runtimes use the same production account/backend. Settings showed Team and the no-payment link. Team → Rookie succeeded; the dashboard badge became Rookie and the existing house-ad placement appeared. The existing user-menu Upgrade to Pro option opened the test selector without checkout. Rookie → Pro succeeded; the production stored/effective tier was Pro, its dashboard had no Rookie house banner, and Settings showed Pro. Pro → Team succeeded. The Median Restart App action returned to a signed-in dashboard still showing Team without the Rookie banner. Final authenticated production readback returned saved Team, effective Team, and unlimited classes true.

A local Android AVD was also booted read-only for installed-package inspection: `app.onlyfast` version `1.0.2`, production startup URL, RevenueCat plugin configured. Its APK was copied for inspection without clearing/replacing app data. The agent-started local emulator was then stopped. Acceptance interactions used the current Median cloud builds; no local debug/custom bridge was used as evidence.

## Test changes and execution

Only these test/report files were changed for this task:

- `tests/nativeSubscriptionControls.mjs`: run each authorized-tier checkout-bypass case on both Android and iOS.
- `tests/testSubscriptionDatabaseUI.mjs`: exercise native payment-visibility contexts and user agents, restore globals after each run, and repeat the exact requested cycle against disposable PostgreSQL.
- `tests/testSubscriptionDatabase.mjs`: run that database/UI flow in web, Android, and iOS contexts.
- `docs/TEST_SUBSCRIPTION_MEDIAN_VERIFICATION.md`: this report.

Other already-modified subscription audit/release documents were preserved. No application source changed, and no commit, push, or deployment was made by this task.

Focused current-main command (set `REACT_TEST_RENDERER_MODULE` to the primary checkout's installed `react-test-renderer/index.js`):

```powershell
node --experimental-strip-types --test --test-concurrency=1 `
  tests/nativeSubscriptionControls.mjs tests/nativeBridgeDiagnostics.mjs `
  tests/membershipLifecycle.test.ts tests/nativePurchaseReadiness.test.ts `
  tests/membershipSelection.test.ts tests/storeSubscriptionNavigation.test.ts `
  tests/nativeAdsMode.test.ts tests/nativeAds.test.ts tests/medianPickerLifecycle.test.ts `
  tests/testSubscriptionDatabase.mjs tests/testSubscription.test.ts

node --experimental-strip-types --test --test-concurrency=1 `
  tests/medianPaywallQa.test.ts tests/medianPaywallLocalSync.test.ts `
  tests/medianIosSourceInspection.test.ts tests/revenuecat.test.ts `
  tests/revenuecatEndpoints.test.ts
```

The initial parallel expanded run hit the existing lifecycle test's short timer while PostgreSQL initialization and native emulation were running. The serial run passed all 128 checks. The isolated-package mounted run initially pointed its renderer environment variable at a missing package-local install; correcting it to the existing primary install passed all 29 mounted checks, in addition to the 91 passing core checks. No application repair was needed for either harness issue. `git diff --check` passed.

Evidence is retained under `tmp/median-native-test-subscriptions/` (sanitized live configuration, installed Android package summary, public delivery summary), `tmp/median-test-subscription-expanded-tests-serial.log`, and `tmp/median-test-subscription-bridge-regression.log`. The additional 41 integration checks use synthetic identities, provider responses, and local source fixtures; they perform no real purchase or live RevenueCat configuration change. Isolated-package test logs are under `tmp/test-subscription-production-release/median-production-native-*.log`. The optional Median screenshot-export action did not produce a downloadable file before its browser wait timed out; no retained screenshot artifact is claimed.

## Remaining acceptance

On the actual installed store apps, select Rookie, Pro, and Team; check the dashboard and Settings; background/resume; fully close/reopen; sign out and back in; and confirm the selected tier persists without checkout. Finish the iOS restart test in a longer device session. Native logout/login, physical-device lifecycle behavior, exhaustive feature workflows, and real store purchases were not exercised in these short cloud sessions. Existing automated tests cover their subscription logic, restrictions, ad eligibility, and normal-user separation. Preserve all current purchase/advertising holds while performing these checks.
