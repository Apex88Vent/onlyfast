# OnlyFast — RevenueCat pre-build report

Date: October 15, 2026. Changes are local and uncommitted. Nothing was deployed, published, activated, or changed in RevenueCat, Vercel, Apple, or Google. No live database migrations were executed. Existing workspace work was preserved.

## A. Files modified by this update

Paths below are relative to the repository. Files that already contained work retain those changes.

| Area | Files |
| --- | --- |
| Shared plan screen | `src/components/PlanSelection.tsx`, **new** `MembershipComparison.tsx`, **new** `MembershipPaidAction.tsx`, `src/pages/Upgrade.tsx` |
| Account/native controls | `src/components/NativeSubscriptionControls.tsx`, `SettingsModal.tsx`, `Header.tsx` |
| Onboarding wiring | `src/components/OnboardingFlow.tsx`, `AppLayout.tsx` |
| Existing restriction messages | **new** `src/components/LockedFeatureNotice.tsx`, `CreateBaseSetupView.tsx`, `HandlingFeedback.tsx`, `SetupDashboard.tsx`, `ShareSetupModal.tsx`, `ViewSharedSetupModal.tsx`, `SavedSetups.tsx`, `ClassChangeModal.tsx` |
| Membership authorization | `src/lib/membership.ts`, `subscription.ts`, **new** `trustedMembership.ts`, **new** `src/hooks/useMembershipRevision.ts`, `src/contexts/AppContext.tsx` |
| Bridge | `src/lib/nativePurchaseController.ts`, `nativePurchases.ts` |
| Server authorization/configuration | `supabase/functions/_shared/revenuecat.ts`, `supabase/functions/get-suggestions/index.ts`, `supabase/functions/scan-timing-screen/index.ts` |
| Pending SQL | **new** `supabase/migrations/20261015235847_secure_membership_authorization.sql`; removed unsafe metadata-to-permission backfill from the already pending `202610130001_restore_racing_onboarding.sql` |
| Tests | **new** `tests/membershipAuthorization.test.ts`, `membershipSelection.test.ts`, `subscriptionServerAuthorization.test.ts`; updated `revenuecat.test.ts`, `iosSubscriptionUI.test.ts`, `subscriptionAccountSwitch.test.ts`, `medianPickerLifecycle.test.ts`, `onboardingNavigation.mjs`, `racingOnboardingDatabase.mjs` |
| Documentation/evidence | `docs/REVENUECAT_SETUP.md`, this report, `docs/membership-desktop.png`, `docs/membership-mobile.png` |

No packages were added to the app. `package.json` and its lockfile are unchanged. A one-line ES2020-compatible string replacement was needed in the already edited HandlingFeedback component for TypeScript checks to pass.

## B. Membership screen behavior

The existing PlanSelection component now serves onboarding and `/pricing`, `/upgrade`, and `/checkout` through Upgrade. The old iOS-only status return is removed. All platforms show the requested heading/subtitle, existing logo, Rookie/Pro/Teams cards, reference prices, Free Forever badge, and Most Popular emphasis on Pro.

Continue Free never invokes a payment provider. During onboarding, the existing server completion RPC saves `onboarding_plan='rookie'`, preserves billing fields, and continues into the app. On the upgrade page, Rookie saves an account-bound preference and navigates home. It does not overwrite an active subscription, promotion, or administrator grant. A failed optional preference write does not make free access depend on payment. Required unfinished account setup still runs when navigating home.

Native Pro/Teams display Coming Soon while `VITE_REVENUECAT_ENABLED` is absent. Native purchase/restore execution has a controller-level guard in addition to UI checks. The flag and SDK keys were not set or changed.

Web Choose Pro/Teams retains the existing Stripe Buy Buttons and UUID reference. Only the selected plan's checkout is mounted, and eligibility is rechecked against trusted account data before it appears. Existing paid members are directed to provider management instead of another purchase. This reduces accidental duplication within the app; Stripe Payment Links and the store/provider still need real-account acceptance testing, including concurrent sessions.

## C. Feature comparison and discrepancies

The comparison reads `tierLimits`; no enforcement limits were changed. Desktop uses aligned columns. Phones show each feature above three labeled plan values, with accessible Included/Locked text and check/lock icons. At 390px, the document had no horizontal overflow.

The existing Rookie configuration matches the requested numeric limits: one car/class, one base setup, two race weekend saves, 48-hour edit lock, two timing uploads monthly, and one Setup Assist per race weekend. Pro has the requested unlimited individual-racer features. Teams retains unlimited cars/classes.

Discrepancies identified:

- The old plan synopsis advertised **two Setup Assists per month**. Enforcement and tierLimits actually use **one per race weekend**. Only the copy was corrected.
- Existing vehicle onboarding/change work permits Rookie/Pro to change their one active vehicle/discipline under the existing 30-day rules. Therefore the comparison says **multiple disciplines at once**, rather than claiming Rookie/Pro can never change disciplines. That enforcement was preserved.
- Motorcycle/RC and other upcoming classes remain unavailable under existing feature availability rules; Teams does not unlock unimplemented disciplines.
- The live database has not received the pending onboarding restoration, so deployed behavior cannot be equated with this local preview.

## D. Locked features

Existing save-limit, Setup Assist, edit-lock, and class notices are reused. An inline LockedFeatureNotice adds View Plans and Not Now at the existing restriction point. PDF export now explains that Pro/Teams unlock exports rather than showing a bare browser alert. Teams-only class prompts are accessible on iOS as well. No popup was added to unrelated actions, and reaching a limit never deletes racing data.

## E. Onboarding routing

The existing tutorial → discipline → vehicle/class → membership → landing sequence is preserved. Onboarding supplies its authenticated UUID to the shared chooser. Native purchase confirmation can complete onboarding only after server-confirmed access; Rookie remains the free exit when purchasing is unavailable.

The existing server progress/resume RPCs, tutorial skip behavior, returning-user bypass, and account-switch guards were retained. Mounted tests cover required steps, retrying a failed completion, restored plan-step state after remount, and returning users entering the landing page.

## F. RevenueCat integration status

Reused configure/isInitialized, login/logout, getOfferings, presentPaywall, restorePurchases, cancellation handling, serialized identity changes, server synchronization, and focus/visibility resume synchronization. Supabase UUID remains appUserID. Platform key detection now also handles desktop-mode iPads.

The existing HTTP handlers verify the authenticated caller or webhook secret, fetch authoritative RevenueCat subscriber state, and apply a service-only transaction. Local mapping tests cover renewals/active periods, expirations, refunds, restore, grace, sandbox filtering, transfers, cancellation, and rejected bridge responses. A cancelled auto-renewal keeps access until expiry. Teams wins over Pro; both active entitlement IDs are retained in the stored snapshot.

Default server entitlement identifiers now match **OnlyFast Pro** and **OnlyFast Teams**. Runtime secrets can still override defaults, so existing deployed values must be checked before future activation.

**Bridge limitation:** the official bridge types expose identifiers but no current-offering identity, offering selector, or package-selector argument to presentPaywall. Both paid buttons therefore use the same supported paywall. The app cannot prove that `onlyfast_monthly_v1` is current. Do not enable the flag until an operator has activated and verified that offering and its published paywall; the old current offering must not be used for launch. Nothing was changed in the dashboard.

Verified API references: [Median documentation](https://docs.median.co/docs/revenue-cat), [official bridge implementation](https://github.com/gonativeio/median-javascript-bridge/blob/master/src/plugins/revenueCat.ts), [official bridge types](https://github.com/gonativeio/median-javascript-bridge/blob/master/src/types/revenueCat.ts).

## G. Supabase integration and security

Read-only checks were made against the connected OnlyFast project `thpyjvwtfvfxiufchrxn`:

- June RevenueCat metadata columns exist.
- September provider-projection/event/expiration migrations are **not applied**. No RevenueCat webhook-events table or sync/expiry RPCs were found.
- October onboarding/road-racing migrations are also **not applied**.
- `sync-revenuecat-subscription` and `revenuecat-webhook` are **not deployed**. Existing Stripe webhook and billing-portal functions are active; their deployed implementations were not changed.
- Subscription RLS has an own-user SELECT policy.
- The deployed `onlyfast_subscription_tier` still trusts `raw_user_meta_data` administrator and promo claims. **Production retains this vulnerability until the reviewed authorization migration is applied.**

Local authorization now ignores browser membership storage and user_metadata. It uses authenticated subscription reads and verified `auth.getUser().app_metadata`, keeps permissions in memory, clears them on identity changes, recomputes expiration, and refreshes existing feature gates. The existing server-backed experimental tester access remains in place. Stripe subscriptions are not downgraded for lacking RevenueCat access. Approved server-side promotions/admin grants retain their privileges.

The pending SQL replaces metadata-based tier authorization, aligns class RLS, adds an own-account membership read RPC, and revokes client subscription writes. The pending onboarding migration no longer promotes arbitrary legacy claims to permanent server-owned grants. Server Setup Assist and timing-scan authorization similarly ignores user_metadata and checks native expiration.

**Preserving legacy grants:** never automatically copy editable claims into app_metadata. An aggregate read found **0 legacy admin/promo-claim accounts and 0 app_metadata grant accounts** at audit time. No accounts were modified. Recheck against independent business records before rollout, and move any legitimate legacy grant to server-owned app_metadata with its original scope/expiry. Existing Stripe promotions and server tester flags are separate and preserved. If legitimate grants are discovered, complete that review before releasing this client, or those unverified claims will no longer authorize paid access.

Authorization reference: [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

## H. Test results

- `npm test`: **350 passed**, 0 failed.
- Isolated mounted onboarding + PostgreSQL suites: **38 passed**, 0 failed. These apply SQL only to an in-memory PGlite database, not connected Supabase.
- `npx tsc -p tsconfig.app.json --noEmit`: passed.
- `npx tsc -p tsconfig.node.json --noEmit`: passed.
- Production Vite build: passed; existing large-chunk warning remains.
- Focused ESLint on new membership components, native controls/controller, new hook and trust resolver: passed.
- Browser: actual shared components rendered in the existing local-only preview at desktop and 390px phone widths. Rookie enabled, native paid actions disabled, all comparison rows present, no overflow, no console errors. Free continuation opened the app's required account setup without a payment surface.

Logs are in ignored `tmp/membership-test-results.log`, `tmp/membership-integration.log`, and `tmp/membership-build.log`. Physical Android/iOS purchase, restore, store-management, account transfer, and app-resume tests remain pending. No sandbox or production payment was attempted.

## I. Outstanding store and RevenueCat actions — pending

Do not perform these as part of this pre-build task:

1. Verify existing Apple/Google identifiers, signing, products/base plans, availability, prices, credentials, and notification configuration with the respective store owners. Actual store state was not inspected or altered.
2. Verify Pro maps to `$rc_monthly` and Teams to `$rc_custom_teams_monthly` within `onlyfast_monthly_v1`; verify Teams grants both entitlements.
3. Review and publish the draft single paywall, make the intended offering current, and verify the real-device result **only in a separately authorized rollout**.
4. Configure server-only RevenueCat API secret, webhook authorization, app allowlist, correct entitlement environment values, and isolated sandbox policy.
5. Review and apply the existing September migrations and pending October dependencies in a controlled rollout, including `20261015235847_secure_membership_authorization.sql`; verify grants/advisors and the expiration cron job. Deploy the sync/webhook and reviewed authorization function updates. No deployment is authorized here.
6. Perform full real-device sandbox acceptance, including two-account switching, restore, cancelled purchases, renewal/expiry/refund, and existing Stripe/promo/admin access. Only then explicitly authorize setting `VITE_REVENUECAT_ENABLED=true` and rebuilding the web bundle.

## J. Required Median configuration

Keep the RevenueCat native plugin enabled in the new Android/iOS wrapper. Keep the same Google package/Apple bundle identity, signing, app URLs, and Supabase account identity. Verify the emitted build includes configure, isInitialized, login, logout, getOfferings, presentPaywall, and restorePurchases. Runtime initialization uses the existing public platform environment keys; no React Native package or plugin API was added.

Use the normal Median/GoNative user-agent evidence (or existing nativeApp setting) so native screens hide Stripe. Rebuilding the wrapper alone will not release these hosted frontend changes. The local website preview is not a substitute for a physical plugin-enabled build test.

## K. Android AAB readiness

**Ready at the application-code level for a plugin-enabled, purchases-disabled test build. Not ready for a paid release.**

Keep the flag unset and verify Rookie onboarding in the generated wrapper. To exercise these new screens against the real backend, the reviewed onboarding/authorization dependencies and hosted frontend must first be released under a separately authorized deployment. The live backend currently lacks those dependencies. A wrapper rebuilt against the unchanged production URL will continue loading the existing production website.

This task intentionally stops before deployment, migration execution, dashboard/paywall publication, offering activation, or enabling purchases.

## Preview evidence

[Desktop](membership-desktop.png) · [Phone](membership-mobile.png). Screenshots use a browser-local test account and no live payments.
