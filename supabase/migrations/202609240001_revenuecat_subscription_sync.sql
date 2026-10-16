-- Apply after SUBSCRIPTIONS_RLS.sql and the June RevenueCat preparation migration.
begin;

alter table public.user_subscriptions
  add column if not exists stripe_plan text,
  add column if not exists stripe_status text,
  add column if not exists revenuecat_plan text,
  add column if not exists revenuecat_status text,
  add column if not exists revenuecat_observed_at timestamptz;

update public.user_subscriptions
set stripe_plan = plan, stripe_status = status
where stripe_plan is null and (
  subscription_source = 'stripe'
  or (subscription_source is null and (stripe_subscription_id is not null or stripe_customer_id is not null))
);

-- Retain existing native data if the groundwork was used outside this repository.
update public.user_subscriptions
set revenuecat_plan = plan, revenuecat_status = status
where subscription_source = 'revenuecat' and revenuecat_plan is null;

create table public.revenuecat_webhook_events (
  event_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  event_at timestamptz not null,
  processed_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.revenuecat_webhook_events enable row level security;
revoke all on public.revenuecat_webhook_events from public, anon, authenticated;
grant all on public.revenuecat_webhook_events to service_role;

-- Existing Stripe upserts continue to use plan/status. Capture their provider
-- snapshot, then resolve the existing effective fields under the row write lock.
-- Native RPC writes its own snapshot directly. Unrelated class writes do nothing.
-- The deployed Stripe webhook predates subscription_source. Recognize writes
-- that explicitly include Stripe identifiers, even when their values did not
-- change. Trigger names ensure this runs before provider projection. Never infer
-- Stripe ownership merely from OLD identifiers during a native sync.
create function public.onlyfast_capture_stripe_source()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.stripe_customer_id is not null or new.stripe_subscription_id is not null
    or new.stripe_checkout_session_id is not null then
    new.subscription_source := 'stripe';
  end if;
  return new;
end;
$$;
revoke all on function public.onlyfast_capture_stripe_source() from public, anon, authenticated;
create trigger onlyfast_capture_stripe_source
before insert or update of stripe_customer_id, stripe_subscription_id, stripe_price_id, stripe_checkout_session_id
on public.user_subscriptions
for each row execute function public.onlyfast_capture_stripe_source();

create function public.onlyfast_project_subscription()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.subscription_source = 'stripe' then
    new.stripe_plan := new.plan;
    new.stripe_status := new.status;
  end if;

  if new.stripe_plan in ('pro', 'teams') and new.stripe_status in ('active', 'trialing') then
    new.plan := new.stripe_plan;
    new.status := new.stripe_status;
    new.subscription_source := 'stripe';
  elsif new.revenuecat_plan in ('pro', 'teams') and new.revenuecat_status = 'active'
    and new.revenuecat_expires_at > now() then
    new.plan := new.revenuecat_plan;
    new.status := 'active';
    new.subscription_source := 'revenuecat';
  elsif new.subscription_source = 'revenuecat' then
    new.plan := 'free';
    new.status := 'expired';
  end if;
  return new;
end;
$$;
create trigger onlyfast_project_subscription
before insert or update of plan, status, subscription_source on public.user_subscriptions
for each row execute function public.onlyfast_project_subscription();

-- One transaction covers deduplication, ordering, metadata and effective access.
-- observed_at is RevenueCat's server response timestamp, never a browser timestamp.
create function public.onlyfast_apply_revenuecat(
  p_user_id uuid, p_snapshot jsonb, p_event_id text default null,
  p_event_type text default 'SYNC', p_event_at timestamptz default null
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_row public.user_subscriptions%rowtype;
  v_observed timestamptz := (p_snapshot ->> 'observed_at')::timestamptz;
begin
  if v_observed is null or not coalesce(p_snapshot ->> 'plan' in ('free', 'pro', 'teams'), false)
    or not coalesce(p_snapshot ->> 'status' in ('active', 'expired'), false) then
    raise exception 'Invalid RevenueCat snapshot';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    return 'deleted_user';
  end if;
  insert into public.user_subscriptions(user_id) values (p_user_id) on conflict do nothing;
  select * into v_row from public.user_subscriptions where user_id = p_user_id for update;
  if p_event_id is not null then
    insert into public.revenuecat_webhook_events(event_id, user_id, event_type, event_at)
    values (p_event_id, p_user_id, p_event_type, p_event_at) on conflict do nothing;
    if not found then return 'duplicate'; end if;
  end if;
  if v_row.revenuecat_observed_at is not null and v_observed <= v_row.revenuecat_observed_at then
    return 'stale';
  end if;
  update public.user_subscriptions set
    revenuecat_plan = p_snapshot ->> 'plan',
    revenuecat_status = p_snapshot ->> 'status',
    revenuecat_app_user_id = p_user_id::text,
    revenuecat_product_id = p_snapshot ->> 'product_id',
    revenuecat_entitlement_ids = array(select jsonb_array_elements_text(p_snapshot -> 'entitlement_ids')),
    revenuecat_store = p_snapshot ->> 'store',
    revenuecat_expires_at = (p_snapshot ->> 'expires_at')::timestamptz,
    revenuecat_observed_at = v_observed,
    revenuecat_event_id = coalesce(p_event_id, revenuecat_event_id),
    revenuecat_last_event_at = greatest(p_event_at, revenuecat_last_event_at),
    subscription_source = 'revenuecat',
    updated_at = now()
  where user_id = p_user_id;
  return 'applied';
end;
$$;
revoke all on function public.onlyfast_apply_revenuecat(uuid, jsonb, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.onlyfast_apply_revenuecat(uuid, jsonb, text, text, timestamptz) to service_role;

-- Expiration safety net if a store webhook is delayed or exhausted its retries.
create function public.onlyfast_expire_revenuecat()
returns void language sql security definer set search_path = public as $$
  update public.user_subscriptions
  set subscription_source = 'revenuecat', updated_at = now()
  where subscription_source = 'revenuecat' and status = 'active'
    and revenuecat_expires_at <= now();
$$;
revoke all on function public.onlyfast_expire_revenuecat() from public, anon, authenticated;
grant execute on function public.onlyfast_expire_revenuecat() to service_role;

-- Enforce the documented subscription write boundary even if the original table
-- grants were broader. Existing class RPCs run as their definer and still work.
-- RLS does not govern TRUNCATE. Remove every client write privilege, including
-- inherited PUBLIC grants, then explicitly expose only the own-row read API.
revoke all on public.user_subscriptions from public, anon, authenticated;
grant select on public.user_subscriptions to authenticated;
grant select, insert, update, delete on public.user_subscriptions to service_role;
commit;
