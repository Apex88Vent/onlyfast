# AdMob tester and subscription lifecycle audit — November 10, 2026

Primary main checkout; starting commit `d9aabc80`. Live investigation was read-only.
No subscription, Auth grant, test-tier selection, customer purchase, RevenueCat setting,
production flag, price, product ID, saved setup or native package was modified.
No commit, push, function deployment, database migration or Vercel deployment was made.

## Verified account state

| Account | Auth UUID | Authoritative findings |
| --- | --- | --- |
| `rookie@test.com` | `58a1db2f-8d4d-412e-afe5-abadf57f6ae1` | Supabase Team/active, RevenueCat source, Apple App Store. One Apple sandbox subscription grants both OnlyFast Teams and OnlyFast Pro. RevenueCat `gives_access=true`, auto-renewal `will_not_renew`, expires November 11 04:17:03 UTC (November 10, 8:17:03 PM PST). No tester role, test-tier override, admin or promotional grant. |
| `test@test.com` | `4b9864ff-2195-4be0-83a4-39308446577e` | Existing experimental tester, explicit full-access testing feature, saved server test tier `rookie`; private authoritative membership resolver returns Rookie. No active RevenueCat entitlements or subscriptions, no admin/promotional grants. Underlying Stripe projection remains Pro/trialing with stored period end July 6, 2026, and existing Stripe customer/subscription references. |

The old account is not stuck because of a local cache or a test override. It has a
still-valid store entitlement. A RevenueCat TRANSFER was processed for the account on
November 4; renewals and a cancellation were subsequently synchronized. The latest
cancellation event was processed November 10 at 04:23:59 UTC. Supabase expiration and
entitlement identifiers agree with RevenueCat. Team granting Pro as well is expected
product mapping, not two separate subscriptions. Canceling renewal does not erase its
paid-through entitlement. The original store is Apple even when this account is used
on Android. Manage its sandbox subscription using the original Apple sandbox account.

The new tester has a genuine **server-authorized simulated Rookie tier**, not a
client/email override. It also has a conflicting underlying Stripe record. A historical
period end does not prove that Stripe currently considers it expired: a renewal may
have occurred without a mirrored update. The currently available connections do not
include authenticated Stripe access. A Stripe integration is available but has not
been connected. The exact current Stripe state must be read before reconciling the
mirror through verified provider events. No forced-free database edit was performed.

RevenueCat customer records:
[former tester](https://app.revenuecat.com/projects/79983fe3/customers/58a1db2f-8d4d-412e-afe5-abadf57f6ae1),
[new tester](https://app.revenuecat.com/projects/79983fe3/customers/4b9864ff-2195-4be0-83a4-39308446577e).

## Local corrections

1. The single controlled AdMob Auth UUID now selects `test@test.com`. The old UUID
   is explicitly covered as rejected in regression tests. There is no email-based
   authorization. Trusted underlying paid/admin/promotional exclusions remain intact,
   including when the account has selected a simulated Rookie tier.
2. The former account's confirmed phone-session digest was removed from the active
   controller. The registered Android advertising-ID hash remains. If Median omits
   GAID, the new test login needs independent confirmation on the registered phone;
   the old session cannot be silently reused. No unknown device is authorized.
3. Store management now follows the subscription's recorded purchase store. An Apple
   subscription on Android opens Apple management; a Google subscription on iOS opens
   Google management. A known store can also be opened from web Settings. With no
   recorded store, the native platform remains the fallback; unknown providers are
   not guessed. Stripe memberships are directed to OnlyFast browser Settings and the
   existing authenticated Stripe portal. No new checkout or client entitlement writer.
4. Subscription controls explain paid-through access after cancellation and that paid
   plan changes use the provider's effective date. The app does not immediately turn
   a legitimate canceled-but-unexpired subscription into Rookie.
5. The local Stripe webhook now fetches current subscription state for signed
   subscription-change notifications, so an old event body is not directly written
   over newer provider state. A delayed invoice failure likewise cannot force
   `past_due` when the fetched subscription is active. Unavailable/malformed provider
   state fails without updating the mirror.
6. Stripe billing periods are persisted for checkout and subscription/invoice updates,
   supporting modern item-level and legacy top-level `current_period_end`. The deployed
   Stripe function is an older version (13) different from the repository source; it
   reads only top-level billing periods and must not be assumed patched by a web deploy.

## Ordinary customers and synchronization

Cancellation retaining access until expiration is normal for real customers too. The
cross-device store-routing defect can affect ordinary customers. The Stripe source
had period-persistence and delayed-event weaknesses; a stale active/trialing server
mirror can also persist when provider notifications are missing. The tester's mirror
needs authoritative Stripe inspection; this audit does not claim all Stripe customers
are stuck or automatically repair already inconsistent records.

RevenueCat's production webhook targets the correct existing Supabase project. Live
provider snapshots, event deduplication/observation ordering, a one-minute native
expiration cron, and fresh owner-authorized membership reads are present. Local
membership timers recompute native expiration even while offline; login/account switches
clear identity-specific trusted evidence. Explicit test-tier RPCs are server-restricted
to approved experimental accounts and never update billing rows. Public users cannot
select test entitlements. Saved setups are not deleted by subscription expiration.

Android changes/cancellation belong in the original Google Play subscription account;
iOS changes/cancellation belong in the original Apple subscription account; Stripe
changes/cancellation belong in the secure web billing portal. Team to Rookie is a
cancellation followed by confirmed entitlement expiration, unless another valid grant
remains. Team to Pro follows the store/portal's scheduled product change, not a local
tier assignment. Apple group/ranking, Google cross-product replacement support in the
installed Median paywall/SDK, and Stripe portal product-change availability were not
verified by a real purchase in this pass. Do not claim those native purchase flows were
tested or change their products/configuration without separate review.

## AdMob readiness and production configuration

Native ads still require the exact authorized UUID, current trusted Rookie access,
underlying non-paid/non-exempt membership, Median Android, current device authorization,
US region, the existing native privacy flow, and safe placement/lifecycle state.
All other Rookie accounts retain house ads. Paid, Team, admin and promotional users
remain excluded. The shared 600-second interstitial attempt cooldown and Setup Assist
usage limits are unchanged; no rewarded ads were introduced.

**The Android test cannot proceed safely yet.** Resolve the Stripe mirror using actual
provider confirmation first, then confirm the new login's physical test-device status.
Do not bypass the underlying paid check or transfer the old session authorization.
No new native build is needed merely for the Auth UUID change.

Read-only Vercel inspection found mode `android-test`, diagnostics `false`, and the
master advertising flag **`false`**, contrary to the requested description of `true`.
All were left unchanged; the master was not enabled while the conflict remains.
No AdMob IDs or app-ads.txt files changed. Automatic main deployment is currently
enabled in this repository; therefore even a push would violate this task's no-deploy
constraint. Nothing was pushed.

## Schema, external steps and validation

No new database migration is required for these local fixes: the needed provider
columns, owner/test-tier functions and native expiration cron already exist in live
Supabase. Provider reconciliation requires a verified Stripe read, followed by the
existing signed webhook/server path after review. No RevenueCat settings change is
required to remove the old account's still-valid access; let cancellation/expiration
take effect normally. The new account has no RevenueCat subscription to cancel.

Validation: 561 automated tests passed, including the new signed Stripe handler and
cross-store routing regressions; 36 mounted ad/subscription UI tests passed. Three
disposable PGlite/PostgreSQL suites passed, exercising actual SQL provider projection,
Rookie/Pro/Team transitions, renewal/expiration, grants, RLS/owner checks, and authorized
test-tier selection without writing billing rows. TypeScript app/node checks and the
production web build passed. These tests do not establish a real store transaction or
physical native ad display. A later release needs both the reviewed web changes and
the reviewed Stripe Edge Function deployment; web deployment alone does not deploy it.

Changed files: `src/lib/nativeAds.ts`, `src/lib/nativeEnvironment.ts`,
`src/components/NativeSubscriptionControls.tsx`, `src/components/SettingsModal.tsx`,
`supabase/functions/stripe-webhook/index.ts`, `tests/nativeAds.test.ts`,
`tests/nativeAdSettings.mjs`, `tests/nativeSubscriptionControls.mjs`,
`tests/storeSubscriptionNavigation.test.ts`, `tests/revenuecatDatabase.mjs`,
`tests/stripeSubscriptionLifecycle.test.ts`, `docs/MEDIAN_ADMOB_ANDROID_ROLLOUT.md`,
and this report.

Sources: [RevenueCat subscription changes](https://www.revenuecat.com/docs/subscription-guidance/managing-subscriptions),
[Apple sandbox testing](https://www.revenuecat.com/docs/test-and-launch/sandbox/apple-app-store),
[Stripe cancellation](https://docs.stripe.com/billing/subscriptions/cancel),
[Stripe item-level billing periods](https://docs.stripe.com/changelog/basil/2025-03-31/deprecate-subscription-current-period-start-and-end).
