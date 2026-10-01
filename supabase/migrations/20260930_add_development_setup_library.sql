-- Development setup library. Apply AFTER active-class, beta feature and Custom Car migrations.
-- Adds no production class availability or subscription entitlements.
begin;

alter table public.race_setups add column if not exists custom_fields jsonb;

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
    'winged sprint cars'
  ]::text[]);
$$;

-- Exactly the existing experimental-account gate. Tier/admin/email/DEV do not qualify.
create or replace function public.onlyfast_can_use_setup_library()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.beta_tester_accounts bta
    join public.user_feature_flags uff on uff.user_id = bta.user_id
    where bta.user_id = auth.uid()
      and bta.is_test_account = true and bta.beta_features_enabled = true
      and bta.tester_kind = 'experimental'
      and uff.feature_key = 'test_account_full_access' and uff.enabled = true
  );
$$;

-- Both existing initialize/change RPCs call this function before writing.
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
    'Winged Sprint Cars'
  ]::text[]) classes(class_name)
  where lower(class_name) = lower(trim(coalesce(p_class, '')))
    and (not public.onlyfast_is_development_setup_class(class_name)
      or public.onlyfast_can_use_setup_library())
  limit 1;
$$;

-- Restrictive policy ANDs with ALL pre-existing permissive owner/share policies.
-- This also blocks anonymous public-share reads and normal Team/admin accounts.
drop policy if exists race_setups_development_library_gate on public.race_setups;
create policy race_setups_development_library_gate on public.race_setups
as restrictive for all to public
using (
  (not public.onlyfast_is_development_setup_class(race_class)
    and not coalesce(custom_fields ? 'onlyfast_setup_library_v1', false))
  or public.onlyfast_can_use_setup_library()
)
with check (
  (not public.onlyfast_is_development_setup_class(race_class)
    and not coalesce(custom_fields ? 'onlyfast_setup_library_v1', false))
  or public.onlyfast_can_use_setup_library()
);

-- Defense against direct writes and owner-trigger changes, including bypassing
-- the class-change RPC through user_subscriptions. No existing rows are changed.
create or replace function public.onlyfast_guard_development_setup_class()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if TG_TABLE_NAME = 'race_setups' then
    if (public.onlyfast_is_development_setup_class(new.race_class)
        or coalesce(new.custom_fields ? 'onlyfast_setup_library_v1', false))
      and not public.onlyfast_can_use_setup_library() then
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
    and not public.onlyfast_can_use_setup_library() then
    raise exception 'SETUP_LIBRARY_TEST_ACCOUNT_REQUIRED' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_development_setup_library on public.race_setups;
create trigger guard_development_setup_library before insert or update on public.race_setups
for each row execute function public.onlyfast_guard_development_setup_class();
drop trigger if exists guard_development_active_class on public.user_subscriptions;
create trigger guard_development_active_class before insert or update of active_race_class on public.user_subscriptions
for each row execute function public.onlyfast_guard_development_setup_class();

-- SECURITY DEFINER summaries bypass row policies; explicitly filter here too.
create or replace function public.list_user_setup_summaries()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'created_at', r.created_at, 'updated_at', r.updated_at,
    'setup_type', r.setup_type, 'setup_name', r.setup_name,
    'session_label', r.session_label, 'session_order', r.session_order,
    'track_name', r.track_name, 'race_date', r.race_date, 'race_class', r.race_class
  ) order by r.created_at desc), '[]'::jsonb)
  from public.race_setups r
  where r.user_id = auth.uid()
    and ((not public.onlyfast_is_development_setup_class(r.race_class)
      and not coalesce(r.custom_fields ? 'onlyfast_setup_library_v1', false))
      or public.onlyfast_can_use_setup_library());
$$;

revoke all on function public.onlyfast_is_development_setup_class(text) from public;
revoke all on function public.onlyfast_can_use_setup_library() from public;
revoke all on function public.onlyfast_guard_development_setup_class() from public;
revoke all on function public.onlyfast_canonical_race_class(text) from public;
grant execute on function public.onlyfast_is_development_setup_class(text) to anon, authenticated;
grant execute on function public.onlyfast_can_use_setup_library() to anon, authenticated;
grant execute on function public.onlyfast_canonical_race_class(text) to authenticated;
notify pgrst, 'reload schema';
commit;
