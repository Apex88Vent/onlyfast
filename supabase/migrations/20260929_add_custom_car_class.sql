-- Add Custom Car to the existing class-lock allowlist. No rows or columns are changed.
-- Requires the existing 20260720 active-class migration. Safe to rerun.
begin;

create or replace function public.onlyfast_canonical_race_class(p_class text)
returns text
language sql
immutable
set search_path = public
as $$
  select class_name
  from unnest(array[
    'Dwarf Cars',
    'Late Model',
    'Lightning Sprints',
    'Midgets',
    'Modified',
    'Non-Wing Sprint Cars',
    'Pro Stock',
    'Pure Stock',
    'Sport Compact',
    'Sport Mod',
    'Custom Car'
  ]::text[]) as classes(class_name)
  where lower(class_name) = lower(trim(coalesce(p_class, '')))
  limit 1;
$$;

commit;
