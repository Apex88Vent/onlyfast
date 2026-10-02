-- Add two kart classes to the existing experimental setup library.
-- The already-deployed development migration is unchanged. No account/row writes.
begin;
do $$
begin
  if to_regprocedure('public.onlyfast_is_development_setup_class(text)') is null
    or to_regprocedure('public.onlyfast_canonical_race_class(text)') is null
    or to_regprocedure('public.onlyfast_can_use_setup_library()') is null then
    raise exception 'Apply add_development_setup_library before add_development_kart_classes';
  end if;
end;
$$;

-- Existing restrictive RLS, subscription/setup triggers and summary filtering
-- call these helpers, so the same gate covers the additional classes.
-- CREATE OR REPLACE retains the existing function ownership and privileges.
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
    'clutch kart'
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
    'Clutch Kart'
  ]::text[]) classes(class_name)
  where lower(class_name) = lower(trim(coalesce(p_class, '')))
    and (not public.onlyfast_is_development_setup_class(class_name)
      or public.onlyfast_can_use_setup_library())
  limit 1;
$$;

notify pgrst, 'reload schema';
commit;
