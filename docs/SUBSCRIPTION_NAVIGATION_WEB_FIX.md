# Subscription navigation web fix — November 10, 2026

Android management previously used `user_subscriptions.revenuecat_store` to choose
the destination. `rookie@test.com` has an active Apple sandbox Teams subscription
and was last seen on Android. That record incorrectly selected Apple management.
No customer, entitlement, subscription, restore, transfer, or purchase was changed.

Management now follows the current user agent: Android opens Google Play, iOS
opens Apple, and an unidentified device shows guidance without an Apple fallback.
An account whose recorded purchase is in the other store gets an explanation;
changing that purchase still requires its original store account.

The old plan cards explicitly rendered `Store pricing`; native onboarding also
showed reference USD prices. Median's stock bridge only exposes package identifiers
through `getOfferings()`, without localized prices or a read-only paywall mode:

- [Median bridge contract](https://github.com/gonativeio/median-javascript-bridge/blob/main/src/types/revenueCat.ts)
- [Median bridge methods](https://github.com/gonativeio/median-javascript-bridge/blob/main/src/plugins/revenueCat.ts)

The owner selected a web-only release, with actual prices in the native paywall.
Both paid cards now delegate to their accessible action. Unpaid accounts load the
selected package, can retry failed loading, then open the existing full Pro/Teams
paywall. The bridge cannot preselect a package. Existing paid store subscribers
receive device-store management instead of another purchasable paywall, preserving
duplicate-purchase protection. Stripe-paid accounts retain the existing provider
guidance. Restore and server-confirmed access remain unchanged.

`onlyfast_monthly_v1` is current and retains both platform products for both plans.
No offering, paywall style, rollout variable, advertising setting, backend function,
database schema, or native app build was changed.

## Verification and release scope

- Main checkout: 558 automated tests and 75 mounted UI checks passed; TypeScript,
  lint for changed files, and the release-output check passed.
- Production source package: 34 focused checks, TypeScript and release-output
  verification passed. Native product loading/checkout is mocked in these tests.
- Physical Android/iOS store UI, localized prices, transaction/restore callbacks,
  and actual store subscription changes require device testing. No charge or
  live Stripe checkout was initiated.
- Release baseline: the previously deployed commit
  `62c48ffdbd53543a7022fdde2d48423e2d2d7ef9`, with only these five source changes:
  `MembershipPaidAction.tsx`, `NativeSubscriptionControls.tsx`, `PlanSelection.tsx`,
  `useNativeSubscription.ts`, and `nativeEnvironment.ts`.
- Other unpublished main work, including test-account changes requiring an
  unapplied production database migration, is excluded. It remains in main.
  The deployment package and provenance are preserved under
  `tmp/subscription-navigation-release/`; this is an artifact, not another Git
  checkout, branch, or worktree.
- Deployment: `dpl_2tY9W51pm7uMTXhf9G3ZdK15NJAt`, production project `onlyfast`
  (`prj_yPHsgwfcKm4LfEmpzkop9XwHVRmR`), **READY**, with `onlyfast.app` and
  `www.onlyfast.app` assigned. Remote build took approximately 82 seconds.

## Android checks

1. Fully reopen OnlyFast and confirm Manage store subscription opens Google Play.
   An Apple sandbox subscription will not appear in Google Play; the explanatory
   message should identify that difference without changing OnlyFast access.
2. With an unpaid account, open Plans, tap both Pro and Teams, verify the genuine
   native paywall, Google Play localized prices and monthly terms, then cancel.
3. With an existing paid account, confirm the plan actions open management and
   access remains unchanged. Restore only with the original OnlyFast/store account.
4. Repeat management/paywall checks on iOS; confirm ordinary web checkout still
   offers the existing Stripe plans.
