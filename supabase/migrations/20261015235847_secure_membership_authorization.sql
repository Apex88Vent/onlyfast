-- PENDING: operator-reviewed migration. Do not apply automatically.
-- Before rollout, review legacy promo/admin accounts against independent records
-- and put approved grants in auth.users.raw_app_meta_data (same field names).
-- Never backfill grants from raw_user_meta_data. No existing data is deleted.
begin;
create schema if not exists onlyfast_private;
revoke all on schema onlyfast_private from public, anon;
grant usage on schema onlyfast_private to authenticated;

create or replace function public.onlyfast_subscription_tier(p_user_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select case
    when u.raw_app_meta_data ->> 'has_admin_full_access' = 'true' then 'admin'
    when exists(select 1 from public.beta_tester_accounts b
      join public.user_feature_flags f on f.user_id = b.user_id
      where b.user_id=u.id and b.is_test_account and b.beta_features_enabled
        and b.tester_kind='experimental' and f.feature_key='test_account_full_access' and f.enabled) then 'team'
    when (lower(s.plan) in ('team','teams') and lower(s.status) in ('active','trialing')
      and (s.subscription_source is distinct from 'revenuecat' or s.revenuecat_expires_at > now()))
      or (lower(u.raw_app_meta_data ->> 'promo_access_level') in ('team','teams','admin','admin_full_access')
        and (nullif(u.raw_app_meta_data ->> 'promo_access_expires_at','') is null
          or (u.raw_app_meta_data ->> 'promo_access_expires_at')::timestamptz > now())) then 'team'
    when (lower(s.plan)='pro' and lower(s.status) in ('active','trialing')
      and (s.subscription_source is distinct from 'revenuecat' or s.revenuecat_expires_at > now()))
      or (lower(u.raw_app_meta_data ->> 'promo_access_level')='pro'
        and (nullif(u.raw_app_meta_data ->> 'promo_access_expires_at','') is null
          or (u.raw_app_meta_data ->> 'promo_access_expires_at')::timestamptz > now())) then 'pro'
    else 'rookie' end
    from auth.users u left join public.user_subscriptions s on s.user_id=u.id
    where u.id=p_user_id), 'rookie');
$$;
revoke all on function public.onlyfast_subscription_tier(uuid) from public, anon;
grant execute on function public.onlyfast_subscription_tier(uuid) to authenticated, service_role;

-- Own-account entry point for synchronous UI feature gates. Current database
-- records are used, including server-owned grants, regardless of JWT age.
create or replace function public.get_onlyfast_membership()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('tier', public.onlyfast_subscription_tier(u.id),
    'grant_level', u.raw_app_meta_data ->> 'promo_access_level',
    'grant_expires_at', u.raw_app_meta_data ->> 'promo_access_expires_at')
  from auth.users u where u.id = (select auth.uid());
$$;
revoke all on function public.get_onlyfast_membership() from public, anon;
grant execute on function public.get_onlyfast_membership() to authenticated;

-- Keep vehicle/class RLS aligned with the same trusted authorization.
create or replace function onlyfast_private.has_unlimited_vehicles(p_uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_uid = (select auth.uid())
    and public.onlyfast_subscription_tier(p_uid) in ('team','admin');
$$;
revoke all on function onlyfast_private.has_unlimited_vehicles(uuid) from public, anon;
grant execute on function onlyfast_private.has_unlimited_vehicles(uuid) to authenticated;
revoke insert, update, delete on public.user_subscriptions from public, anon, authenticated;
commit;
