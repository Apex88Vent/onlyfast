-- Restore server-backed onboarding and a single rolling 30-day vehicle change.
-- Reuses user_subscriptions and race_class; never rewrites historical setup rows.
begin;

alter table public.user_subscriptions
  add column if not exists active_racing_discipline text,
  add column if not exists onboarding_step text,
  add column if not exists onboarding_discipline text,
  add column if not exists onboarding_race_class text,
  add column if not exists onboarding_plan text;

create schema if not exists onlyfast_private;
revoke all on schema onlyfast_private from public, anon;
grant usage on schema onlyfast_private to authenticated;

-- Legacy promo/admin claims require an operator review before rollout.
-- Never promote user-editable metadata to a server-owned authorization grant.
-- Approved grants belong in raw_app_meta_data; no user data is changed here.

create or replace function onlyfast_private.has_unlimited_vehicles(p_uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_uid = auth.uid() and exists(
    select 1 from auth.users u left join public.user_subscriptions s on s.user_id = u.id
    where u.id = p_uid and (
      u.raw_app_meta_data ->> 'has_admin_full_access' = 'true'
      or (u.raw_app_meta_data ->> 'onlyfast_vehicle_unlimited' = 'true'
        and (nullif(u.raw_app_meta_data ->> 'onlyfast_vehicle_grant_expires_at','') is null
          or (u.raw_app_meta_data ->> 'onlyfast_vehicle_grant_expires_at')::timestamptz > now()))
      or (lower(s.plan) in ('team','teams') and lower(s.status) in ('active','trialing'))
      or exists(select 1 from public.beta_tester_accounts b
        join public.user_feature_flags f on f.user_id = b.user_id
        where b.user_id = u.id and b.is_test_account and b.beta_features_enabled
          and b.tester_kind = 'experimental' and f.feature_key = 'test_account_full_access' and f.enabled)
    ));
$$;
revoke all on function onlyfast_private.has_unlimited_vehicles(uuid) from public, anon;
grant execute on function onlyfast_private.has_unlimited_vehicles(uuid) to authenticated;
create or replace function public.onlyfast_has_unlimited_classes(p_user_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select onlyfast_private.has_unlimited_vehicles(p_user_id);
$$;

-- Existing, fully implemented sheets are released to all disciplines.
-- Account beta flags and paid entitlement resolution remain unchanged.
create or replace function public.onlyfast_can_use_setup_library()
returns boolean language sql immutable set search_path = '' as $$ select true $$;

create or replace function public.onlyfast_race_discipline(p_class text)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_class = any(array['Legends','Pavement Late Model','Pavement Modified','Stock Car / ARCA','Street Stock / Sportsman','Mini Stock / Compact']) then 'pavement_oval'
    when p_class = any(array['GT3','GT4','Prototype','Radical / Sports Racer','Touring Car','Production Track Car','Time Attack','Formula Ford 1600 / FF1600','Formula Ford 2000 / FF2000','Formula Continental','F2000','Formula Mazda','Formula Vee','Formula Atlantic','Formula 4','Junior Formula','Shifter Kart','Clutch Kart']) then 'road_course'
    when p_class = any(array['Road Racing / Superbike','Supersport','Track Day Motorcycle','Supermoto','Flat Track','Mini Moto','Motocross']) then 'motorcycle'
    when p_class = any(array['RC 1/8 Buggy','RC 1/10 Buggy','RC 1/10 4WD Buggy','RC Short Course','RC Touring Car','RC Oval']) then 'rc'
    when p_class is not null then 'dirt_oval'
    else null
  end;
$$;

create or replace function public.get_active_race_class_state()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_active text;
  v_s public.user_subscriptions%rowtype;
  v_tier text;
  v_unlimited boolean;
  v_next timestamptz;
  v_step text;
begin
  if v_uid is null then raise exception 'CLASS_AUTH_REQUIRED'; end if;
  select * into v_s from public.user_subscriptions where user_id = v_uid;
  v_active := public.onlyfast_active_race_class(v_uid);
  v_tier := public.onlyfast_subscription_tier(v_uid);
  v_unlimited := public.onlyfast_has_unlimited_classes(v_uid);
  -- 720 hours is an exact rolling period, including daylight-saving changes.
  v_next := case when v_s.last_class_change_at is null then null else v_s.last_class_change_at + interval '720 hours' end;
  -- NULL progress identifies legacy accounts, which must never be re-onboarded
  -- when a class is already configured (including class inferred from history).
  v_step := coalesce(v_s.onboarding_step, case
    when v_active is not null then 'complete'
    when exists(select 1 from auth.users where id = v_uid and raw_user_meta_data ->> 'onboarding_completed' = 'true') then 'discipline'
    else 'tutorial' end);
  return jsonb_build_object(
    'active_class', v_active,
    'active_discipline', coalesce(v_s.active_racing_discipline, public.onlyfast_race_discipline(v_active)),
    'tier', v_tier, 'unlimited', v_unlimited,
    'last_class_change_at', v_s.last_class_change_at,
    'next_eligible_at', case when v_unlimited then null else v_next end,
    'can_change', v_unlimited or v_next is null or now() >= v_next,
    'onboarding_step', v_step,
    'onboarding_discipline', v_s.onboarding_discipline,
    'onboarding_race_class', v_s.onboarding_race_class);
end;
$$;

create schema if not exists onlyfast_private;
revoke all on schema onlyfast_private from public, anon;
grant usage on schema onlyfast_private to authenticated;

create or replace function onlyfast_private.save_racing_onboarding_progress(p_step text, p_discipline text, p_class text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_s public.user_subscriptions%rowtype;
  v_class text;
begin
  if v_uid is null then raise exception 'CLASS_AUTH_REQUIRED'; end if;
  if p_step not in ('discipline','vehicle','plan') or p_step is null then raise exception 'ONBOARDING_STEP_INVALID'; end if;
  if (public.get_active_race_class_state() ->> 'onboarding_step') = 'complete' then return public.get_active_race_class_state(); end if;
  insert into public.user_subscriptions(user_id, plan, status, onboarding_step)
    values(v_uid, 'free', 'inactive', 'tutorial') on conflict(user_id) do nothing;
  select * into v_s from public.user_subscriptions where user_id = v_uid for update;
  if (public.get_active_race_class_state() ->> 'onboarding_step') = 'complete' then
    return public.get_active_race_class_state();
  end if;
  if p_step in ('vehicle','plan') and (p_discipline is null or p_discipline not in ('dirt_oval','pavement_oval','road_course','motorcycle','rc')) then
    raise exception 'DISCIPLINE_INVALID';
  end if;
  if p_step = 'plan' then
    v_class := public.onlyfast_canonical_race_class(p_class);
    if v_class is null or public.onlyfast_race_discipline(v_class) is distinct from p_discipline then raise exception 'CLASS_INVALID'; end if;
  end if;
  update public.user_subscriptions set
    onboarding_step = p_step,
    onboarding_discipline = case when p_step = 'discipline' then null else p_discipline end,
    onboarding_race_class = case when p_step = 'plan' then v_class else null end
  where user_id = v_uid;
  return public.get_active_race_class_state();
end;
$$;

create or replace function public.save_racing_onboarding_progress(p_step text, p_discipline text default null, p_class text default null)
returns jsonb language sql security invoker set search_path = '' as $$
  select onlyfast_private.save_racing_onboarding_progress(p_step, p_discipline, p_class);
$$;

create or replace function onlyfast_private.complete_racing_onboarding()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_s public.user_subscriptions%rowtype;
  v_class text;
  v_existing text;
begin
  if v_uid is null then raise exception 'CLASS_AUTH_REQUIRED'; end if;
  select * into v_s from public.user_subscriptions where user_id = v_uid for update;
  if (public.get_active_race_class_state() ->> 'onboarding_step') = 'complete' then return public.get_active_race_class_state(); end if;
  v_class := public.onlyfast_canonical_race_class(v_s.onboarding_race_class);
  if v_s.onboarding_step is distinct from 'plan' or v_class is null
    or public.onlyfast_race_discipline(v_class) is distinct from v_s.onboarding_discipline then
    raise exception 'ONBOARDING_INCOMPLETE';
  end if;
  v_existing := public.onlyfast_active_race_class(v_uid);
  -- Choosing Rookie records the onboarding choice only. Never downgrade an
  -- existing Stripe/native/promo membership or replace its billing columns.
  update public.user_subscriptions set
    active_race_class = coalesce(v_existing, v_class),
    active_racing_discipline = coalesce(public.onlyfast_race_discipline(v_existing), v_s.onboarding_discipline),
    onboarding_plan = 'rookie', onboarding_step = 'complete'
  where user_id = v_uid;
  return public.get_active_race_class_state();
end;
$$;

create or replace function public.complete_racing_onboarding()
returns jsonb language sql security invoker set search_path = '' as $$
  select onlyfast_private.complete_racing_onboarding();
$$;

create or replace function public.change_active_race_class(p_new_class text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_current text;
  v_last timestamptz;
  v_next timestamptz;
  v_unlimited boolean;
  v_class text;
begin
  if v_uid is null then raise exception 'CLASS_AUTH_REQUIRED'; end if;
  v_class := public.onlyfast_canonical_race_class(p_new_class);
  if v_class is null then raise exception 'CLASS_INVALID'; end if;
  insert into public.user_subscriptions(user_id, active_race_class)
    values(v_uid, public.onlyfast_active_race_class(v_uid)) on conflict(user_id) do nothing;
  select coalesce(nullif(trim(active_race_class), ''), public.onlyfast_active_race_class(v_uid)), last_class_change_at
    into v_current, v_last from public.user_subscriptions where user_id = v_uid for update;
  -- A no-op never consumes a change, even inside the cooldown.
  if lower(trim(coalesce(v_current, ''))) = lower(v_class) then return public.get_active_race_class_state(); end if;
  if v_current is null or (public.get_active_race_class_state() ->> 'onboarding_step') <> 'complete' then raise exception 'ONBOARDING_INCOMPLETE'; end if;
  v_unlimited := public.onlyfast_has_unlimited_classes(v_uid);
  v_next := v_last + interval '720 hours';
  if not v_unlimited and v_next is not null and now() < v_next then
    raise exception 'CLASS_CHANGE_COOLDOWN:%', to_char(v_next at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  end if;
  update public.user_subscriptions set active_race_class = v_class,
    active_racing_discipline = public.onlyfast_race_discipline(v_class),
    last_class_change_at = case when v_unlimited then last_class_change_at else now() end
  where user_id = v_uid;
  return public.get_active_race_class_state();
end;
$$;

-- Even other permissive share policies cannot expose an owner's inactive setup.
-- Summaries continue to list every saved file, with no permanent lock flags.
drop policy if exists race_setups_active_vehicle_guard on public.race_setups;
create policy race_setups_active_vehicle_guard on public.race_setups as restrictive for all to public
using (user_id <> (select auth.uid()) or (select auth.uid()) is null
  or public.onlyfast_can_access_setup_class(user_id, race_class))
with check ((select auth.uid()) = user_id and public.onlyfast_can_save_setup_class(user_id, race_class));

-- Keep locked file summaries visible, including their original schedule link.
-- JSON extraction is compatible with older installations lacking that column.
create or replace function public.list_user_setup_summaries()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'created_at', r.created_at, 'updated_at', r.updated_at,
    'setup_type', r.setup_type, 'setup_name', r.setup_name,
    'session_label', r.session_label, 'session_order', r.session_order,
    'track_name', r.track_name, 'race_date', r.race_date, 'race_class', r.race_class,
    'race_schedule_id', to_jsonb(r) -> 'race_schedule_id'
  ) order by r.created_at desc), '[]'::jsonb)
  from public.race_setups r where r.user_id = auth.uid();
$$;

-- Prevent reassociation of historical rows or inactive writes via stale tabs.
-- Lock the same subscription row used by the change RPC to serialize mutations.
create or replace function onlyfast_private.guard_setup_vehicle()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    if TG_OP = 'DELETE' then return old; end if;
    return new;
  end if;
  perform 1 from public.user_subscriptions where user_id = auth.uid() for update;
  if TG_OP = 'DELETE' then
    if old.user_id is distinct from auth.uid() or not public.onlyfast_can_access_setup_class(old.user_id, old.race_class) then
      raise exception 'SETUP_VEHICLE_LOCKED' using errcode = '42501';
    end if;
    return old;
  end if;
  if TG_OP = 'UPDATE' then
    if old.user_id is distinct from new.user_id or old.race_class is distinct from new.race_class then
      raise exception 'SETUP_VEHICLE_ASSOCIATION_IMMUTABLE' using errcode = '42501';
    end if;
  end if;
  if new.user_id is distinct from auth.uid() or not public.onlyfast_can_save_setup_class(new.user_id, new.race_class) then
    raise exception 'SETUP_VEHICLE_LOCKED' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_setup_vehicle on public.race_setups;
create trigger guard_setup_vehicle before insert or update or delete on public.race_setups
for each row execute function onlyfast_private.guard_setup_vehicle();

-- Direct client writes cannot set active class, reset timestamps, or alter
-- onboarding/billing data: subscription writes remain RPC/service-only.
revoke insert, update, delete on public.user_subscriptions from anon, authenticated;
revoke all on function public.get_active_race_class_state() from public, anon;
revoke all on function public.change_active_race_class(text) from public, anon;
revoke all on function public.initialize_active_race_class(text) from public, anon;
revoke all on function public.list_user_setup_summaries() from public, anon;
revoke all on function public.get_setup_class_lock_state(uuid) from public, anon;
revoke all on function onlyfast_private.save_racing_onboarding_progress(text,text,text) from public, anon;
revoke all on function onlyfast_private.complete_racing_onboarding() from public, anon;
revoke all on function onlyfast_private.guard_setup_vehicle() from public, anon, authenticated;
revoke all on function public.save_racing_onboarding_progress(text,text,text) from public, anon;
revoke all on function public.complete_racing_onboarding() from public, anon;
revoke all on function public.onlyfast_race_discipline(text) from public, anon;
grant execute on function onlyfast_private.save_racing_onboarding_progress(text,text,text) to authenticated;
grant execute on function onlyfast_private.complete_racing_onboarding() to authenticated;
grant execute on function public.save_racing_onboarding_progress(text,text,text) to authenticated;
grant execute on function public.complete_racing_onboarding() to authenticated;
grant execute on function public.onlyfast_race_discipline(text) to authenticated;
notify pgrst, 'reload schema';
commit;
