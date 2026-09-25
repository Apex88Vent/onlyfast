# OnlyFast subscription audit — 2026-09-24

Completed before implementation. This describes repository evidence, not a verified
snapshot of the deployed Supabase database or the Median dashboard.

## Current architecture

- Root `src` is the application built by `vite.config.ts`. `supabase/src` and
  `supabase/docs` contain older copies and are not the Vite entry point.
- Web purchasing is an embedded Stripe Buy Button, not a local checkout Edge
  Function. `src/lib/membership.ts` defines the publishable key and Pro/Teams Buy
  Button IDs. `src/components/StripeBuyButton.tsx` loads Stripe's script and passes
  the authenticated Supabase UUID as `client-reference-id`.
- `/pricing`, `/upgrade`, and `/checkout` lead to `src/pages/Upgrade.tsx`.
  `src/pages/SubscriptionSuccess.tsx` polls the database after checkout.
- `src/lib/paymentVisibility.ts` computes a module-level flag from
  `VITE_HIDE_EXTERNAL_PAYMENTS=true`, or `nativeApp=true` in the query string,
  persisted as `onlyfast_hide_external_payments` in localStorage. The query is
  removed from the URL. `nativeApp=false` clears the storage flag. There is no
  Median SDK, Capacitor integration, platform-specific key selection, or native
  purchase bridge in the existing subscription implementation.
- Native users see the same plan cards (including hardcoded web prices/trial),
  with an unavailable/support message instead of purchasing. Settings replaces
  billing controls with the same message; its billing handler also guards native
  calls. StripeBuyButton guards both script loading and element creation.
- Both environments read `public.user_subscriptions`. Active/trialing Pro/Teams
  records grant paid access even without a native purchase.
- `src/lib/subscription.ts` resolves account status and mirrors it into the
  existing membership state. Internal database values are `free/pro/teams`;
  membership values are `rookie/pro/team`. Preserve this mapping.
- `src/contexts/AppContext.tsx` syncs on mount, sign-in, token refresh, and the
  `subscription-updated` event. `src/lib/membership.ts` stores UI membership in
  localStorage and Supabase user metadata, preserving admin/promo exceptions.
- Database function `onlyfast_subscription_tier`, setup-class policies, and the
  `get-suggestions` / `scan-timing-screen` functions also inspect plan/status.
  These existing consumers should not be rewritten to query RevenueCat.
- Supabase Auth (`src/lib/supabase.ts`, `src/components/AuthModal.tsx`,
  `src/components/AppLayout.tsx`) provides the stable `auth.users.id` UUID. The
  standard Supabase client handles session storage and refresh.

## Relevant files and UI entry points

| Responsibility | Files |
| --- | --- |
| Native payment detection | `src/lib/paymentVisibility.ts` |
| Plans, membership, Stripe IDs | `src/lib/membership.ts` |
| Plan onboarding | `src/components/PlanSelection.tsx` |
| Purchase page/routes | `src/pages/Upgrade.tsx`, `src/App.tsx` |
| Stripe purchase element | `src/components/StripeBuyButton.tsx` |
| Subscription/account display | `src/lib/subscription.ts`, `src/components/Header.tsx` |
| Membership synchronization | `src/contexts/AppContext.tsx` |
| Billing/account management | `src/components/SettingsModal.tsx` |
| Upgrade advertising entry | `src/components/RookieHouseAdContent.tsx` |
| Purchase confirmation | `src/pages/SubscriptionSuccess.tsx` |
| Supabase client/auth | `src/lib/supabase.ts`, `src/components/AuthModal.tsx`, `src/components/AppLayout.tsx` |
| Stripe events | `supabase/functions/stripe-webhook/index.ts` |
| Stripe portal | `supabase/functions/create-billing-portal-session/index.ts` |
| Portal documentation copy | `docs/edge-functions/create-billing-portal-session.ts` |
| Base subscription schema/RLS | `SUBSCRIPTIONS_RLS.sql` |
| Provider groundwork | `supabase/migrations/20260630_prepare_user_subscriptions_for_revenuecat.sql` |
| Server feature access | `supabase/migrations/20260720_enforce_active_race_class.sql`, latest override in `20260728_add_account_beta_feature_flags.sql`; `supabase/functions/get-suggestions/index.ts`, `supabase/functions/scan-timing-screen/index.ts` |

## Database evidence

`public.user_subscriptions` has one row per `user_id` (UUID primary key referencing
`auth.users`, cascading deletion). Base columns: `plan`, `status`,
`stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id`,
`stripe_checkout_session_id`, `created_at`, `updated_at`.

June groundwork adds `subscription_source`, `revenuecat_app_user_id`,
`revenuecat_product_id`, `revenuecat_entitlement_ids`, `revenuecat_store`,
`revenuecat_expires_at`, `revenuecat_event_id`, `revenuecat_last_event_at`.
July class migration adds `active_race_class`, `last_class_change_at`.

The base SQL enables RLS and an own-user SELECT policy, with no client write
policies. Class-selection SECURITY DEFINER functions update only class fields.
The migration history does not include the initial subscription table creation;
the root SQL must already have been applied. Actual deployed policies/triggers
cannot be inferred solely from these files.

Stripe webhook accepts checkout completion, subscription created/updated/deleted,
and invoice success/failure, verifying Stripe's HMAC. It upserts plan/status and
Stripe identifiers with `subscription_source='stripe'`. Existing writes do not
check returned database errors. There is no provider projection trigger or
RevenueCat webhook yet.

## Existing RevenueCat support

Only the June metadata migration and Stripe source annotation exist. No SDK,
purchase/restore UI, secret configuration, lifecycle handler, or app-user identity
synchronization is implemented. The June guardrail comments are not enforcement.

## Risks and implementation decisions

1. A single provider-owned plan/status can erase another paid provider. Preserve
   provider snapshots and atomically project to the existing fields. Active
   Stripe retains precedence; an inactive Stripe subscription must allow a valid
   native subscription to remain effective. Retain every Stripe identifier.
2. Concurrent, retried, and out-of-order events need transactional event IDs,
   ordering, and per-account serialization. Client success is never proof of paid
   access. Fetch RevenueCat's authoritative subscriber state on the server.
3. Median's main documentation omits login/logout, but its official live demo
   includes them. Verify official bridge definitions before implementation and
   require both operations at runtime. Do not repeatedly configure to switch users.
4. Existing native flag alone is not proof that a purchase bridge exists. Keep
   Stripe hidden when native mode is requested; unavailable/old bridges must fail
   closed. Supplement detection with Median's documented user-agent markers.
5. Keep localized prices and eligibility-dependent trials in the native paywall;
   do not advertise the hardcoded Stripe price/trial as a native store offer.
6. Existing membership metadata/localStorage includes client-controlled overrides,
   and account switching can race async membership writes. Those are existing
   limitations; native purchases must bind to the UUID and avoid stale-user writes.
7. Store configuration and real-device sandbox testing are deployment prerequisites.
   No credentials, app IDs, enabled plugin build versions, or store products have
   been verified from the repository.

## API evidence consulted

- https://docs.median.co/docs/revenue-cat
- https://median.dev/revenue-cat (official demo includes login/logout)
- https://github.com/gonativeio/median-javascript-bridge
- https://docs.median.co/docs/detecting-app-usage
- https://www.revenuecat.com/docs/integrations/webhooks
- https://www.revenuecat.com/docs/api-v1
