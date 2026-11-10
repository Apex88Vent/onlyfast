-- Prepared for review; apply only with the compatible frontend after QA.
-- Requires Phase 1 membership authorization. Never writes billing or setup rows.
begin;
do $$
begin
  if to_regprocedure('onlyfast_private.membership_tier(uuid)') is null
    or to_regprocedure('public.onlyfast_membership_for_user(uuid)') is null then
    raise exception 'TEST_TIER_REQUIRES_PHASE1_MEMBERSHIP';
  end if;
end;
$$;
alter table public.beta_tester_accounts
  add column test_subscription_tier text check (test_subscription_tier in ('rookie','pro','team'));

-- Internal resolver: only existing explicit experimental grants qualify.
-- Null selections retain legacy Team access until a tester chooses a tier.
create or replace function onlyfast_private.test_subscription_tier(p_uid uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(b.test_subscription_tier, 'team')
  from public.beta_tester_accounts b join public.user_feature_flags f on f.user_id=b.user_id
  where b.user_id=p_uid and b.is_test_account and b.beta_features_enabled
    and b.tester_kind='experimental' and f.feature_key='test_account_full_access' and f.enabled;
$$;
revoke all on function onlyfast_private.test_subscription_tier(uuid) from public, anon, authenticated;

create or replace function onlyfast_private.get_test_tier()
returns text language sql stable security definer set search_path = '' as $$
  select onlyfast_private.test_subscription_tier(auth.uid());
$$;
revoke all on function onlyfast_private.get_test_tier() from public, anon;
grant execute on function onlyfast_private.get_test_tier() to authenticated;

create or replace function onlyfast_private.set_test_tier(p_tier text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or onlyfast_private.test_subscription_tier(v_uid) is null then
    raise exception 'TEST_ACCOUNT_REQUIRED' using errcode='42501';
  end if;
  if p_tier is null or p_tier not in ('rookie','pro','team') then
    raise exception 'TEST_TIER_INVALID' using errcode='22023';
  end if;
  update public.beta_tester_accounts set test_subscription_tier=p_tier where user_id=v_uid;
  return p_tier;
end;
$$;
revoke all on function onlyfast_private.set_test_tier(text) from public, anon;
grant execute on function onlyfast_private.set_test_tier(text) to authenticated;

-- Exposed wrappers run as the caller; privileged code stays in the private schema.
create or replace function public.get_onlyfast_test_tier()
returns text language sql stable security invoker set search_path = '' as $$
  select onlyfast_private.get_test_tier();
$$;
create or replace function public.set_onlyfast_test_tier(p_tier text)
returns text language sql security invoker set search_path = '' as $$
  select onlyfast_private.set_test_tier(p_tier);
$$;
revoke all on function public.get_onlyfast_test_tier() from public, anon;
revoke all on function public.set_onlyfast_test_tier(text) from public, anon;
grant execute on function public.get_onlyfast_test_tier() to authenticated;
grant execute on function public.set_onlyfast_test_tier(text) to authenticated;

create or replace function onlyfast_private.membership_tier(p_user_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select case
    when onlyfast_private.test_subscription_tier(u.id) is not null then onlyfast_private.test_subscription_tier(u.id)
    when u.raw_app_meta_data ->> 'has_admin_full_access' = 'true' then 'admin'

    when (lower(s.plan) in ('team','teams') and lower(s.status) in ('active','trialing')
      and (s.subscription_source is distinct from 'revenuecat' or s.revenuecat_expires_at > now()))
      or (lower(u.raw_app_meta_data ->> 'promo_access_level') in ('team','teams','admin','admin_full_access')
        and case when nullif(u.raw_app_meta_data ->> 'promo_access_expires_at','') is null then true
          when pg_input_is_valid(u.raw_app_meta_data ->> 'promo_access_expires_at','timestamptz')
            then (u.raw_app_meta_data ->> 'promo_access_expires_at')::timestamptz > now()
          else false end) then 'team'
    when (lower(s.plan)='pro' and lower(s.status) in ('active','trialing')
      and (s.subscription_source is distinct from 'revenuecat' or s.revenuecat_expires_at > now()))
      or (lower(u.raw_app_meta_data ->> 'promo_access_level')='pro'
        and case when nullif(u.raw_app_meta_data ->> 'promo_access_expires_at','') is null then true
          when pg_input_is_valid(u.raw_app_meta_data ->> 'promo_access_expires_at','timestamptz')
            then (u.raw_app_meta_data ->> 'promo_access_expires_at')::timestamptz > now()
          else false end) then 'pro'
    else 'rookie' end
    from auth.users u left join public.user_subscriptions s on s.user_id=u.id
    where u.id=p_user_id), 'rookie');
$$;

revoke all on function onlyfast_private.membership_tier(uuid) from public, anon, authenticated;
grant execute on function onlyfast_private.membership_tier(uuid) to service_role;


create or replace function onlyfast_private.has_unlimited_vehicles(p_uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_uid = (select auth.uid())
    and (case when onlyfast_private.test_subscription_tier(p_uid) is not null
      then onlyfast_private.test_subscription_tier(p_uid) = 'team'
      else (public.onlyfast_subscription_tier(p_uid) in ('team','admin')
      or exists(select 1 from auth.users u where u.id=p_uid
        and u.raw_app_meta_data ->> 'onlyfast_vehicle_unlimited' = 'true'
        and case when nullif(u.raw_app_meta_data ->> 'onlyfast_vehicle_grant_expires_at','') is null then true
          when pg_input_is_valid(u.raw_app_meta_data ->> 'onlyfast_vehicle_grant_expires_at','timestamptz')
            then (u.raw_app_meta_data ->> 'onlyfast_vehicle_grant_expires_at')::timestamptz > now()
          else false end)) end);
$$;
revoke all on function onlyfast_private.has_unlimited_vehicles(uuid) from public, anon;
grant execute on function onlyfast_private.has_unlimited_vehicles(uuid) to authenticated;

commit;
