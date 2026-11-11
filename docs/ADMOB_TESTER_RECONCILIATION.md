# Android AdMob tester reconciliation — November 10, 2026

Account: `test@test.com`, verified Auth UUID `4b9864ff-2195-4be0-83a4-39308446577e`.
Scope: reconcile the stale test-account mirror; no additional Stripe integration,
new endpoint, deployment, subscription creation/cancellation or store configuration.

## Authoritative evidence

Read the existing Supabase-linked customer and subscription through the connected
**Apex88 Ventures live Stripe account**. The stored subscription matches that customer,
has status `canceled`, and has provider-confirmed `ended_at` and item period end
`1783366243` (July 6, 2026, 19:30:43 UTC). Listing **all** subscriptions for that customer
returned exactly that canceled subscription, with `has_more=false`. A fresh RevenueCat
lookup returned no subscriptions for this Auth UUID. No active admin/promotional grant
exists. The approved server-side test-tier selection is still `rookie`.

This establishes expiration from Stripe itself, not a guessed interpretation of the
historical Supabase date or a fake client-side tier. The customer's billing email was
not used to authorize AdMob; the existing database customer/subscription linkage and
the exact Auth UUID were checked.

## Reported finding and targeted reconciliation

The canceled subscription and absence of another current grant were reported in chat
before the live mirror correction, as requested. The conditional server-side update
changed only this test UUID's **Supabase subscription mirror** from `trialing` to
`canceled`, with source `stripe` and Stripe's verified period end. It required matching
customer/subscription IDs, the original update timestamp and previous trialing state,
so a concurrently changed record would not have been overwritten.

The existing `onlyfast_project_subscription` trigger projected the same canceled status
into `stripe_status`. The historical `pro` plan was preserved. No local Rookie override,
new entitlement setter or public client writer was added. No Stripe subscription,
payment, renewal setting, Auth grant, test-tier selection, other customer, saved setup
or subscription restriction was changed.

Verified after-state:

- mirrored Stripe status: `canceled`; historical plan: `pro`;
- RevenueCat status: `expired`, with no current subscription;
- saved test selection and authoritative server tier: `rookie`;
- no underlying active paid/admin/promotional exclusion remains;
- native ad membership eligibility can now pass after the app refreshes trusted state.

## Remaining independent advertising gates

The `android-test` account selector is still restricted to the exact Auth UUID above.
Median Android, registered-device authorization, native privacy flow, US region and
safe placement/lifecycle checks remain mandatory. Other Rookies keep house ads;
Pro/Team/admin/promotional accounts remain ad-free. The shared 600-second cooldown and
Setup Assist limits are unchanged. No rewarded ads or extra usage were introduced.

The new login has **no approved signed-session fallback**: the former account's session
was deliberately removed. A matching registered Android advertising ID can still pass.
If Median omits GAID, separately confirm and authorize this account's actual registered
phone session; do not infer device verification from membership or reuse the old login.

Vercel production inspection still shows `VITE_MEDIAN_ADMOB_ENABLED=false` and diagnostics
`false`; mode remains the previously verified `android-test`. No variables were changed.
The current onlyfast.app deployment is READY at commit
`228e4f5c1179af4bf410d492c03c96b86cfe24f4`, which already includes this tester's allowlist.
No web deployment is required merely to refresh the reconciled membership. A later
advertising flag change is build-time and requires an authorized deployment; neither
was performed here. No Median rebuild is needed for this membership correction.

Refresh subscription/reopen the app to obtain current trusted membership. Membership
is ready, but **this is not confirmation of native ad display**. Production advertising
is off and device authorization must pass before a Google Test Ad can be requested.

## Verification and local changes

Added regression checks using the existing actual controller and disposable PostgreSQL
provider projection: an old trial date alone stays blocked, a provider-confirmed canceled
mirror releases the stale paid exclusion, history is retained, and another active customer
remains unchanged. These are code/SQL tests; the live account finding comes from actual
Stripe, RevenueCat and Supabase reads, independently of fixture values.

Files changed in this follow-up: `tests/nativeAds.test.ts`, `tests/revenuecatDatabase.mjs`,
`docs/ADMOB_TEST_ACCOUNT_SUBSCRIPTION_AUDIT.md`, `docs/MEDIAN_ADMOB_ANDROID_ROLLOUT.md`, and
this report. No application feature implementation, flag, schema, price or product ID changed.

Validation: all 65 focused native-ad/mode/membership lifecycle tests passed, plus the
disposable PostgreSQL provider-projection test (1 passed). These checks cover stale
trial blocking, confirmed cancellation, account/device restrictions and the shared
cooldown. No native-device display test was performed. Other concurrent local
membership/UI edits were left untouched; no commit, push or deployment was made.
