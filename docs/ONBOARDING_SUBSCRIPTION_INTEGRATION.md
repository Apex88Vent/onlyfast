# OnlyFast onboarding and subscription integration

Implementation report — October 17, 2026. Local code only; nothing deployed,
published, uploaded, submitted, purchased or restored during this task.

Final actual-app review and release scope: [ONBOARDING_RELEASE_REVIEW.md](ONBOARDING_RELEASE_REVIEW.md).

## What changed

The main application now keeps one membership lifecycle across all routes,
including Upgrade and Settings. It reads authenticated server-owned subscription
rows and verified Auth app metadata through the existing subscription module.
Existing Stripe, promotional, admin and explicitly authorized tester access is
preserved. User-editable metadata and browser storage cannot authorize paid access.

New-user sequence:

1. Existing welcome/tutorial, with **Skip available on its first slide**.
2. Existing supported discipline selection.
3. Existing car/class selection and setup definitions.
4. Rookie / Pro / Teams plan selection.
5. Existing OnlyFast landing page after **Continue Free**.

Skip saves only the transition to discipline selection. Tutorial save requests
cannot overlap. Incomplete or mismatched saved discipline/class drafts cannot
jump to the plan screen. Valid historical class labels remain readable and map
to existing canonical classes. Failed persistence keeps the user on onboarding
with an error. Completed users retain their existing account-scoped/server
completion state and do not repeat onboarding. Replaying help still uses Close
to return to the existing landing page without changing the racing profile.

The existing racing RPCs persist discipline, class, Rookie selection and
completion. Completing onboarding changes no subscription/billing/grant fields.
No database migrations or backend functions were changed or applied.

## Subscription selection and access

`PLANS` and `tierLimits` remain the feature/limit source of truth. Rookie remains
free and ad-supported; Pro keeps one car/class and no ads; Teams keeps unlimited
cars/classes and no ads. Existing plan labels remain $5/$8. The held store plans
describe the seven-day introductory trial as conditional on eligibility at launch;
these labels are not a native checkout price or an eligibility assertion.

Both native and web **onboarding** show Pro and Teams as disabled Coming Soon
buttons. Only Rookie can complete that step. Native upgrades retain the hold.
The existing **web upgrade page** explicitly retains its Stripe checkout path,
as required to preserve web billing. No Stripe checkout component, price/button
ID, portal endpoint or billing implementation was changed.

The native subscription UI displays the current server-confirmed plan and native
access expiration when available. It preserves existing membership and exposes
the correct Apple/Google management link using the stored provider. Refresh works
for existing RevenueCat subscribers even while purchasing is held. Stripe/free/
promotion-only accounts do not invoke native billing or RevenueCat synchronization
on resume. The legacy `team` spelling is recognized consistently with `teams`.

Membership refresh runs at sign-in, account changes, return to the visible app,
focus, network recovery, subscription updates and native/promo expiration. It
coalesces concurrent refresh requests, clears access on account changes, rejects
late initial-session responses, cleans up listeners/timers, and keeps expiry
effective even when the next network refresh fails. Settings ignores delayed
subscription responses for another account. The server's class allowance refreshes
with membership without resetting the active vehicle or reopening onboarding.
No timer or event initiates a purchase
or restore. A native success result never grants access; the existing
`sync-revenuecat-subscription` handler and server-owned records remain authoritative.

Pending payment is a non-success state with an instruction to await store approval
and refresh, without purchasing again. Cancellation and failed/offline requests
cannot unlock content. Restore remains an explicit, prepared user action behind
the readiness hold; it is disabled and explained as unavailable in this build.

## Android release work that remains

The earlier real sandbox Pro purchase **did succeed** with Median plugin 1.3.0
and RevenueCat Android SDK 10.3.0. Its evidence remains in the sibling Android
`diagnostics/` directory. It does not establish release-binary readiness.

Source inspected:

- `android/app/src/debug/java/co/median/android/LocalCatalogApplication.kt`.
- `android/app/src/debug/AndroidManifest.xml`.
- `android/diagnostics/catalog-debug.init.gradle` and single-Play-test helpers.
- Existing frontend Median bridge/controller and named-catalog diagnostic code.
- [Median's actual JavaScript bridge implementation](https://github.com/gonativeio/median-javascript-bridge/blob/master/src/plugins/revenueCat.ts).

The debug application registers `window.onlyFastCatalog` only for the main frame
at `http://127.0.0.1:8086/native-subscription-test`. It requires a synthetic local
tester, verifies local Auth/feature flags, checks the non-anonymous SDK UUID, reads
`offerings.getOffering("onlyfast_monthly_v1")`, and serializes actual packages,
products, prices and offer phases. Its purchase action is intentionally one-shot,
Pro-only, emulator-only and tied to a local operator permit. These debug source
sets, manifest override and Gradle init scripts are **not automatically included
in Median production cloud builds**.

The standard Median `getOfferings()` has no offering argument and returns the
current offering's package identifiers. `presentPaywall()` has no named-offering
argument. Neither is a valid replacement for the named catalog integration. The
current frontend's legacy generic-paywall scaffold remains unreachable because
`NATIVE_PURCHASES_READY=false`; it must not be enabled as the release solution.

Before an Android release:

1. Choose a controlled source-build/custom native plugin pipeline that will
   actually package the extension. If using Median cloud builds, establish how
   the custom extension is included and verify the resulting binary. This needs
   an owner/build decision, not a guessed bridge call.
2. Adapt the native reader into that supported release integration while
   preserving Median's Application/plugin lifecycle. Replace localhost/debug/
   emulator guards with an exact approved HTTPS app-origin/main-frame allowlist,
   configured backend validation and authenticated UUID/identity checks. Do not
   merely remove the existing guards or copy the synthetic tester permit into
   production. Never accept arbitrary backend URLs or SDK identities from a page.
3. Define and version the native capability/response contract, with request IDs,
   platform, identity, catalog, pending/cancel/error and restore outcomes. Detect
   absent/incompatible binaries and show unavailable. Add packaging/minification
   checks so required bridge classes survive release builds.
4. Reuse the existing native SDK's named-offering lookup. Return actual localized
   prices/currencies/periods/eligible offer phases for `pro:pro` and `teams:teams`.
   Select the exact returned package/offer; do not infer trial eligibility or send
   unsupported arguments to `median.revenueCat`.
5. Replace the frontend generic-paywall purchase branch with the verified named
   catalog adapter. Both Pro and Teams need explicit selection. Keep the current
   offering unchanged and do not require a published RevenueCat paywall.
6. Generalize the one-Pro test action into a guarded, one-request-at-a-time
   native purchase implementation. Keep the existing public hold until approved.
   Handle SDK UUID verification, login/logout/account switching, deferred
   payments, cancellation, offline/error cases and late callbacks. Connect native
   customer-info notifications without replacing Median's existing listeners.
7. Verify explicit restore and ownership/transfer behavior, then synchronize
   through the existing Edge Function and refresh trusted membership. No access
   can be granted by a local flag or native callback alone.
8. Test the resulting signed Android testing binary through the intended Play
   distribution path, including Pro, Teams, pending/cancel, restore, expiry and
   renewal against isolated sandbox records. No binary was built/released here.

## iOS work that remains

The shared React UI and existing Median iPhone/iPad/desktop-mode iPad detection
have regression coverage. The same plan/status/unavailable views are prepared.
No React Native or Capacitor dependency was added. This task does **not** claim
functioning StoreKit purchases.

A controlled iOS Median source/plugin build must implement the equivalent
versioned named-offering bridge using the RevenueCat iOS SDK. It needs the iOS
public SDK key, exact approved origins, verified Supabase UUID identity,
localized StoreKit products `app.onlyfast.pro.monthly` and
`app.onlyfast.teams.monthly`, eligibility-aware terms, exact package purchase,
explicit restore, cancellation/pending/error handling and server synchronization.
The Android debug extension cannot be copied into a cloud iOS binary implicitly.

An actual TestFlight test remains mandatory, including restoration and account
switching. Plan a secure path from that dedicated test build to the isolated
local sandbox backend; a physical iPhone cannot use Android ADB reverse or assume
that 127.0.0.1 reaches this PC. Production `REVENUECAT_ALLOW_SANDBOX=false` stays
unchanged. Do not direct sandbox access into production subscriber records.
No Apple products were submitted for review and no TestFlight build was uploaded.

## Before enabling public native purchases

- Complete the Android/iOS release bridge integration and binary verification.
- Run genuine device/store tests for both plans, restoration, cancellation,
  pending billing, renewal/expiration and account switching with isolated records.
- Check actual localized store terms, eligibility and provider management routes.
- Verify existing Stripe/promotional/tester access with the final binaries.
- Review the existing entitlement/webhook configuration without changing the
  current offering as a workaround. No new schema/webhook rebuild is proposed.
- Review the remaining repository lint debt and approve deployment/store rollout
  separately. Change the readiness hold only after the above is verified and
  public enablement is explicitly authorized.

Reference contracts:
[RevenueCat product display](https://www.revenuecat.com/docs/getting-started/displaying-products),
[explicit restore and ownership behavior](https://www.revenuecat.com/docs/getting-started/restoring-purchases).

## Validation and limits

- `npm test`: **374 passed**, zero failures.
- Existing `.mjs` regression/integration suites with external QA React renderer
  and PGlite: **62 passed, zero failures, one skipped**. Includes fresh staging
  rebuild, actual SQL authorization, both providers, duplicate/out-of-order events,
  onboarding persistence, setup history and mounted native controls.
- The skipped suite is the Docker-based local Supabase end-to-end test. Local
  ports 54321/8086 were not running during this implementation; no Docker reset,
  purchase rerun or production connection was attempted. PGlite's platform/cron
  test doubles do not establish real Docker/pg_cron runtime health.
- Production, native-sandbox and development Vite builds: passed. Development
  output is isolated under `tmp/onboarding-development-build`. Bundle-size
  warnings remain; no unrelated code-splitting refactor was made.
- TypeScript application check: passed.
- Focused lint: zero errors (existing AppContext Fast Refresh warning).
- Full repository lint: **not clean** — 419 errors and 93 warnings, including
  duplicate root/source files and existing `any`/escape issues. Comparison to
  HEAD found no increased lint-error counts in changed tracked source files;
  existing Settings (10) and subscription module (3) errors remain unchanged.
- `git diff --check`: passed.
- Browser visual fixture using the actual tutorial/selection/landing components
  at phone and desktop widths: Skip → discipline → class → plans → free landing
  passed; both paid buttons disabled; no horizontal overflow. Fixture made no
  customer/store/database requests. Real persistence was checked separately in
  mounted/database integration suites. This is not an actual iOS device test.

Evidence:
[desktop plans](release-review-plans-desktop.png),
[mobile plans](release-review-plans-mobile.png),
[mobile welcome with Skip](release-review-welcome-mobile.png).
These screenshots were updated during the actual-app release review linked above.

Logs are in `tmp/onboarding-subscription-*.log`. No production settings, secrets,
subscriptions, schedules, setup sheets, saved setups, session records, timing
uploads, or Setup Assist implementation were changed. No push or deployment.
