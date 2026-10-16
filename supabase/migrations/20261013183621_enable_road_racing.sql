-- Register stable Road Racing class IDs in existing validation helpers.
-- Reuses custom_fields JSONB; retains every historical class and all privileges.
-- Apply restore_racing_onboarding first for the full onboarding/class-change flow.
begin;

do $$
begin
  if to_regprocedure('public.onlyfast_canonical_race_class(text)') is null
    or to_regprocedure('public.onlyfast_is_development_setup_class(text)') is null
    or to_regprocedure('public.onlyfast_can_use_setup_library()') is null
    or to_regprocedure('public.onlyfast_race_discipline(text)') is null then
    raise exception 'Apply setup library and restore_racing_onboarding migrations before enable_road_racing';
  end if;
end;
$$;

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
    'road_ta2'
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
    'road_ta2'
  ]::text[]) classes(class_name)
  where lower(class_name) = lower(trim(coalesce(p_class, '')))
    and (not public.onlyfast_is_development_setup_class(class_name)
      or public.onlyfast_can_use_setup_library())
  limit 1;
$$;

create or replace function public.onlyfast_race_discipline(p_class text)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_class = any(array['Legends','Pavement Late Model','Pavement Modified','Stock Car / ARCA','Street Stock / Sportsman','Mini Stock / Compact']) then 'pavement_oval'
    when p_class = any(array['road_spec_miata','road_gt3','road_gt4','road_prototypes','road_formula_winged','road_formula_non_winged','road_karts','road_legends','road_tcr','road_ta2','GT3','GT4','Prototype','Radical / Sports Racer','Touring Car','Production Track Car','Time Attack','Formula Ford 1600 / FF1600','Formula Ford 2000 / FF2000','Formula Continental','F2000','Formula Mazda','Formula Vee','Formula Atlantic','Formula 4','Junior Formula','Shifter Kart','Clutch Kart']) then 'road_course'
    when p_class = any(array['Road Racing / Superbike','Supersport','Track Day Motorcycle','Supermoto','Flat Track','Mini Moto','Motocross']) then 'motorcycle'
    when p_class = any(array['RC 1/8 Buggy','RC 1/10 Buggy','RC 1/10 4WD Buggy','RC Short Course','RC Touring Car','RC Oval']) then 'rc'
    when p_class is not null then 'dirt_oval'
    else null
  end;
$$;

notify pgrst, 'reload schema';
commit;
