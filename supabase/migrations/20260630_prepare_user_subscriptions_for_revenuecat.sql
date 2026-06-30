-- Prepare public.user_subscriptions for Stripe + RevenueCat coexistence.
--
-- Launch-safe notes:
-- - Additive only: no drops, renames, restrictive checks, or data deletion.
-- - Existing Stripe columns are preserved.
-- - Existing Stripe-owned rows are backfilled with subscription_source = 'stripe'
--   only when subscription_source is currently null.
--
-- Future RevenueCat webhook guardrails:
-- - Stripe webhook remains authoritative for Stripe-owned rows.
-- - RevenueCat webhook must not downgrade a row when subscription_source = 'stripe'
--   and status is active/trialing.
-- - RevenueCat webhook should only downgrade RevenueCat-owned rows, or rows with
--   no active Stripe ownership.

begin;

alter table public.user_subscriptions
  add column if not exists subscription_source text,
  add column if not exists revenuecat_app_user_id text,
  add column if not exists revenuecat_product_id text,
  add column if not exists revenuecat_entitlement_ids text[],
  add column if not exists revenuecat_store text,
  add column if not exists revenuecat_expires_at timestamptz,
  add column if not exists revenuecat_event_id text,
  add column if not exists revenuecat_last_event_at timestamptz;

comment on column public.user_subscriptions.subscription_source is
  'Subscription provider/source that currently owns this row, e.g. stripe or revenuecat. RevenueCat webhook must not downgrade active/trialing stripe-owned rows.';
comment on column public.user_subscriptions.revenuecat_app_user_id is
  'RevenueCat App User ID, expected to match the authenticated Supabase user id.';
comment on column public.user_subscriptions.revenuecat_product_id is
  'Last RevenueCat product id seen for this user.';
comment on column public.user_subscriptions.revenuecat_entitlement_ids is
  'RevenueCat entitlement ids used to map native purchases to OnlyFast plans.';
comment on column public.user_subscriptions.revenuecat_store is
  'RevenueCat store/provider for the native purchase, such as app_store or play_store.';
comment on column public.user_subscriptions.revenuecat_expires_at is
  'RevenueCat entitlement expiration time, when provided.';
comment on column public.user_subscriptions.revenuecat_event_id is
  'Last processed RevenueCat webhook event id for idempotency/audit visibility.';
comment on column public.user_subscriptions.revenuecat_last_event_at is
  'Timestamp of the last RevenueCat webhook event processed for this row.';

update public.user_subscriptions
set
  subscription_source = 'stripe',
  updated_at = coalesce(updated_at, now())
where subscription_source is null
  and (
    stripe_subscription_id is not null
    or stripe_customer_id is not null
    or stripe_checkout_session_id is not null
  );

commit;
