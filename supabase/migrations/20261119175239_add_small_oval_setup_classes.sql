-- Current-version small oval sheets. Additive: no saved rows or membership
-- columns are rewritten. Existing expanded classes retain their released state.
begin;

-- Preflight on 2026-11-19 confirmed this registration migration is unapplied
-- on shared projects. The production database retains the legacy library gate
-- and does not yet have the frontend's onboarding-progress RPCs. Add only that
-- missing compatibility; preserve its exact existing class-state/cooldown logic.
create schema if not exists onlyfast_private;
revoke all on schema onlyfast_private from public, anon;
grant usage on schema onlyfast_private to authenticated;
alter table public.user_subscriptions
  add column if not exists active_racing_discipline text,
  add column if not exists onboarding_step text,
  add column if not exists onboarding_discipline text,
  add column if not exists onboarding_race_class text,
  add column if not exists onboarding_plan text;

do $compatibility$
declare v_definition text;
begin
  if to_regprocedure('public.onlyfast_race_discipline(text)') is null then
    execute $ddl$create or replace function public.onlyfast_race_discipline(p_class text)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_class = any(array['Legends','Pavement Late Model','Pavement Modified','Stock Car / ARCA','Street Stock / Sportsman','Mini Stock / Compact']) then 'pavement_oval'
    when p_class = any(array['GT3','GT4','Prototype','Radical / Sports Racer','Touring Car','Production Track Car','Time Attack','Formula Ford 1600 / FF1600','Formula Ford 2000 / FF2000','Formula Continental','F2000','Formula Mazda','Formula Vee','Formula Atlantic','Formula 4','Junior Formula','Shifter Kart','Clutch Kart']) then 'road_course'
    when p_class = any(array['Road Racing / Superbike','Supersport','Track Day Motorcycle','Supermoto','Flat Track','Mini Moto','Motocross']) then 'motorcycle'
    when p_class = any(array['RC 1/8 Buggy','RC 1/10 Buggy','RC 1/10 4WD Buggy','RC Short Course','RC Touring Car','RC Oval']) then 'rc'
    when p_class is not null then 'dirt_oval'
    else null
  end;
$$;$ddl$;
  end if;
  if to_regprocedure('public.save_racing_onboarding_progress(text,text,text)') is null then
    if to_regprocedure('onlyfast_private.small_oval_legacy_class_state()') is null then
      select pg_get_functiondef('public.get_active_race_class_state()'::regprocedure) into v_definition;
      v_definition := replace(v_definition,
        'CREATE OR REPLACE FUNCTION public.get_active_race_class_state()',
        'CREATE OR REPLACE FUNCTION onlyfast_private.small_oval_legacy_class_state()');
      if v_definition not like '%FUNCTION onlyfast_private.small_oval_legacy_class_state()%' then
        raise exception 'Unexpected class-state definition; review before release';
      end if;
      execute v_definition;
      revoke all on function onlyfast_private.small_oval_legacy_class_state() from public, anon, authenticated;
    end if;
    execute $ddl$
      create or replace function public.get_active_race_class_state()
      returns jsonb language plpgsql stable security definer set search_path = '' as $state$
      declare v_state jsonb; v_s public.user_subscriptions%rowtype; v_step text;
      begin
        if auth.uid() is null then raise exception 'CLASS_AUTH_REQUIRED'; end if;
        v_state := onlyfast_private.small_oval_legacy_class_state();
        select * into v_s from public.user_subscriptions where user_id=auth.uid();
        v_step := coalesce(v_s.onboarding_step, case
          when v_state ->> 'active_class' is not null then 'complete'
          when exists(select 1 from auth.users where id=auth.uid() and raw_user_meta_data ->> 'onboarding_completed'='true') then 'discipline'
          else 'tutorial' end);
        return v_state || jsonb_build_object(
          'active_discipline', coalesce(v_s.active_racing_discipline, public.onlyfast_race_discipline(v_state ->> 'active_class')),
          'onboarding_step', v_step, 'onboarding_discipline', v_s.onboarding_discipline,
          'onboarding_race_class', v_s.onboarding_race_class);
      end;
      $state$;
    $ddl$;
  end if;
end;
$compatibility$;


-- Per-class release control, mirrored by smallOvalSetupSchemas.ts.
-- A reviewed Micro Sprint release changes ONLY its case to 'production'.
create or replace function public.onlyfast_small_oval_release_status(p_class text)
returns text language sql immutable set search_path = '' as $$
  select case lower(trim(coalesce(p_class, '')))
    when 'micro_sprint' then 'test'
    when 'quarter_midget' then 'test'
    when 'junior_sprint' then 'test'
    when 'mini_dwarf' then 'test'
    else null end;
$$;

-- Narrow SECURITY DEFINER lookup: only the caller's existing experimental
-- designation, never email, paid tier, admin status or user-editable claims.
create or replace function public.onlyfast_small_oval_class_allowed(p_class text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case public.onlyfast_small_oval_release_status(p_class)
    when 'disabled' then false
    when 'test' then auth.uid() is not null and exists (
      select 1 from public.beta_tester_accounts b
      join public.user_feature_flags f on f.user_id = b.user_id
      where b.user_id = auth.uid() and b.is_test_account and b.beta_features_enabled
        and b.tester_kind = 'experimental'
        and f.feature_key = 'test_account_full_access' and f.enabled
    )
    else true end;
$$;
revoke all on function public.onlyfast_small_oval_release_status(text) from public;
revoke all on function public.onlyfast_small_oval_class_allowed(text) from public;
grant execute on function public.onlyfast_small_oval_release_status(text) to anon, authenticated;
grant execute on function public.onlyfast_small_oval_class_allowed(text) to anon, authenticated;

create or replace function public.onlyfast_is_development_setup_class(p_class text)
returns boolean language sql immutable set search_path = '' as $$
  select lower(trim(coalesce(p_class, ''))) = any(array[
    'legends',
    'pavement late model',
    'pavement modified',
    'stock car / arca',
    'street stock / sportsman',
    'mini stock / compact',
    'gt3',
    'gt4',
    'prototype',
    'radical / sports racer',
    'touring car',
    'production track car',
    'time attack',
    'formula ford 1600 / ff1600',
    'formula ford 2000 / ff2000',
    'formula continental',
    'f2000',
    'formula mazda',
    'formula vee',
    'formula atlantic',
    'formula 4',
    'junior formula',
    'road racing / superbike',
    'supersport',
    'track day motorcycle',
    'supermoto',
    'flat track',
    'mini moto',
    'motocross',
    'rc 1/8 buggy',
    'rc 1/10 buggy',
    'rc 1/10 4wd buggy',
    'rc short course',
    'rc touring car',
    'rc oval',
    'winged sprint cars',
    'shifter kart',
    'clutch kart',
    'road_spec_miata',
    'road_gt3',
    'road_gt4',
    'road_prototypes',
    'road_formula_winged',
    'road_formula_non_winged',
    'road_karts',
    'road_legends',
    'road_tcr',
    'road_ta2',
    'micro_sprint', 'quarter_midget', 'junior_sprint', 'mini_dwarf'
  ]::text[]);
$$;

create or replace function public.onlyfast_canonical_race_class(p_class text)
returns text language sql stable security definer set search_path = '' as $$
  select class_name from unnest(array[
    'Custom Car', 'Dwarf Cars', 'Late Model', 'Lightning Sprints', 'Midgets',
    'Modified', 'Non-Wing Sprint Cars', 'Pro Stock', 'Pure Stock', 'Sport Compact', 'Sport Mod',
    'Legends',
    'Pavement Late Model',
    'Pavement Modified',
    'Stock Car / ARCA',
    'Street Stock / Sportsman',
    'Mini Stock / Compact',
    'GT3',
    'GT4',
    'Prototype',
    'Radical / Sports Racer',
    'Touring Car',
    'Production Track Car',
    'Time Attack',
    'Formula Ford 1600 / FF1600',
    'Formula Ford 2000 / FF2000',
    'Formula Continental',
    'F2000',
    'Formula Mazda',
    'Formula Vee',
    'Formula Atlantic',
    'Formula 4',
    'Junior Formula',
    'Road Racing / Superbike',
    'Supersport',
    'Track Day Motorcycle',
    'Supermoto',
    'Flat Track',
    'Mini Moto',
    'Motocross',
    'RC 1/8 Buggy',
    'RC 1/10 Buggy',
    'RC 1/10 4WD Buggy',
    'RC Short Course',
    'RC Touring Car',
    'RC Oval',
    'Winged Sprint Cars',
    'Shifter Kart',
    'Clutch Kart',
    'road_spec_miata',
    'road_gt3',
    'road_gt4',
    'road_prototypes',
    'road_formula_winged',
    'road_formula_non_winged',
    'road_karts',
    'road_legends',
    'road_tcr',
    'road_ta2',
    'micro_sprint', 'quarter_midget', 'junior_sprint', 'mini_dwarf'
  ]::text[]) classes(class_name)
  where lower(class_name) = lower(trim(coalesce(p_class, '')))
    and (not public.onlyfast_is_development_setup_class(class_name)
      or public.onlyfast_can_use_setup_library()
      or public.onlyfast_small_oval_release_status(class_name) = 'production')
    and public.onlyfast_small_oval_class_allowed(class_name)
  limit 1;
$$;

-- Canonical fallback stays Dirt; membership accepts every registered discipline.
-- Quarter Midget identity never contains the selected discipline.
create or replace function public.onlyfast_class_supports_discipline(p_class text, p_discipline text)
returns boolean language sql immutable set search_path = '' as $$
  select case when p_class = 'quarter_midget'
    then coalesce(p_discipline = any(array['dirt_oval','pavement_oval']), false)
    else coalesce(public.onlyfast_race_discipline(p_class) = p_discipline, false) end;
$$;
revoke all on function public.onlyfast_class_supports_discipline(text,text) from public;
grant execute on function public.onlyfast_class_supports_discipline(text,text) to authenticated;

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
    if v_class is null or not public.onlyfast_class_supports_discipline(v_class, p_discipline) then raise exception 'CLASS_INVALID'; end if;
  end if;
  update public.user_subscriptions set
    onboarding_step = p_step,
    onboarding_discipline = case when p_step = 'discipline' then null else p_discipline end,
    onboarding_race_class = case when p_step = 'plan' then v_class else null end
  where user_id = v_uid;
  return public.get_active_race_class_state();
end;
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
    or not public.onlyfast_class_supports_discipline(v_class, v_s.onboarding_discipline) then
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

-- Expose only missing progress endpoints; retain existing grants and wrappers.
do $wrappers$
begin
  if to_regprocedure('public.save_racing_onboarding_progress(text,text,text)') is null then
    execute $ddl$create function public.save_racing_onboarding_progress(p_step text, p_discipline text default null, p_class text default null)
      returns jsonb language sql security invoker set search_path = '' as $body$
        select onlyfast_private.save_racing_onboarding_progress(p_step,p_discipline,p_class);
      $body$;$ddl$;
  end if;
  if to_regprocedure('public.complete_racing_onboarding()') is null then
    execute $ddl$create function public.complete_racing_onboarding()
      returns jsonb language sql security invoker set search_path = '' as $body$
        select onlyfast_private.complete_racing_onboarding();
      $body$;$ddl$;
  end if;
end;
$wrappers$;
revoke all on function onlyfast_private.save_racing_onboarding_progress(text,text,text),
  onlyfast_private.complete_racing_onboarding(), public.save_racing_onboarding_progress(text,text,text),
  public.complete_racing_onboarding() from public, anon;
grant execute on function onlyfast_private.save_racing_onboarding_progress(text,text,text),
  onlyfast_private.complete_racing_onboarding(), public.save_racing_onboarding_progress(text,text,text),
  public.complete_racing_onboarding() to authenticated;

-- Legacy installations still gate every library snapshot globally. Permit only
-- individually production-released classes; never change the global library gate.
drop policy if exists race_setups_development_library_gate on public.race_setups;
create policy race_setups_development_library_gate on public.race_setups
as restrictive for all to public
using ((not public.onlyfast_is_development_setup_class(race_class)
  and not coalesce(custom_fields ? 'onlyfast_setup_library_v1', false))
  or public.onlyfast_can_use_setup_library()
  or public.onlyfast_small_oval_release_status(race_class) = 'production')
with check ((not public.onlyfast_is_development_setup_class(race_class)
  and not coalesce(custom_fields ? 'onlyfast_setup_library_v1', false))
  or public.onlyfast_can_use_setup_library()
  or public.onlyfast_small_oval_release_status(race_class) = 'production');

create or replace function public.onlyfast_guard_development_setup_class()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if TG_TABLE_NAME = 'race_setups' then
    if (public.onlyfast_is_development_setup_class(new.race_class)
        or coalesce(new.custom_fields ? 'onlyfast_setup_library_v1', false))
      and not public.onlyfast_can_use_setup_library()
      and public.onlyfast_small_oval_release_status(new.race_class) is distinct from 'production' then
      raise exception 'SETUP_LIBRARY_TEST_ACCOUNT_REQUIRED' using errcode = '42501';
    end if;
    if public.onlyfast_is_development_setup_class(new.race_class) then
      if new.custom_fields -> 'onlyfast_setup_library_v1' ->> 'version' is distinct from '1'
        or new.custom_fields -> 'onlyfast_setup_library_v1' ->> 'race_class' is distinct from new.race_class
        or jsonb_typeof(new.custom_fields -> 'onlyfast_setup_library_v1' -> 'values') is distinct from 'object' then
        raise exception 'SETUP_LIBRARY_SNAPSHOT_REQUIRED' using errcode = '22023';
      end if;
      if exists (select 1 from jsonb_each(new.custom_fields -> 'onlyfast_setup_library_v1' -> 'values') as fields(key, value)
        where jsonb_typeof(value) <> 'string') then
        raise exception 'SETUP_LIBRARY_VALUES_MUST_BE_STRINGS' using errcode = '22023';
      end if;
    end if;
  elsif public.onlyfast_is_development_setup_class(new.active_race_class)
    and not public.onlyfast_can_use_setup_library()
    and public.onlyfast_small_oval_release_status(new.active_race_class) is distinct from 'production' then
    raise exception 'SETUP_LIBRARY_TEST_ACCOUNT_REQUIRED' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Restrictive AND with existing ownership, sharing and active-class policies.
drop policy if exists race_setups_small_oval_release_gate on public.race_setups;
create policy race_setups_small_oval_release_gate on public.race_setups
as restrictive for all to public
using (public.onlyfast_small_oval_class_allowed(race_class))
with check (public.onlyfast_small_oval_class_allowed(race_class));

create or replace function onlyfast_private.guard_small_oval_class()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if TG_TABLE_NAME = 'race_setups' then
    if not public.onlyfast_small_oval_class_allowed(new.race_class) then
      raise exception 'SETUP_LIBRARY_TEST_ACCOUNT_REQUIRED' using errcode = '42501';
    end if;
    if new.race_class = 'micro_sprint' and coalesce(
      new.custom_fields -> 'onlyfast_setup_library_v1' -> 'values' ->> 'micro_configuration', ''
    ) not in ('winged','non_winged') then
      raise exception 'MICRO_CONFIGURATION_REQUIRED' using errcode = '22023';
    end if;
  elsif not public.onlyfast_small_oval_class_allowed(new.active_race_class) then
    raise exception 'SETUP_LIBRARY_TEST_ACCOUNT_REQUIRED' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function onlyfast_private.guard_small_oval_class() from public, anon, authenticated;
drop trigger if exists guard_small_oval_setup on public.race_setups;
create trigger guard_small_oval_setup before insert or update on public.race_setups
for each row execute function onlyfast_private.guard_small_oval_class();
drop trigger if exists guard_small_oval_active_class on public.user_subscriptions;
create trigger guard_small_oval_active_class before insert or update of active_race_class on public.user_subscriptions
for each row execute function onlyfast_private.guard_small_oval_class();

-- This SECURITY DEFINER summary bypasses RLS; apply the same narrow gate.
create or replace function public.list_user_setup_summaries()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'created_at', r.created_at, 'updated_at', r.updated_at,
    'setup_type', r.setup_type, 'setup_name', r.setup_name,
    'session_label', r.session_label, 'session_order', r.session_order,
    'track_name', r.track_name, 'race_date', r.race_date, 'race_class', r.race_class,
    'race_schedule_id', to_jsonb(r) -> 'race_schedule_id',
    'race_weekend_id', to_jsonb(r) -> 'race_weekend_id'
  ) order by r.created_at desc), '[]'::jsonb)
  from public.race_setups r where r.user_id = auth.uid()
    and public.onlyfast_small_oval_class_allowed(r.race_class);
$$;

notify pgrst, 'reload schema';
commit;
